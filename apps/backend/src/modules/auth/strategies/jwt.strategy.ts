import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IJwtPayload } from '@law-ai/shared';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('app.jwt.secret')!,
    });
  }

  /**
   * Return value is attached to req.user.
   * We return the full payload so decorators can read any field.
   */
  validate(payload: IJwtPayload): IJwtPayload {
    return payload;
  }
}
