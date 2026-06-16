import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration from './config/configuration';
import { validationSchema } from './config/validation.schema';
import { typeOrmModuleOptions } from './config/typeorm.config';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { ChatModule } from './modules/chat/chat.module';
import { HealthModule } from './modules/health/health.module';
import { LlmModule } from './modules/llm/llm.module';
import { RagModule } from './modules/rag/rag.module';
import { InternalChatModule } from './modules/internal-chat/internal-chat.module';
import { PaymentModule } from './modules/payment/payment.module';
import { ThrottlerBehindAuthGuard } from './common/guards/throttler-behind-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
      validationOptions: { allowUnknown: true, abortEarly: false },
      envFilePath: ['.env'],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: typeOrmModuleOptions,
    }),
    // Global rate-limit defaults. Endpoints that need a different limit
    // (e.g. /chat/messages) override with @Throttle({...}). The actual
    // limit values come from env (CHAT_RATE_LIMIT_TTL_MS, CHAT_RATE_LIMIT_MAX)
    // via the chat-specific overrides in ChatController — this default
    // is intentionally loose (1000 / 60s) so unprotected routes
    // (health, docs, etc.) never trip it.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: 60_000,
          limit: 1000,
        },
      ],
    }),
    AuthModule,
    UserModule,
    ChatModule,
    HealthModule,
    LlmModule,
    RagModule,
    InternalChatModule,
    PaymentModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerBehindAuthGuard,
    },
  ],
})
export class AppModule {}
