import { Controller, Get, UseGuards, Request, Res, Query, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);
  private readonly frontendUrl: string;

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {
    this.frontendUrl = this.configService.get<string>('FRONTEND_URL');
  }

  @Get('authentik')
  @UseGuards(AuthGuard('authentik'))
  async authentikAuth() {
    // Initiates Authentik OAuth flow via Passport Strategy
  }

  @Get('authentik/callback')
  async authentikCallback(@Query('code') code: string, @Res() res: Response) {
    if (!code) {
      return this.redirectWithError(res, 'no_code');
    }

    try {
      // 1. Exchange Code & Get UserInfo (jetzt im Service)
      const oauthData = await this.authService.handleAuthentikCallback(code);

      // 2. Validate User & Generate JWT
      const user = await this.authService.validateOAuthUser(oauthData);
      const { access_token } = await this.authService.login(user);

      // 3. Success Redirect
      return res.redirect(`${this.frontendUrl}?token=${access_token}`);
    } catch (error) {
      this.logger.error(`Authentik Callback Error: ${error.message}`);
      return this.redirectWithError(res, 'auth_failed', error.message);
    }
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getProfile(@Request() req) {
    return req.user;
  }

  private redirectWithError(res: Response, errorType: string, message?: string) {
    const url = new URL(this.frontendUrl);
    url.searchParams.append('error', errorType);
    if (message) url.searchParams.append('message', message);
    return res.redirect(url.toString());
  }
}