import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  override handleRequest<TUser = any>(err: any, user: any): TUser {
    // If there's an error or no user, return null/undefined instead of throwing 401
    if (err || !user) {
      return null as any;
    }
    return user;
  }
}
