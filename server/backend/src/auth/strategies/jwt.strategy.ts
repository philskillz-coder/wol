import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    const secret = configService.get<string>('JWT_SECRET')?.trim();
    if (!secret) {
      throw new Error(
        'JWT_SECRET is not set. Add it to server/.env or server/backend/.env (see ConfigModule envFilePath in app.module).',
      );
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: { sub: string; email?: string; name?: string }) {
    return { id: payload.sub, email: payload.email, name: payload.name };
  }
}
