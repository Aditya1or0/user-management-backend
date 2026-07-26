import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';

describe('MailService', () => {
  let service: MailService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const mockConfig: Record<string, any> = {
                'mail.host': 'smtp.gmail.com',
                'mail.port': 587,
                'mail.secure': false,
                'mail.user': 'test@gmail.com',
                'mail.pass': 'secretpass',
                'mail.from': 'Nimbus <test@gmail.com>',
                'mail.frontendUrl': 'http://localhost:3000',
              };
              return mockConfig[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<MailService>(MailService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should call sendEmail and return true when transporter succeeds', async () => {
    jest.spyOn((service as any).transporter, 'sendMail').mockResolvedValueOnce({
      messageId: 'mock-message-id-123',
    });

    const result = await service.sendInvitationEmail({
      recipientEmail: 'invitee@example.com',
      organizationName: 'Test Org',
      inviterName: 'Admin',
      invitationUrl: 'http://localhost:3000/accept-invitation?token=rawtoken123',
      expiresAt: new Date(),
    });

    expect(result).toBe(true);
    expect((service as any).transporter.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'invitee@example.com',
        subject: expect.stringContaining('Test Org'),
      }),
    );
  });

  it('should throw error when transporter fails', async () => {
    jest.spyOn((service as any).transporter, 'sendMail').mockRejectedValueOnce(
      new Error('SMTP Connection Refused'),
    );

    await expect(
      service.sendWelcomeEmail({
        recipientEmail: 'newuser@example.com',
        firstName: 'John',
        organizationName: 'Acme Corp',
        loginUrl: 'http://localhost:3000/login',
      }),
    ).rejects.toThrow('SMTP Connection Refused');
  });
});
