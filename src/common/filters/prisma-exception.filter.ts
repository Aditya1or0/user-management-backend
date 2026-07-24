import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { Prisma } from '@prisma/client';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    this.logger.error(
      `Prisma Exception [${exception.code}]: ${exception.message}`,
      exception.stack,
    );

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'An unexpected database error occurred.';

    switch (exception.code) {
      case 'P2002': {
        status = HttpStatus.CONFLICT;
        const target = Array.isArray(exception.meta?.target)
          ? (exception.meta.target as string[])
          : [];
        
        if (target.includes('email')) {
          message = 'Email is already registered';
        } else if (target.includes('slug')) {
          message = 'Organization slug collision occurred. Please try again.';
        } else {
          message = `A unique constraint conflict occurred on field(s): ${target.join(', ') || 'unknown'}.`;
        }
        break;
      }
      case 'P2025': {
        status = HttpStatus.NOT_FOUND;
        message = 'The requested database record was not found.';
        break;
      }
      case 'P2003': {
        status = HttpStatus.BAD_REQUEST;
        message = 'Invalid reference or foreign key constraint failure.';
        break;
      }
      default:
        break;
    }

    response.status(status).json({
      statusCode: status,
      message,
      error: HttpStatus[status],
      timestamp: new Date().toISOString(),
    });
  }
}
