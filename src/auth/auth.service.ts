import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../config/prisma/prisma.service.js';
import { TokenService } from './token.service.js';
import { GoogleProfile } from './strategies/google.strategy.js';
import { User } from '../../prisma/generated/prisma/client.js';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: Pick<User, 'id' | 'name' | 'email' | 'isVerified'>;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
  ) {}

  async validateGoogleUser(profile: GoogleProfile): Promise<User> {
    const existingAccount = await this.prisma.authAccount.findFirst({
      where: {
        provider: 'google',
        providerAccountId: profile.id,
      },
      include: { user: true },
    });

    if (existingAccount) {
      return existingAccount.user;
    }

    if (profile.email) {
      const existingUser = await this.prisma.user.findUnique({
        where: { email: profile.email },
      });

      if (existingUser) {
        await this.prisma.authAccount.create({
          data: {
            userId: existingUser.id,
            provider: 'google',
            providerAccountId: profile.id,
          },
        });

        return existingUser;
      }
    }

    const newUser = await this.prisma.user.create({
      data: {
        name: profile.displayName,
        email: profile.email,
        isVerified: !!profile.email,
        authAccounts: {
          create: {
            provider: 'google',
            providerAccountId: profile.id,
          },
        },
      },
    });

    return newUser;
  }

  async generateTokens(
    user: User,
    metadata: { deviceName: string; ipAddress: string; userAgent: string },
  ): Promise<AuthTokens> {
    const accessToken = this.tokenService.signAccessToken(user);
    const refreshToken = this.tokenService.signRefreshToken(user.id);

    await this.tokenService.createRefreshSession(
      user.id,
      refreshToken,
      metadata,
    );

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        isVerified: user.isVerified,
      },
    };
  }

  async refreshTokens(
    refreshToken: string,
    metadata: { deviceName: string; ipAddress: string; userAgent: string },
  ): Promise<AuthTokens> {
    const session =
      await this.tokenService.validateRefreshSession(refreshToken);

    if (!session) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    await this.tokenService.revokeRefreshSession(refreshToken);

    const user = await this.prisma.user.findUnique({
      where: { id: session.userId },
    });

    if (!user || user.deletedAt) {
      throw new UnauthorizedException('User not found');
    }

    const newAccessToken = this.tokenService.signAccessToken(user);
    const newRefreshToken = this.tokenService.signRefreshToken(user.id);

    await this.tokenService.createRefreshSession(
      user.id,
      newRefreshToken,
      metadata,
    );

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        isVerified: user.isVerified,
      },
    };
  }

  async logout(refreshToken: string): Promise<void> {
    await this.tokenService.revokeRefreshSession(refreshToken);
  }

  async getProfile(
    userId: string,
  ): Promise<
    Pick<
      User,
      | 'id'
      | 'name'
      | 'username'
      | 'email'
      | 'gender'
      | 'isVerified'
      | 'createdAt'
    >
  > {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        gender: true,
        isVerified: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }
}
