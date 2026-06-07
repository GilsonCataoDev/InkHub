import { Controller, Get, Post, Put, Patch, Body, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto, ChangePasswordDto } from './dto/create-user.dto';
import { TenantId } from '../common/decorators/tenant.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { Audit } from '../audit/audit.interceptor';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private service: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Listar usuários do tenant' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  findAll(@TenantId() tenantId: string) {
    return this.service.findAll(tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhes do usuário' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  findOne(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.service.findOne(id, tenantId);
  }

  @Post()
  @ApiOperation({ summary: 'Criar usuário no tenant' })
  @Roles(UserRole.ADMIN)
  @Audit('user.create', 'User')
  create(@Body() dto: CreateUserDto, @TenantId() tenantId: string) {
    return this.service.create(dto, tenantId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Atualizar nome, role ou status' })
  @Roles(UserRole.ADMIN)
  @Audit('user.update', 'User')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @TenantId() tenantId: string,
  ) {
    return this.service.update(id, dto, tenantId);
  }

  @Patch(':id/password')
  @ApiOperation({ summary: 'Alterar senha de um usuário' })
  @Roles(UserRole.ADMIN)
  changePassword(
    @Param('id') id: string,
    @Body() dto: ChangePasswordDto,
    @TenantId() tenantId: string,
  ) {
    return this.service.changePassword(id, dto, tenantId);
  }

  @Patch(':id/deactivate')
  @ApiOperation({ summary: 'Desativar usuário' })
  @Roles(UserRole.ADMIN)
  @Audit('user.deactivate', 'User')
  deactivate(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.service.deactivate(id, tenantId);
  }

  @Patch(':id/activate')
  @ApiOperation({ summary: 'Reativar usuário' })
  @Roles(UserRole.ADMIN)
  @Audit('user.activate', 'User')
  activate(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.service.activate(id, tenantId);
  }
}
