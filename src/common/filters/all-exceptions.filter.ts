import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { EnvConfigService } from '../../config/env/env.service.js';
import type { Request, Response } from 'express';

type RequestWithId = Request & { requestId?: string };

interface ResolvedException {
  status: number;
  message: string;
  data: string[] | null;
  stack?: string;
}

interface ErrorResponseBody {
  success: false;
  statusCode: number;
  message: string;
  data: string[] | null;
  meta?: unknown;
  requestId?: string;
  timestamp: string;
  path: string;
  method: string;
  stack?: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  constructor(private readonly envConfigService: EnvConfigService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestWithId>();

    const resolved = this.resolveException(exception);

    this.log(request, resolved);

    if (response.headersSent) {
      return;
    }

    response.status(resolved.status).json(this.buildBody(resolved, request));
  }

  private buildBody(
    resolved: ResolvedException,
    request: RequestWithId,
  ): ErrorResponseBody {
    const isInternal = resolved.status >= HttpStatus.INTERNAL_SERVER_ERROR;
    const hideDetails = isInternal && !this.envConfigService.isDevelopment;

    return {
      success: false,
      statusCode: resolved.status,
      message: hideDetails ? 'Internal server error' : resolved.message,
      data: hideDetails ? null : resolved.data,
      requestId: request.requestId,
      timestamp: new Date().toISOString(),
      path: request.originalUrl,
      method: request.method,
      ...(this.envConfigService.isDevelopment && resolved.stack
        ? { stack: resolved.stack }
        : {}),
    };
  }

  private resolveException(exception: unknown): ResolvedException {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();

      if (typeof response === 'string') {
        return { status, message: response, data: null };
      }

      const payload = response as {
        message?: string | string[];
        error?: string;
      };

      if (Array.isArray(payload.message)) {
        return {
          status,
          message: 'Validation failed',
          data: payload.message,
        };
      }

      return {
        status,
        message: payload.message ?? exception.message,
        data: null,
      };
    }

    const errorObject = exception instanceof Error ? exception : undefined;

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: errorObject?.message ?? 'Internal server error',
      data: null,
      stack: errorObject?.stack,
    };
  }

  private log(request: RequestWithId, resolved: ResolvedException): void {
    const requestId = request.requestId ?? '-';
    const details = resolved.data?.length
      ? ` - ${resolved.data.join('; ')}`
      : '';
    const logMessage = `[${requestId}] ${resolved.status} ${request.method} ${request.originalUrl} - ${resolved.message}${details}`;

    if (resolved.status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(logMessage, resolved.stack);
    } else {
      this.logger.warn(logMessage);
    }
  }
}
