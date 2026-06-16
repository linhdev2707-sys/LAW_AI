import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, FindOptionsWhere } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { CreateUserBody } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryUserDto } from './dto/query-user.dto';
import { IPaginatedResult, IUser, UserRole } from '@law-ai/shared';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  /** Map User entity → IUser (sanitize: strip password) */
  private toIUser(user: User): IUser {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      isActive: user.isActive,
      emailVerified: user.emailVerified,
      subscriptionPlan: user.subscriptionPlan,
      subscriptionExpiresAt: user.subscriptionExpiresAt ? user.subscriptionExpiresAt.toISOString() : null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  async create(dto: CreateUserBody): Promise<IUser> {
    const existing = await this.usersRepository.findOne({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Email already in use');
    }
    const hashed = await bcrypt.hash(dto.password, 12);
    const user = this.usersRepository.create({
      email: dto.email,
      password: hashed,
      fullName: dto.fullName,
      role: dto.role ?? UserRole.USER,
    });
    const saved = await this.usersRepository.save(user);
    return this.toIUser(saved);
  }

  async findAll(query: QueryUserDto): Promise<IPaginatedResult<IUser>> {
    const { page, limit, search, role } = query;
    const where: FindOptionsWhere<User> = {};
    if (search) {
      where.fullName = ILike(`%${search}%`);
    }
    if (role) {
      where.role = role;
    }

    const [items, total] = await this.usersRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      items: items.map((u) => this.toIUser(u)),
      total,
      page,
      limit,
    };
  }

  async findOne(id: string): Promise<IUser> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return this.toIUser(user);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async update(id: string, dto: UpdateUserDto): Promise<IUser> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    
    const { password, ...rest } = dto;
    Object.assign(user, rest);
    
    if (password) {
      user.password = await bcrypt.hash(password, 12);
    }
    
    const saved = await this.usersRepository.save(user);
    return this.toIUser(saved);
  }

  async remove(id: string): Promise<void> {
    const result = await this.usersRepository.delete({ id });
    if (!result.affected) {
      throw new NotFoundException(`User ${id} not found`);
    }
  }
}
