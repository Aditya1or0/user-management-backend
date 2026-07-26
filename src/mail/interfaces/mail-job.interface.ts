export interface InvitationEmailData {
  recipientEmail: string;
  organizationName: string;
  inviterName?: string;
  invitationUrl: string;
  expiresAt: Date | string;
}

export interface PasswordResetEmailData {
  recipientEmail: string;
  firstName?: string;
  resetUrl: string;
  otp?: string;
  expiresAt: Date | string;
}

export interface WelcomeEmailData {
  recipientEmail: string;
  firstName: string;
  organizationName?: string;
  loginUrl: string;
}

export interface LoginOtpEmailData {
  recipientEmail: string;
  firstName?: string;
  otp: string;
}
