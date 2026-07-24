export interface SendEmailPayload {
  to: string;
  subject: string;
  body: string;
  html?: string;
}

export interface IEmailProvider {
  sendEmail(payload: SendEmailPayload): Promise<boolean>;
}

export const EMAIL_PROVIDER_TOKEN = 'EMAIL_PROVIDER_TOKEN';
