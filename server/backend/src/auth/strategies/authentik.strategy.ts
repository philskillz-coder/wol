import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-oauth2';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class AuthentikStrategy extends PassportStrategy(Strategy, 'authentik') {
  private readonly logger = new Logger(AuthentikStrategy.name);

  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
  ) {
    const clientID = configService.get<string>('AUTHENTIK_CLIENT_ID');
    const clientSecret = configService.get<string>('AUTHENTIK_CLIENT_SECRET');
    
    super({
      authorizationURL: configService.get<string>('AUTHENTIK_AUTHORIZATION_URL'),
      tokenURL: configService.get<string>('AUTHENTIK_TOKEN_URL'),
      clientID: clientID,
      clientSecret: clientSecret,
      callbackURL: configService.get<string>('AUTHENTIK_CALLBACK_URL'),
      scope: ['openid', 'profile', 'email'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    try {
      // Fetch user info from Authentik
      const userInfoUrl = this.configService.get<string>('AUTHENTIK_USERINFO_URL');
      const response = await firstValueFrom(
        this.httpService.get(userInfoUrl, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }),
      );

      const userInfo = response.data as any;

      this.logger.log(`User authenticated: ${userInfo.email || userInfo.sub}`);

      return {
        oauthId: userInfo.sub || userInfo.id,
        email: userInfo.email,
        name: userInfo.name || userInfo.preferred_username,
        provider: 'authentik',
      };
    } catch (error: any) {
      this.logger.error(`Failed to fetch user info: ${error.message}`);
      return done(error, null);
    }
  }
}
