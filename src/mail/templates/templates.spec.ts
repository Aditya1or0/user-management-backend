import { renderInvitationTemplate } from './invitation.template';
import { renderPasswordResetTemplate } from './password-reset.template';
import { renderWelcomeTemplate } from './welcome.template';

describe('Email Templates', () => {
  describe('renderInvitationTemplate', () => {
    it('should render invitation template with dynamic variables', () => {
      const result = renderInvitationTemplate({
        recipientEmail: 'user@example.com',
        organizationName: 'Acme Inc',
        inviterName: 'Alice',
        invitationUrl: 'http://localhost:3000/accept-invitation?token=raw123',
        expiresAt: new Date('2026-12-31T00:00:00Z'),
      });

      expect(result.subject).toContain('Acme Inc');
      expect(result.html).toContain('Alice');
      expect(result.html).toContain('http://localhost:3000/accept-invitation?token=raw123');
      expect(result.text).toContain('http://localhost:3000/accept-invitation?token=raw123');
    });
  });

  describe('renderPasswordResetTemplate', () => {
    it('should render password reset template with reset link and OTP', () => {
      const result = renderPasswordResetTemplate({
        recipientEmail: 'user@example.com',
        firstName: 'Bob',
        resetUrl: 'http://localhost:3000/reset-password?token=reset123',
        otp: '654321',
        expiresAt: new Date('2026-12-31T00:00:00Z'),
      });

      expect(result.subject).toContain('Reset Your Nimbus Password');
      expect(result.html).toContain('Bob');
      expect(result.html).toContain('654321');
      expect(result.html).toContain('http://localhost:3000/reset-password?token=reset123');
      expect(result.text).toContain('654321');
    });
  });

  describe('renderWelcomeTemplate', () => {
    it('should render welcome template correctly', () => {
      const result = renderWelcomeTemplate({
        recipientEmail: 'user@example.com',
        firstName: 'Charlie',
        organizationName: 'Stark Industries',
        loginUrl: 'http://localhost:3000/login',
      });

      expect(result.subject).toContain('Stark Industries');
      expect(result.html).toContain('Charlie');
      expect(result.html).toContain('http://localhost:3000/login');
      expect(result.text).toContain('Stark Industries');
    });
  });
});
