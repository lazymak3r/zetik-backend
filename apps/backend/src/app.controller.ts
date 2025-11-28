import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get('health')
  getHealth() {
    return { status: 'ok' };
  }

  @Get()
  getApiInfo() {
    return {
      name: 'Zetik Casino API',
      version: '1.0.0',
      description: 'API for Zetik Casino platform',
    };
  }
}
