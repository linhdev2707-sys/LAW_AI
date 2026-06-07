import { UserRole } from '../constants/roles';
import { IUser } from './user';

export interface IJwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface IAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number; // seconds
}

export interface IAuthResponse {
  user: IUser;
  tokens: IAuthTokens;
}
