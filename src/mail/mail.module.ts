import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { MAIL_QUEUE } from '../common/constants/queue.constants';
import { MailQueueService } from './mail-queue.service';
import { MailProcessor } from './mail.processor';
import { MailService } from './mail.service';
import { EMAIL_PROVIDER_TOKEN } from './providers/email-provider.interface';
import { AuditModule } from '../modules/audit/audit.module';

@Global()
@Module({
  imports: [
    AuditModule,
    BullModule.registerQueueAsync({
      name: MAIL_QUEUE,
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('redis.host') || 'localhost',
          port: configService.get<number>('redis.port') || 6379,
          password: configService.get<string>('redis.password') || undefined,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    MailService,
    MailQueueService,
    MailProcessor,
    {
      provide: EMAIL_PROVIDER_TOKEN,
      useExisting: MailService,
    },
  ],
  exports: [MailService, MailQueueService, EMAIL_PROVIDER_TOKEN],
})
export class MailModule {}
