import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { GoogleAuthGuard } from './guards/google.guard.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import type { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: { id: string; email: string; name: string };
}

function parseDeviceName(ua: string): string {
  const browser = ua.includes('Edg/')
    ? 'Edge'
    : ua.includes('Chrome/')
      ? 'Chrome'
      : ua.includes('Firefox/')
        ? 'Firefox'
        : ua.includes('Safari/')
          ? 'Safari'
          : 'Unknown';
  const os = ua.includes('Windows')
    ? 'Windows'
    : ua.includes('Macintosh')
      ? 'Mac'
      : ua.includes('Android')
        ? 'Android'
        : ua.includes('iPhone') || ua.includes('iPad')
          ? 'iOS'
          : ua.includes('Linux')
            ? 'Linux'
            : 'Unknown';
  return `${browser} on ${os}`;
}

function extractRequestMetadata(req: Request) {
  const userAgent = req.headers['user-agent'] ?? 'unknown'.slice(0, 250);
  return {
    deviceName: parseDeviceName(userAgent),
    ipAddress: req.ip ?? req.socket.remoteAddress ?? 'unknown',
    userAgent,
  };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  async googleAuth() {
    // Guard handles redirect to Google
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleAuthCallback(@Req() req: AuthenticatedRequest) {
    const metadata = extractRequestMetadata(req);
    const tokens = await this.authService.generateTokens(
      req.user as any,
      metadata,
    );
    return tokens;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshTokens(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    const metadata = extractRequestMetadata(req);
    return this.authService.refreshTokens(dto.refreshToken, metadata);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@Body() dto: RefreshTokenDto) {
    await this.authService.logout(dto.refreshToken);
    return { message: 'Logged out successfully' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Req() req: AuthenticatedRequest) {
    return this.authService.getProfile(req.user.id);
  }
}
