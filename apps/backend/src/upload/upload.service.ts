import {
  CreateBucketCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
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
      await this.s3.send(new CreateBucketCommand({ Bucket: this.bucket }));
    }
  }

  async upload(file: any, directory?: string): Promise<string> {
    // Ensure bucket exists before uploading
    await this.ensureBucket();
    // Use default folder 'uploads' when missing or empty
    const dir = directory && directory.trim() ? directory.trim() : 'uploads';
    const originalName = file.originalname;
    const keyBase = `${dir}/${originalName}`;
    let key = keyBase;

    try {
      await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      const timestamp = Date.now();
      const parts = originalName.split('.');
      const ext = parts.pop();
      const name = parts.join('.');
      key = `${dir}/${name}-${timestamp}.${ext}`;
    } catch {
      // object does not exist, use original key
    }

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: 'public-read',
      }),
    );
    // Return path relative to bucket
    const publicBaseUrl = this.configService.get<string>('minio.publicStorageBaseUrl')!;
    return `${publicBaseUrl}/${key}`;
  }

  async uploadWithCustomKey(file: any, key: string): Promise<string> {
    // Ensure bucket exists before uploading
    await this.ensureBucket();

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: 'public-read',
      }),
    );

    // Return public URL
    const publicBaseUrl = this.configService.get<string>('minio.publicStorageBaseUrl')!;
    return `${publicBaseUrl}/${key}`;
  }

  async listFiles(directory?: string): Promise<string[]> {
    const prefix = directory && directory.trim() ? `${directory.trim()}/` : 'uploads/';
    const response = await this.s3.send(
      new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
      }),
    );
    return response.Contents?.map((item) => item.Key!) || [];
  }

  async deleteFile(key: string): Promise<void> {
    try {
      await this.s3.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
      this.logger.log(`Successfully deleted file: ${key}`);
    } catch (error) {
      this.logger.warn(`Failed to delete file ${key}:`, error);
    }
  }

  extractKeyFromUrl(url: string): string {
    const publicBaseUrl = this.configService.get<string>('minio.publicStorageBaseUrl')!;
    return url.replace(`${publicBaseUrl}/`, '');
  }
}
