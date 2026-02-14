import { Controller, Get, UseGuards, Request, Res, Query } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
    private httpService: HttpService,
  ) {}

  @Get('authentik')
  @UseGuards(AuthGuard('authentik'))
  async authentikAuth() {
    // Initiates Authentik OAuth flow
  }

  @Get('authentik/callback')
  async authentikCallback(@Query('code') code: string, @Query('state') state: string, @Res() res: Response) {
    try {
      if (!code) {
        return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}?error=no_code`);
      }

      // Exchange authorization code for access token
      const tokenURL = this.configService.get<string>('AUTHENTIK_TOKEN_URL');
      const clientID = this.configService.get<string>('AUTHENTIK_CLIENT_ID');
      const clientSecret = this.configService.get<string>('AUTHENTIK_CLIENT_SECRET');
      const callbackURL = this.configService.get<string>('AUTHENTIK_CALLBACK_URL');

      // Authentik requires client credentials in request body
      const postData = new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: callbackURL,
        client_id: clientID,
        client_secret: clientSecret,
      });

      let tokenResponse;
      try {
        tokenResponse = await firstValueFrom(
          this.httpService.post(tokenURL, postData.toString(), {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          }),
        );
      } catch (error: any) {
        console.error('Token exchange error:', error.response?.data || error.message);
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        return res.redirect(`${frontendUrl}?error=token_exchange_failed&message=${encodeURIComponent(error.response?.data?.error_description || error.message)}`);
      }

      const { access_token } = tokenResponse.data;
      if (!access_token) {
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        return res.redirect(`${frontendUrl}?error=no_access_token`);
      }

      // Fetch user info from Authentik
      const userInfoUrl = this.configService.get<string>('AUTHENTIK_USERINFO_URL');
      let userInfoResponse;
      try {
        userInfoResponse = await firstValueFrom(
          this.httpService.get(userInfoUrl, {
            headers: {
              Authorization: `Bearer ${access_token}`,
            },
          }),
        );
      } catch (error: any) {
        console.error('User info error:', error.response?.data || error.message);
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        return res.redirect(`${frontendUrl}?error=userinfo_failed`);
      }

      const userInfo = userInfoResponse.data;
      const oauthData = {
        oauthId: userInfo.sub || userInfo.id,
        email: userInfo.email,
        name: userInfo.name || userInfo.preferred_username,
        provider: 'authentik',
      };

      // Create or update user
      const user = await this.authService.validateOAuthUser(oauthData);
      const result = await this.authService.login(user);
      
      // Redirect to frontend with token
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(`${frontendUrl}/auth/callback?token=${result.access_token}`);
    } catch (error: any) {
      console.error('Authentik callback error:', error);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(`${frontendUrl}?error=auth_failed&message=${encodeURIComponent(error.message)}`);
    }
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Request() req) {
    return req.user;
  }
}
