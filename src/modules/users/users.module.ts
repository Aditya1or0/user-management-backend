import { Module } from '@nestjs/common';
import { UserRepository } from './repositories/user.repository';
import { UsersController } from './controllers/users.controller';
import { DatabaseModule } from '../../database/database.module';
import { AuthorizationModule } from '../authorization/authorization.module';

@Module({
  imports: [DatabaseModule, AuthorizationModule],
  controllers: [UsersController],
  providers: [UserRepository],
  exports: [UserRepository],
})
export class UsersModule {}
