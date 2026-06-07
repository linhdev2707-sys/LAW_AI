import { UserRole } from '../constants/roles';

export interface IUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  emailVerified: boolean;
  createdAt: string; // ISO string (JSON-serializable)
  updatedAt: string;
}

export interface IUserWithoutPassword extends Omit<IUser, never> {
  // Reserved for future fields; currently identical to IUser.
  // We never return the password hash over the wire.
}
