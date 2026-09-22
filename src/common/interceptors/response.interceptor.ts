import {
  CallHandler,
  ExecutionContext,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map, type Observable } from 'rxjs';
import { STATUS_CODES } from 'node:http';
import type { Request, Response } from 'express';

type RequestWithId = Request & { requestId?: string; route?: { path?: string } };

interface SuccessResponseBody {
  success: true;
  statusCode: number;
  message: string;
  data: unknown;
  meta?: unknown;
  requestId?: string;
}

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestWithId>();

    return next.handle().pipe(
      map((payload) => {
        if (this.shouldSkip(request, response)) {
          return payload;
        }

        return this.wrap(payload, request, response);
      }),
    );
  }

  private shouldSkip(request: RequestWithId, response: Response): boolean {
    if (response.headersSent) {
      return true;
    }

    if (response.statusCode === HttpStatus.NO_CONTENT) {
      return true;
    }

    const routePath = request.route?.path;
    if (typeof routePath === 'string') {
      return routePath === '/' || routePath.indexOf('/', 1) === -1;
    }

    return request.path === '/';
  }

  private wrap(
    payload: unknown,
    request: RequestWithId,
    response: Response,
  ): SuccessResponseBody {
    const statusCode = response.statusCode;
    const body: SuccessResponseBody = {
      success: true,
      statusCode,
      message: this.statusText(statusCode),
      data: payload ?? null,
      requestId: request.requestId,
    };

    if (this.isPaginated(payload)) {
      return { ...body, data: payload.data, meta: payload.meta };
    }

    if (this.isMessageOnly(payload)) {
      return { ...body, message: payload.message, data: null };
    }

    return body;
  }

  private isPaginated(
    payload: unknown,
  ): payload is { data: unknown; meta: unknown } {
    return (
      this.isPlainObject(payload) &&
      Object.prototype.hasOwnProperty.call(payload, 'data') &&
      Object.prototype.hasOwnProperty.call(payload, 'meta')
    );
  }

  private isMessageOnly(payload: unknown): payload is { message: string } {
    return (
      this.isPlainObject(payload) &&
      typeof payload.message === 'string' &&
      Object.keys(payload).length === 1
    );
  }

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private statusText(status: number): string {
    return STATUS_CODES[status] ?? 'Success';
  }
}
