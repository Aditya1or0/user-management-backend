import { Provider } from '@nestjs/common';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

export const RedisProvider: Provider = {
  provide: REDIS_CLIENT,
  useFactory: () => {
    return new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT || 6379),
      password: process.env.REDIS_PASSWORD || undefined,

      maxRetriesPerRequest: 1,

      retryStrategy(times) {
        if (times > 3) {
          return null;
        }

        return Math.min(times * 100, 2000);
      },
    });
  },
};
