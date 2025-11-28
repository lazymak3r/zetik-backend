import cluster from 'cluster';
import { cpus } from 'os';

/**
 * Cluster mode entry point for main API
 * Spawns worker processes based on CPU count
 * Provides zero-downtime reload capabilities
 */

const DEFAULT_WORKERS = cpus().length;

function getWorkerCount(): number {
  const envWorkers = process.env.NODE_CLUSTER_WORKERS;

  if (!envWorkers) {
    return DEFAULT_WORKERS;
  }

  if (envWorkers === 'auto') {
    return DEFAULT_WORKERS;
  }

  const count = parseInt(envWorkers, 10);
  if (isNaN(count) || count < 1) {
    console.warn(`Invalid NODE_CLUSTER_WORKERS value: ${envWorkers}, using ${DEFAULT_WORKERS}`);
    return DEFAULT_WORKERS;
  }

  return count;
}

async function startCluster() {
  if (cluster.isPrimary) {
    const workerCount = getWorkerCount();
    console.log(
      `🚀 Master process ${process.pid} starting cluster mode with ${workerCount} workers`,
    );
    console.log(`📊 CPU count: ${cpus().length}`);

    // Track worker restart attempts to prevent restart loops
    // Use slot-based tracking (not worker.id which changes on every restart)
    const workerRestarts = new Map<number, { count: number; timestamp: number }>();
    const MAX_RESTARTS = 5;
    const RESTART_WINDOW = 60000; // 60 seconds

    // Fork workers and assign them to slots
    const workerSlots = new Map<number, number>(); // workerId -> slot
    for (let i = 0; i < workerCount; i++) {
      const worker = cluster.fork();
      workerSlots.set(worker.id, i);
    }

    // Handle worker exits
    cluster.on('exit', (worker, code, signal) => {
      const slot = workerSlots.get(worker.id) ?? 0;
      const restartInfo = workerRestarts.get(slot) || { count: 0, timestamp: Date.now() };

      if (code !== 0 && !signal) {
        console.error(`❌ Worker ${worker.process.pid} (slot ${slot}) died with code ${code}`);

        // Reset counter if outside restart window
        const now = Date.now();
        if (now - restartInfo.timestamp > RESTART_WINDOW) {
          restartInfo.count = 0;
          restartInfo.timestamp = now;
        }

        // Check if we should restart
        if (restartInfo.count < MAX_RESTARTS) {
          console.log(
            `🔄 Restarting worker slot ${slot} (restart ${restartInfo.count + 1}/${MAX_RESTARTS})`,
          );
          const newWorker = cluster.fork();
          workerSlots.set(newWorker.id, slot);
          workerRestarts.set(slot, {
            count: restartInfo.count + 1,
            timestamp: restartInfo.timestamp,
          });
        } else {
          console.error(
            `⚠️  Worker slot ${slot} exceeded max restarts (${MAX_RESTARTS}) within ${RESTART_WINDOW / 1000}s window, not restarting`,
          );
        }
      } else {
        console.log(`Worker ${worker.process.pid} (slot ${slot}) exited cleanly`);
      }

      // Clean up worker slot mapping
      workerSlots.delete(worker.id);
    });

    // Handle graceful shutdown
    const shutdown = (signal: string) => {
      console.log(`\n${signal} received, shutting down gracefully...`);

      // Stop accepting new connections
      for (const id in cluster.workers) {
        const worker = cluster.workers[id];
        if (worker) {
          worker.send({ type: 'shutdown' });
          worker.disconnect();
        }
      }

      // Give workers time to finish requests
      setTimeout(() => {
        console.log('Forcefully shutting down remaining workers');
        for (const id in cluster.workers) {
          const worker = cluster.workers[id];
          if (worker) {
            worker.kill();
          }
        }
        process.exit(0);
      }, 30000); // 30 second grace period
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Handle reload signal for zero-downtime deployment
    process.on('SIGUSR2', () => {
      console.log('📡 SIGUSR2 received, performing rolling restart...');

      const workers = Object.values(cluster.workers || {}).filter(
        (w): w is NonNullable<typeof w> => !!w,
      );
      let currentIndex = 0;

      const restartNext = () => {
        if (currentIndex >= workers.length) {
          console.log('✅ Rolling restart complete');
          return;
        }

        const worker = workers[currentIndex];
        const oldSlot = workerSlots.get(worker.id) ?? currentIndex;
        console.log(`🔄 Restarting worker ${worker.process.pid} (slot ${oldSlot})...`);

        // Fork new worker first
        const newWorker = cluster.fork();
        // Assign new worker to same slot as old worker
        workerSlots.set(newWorker.id, oldSlot);

        // Wait for new worker to be ready
        newWorker.once('listening', () => {
          console.log(`✅ New worker ${newWorker.process.pid} ready (slot ${oldSlot})`);

          // Gracefully disconnect old worker
          worker.disconnect();

          // Kill old worker after grace period if still alive
          setTimeout(() => {
            if (!worker.isDead()) {
              console.log(`⚠️  Force killing old worker ${worker.process.pid}`);
              worker.kill();
            }
          }, 5000);

          currentIndex++;
          restartNext();
        });
      };

      restartNext();
    });

    console.log('🎯 Master process ready. Workers starting...');
  } else {
    // Worker process - start the application
    await import('./main');

    // Handle shutdown message from master
    process.on('message', (msg: any) => {
      if (msg.type === 'shutdown') {
        console.log(`Worker ${process.pid} received shutdown signal`);
        // The main.ts bootstrap should handle graceful shutdown
      }
    });
  }
}

startCluster().catch((error) => {
  console.error('Failed to start cluster:', error);
  process.exit(1);
});
