import { Request } from 'express';
import { SessionContext } from '../types/session-context.interface';

export function createSessionContext(req: Request): SessionContext {
  // Extract real IP if behind proxies, otherwise fallback to req.ip
  const ipAddress = (req.headers['x-forwarded-for'] || req.ip || '').toString().split(',')[0].trim();
  const userAgent = req.headers['user-agent'] || 'Unknown';

  return {
    ipAddress,
    userAgent,
  };
}
