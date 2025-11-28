import { config } from 'dotenv';
import { join } from 'path';
config({
  path: [join(process.cwd(), 'apps/backend/.env'), join(process.cwd(), '.env')],
});

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as express from 'express';
import { AdminPanelModule } from './admin-panel.module';
import { commonConfig } from './config/common.config';

async function bootstrap() {
  try {
    const app = await NestFactory.create(AdminPanelModule);

    const config = commonConfig();

    // Set global prefix for all routes
    app.setGlobalPrefix('v1');

    // Enable CORS
    app.enableCors({
      origin: config.corsOrigins,
      credentials: true,
    });

    // Serve static files for admin panel frontend
    const expressApp = app.getHttpAdapter().getInstance();
    const frontendBuildPath = join(__dirname, '..', '..', '..', 'frontend', 'admin-panel', 'build');
    expressApp.use('/v1/admin', express.static(frontendBuildPath));

    // History API fallback for SPA
    expressApp.get(/^\/v1\/admin(\/.*)?$/, (req, res) => {
      res.sendFile(join(frontendBuildPath, 'index.html'));
    });

    // Global validation pipe
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: false, // Allow extra fields for multipart/form-data uploads
      }),
    );

    // Swagger documentation
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Zetik Admin API')
      .setDescription('Admin panel API for Zetik casino platform')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api', app, document);

    const port = config.port;
    await app.listen(port);
    console.log(`✅ Admin API is running on: http://localhost:${port}`);
    console.log(`📚 API documentation: http://localhost:${port}/api`);
    console.log(`🎛️  Admin panel frontend: http://localhost:${port}/v1/admin`);
    console.log(`🔗 Backend URL: ${config.backendUrl}`);
  } catch (error) {
    console.error('❌ Failed to start Admin Panel:');

    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes('BACKEND_URL')) {
      console.error('🚨 BACKEND_URL environment variable is required!');
      console.error('💡 Please set BACKEND_URL (e.g., http://localhost:3000)');
    }

    if (errorMessage.includes('ADMIN_API_SECRET')) {
      console.error('🚨 ADMIN_API_SECRET environment variable is required!');
      console.error('💡 Please set ADMIN_API_SECRET (e.g., admin-secret-key)');
    }

    if (errorMessage.includes('ADMIN_PORT')) {
      console.error('🚨 ADMIN_PORT environment variable is required!');
      console.error('💡 Please set ADMIN_PORT (e.g., 3001)');
    }

    if (errorMessage.includes('ADMIN_CORS_ORIGINS')) {
      console.error('🚨 ADMIN_CORS_ORIGINS environment variable is required!');
      console.error(
        '💡 Please set ADMIN_CORS_ORIGINS (e.g., http://localhost:3001,http://localhost:3000)',
      );
    }

    console.error('\n📋 Example configuration (create .env file in apps/admin-panel/):');
    console.error('ADMIN_PORT=3001');
    console.error('ADMIN_CORS_ORIGINS=http://localhost:3001,http://localhost:3000');
    console.error('BACKEND_URL=http://localhost:3000');
    console.error('ADMIN_API_SECRET=admin-secret-key');
    console.error('\n📄 See apps/admin-panel/env.example for full configuration');

    process.exit(1);
  }
}

void bootstrap();
