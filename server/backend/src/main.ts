import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  const port = parseInt(
    String(config.get('BACKEND_PORT') ?? config.get('PORT') ?? '3000'),
    10,
  );
  const frontendUrl = config.get<string>('FRONTEND_URL')?.trim();
  if (!frontendUrl) {
    throw new Error(
      'FRONTEND_URL must be set (e.g. in server/.env). Used for CORS and OAuth redirects.',
    );
  }

  app.enableCors({
    origin: frontendUrl,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(port);
  const backendUrl =
    config.get<string>('BACKEND_URL')?.trim() || `http://127.0.0.1:${port}`;
  console.log(`Backend listening on ${port} — ${backendUrl}`);
}

bootstrap();
