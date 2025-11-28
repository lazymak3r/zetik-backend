import { Controller, Get, Query } from '@nestjs/common';
import cluster from 'cluster';
import { DistributedLockService } from '../services/distributed-lock.service';

/**
 * Health check and monitoring controller
 */
@Controller('health')
export class HealthController {
  constructor(private readonly lockService: DistributedLockService) {}

  /**
   * Get lock performance statistics
   *
   * @param resource - Optional resource identifier to filter stats
   * @returns Lock statistics
   *
   * @example
   * GET /health/locks
   * GET /health/locks?resource=user:123
   */
  @Get('locks')
  getLockStats(@Query('resource') resource?: string) {
    return this.lockService.getLockStats(resource);
  }

  /**
   * Get top contended lock resources
   *
   * @param limit - Maximum number of resources to return (default: 10)
   * @returns Array of resource statistics sorted by contention rate
   *
   * @example
   * GET /health/locks/contended
   * GET /health/locks/contended?limit=5
   */
  @Get('locks/contended')
  getTopContendedResources(@Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 10) : undefined;
    return this.lockService.getTopContendedResources(parsedLimit);
  }

  /**
   * Basic health check endpoint
   * Includes cluster mode information if running in cluster
   *
   * @returns Health status with cluster info
   */
  @Get()
  healthCheck() {
    const isClusterMode = process.env.NODE_CLUSTER_ENABLED === 'true';
    const baseHealth = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      pid: process.pid,
    };

    if (isClusterMode && cluster.isWorker) {
      return {
        ...baseHealth,
        cluster: {
          enabled: true,
          workerId: cluster.worker?.id,
          workerPid: process.pid,
          isWorker: true,
        },
      };
    }

    return {
      ...baseHealth,
      cluster: {
        enabled: isClusterMode,
        isWorker: false,
      },
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
    };
  }

  /**
   * Readiness probe endpoint
   * Checks if the worker is ready to accept traffic
   *
   * @returns Readiness status
   */
  @Get('ready')
  readiness() {
    // Add additional readiness checks here (database, redis, etc.)
    return {
      status: 'ready',
      pid: process.pid,
      uptime: process.uptime(),
    };
  }
}
