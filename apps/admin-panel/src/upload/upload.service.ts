import {
  CopyObjectCommand,
  CreateBucketCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class UploadService {
  private s3: S3Client;
  private bucket: string;

  constructor(private configService: ConfigService) {
    const endpoint = this.configService.get<string>('minio.endpoint')!;
    const port = this.configService.get<number>('minio.port')!;
    this.bucket = this.configService.get<string>('minio.bucket')!;
    const useSSL = this.configService.get<boolean>('minio.useSSL')!;
    const accessKey = this.configService.get<string>('minio.accessKey')!;
    const secretKey = this.configService.get<string>('minio.secretKey')!;

    const protocol = useSSL ? 'https' : 'http';
    this.s3 = new S3Client({
      endpoint: `${protocol}://${endpoint}:${port}`,
      region: 'us-east-1',
      credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
      forcePathStyle: true,
    });
    void this.ensureBucket();
  }

  private async ensureBucket() {
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      // If Access Denied, bucket exists but we don't have HeadBucket permission
      // if (error?.name === 'AccessDenied' || error?.$metadata?.httpStatusCode === 403) {
      //   console.warn(`Bucket "${this.bucket}" exists but HeadBucket permission denied. Continuing...`);
      //   return;
      // }
      // // If bucket doesn't exist, try to create it
      // try {
      await this.s3.send(new CreateBucketCommand({ Bucket: this.bucket }));
      // } catch (createError: any) {
      //   console.warn(`Could not create bucket "${this.bucket}":`, createError.message);
      // }
    }
  }

  async upload(file: any, directory?: string, overwrite?: boolean): Promise<string> {
    // Ensure bucket exists before uploading
    await this.ensureBucket();
    // Use default folder 'images' when missing or empty
    const dir = directory && directory.trim() ? directory.trim() : 'images';
    const originalName = (file.originalname || 'image').trim();
    const sanitizedName = this.sanitizeAndTruncateFileName(originalName);
    const key = overwrite
      ? `${dir}/${sanitizedName}`
      : await this.generateAvailableKey(dir, sanitizedName);

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: 'public-read',
      }),
    );

    return this.getPublicUrl(key);
  }

  async listFiles(directory?: string): Promise<string[]> {
    const prefix = directory && directory.trim() ? `${directory.trim()}/` : 'images/';
    const response = await this.s3.send(
      new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
      }),
    );
    return response.Contents?.map((item) => item.Key!) || [];
  }

  extractKeyFromUrl(url: string): string {
    const publicBaseUrl = this.configService.get<string>('minio.publicStorageBaseUrl')!;
    return url.replace(`${publicBaseUrl}/`, '');
  }

  async deleteFile(key: string): Promise<void> {
    await this.s3.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }

  async renameFile(
    oldKey: string,
    directory: string,
    desiredFileName: string,
    contentType?: string,
  ): Promise<{ key: string; url: string }> {
    await this.ensureBucket();

    const dir = directory.trim();
    const sanitizedFileName = desiredFileName.replace(/[\\/]+/g, '-').trim();
    if (!sanitizedFileName) {
      throw new Error('Target file name cannot be empty');
    }

    const targetKey = await this.generateAvailableKey(dir, sanitizedFileName, oldKey);
    if (targetKey === oldKey) {
      return { key: oldKey, url: this.getPublicUrl(oldKey) };
    }

    const copySource = `/${this.bucket}/${encodeURI(oldKey)}`;
    const copyCommand = new CopyObjectCommand({
      Bucket: this.bucket,
      CopySource: copySource,
      Key: targetKey,
      ACL: 'public-read',
      MetadataDirective: contentType ? 'REPLACE' : 'COPY',
      ...(contentType ? { ContentType: contentType } : {}),
    });

    await this.s3.send(copyCommand);
    await this.deleteFile(oldKey);

    return { key: targetKey, url: this.getPublicUrl(targetKey) };
  }

  private getPublicUrl(key: string): string {
    const publicBaseUrl = this.configService.get<string>('minio.publicStorageBaseUrl')!;
    return `${publicBaseUrl}/${key}`;
  }

  private async generateAvailableKey(
    directory: string,
    fileName: string,
    excludeKey?: string,
  ): Promise<string> {
    let candidateKey = `${directory}/${fileName}`;
    if (candidateKey === excludeKey) {
      return candidateKey;
    }

    const { name: baseNameRaw, extension: extRaw } = this.splitFileName(fileName);
    const baseName = baseNameRaw || 'image';
    const extension = extRaw;
    let attempt = 0;

    while (true) {
      try {
        await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: candidateKey }));
        const suffix = `-${Date.now() + attempt}`;
        const availableLength = 255 - suffix.length - (extension ? extension.length + 1 : 0);
        const truncatedBase = baseName.slice(0, Math.max(1, availableLength));
        const nextName = extension
          ? `${truncatedBase}${suffix}.${extension}`
          : `${truncatedBase}${suffix}`;
        candidateKey = `${directory}/${nextName}`;
        if (candidateKey === excludeKey) {
          attempt += 1;
          continue;
        }
        attempt += 1;
      } catch (error: any) {
        if (this.isNotFoundError(error)) {
          break;
        }
        throw error;
      }
    }

    return candidateKey;
  }

  private splitFileName(fileName: string): { name: string; extension: string } {
    const lastDot = fileName.lastIndexOf('.');
    if (lastDot <= 0 || lastDot === fileName.length - 1) {
      return { name: fileName, extension: '' };
    }
    return {
      name: fileName.slice(0, lastDot),
      extension: fileName.slice(lastDot + 1),
    };
  }

  private sanitizeFileName(fileName: string): string {
    const replacedSeparators = fileName.trim().replace(/[\\/]+/g, '-');
    const cleaned = replacedSeparators.replace(/[\r\n]+/g, ' ').replace(/[^A-Za-z0-9._-]+/g, '-');
    const collapsed = cleaned.replace(/-{2,}/g, '-');
    const stripped = collapsed.replace(/^[-.]+/, '').replace(/[-.]+$/, '');
    return stripped || 'image';
  }

  private sanitizeAndTruncateFileName(fileName: string): string {
    const sanitized = this.sanitizeFileName(fileName);
    const { name, extension } = this.splitFileName(sanitized);

    const baseName = name || 'image';
    const ext = extension ? extension.toLowerCase() : '';

    const limit = 255;
    if (!ext) {
      return baseName.length > limit ? baseName.slice(0, limit) : baseName;
    }

    const allowedBaseLength = limit - (ext.length + 1);
    const truncatedBase = baseName.slice(0, Math.max(1, allowedBaseLength));
    return `${truncatedBase}.${ext}`;
  }

  private isNotFoundError(error: any): boolean {
    const code = error?.$metadata?.httpStatusCode;
    const name = error?.name || error?.Code;
    return code === 404 || name === 'NotFound' || name === 'NoSuchKey';
  }
}
