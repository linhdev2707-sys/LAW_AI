import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { IApiSuccess } from '@law-ai/shared';

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, IApiSuccess<T>> {
  intercept(_context: ExecutionContext, next: CallHandler<T>): Observable<IApiSuccess<T>> {
    return next.handle().pipe(
      map((data) => ({
        success: true,
        data: data as T,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
