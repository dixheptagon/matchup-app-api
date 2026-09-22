import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

type RequestWithId = Request & { requestId?: string };

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const start = process.hrtime.bigint();
    const requestId =
      (req.headers['x-request-id'] as string | undefined) ?? randomUUID();

    (req as RequestWithId).requestId = requestId;
    res.setHeader('X-Request-Id', requestId);

    const { method, originalUrl } = req;
    const userAgent = req.get('user-agent') ?? '-';
    const ip = req.ip ?? req.socket.remoteAddress ?? '-';

    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
      const { statusCode } = res;
      const contentLength = res.getHeader('content-length') ?? 0;

      const logContent = `${method} ${originalUrl} ${statusCode} - ${durationMs.toFixed(1)}ms [${requestId}] - ${ip} "${userAgent}" (${contentLength}b)`;

      if (statusCode >= 500) {
        this.logger.error(logContent);
      } else if (statusCode >= 400) {
        this.logger.warn(logContent);
      } else {
        this.logger.log(logContent);
      }
    });

    next();
  }
}
