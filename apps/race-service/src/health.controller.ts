import { Controller, Get } from '@nestjs/common';

/**
 * Health check controller for race service
 */
@Controller('health')
export class HealthController {
  /**
   * Basic health check endpoint
   * Returns service status, uptime, memory usage, and process information
   *
   * @returns Health status
   */
  @Get()
  healthCheck() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      pid: process.pid,
      serviceName: 'race-service',
    };
  }

  /**
   * Liveness probe endpoint
   * Simple check to verify the process is alive
   *
   * @returns Liveness status
   */
  @Get('live')
  liveness() {
    return {
      status: 'alive',
      pid: process.pid,
      serviceName: 'race-service',
    };
  }

  /**
   * Readiness probe endpoint
   * Checks if the service is ready to accept traffic
   *
   * @returns Readiness status
   */
  @Get('ready')
  readiness() {
    return {
      status: 'ready',
      pid: process.pid,
      uptime: process.uptime(),
      serviceName: 'race-service',
    };
  }
}
