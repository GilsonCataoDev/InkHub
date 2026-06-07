import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';

const TENANT_ID = 'tenant-test';

const mockUser = {
  id: 'user-1',
  email: 'test@test.com',
  name: 'Test User',
  passwordHash: bcrypt.hashSync('password123', 10),
  role: 'ADMIN' as const,
  tenantId: TENANT_ID,
  active: true,
  deletedAt: null,
  refreshToken: null,
  googleId: null,
  avatarUrl: null,
  lastLoginAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockPrisma = {
  user: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  tenant: {
    findFirst: jest.fn(),
  },
};

const mockJwt = {
  signAsync: jest.fn().mockResolvedValue('mock_token'),
};

const mockConfig = {
  get: jest.fn((key: string) => {
    const map: Record<string, string> = {
      JWT_SECRET: 'test_secret',
      JWT_EXPIRES_IN: '15m',
      JWT_REFRESH_SECRET: 'refresh_secret',
      JWT_REFRESH_EXPIRES_IN: '7d',
    };
    return map[key];
  }),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('deve retornar tokens com credenciais válidas', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockPrisma.user.update.mockResolvedValue(mockUser);

      const result = await service.login({ email: 'test@test.com', password: 'password123' }, TENANT_ID);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ email: 'test@test.com' }) }),
      );
    });

    it('deve lançar UnauthorizedException com senha errada', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      await expect(service.login({ email: 'test@test.com', password: 'wrong' }, TENANT_ID)).rejects.toThrow(UnauthorizedException);
    });

    it('deve lançar UnauthorizedException se usuário não existe', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      await expect(service.login({ email: 'notfound@test.com', password: 'any' }, TENANT_ID)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('register', () => {
    it('deve criar usuário e retornar tokens', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(mockUser);
      mockPrisma.user.update.mockResolvedValue(mockUser);

      const result = await service.register(
        { name: 'New User', email: 'new@test.com', password: 'password123' },
        TENANT_ID,
      );

      expect(result).toHaveProperty('accessToken');
      expect(mockPrisma.user.create).toHaveBeenCalled();
    });

    it('deve lançar ConflictException se e-mail já existe', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      await expect(
        service.register({ name: 'X', email: 'test@test.com', password: 'password123' }, TENANT_ID),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('logout', () => {
    it('deve invalidar refresh token', async () => {
      mockPrisma.user.update.mockResolvedValue({ ...mockUser, refreshToken: null });
      const result = await service.logout('user-1');
      expect(result).toHaveProperty('message');
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { refreshToken: null } }),
      );
    });
  });
});
