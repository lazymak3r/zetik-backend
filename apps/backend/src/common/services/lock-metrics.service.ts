import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  ILockMetricsService,
  LockMetrics,
  LockStats,
  MetricEntry,
  ResourceStats,
} from '../interfaces/lock-metrics.interface';

/**
 * Service for collecting and analyzing lock performance metrics
 */
@Injectable()
export class LockMetricsService implements ILockMetricsService, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LockMetricsService.name);
  private readonly metrics: MetricEntry[] = [];
  private readonly maxMetricsSize = 10000; // Keep last 10k entries
  private readonly resourceExtensions = new Map<string, number>();
  private periodicLoggingInterval?: NodeJS.Timeout;

  onModuleInit() {
    // Start periodic logging every 60 seconds
    this.periodicLoggingInterval = setInterval(() => {
      this.logPeriodicStats();
    }, 60000);

    this.logger.log('Lock metrics service initialized with periodic logging enabled');
  }

  onModuleDestroy() {
    if (this.periodicLoggingInterval) {
      clearInterval(this.periodicLoggingInterval);
    }
  }

  /**
   * Record a lock acquisition attempt
   */
  recordLockAcquisition(metrics: LockMetrics): void {
    const entry: MetricEntry = {
      timestamp: Date.now(),
      resource: metrics.resource,
      acquisitionTimeMs: metrics.acquisitionTimeMs,
      holdTimeMs: metrics.holdTimeMs,
      success: metrics.success,
      extended: metrics.extended,
      extensionCount: metrics.extensionCount,
    };

    this.addMetricEntry(entry);

    // Log slow acquisitions
    if (metrics.success && metrics.acquisitionTimeMs > 1000) {
      this.logger.warn(
        `Slow lock acquisition for resource "${metrics.resource}": ${metrics.acquisitionTimeMs}ms`,
      );
    }
  }

  /**
   * Record a lock release
   */
  recordLockRelease(resource: string, holdTimeMs: number): void {
    // Find the most recent successful acquisition for this resource and update it
    for (let i = this.metrics.length - 1; i >= 0; i--) {
      const entry = this.metrics[i];
      if (entry.resource === resource && entry.success && entry.holdTimeMs === undefined) {
        entry.holdTimeMs = holdTimeMs;
        break;
      }
    }

    // Log long-held locks
    if (holdTimeMs > 5000) {
      this.logger.warn(`Lock held for extended period on resource "${resource}": ${holdTimeMs}ms`);
    }
  }

  /**
   * Record a lock extension
   */
  recordLockExtension(resource: string): void {
    const currentCount = this.resourceExtensions.get(resource) || 0;
    this.resourceExtensions.set(resource, currentCount + 1);

    // Log excessive extensions
    if ((currentCount + 1) % 10 === 0) {
      this.logger.warn(`Resource "${resource}" has been extended ${currentCount + 1} times`);
    }
  }

  /**
   * Record a lock failure
   */
  recordLockFailure(resource: string, reason: string): void {
    const entry: MetricEntry = {
      timestamp: Date.now(),
      resource,
      acquisitionTimeMs: 0,
      success: false,
      failureReason: reason,
    };

    this.addMetricEntry(entry);

    this.logger.debug(`Lock acquisition failed for resource "${resource}": ${reason}`);
  }

  /**
   * Get lock statistics for a specific resource or all resources
   */
  getLockStats(resource?: string): LockStats {
    if (resource) {
      return this.getResourceLockStats(resource);
    }

    return this.getGlobalLockStats();
  }

  /**
   * Get statistics for top contended resources
   */
  getTopContendedResources(limit = 10): ResourceStats[] {
    const resourceMap = new Map<string, MetricEntry[]>();

    // Group metrics by resource
    for (const entry of this.metrics) {
      const entries = resourceMap.get(entry.resource) || [];
      entries.push(entry);
      resourceMap.set(entry.resource, entries);
    }

    // Calculate stats for each resource
    const allResourceStats: ResourceStats[] = [];
    for (const [resource, entries] of resourceMap.entries()) {
      const stats = this.calculateResourceStats(resource, entries);
      allResourceStats.push(stats);
    }

    // Sort by contention rate (descending) and return top N
    return allResourceStats.sort((a, b) => b.contentionRate - a.contentionRate).slice(0, limit);
  }

  /**
   * Add a metric entry to the circular buffer
   */
  private addMetricEntry(entry: MetricEntry): void {
    this.metrics.push(entry);

    // Maintain circular buffer size
    if (this.metrics.length > this.maxMetricsSize) {
      this.metrics.shift();
    }
  }

  /**
   * Get statistics for a specific resource
   */
  private getResourceLockStats(resource: string): LockStats {
    const resourceMetrics = this.metrics.filter((m) => m.resource === resource);

    if (resourceMetrics.length === 0) {
      return this.getEmptyStats();
    }

    return this.calculateStats(resourceMetrics);
  }

  /**
   * Get global lock statistics across all resources
   */
  private getGlobalLockStats(): LockStats {
    // Calculate stats even if no metrics exist (we might have extensions without acquisitions)
    const stats =
      this.metrics.length === 0 ? this.getEmptyStats() : this.calculateStats(this.metrics);

    // Even if there are no metrics, we need to include extensions
    if (this.metrics.length === 0 && this.resourceExtensions.size > 0) {
      stats.totalExtensions = Array.from(this.resourceExtensions.values()).reduce(
        (sum, count) => sum + count,
        0,
      );
    }

    // Add per-resource breakdown
    const resourceMap = new Map<string, MetricEntry[]>();
    for (const entry of this.metrics) {
      const entries = resourceMap.get(entry.resource) || [];
      entries.push(entry);
      resourceMap.set(entry.resource, entries);
    }

    const resourceStats = new Map<string, ResourceStats>();
    for (const [resource, entries] of resourceMap.entries()) {
      resourceStats.set(resource, this.calculateResourceStats(resource, entries));
    }

    stats.resourceStats = resourceStats;

    return stats;
  }

  /**
   * Calculate statistics from a set of metric entries
   */
  private calculateStats(entries: MetricEntry[]): LockStats {
    const successful = entries.filter((m) => m.success);
    const failed = entries.filter((m) => !m.success);

    const totalAcquisitionTime = entries.reduce((sum, m) => sum + m.acquisitionTimeMs, 0);
    const entriesWithHoldTime = entries.filter((m) => m.holdTimeMs !== undefined);
    const totalHoldTime = entriesWithHoldTime.reduce((sum, m) => sum + (m.holdTimeMs || 0), 0);

    const totalExtensions = Array.from(this.resourceExtensions.values()).reduce(
      (sum, count) => sum + count,
      0,
    );

    return {
      totalAcquisitions: entries.length,
      successfulAcquisitions: successful.length,
      failedAcquisitions: failed.length,
      averageAcquisitionTime: entries.length > 0 ? totalAcquisitionTime / entries.length : 0,
      averageHoldTime:
        entriesWithHoldTime.length > 0 ? totalHoldTime / entriesWithHoldTime.length : 0,
      totalExtensions,
    };
  }

  /**
   * Calculate statistics for a specific resource
   */
  private calculateResourceStats(resource: string, entries: MetricEntry[]): ResourceStats {
    const successful = entries.filter((m) => m.success);
    const failed = entries.filter((m) => !m.success);

    const totalAcquisitionTime = entries.reduce((sum, m) => sum + m.acquisitionTimeMs, 0);
    const entriesWithHoldTime = entries.filter((m) => m.holdTimeMs !== undefined);
    const totalHoldTime = entriesWithHoldTime.reduce((sum, m) => sum + (m.holdTimeMs || 0), 0);

    return {
      resource,
      acquisitions: entries.length,
      successful: successful.length,
      failed: failed.length,
      avgAcquisitionTime: entries.length > 0 ? totalAcquisitionTime / entries.length : 0,
      avgHoldTime: entriesWithHoldTime.length > 0 ? totalHoldTime / entriesWithHoldTime.length : 0,
      extensions: this.resourceExtensions.get(resource) || 0,
      contentionRate: entries.length > 0 ? failed.length / entries.length : 0,
    };
  }

  /**
   * Get empty statistics object
   */
  private getEmptyStats(): LockStats {
    return {
      totalAcquisitions: 0,
      successfulAcquisitions: 0,
      failedAcquisitions: 0,
      averageAcquisitionTime: 0,
      averageHoldTime: 0,
      totalExtensions: 0,
    };
  }

  /**
   * Log periodic statistics
   */
  private logPeriodicStats(): void {
    const stats = this.getLockStats();

    if (stats.totalAcquisitions === 0) {
      return; // No metrics to report
    }

    this.logger.log('=== Lock Performance Statistics (Last 60s) ===');
    this.logger.log(`Total Acquisitions: ${stats.totalAcquisitions}`);
    this.logger.log(`Successful: ${stats.successfulAcquisitions}`);
    this.logger.log(`Failed: ${stats.failedAcquisitions}`);
    this.logger.log(
      `Success Rate: ${((stats.successfulAcquisitions / stats.totalAcquisitions) * 100).toFixed(2)}%`,
    );
    this.logger.log(`Avg Acquisition Time: ${stats.averageAcquisitionTime.toFixed(2)}ms`);
    this.logger.log(`Avg Hold Time: ${stats.averageHoldTime.toFixed(2)}ms`);
    this.logger.log(`Total Extensions: ${stats.totalExtensions}`);

    // Log top contended resources
    const topContended = this.getTopContendedResources(5);
    if (topContended.length > 0) {
      this.logger.log('=== Top Contended Resources ===');
      topContended.forEach((resourceStats, index) => {
        this.logger.log(
          `${index + 1}. ${resourceStats.resource} - Contention: ${(resourceStats.contentionRate * 100).toFixed(2)}%, ` +
            `Acquisitions: ${resourceStats.acquisitions}, Failed: ${resourceStats.failed}`,
        );
      });
    }
  }
}
