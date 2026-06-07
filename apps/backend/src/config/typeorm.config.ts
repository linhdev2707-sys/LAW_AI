import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { User } from '../modules/user/entities/user.entity';
import { Conversation } from '../modules/chat/entities/conversation.entity';
import { Message } from '../modules/chat/entities/message.entity';

export const typeOrmModuleOptions = (configService: ConfigService): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: configService.get<string>('app.database.host'),
  port: configService.get<number>('app.database.port'),
  username: configService.get<string>('app.database.username'),
  password: configService.get<string>('app.database.password'),
  database: configService.get<string>('app.database.name'),
  entities: [User, Conversation, Message],
  migrations: [__dirname + '/../database/migrations/*.{ts,js}'],
  migrationsRun: false,
  synchronize: false, // use migrations
  logging: configService.get<string>('app.env') === 'development' ? ['error', 'warn'] : ['error'],
});

export { ConfigModule };
