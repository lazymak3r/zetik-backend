import { registerAs } from '@nestjs/config';
import { from } from 'env-var';

export default registerAs('minio', () => {
  const env = from(process.env);

  return {
    endpoint: env.get('MINIO_ENDPOINT').required().asString(),
    port: env.get('MINIO_PORT').required().asPortNumber(),
    accessKey: env.get('MINIO_ACCESS_KEY').required().asString(),
    secretKey: env.get('MINIO_SECRET_KEY').required().asString(),
    useSSL: env.get('MINIO_USE_SSL').required().asBool(),
    bucket: env.get('MINIO_BUCKET').required().asString(),
    publicStorageBaseUrl: env.get('PUBLIC_STORAGE_BASE_URL').required().asString(),
  };
});
