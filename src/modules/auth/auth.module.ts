import { Module } from '@nestjs/common';
import { RegisterController } from './controllers/register.controller';
import { AuthService } from './services/auth.service';

@Module({
  controllers: [RegisterController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
