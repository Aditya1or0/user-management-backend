import { Global, Module } from '@nestjs/common';
import { CacheService } from './cache.service';
import { RedisProvider } from './redis.provider';

@Global()
@Module({
  providers: [RedisProvider, CacheService],
  exports: [CacheService],
})
export class CacheModule {}
