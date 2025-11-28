import * as env from 'env-var';

export interface IRedisInstanceConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
}

export interface IRedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  instances?: IRedisInstanceConfig[];
}

/**
 * Parse Redis instances from environment variable
 * Format: REDIS_INSTANCES=host1:port1,host2:port2,host3:port3
 *
 * Example: REDIS_INSTANCES=redis-1:6379,redis-2:6379,redis-3:6379
 *
 * For production Redlock deployments, it is recommended to use 3-5 independent
 * Redis instances for Byzantine fault tolerance and safety guarantees.
 */
function parseRedisInstances(
  instancesStr: string | undefined,
  password: string | undefined,
  db: number,
): IRedisInstanceConfig[] | undefined {
  if (!instancesStr) {
    return undefined;
  }

  try {
    const instances = instancesStr.split(',').map((instance) => {
      const [host, portStr] = instance.trim().split(':');
      const port = parseInt(portStr, 10);

      if (!host || isNaN(port)) {
        throw new Error(`Invalid Redis instance format: ${instance}`);
      }

      return {
        host,
        port,
        password,
        db,
      };
    });

    if (instances.length === 0) {
      return undefined;
    }

    return instances;
  } catch (error) {
    throw new Error(
      `Failed to parse REDIS_INSTANCES: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

export const redisConfig = (): { redis: IRedisConfig } => {
  const host = env.get('REDIS_HOST').required().asString();
  const port = env.get('REDIS_PORT').required().asPortNumber();
  const password = env.get('REDIS_PASSWORD').asString();
  const db = env.get('REDIS_DB').default(0).asInt();
  const instancesStr = env.get('REDIS_INSTANCES').asString();

  const instances = parseRedisInstances(instancesStr, password, db);

  return {
    redis: {
      host,
      port,
      password,
      db,
      instances,
    },
  } as const;
};
