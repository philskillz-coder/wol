import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

// Interface für die konsistente Datenübergabe
export interface AuthentikUser {
  oauthId: string;
  email: string;
  name: string;
  provider: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    // Falls du eine DB nutzt:
    // private readonly userService: UserService, 
  ) {}

  /**
   * Tauscht den Authorization Code gegen User-Daten von Authentik
   */
  async handleAuthentikCallback(code: string): Promise<AuthentikUser> {
    const tokenURL = this.configService.get<string>('AUTHENTIK_TOKEN_URL');
    const userInfoUrl = this.configService.get<string>('AUTHENTIK_USERINFO_URL');

    try {
      // 1. Token Exchange (POST Request)
      const tokenResponse = await firstValueFrom(
        this.httpService.post(
          tokenURL,
          new URLSearchParams({
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: this.configService.get<string>('AUTHENTIK_CALLBACK_URL'),
            client_id: this.configService.get<string>('AUTHENTIK_CLIENT_ID'),
            client_secret: this.configService.get<string>('AUTHENTIK_CLIENT_SECRET'),
          }).toString(),
          {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          },
        ),
      );

      const { access_token } = tokenResponse.data;

      // 2. User Info abrufen (GET Request mit Bearer Token)
      const userInfoResponse = await firstValueFrom(
        this.httpService.get(userInfoUrl, {
          headers: { Authorization: `Bearer ${access_token}` },
        }),
      );

      const profile = userInfoResponse.data;

      // Normalisierung der Daten
      return {
        oauthId: profile.sub || profile.id,
        email: profile.email,
        name: profile.name || profile.preferred_username || profile.nickname,
        provider: 'authentik',
      };
    } catch (error) {
      this.logger.error(`Fehler bei Authentik Kommunikation: ${error.response?.data ? JSON.stringify(error.response.data) : error.message}`);
      throw new Error('Authentik exchange failed');
    }
  }

  /**
   * Findet oder erstellt den User in der Datenbank
   */
  async validateOAuthUser(profile: AuthentikUser) {
    // Hier würdest du normalerweise checken: Existiert der User in der DB?
    // Falls nein -> create, falls ja -> update.
    // Beispiel (pseudo): return this.userService.findOrCreate(profile);
    return profile; 
  }

  /**
   * Erstellt das finale JWT für deine App
   */
  async login(user: any) {
    const payload = { 
      email: user.email, 
      sub: user.oauthId,
      name: user.name 
    };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}