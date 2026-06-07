import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, UpdateUserDto, ChangePasswordDto } from './dto/create-user.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string) {
    return this.prisma.user.findMany({
      where: { tenantId, deletedAt: null },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        avatarUrl: true,
        lastLoginAt: true,
        createdAt: true,
        tattooArtist: { select: { id: true, specialties: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string, tenantId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId, deletedAt: null },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        avatarUrl: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        tattooArtist: { select: { id: true, specialties: true, bio: true } },
      },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return user;
  }

  async create(dto: CreateUserDto, tenantId: string) {
    const exists = await this.prisma.user.findFirst({
      where: { email: dto.email, tenantId },
    });
    if (exists) throw new ConflictException('E-mail já cadastrado neste tenant');

    const hash = await bcrypt.hash(dto.password, 12);
    return this.prisma.user.create({
      data: { tenantId, email: dto.email, name: dto.name, passwordHash: hash, role: dto.role },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });
  }

  async update(id: string, dto: UpdateUserDto, tenantId: string) {
    await this.findOne(id, tenantId);
    return this.prisma.user.update({
      where: { id },
      data: dto,
      select: { id: true, name: true, email: true, role: true, active: true },
    });
  }

  async changePassword(id: string, dto: ChangePasswordDto, tenantId: string) {
    await this.findOne(id, tenantId);
    const hash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({ where: { id }, data: { passwordHash: hash } });
    return { message: 'Senha alterada com sucesso' };
  }

  async deactivate(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    return this.prisma.user.update({
      where: { id },
      data: { active: false },
      select: { id: true, active: true },
    });
  }

  async activate(id: string, tenantId: string) {
    const user = await this.prisma.user.findFirst({ where: { id, tenantId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return this.prisma.user.update({
      where: { id },
      data: { active: true },
      select: { id: true, active: true },
    });
  }
}
