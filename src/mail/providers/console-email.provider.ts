import { Injectable, Logger } from '@nestjs/common';
import { IEmailProvider, SendEmailPayload } from './email-provider.interface';

@Injectable()
export class ConsoleEmailProvider implements IEmailProvider {
  private readonly logger = new Logger(ConsoleEmailProvider.name);

  async sendEmail(payload: SendEmailPayload): Promise<boolean> {
    this.logger.log(`[EMAIL DISPATCH] To: ${payload.to} | Subject: "${payload.subject}"`);
    this.logger.log(`[EMAIL BODY]: ${payload.body}`);
    return true;
  }
}
