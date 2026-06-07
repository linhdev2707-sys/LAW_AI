import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { IApiError } from '@law-ai/shared';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string = 'Internal server error';
    let errors: Record<string, string[]> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const r = res as Record<string, unknown>;
        message = (r.message as string) || message;
        if (Array.isArray(r.message)) {
          // class-validator returns array of strings
          message = 'Validation failed';
          errors = { _root: r.message as string[] };
        }
        if (r.errors && typeof r.errors === 'object') {
          errors = r.errors as Record<string, string[]>;
        }
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error(exception.stack);
    }

    const body: IApiError = {
      success: false,
      statusCode: status,
      message,
      errors,
      timestamp: new Date().toISOString(),
    };

    if (status >= 500) {
      this.logger.error(`${request.method} ${request.url} → ${status} ${message}`);
    } else {
      this.logger.warn(`${request.method} ${request.url} → ${status} ${message}`);
    }

    response.status(status).json(body);
  }
}
