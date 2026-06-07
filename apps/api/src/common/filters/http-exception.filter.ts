import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Erro interno do servidor';

    if (status >= 500) {
      // VULN-003: logar apenas path sem query string (evita JWT nos logs)
      const safePath = request.path ?? request.url?.split('?')[0];
      this.logger.error(`[${request.method}] ${safePath}`, exception instanceof Error ? exception.stack : String(exception));
    }

    // VULN-003: não retornar URL completa no body (pode conter tokens em query params)
    const safePath = request.path ?? request.url?.split('?')[0];

    response.status(status).json({
      success: false,
      statusCode: status,
      message: typeof message === 'object' ? message : { error: message },
      timestamp: new Date().toISOString(),
      path: safePath,
    });
  }
}
