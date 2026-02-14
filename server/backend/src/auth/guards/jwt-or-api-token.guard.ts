import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { ApiTokensService } from '../../api-tokens/api-tokens.service';

@Injectable()
export class JwtOrApiTokenGuard extends AuthGuard('jwt') {
  constructor(
    private reflector: Reflector,
    private apiTokensService: ApiTokensService,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = authHeader.substring(7);

    // Try API token first (starts with 'wol_')
    if (token.startsWith('wol_')) {
      try {
        const userId = await this.apiTokensService.validateToken(token);
        request.user = { id: userId };
        return true;
      } catch (error) {
        // If API token fails, fall through to JWT
      }
    }

    // Try JWT authentication
    try {
      return (await super.canActivate(context)) as boolean;
    } catch (error) {
      throw new UnauthorizedException('Invalid authentication token');
    }
  }
}
