import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../config/prisma/prisma.service.js';
import { ENV } from '../config/env/env.config.js';
import { User } from '../../prisma/generated/prisma/client.js';

export interface TokenPayload {
  sub: string;
  email: string | null;
  name: string | null;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<ENV, true>,
    private readonly prisma: PrismaService,
  ) {}

  signAccessToken(user: User): string {
    const payload: TokenPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
    };

    return this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_ACCESS_SECRET'),
      expiresIn: this.configService.get('JWT_ACCESS_EXPIRATION'),
    });
  }

  signRefreshToken(userId: string): string {
    return this.jwtService.sign(
      { sub: userId },
      {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get('JWT_REFRESH_EXPIRATION'),
      },
    );
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async createRefreshSession(
    userId: string,
    token: string,
    metadata: { deviceName: string; ipAddress: string; userAgent: string },
  ) {
    const hashedToken = this.hashToken(token);

    const expirationStr = this.configService.get('JWT_REFRESH_EXPIRATION');
    const expirationMs = this.parseExpiration(expirationStr);

    return this.prisma.refreshSession.create({
      data: {
        userId,
        hashedToken,
        deviceName: metadata.deviceName,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        expiredAt: new Date(Date.now() + expirationMs),
      },
    });
  }

  async validateRefreshSession(token: string) {
    const hashedToken = this.hashToken(token);

    const session = await this.prisma.refreshSession.findFirst({
      where: {
        hashedToken,
        revokedAt: null,
        expiredAt: { gt: new Date() },
      },
    });

    return session;
  }

  async revokeRefreshSession(token: string) {
    const hashedToken = this.hashToken(token);

    return this.prisma.refreshSession.updateMany({
      where: { hashedToken },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllUserSessions(userId: string) {
    return this.prisma.refreshSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  generateTokenPair(): string {
    return randomBytes(40).toString('hex');
  }

  private parseExpiration(expiration: string): number {
    const match = expiration.match(/^(\d+)([smhd])$/);
    if (!match) return 7 * 24 * 60 * 60 * 1000;

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value * 1000;
      case 'm':
        return value * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      case 'd':
        return value * 24 * 60 * 60 * 1000;
      default:
        return 7 * 24 * 60 * 60 * 1000;
    }
  }
}
