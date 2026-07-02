import './config/load-env';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AppConfig } from './config/configuration';
import { PrismaService } from './prisma/prisma.service';
import { initSentry } from './observability/sentry';

async function bootstrap(): Promise<void> {
  initSentry();
  const app = await NestFactory.create(AppModule, { rawBody: true, bufferLogs: true });
  app.useLogger(app.get(Logger));

  const config = app.get(ConfigService);
  const appConfig = config.getOrThrow<AppConfig>('app');

  if (appConfig.env === 'production') {
    const secret = config.get<string>('jwt.accessSecret');
    if (!secret || secret === 'insecure-dev-secret') {
      throw new Error('JWT_ACCESS_SECRET must be set to a strong value in production');
    }
  }

  app.setGlobalPrefix(appConfig.apiPrefix);
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({ origin: appConfig.webAppUrl, credentials: true });

  app.get(PrismaService).enableShutdownHooks(app);
  app.enableShutdownHooks();

  await app.listen(appConfig.port);
}

void bootstrap();
