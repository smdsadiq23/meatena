import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import type { Response } from 'express';

type ExceptionPayload = {
  message?: string | string[];
};

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const payload = exception.getResponse();

    let message: string | string[] = exception.message;

    if (typeof payload === 'string') {
      message = payload;
    } else if (
      typeof payload === 'object' &&
      payload !== null &&
      'message' in payload
    ) {
      const exceptionPayload = payload as ExceptionPayload;
      message = exceptionPayload.message ?? message;
    }

    response.status(exception.getStatus()).json({
      status: 'error',
      message,
    });
  }
}
