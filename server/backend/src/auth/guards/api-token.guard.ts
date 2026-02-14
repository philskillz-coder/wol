import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTokensService } from '../../api-tokens/api-tokens.service';

@Injectable()
export class ApiTokenGuard implements CanActivate {
  constructor(private apiTokensService: ApiTokensService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const userId = await this.apiTokensService.validateToken(token);

    // Attach user ID to request
    request.user = { id: userId };
    return true;
  }
}
