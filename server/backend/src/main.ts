import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  const backendPortRaw = String(
    config.get('BACKEND_PORT') ?? config.get('PORT') ?? '',
  ).trim();
  if (!backendPortRaw) {
    throw new Error(
      'BACKEND_PORT must be set (e.g. in server/.env).',
    );
  }
  const port = Number.parseInt(backendPortRaw, 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`BACKEND_PORT is invalid: "${backendPortRaw}". Expected integer between 1 and 65535.`);
  }
  const frontendUrl = config.get<string>('FRONTEND_URL')?.trim();
  if (!frontendUrl) {
    throw new Error(
      'FRONTEND_URL must be set (e.g. in server/.env). Used for CORS and OAuth redirects.',
    );
  }
  const backendUrl = config.get<string>('BACKEND_URL')?.trim();
  if (!backendUrl) {
    throw new Error(
      'BACKEND_URL must be set (e.g. in server/.env).',
    );
  }

  const parseUrl = (name: string, value: string): URL => {
    try {
      const parsed = new URL(value);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('unsupported protocol');
      }
      return parsed;
    } catch {
      throw new Error(`${name} is invalid: "${value}". Expected full URL like http://localhost:6010.`);
    }
  };

  const backendParsed = parseUrl('BACKEND_URL', backendUrl);
  const frontendParsed = parseUrl('FRONTEND_URL', frontendUrl);

  const backendUrlPort = backendParsed.port
    ? Number.parseInt(backendParsed.port, 10)
    : backendParsed.protocol === 'https:'
      ? 443
      : 80;
  if (backendUrlPort !== port) {
    throw new Error(
      `BACKEND_URL port (${backendUrlPort}) does not match BACKEND_PORT (${port}).`,
    );
  }

  const frontendPortRaw = config.get<string>('FRONTEND_PORT')?.trim();
  if (frontendPortRaw) {
    const frontendPort = Number.parseInt(frontendPortRaw, 10);
    if (!Number.isInteger(frontendPort) || frontendPort < 1 || frontendPort > 65535) {
      throw new Error(`FRONTEND_PORT is invalid: "${frontendPortRaw}". Expected integer between 1 and 65535.`);
    }
    const frontendUrlPort = frontendParsed.port
      ? Number.parseInt(frontendParsed.port, 10)
      : frontendParsed.protocol === 'https:'
        ? 443
        : 80;
    if (frontendUrlPort !== frontendPort) {
      throw new Error(
        `FRONTEND_URL port (${frontendUrlPort}) does not match FRONTEND_PORT (${frontendPort}).`,
      );
    }
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
  console.log(`Backend listening on ${port} — ${backendUrl.replace(/\/$/, '')}`);
}

bootstrap();
