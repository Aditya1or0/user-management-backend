import { Module } from '@nestjs/common';
import { MemberRepository } from './repositories/member.repository';
import { MembersService } from './services/members.service';
import { MembersController } from './controllers/members.controller';
import { DatabaseModule } from '../../database/database.module';
import { CacheModule } from '../../cache/cache.module';

@Module({
  imports: [DatabaseModule, CacheModule],
  controllers: [MembersController],
  providers: [MemberRepository, MembersService],
  exports: [MemberRepository, MembersService],
})
export class MembersModule {}
