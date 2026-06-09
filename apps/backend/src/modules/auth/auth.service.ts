import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { IAuthResponse, IAuthTokens, IJwtPayload, IUser } from '@law-ai/shared';
import { UserService } from '../user/user.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  private signTokens(user: IUser): IAuthTokens {
    const payload: IJwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('app.jwt.secret'),
      expiresIn: this.configService.get<string>('app.jwt.expiresIn'),
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('app.jwt.refreshSecret'),
      expiresIn: this.configService.get<string>('app.jwt.refreshExpiresIn'),
    });

    // expiresIn from @nestjs/jwt is given as a string ('15m') or number (seconds).
    // For client convenience, return seconds:
    const expiresIn = this.parseExpiresIn(
      this.configService.get<string>('app.jwt.expiresIn', '15m'),
    );

    return { accessToken, refreshToken, expiresIn };
  }

  private parseExpiresIn(value: string): number {
    const m = value.match(/^(\d+)([smhd])$/);
    if (!m) return 900; // 15 min default
    const n = parseInt(m[1] ?? '15', 10);
    switch (m[2]) {
      case 's':
        return n;
      case 'm':
        return n * 60;
      case 'h':
        return n * 3600;
      case 'd':
        return n * 86400;
      default:
        return n;
    }
  }

  async register(dto: RegisterDto): Promise<IAuthResponse> {
    const user = await this.userService.create({
      email: dto.email,
      password: dto.password,
      fullName: dto.fullName,
    });
    const tokens = this.signTokens(user);
    return { user, tokens };
  }

  async login(dto: LoginDto): Promise<IAuthResponse> {
    const userWithPassword = await this.userService.findByEmail(dto.email);
    if (!userWithPassword) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!userWithPassword.isActive) {
      throw new UnauthorizedException('Account disabled');
    }
    const ok = await bcrypt.compare(dto.password, userWithPassword.password);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const user: IUser = {
      id: userWithPassword.id,
      email: userWithPassword.email,
      fullName: userWithPassword.fullName,
      role: userWithPassword.role,
      isActive: userWithPassword.isActive,
      emailVerified: userWithPassword.emailVerified,
      createdAt: userWithPassword.createdAt.toISOString(),
      updatedAt: userWithPassword.updatedAt.toISOString(),
    };
    const tokens = this.signTokens(user);
    return { user, tokens };
  }

  async refresh(refreshToken: string): Promise<IAuthTokens> {
    try {
      const payload = this.jwtService.verify<IJwtPayload>(refreshToken, {
        secret: this.configService.get<string>('app.jwt.refreshSecret'),
      });
      const user = await this.userService.findOne(payload.sub);
      return this.signTokens(user);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async getProfile(userId: string): Promise<IUser> {
    return this.userService.findOne(userId);
  }
}
