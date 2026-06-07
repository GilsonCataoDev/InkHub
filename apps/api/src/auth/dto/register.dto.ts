import { IsEmail, IsString, MinLength, MaxLength, IsEnum, IsOptional, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

export class RegisterDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  /**
   * VULN-016: mínimo 10 caracteres com letra maiúscula, minúscula,
   * número e símbolo — previne senhas triviais tipo "admin123"
   */
  @ApiProperty({ minLength: 10, description: 'Mín. 10 chars: maiúscula, minúscula, número e símbolo' })
  @IsString()
  @MinLength(10, { message: 'Senha deve ter pelo menos 10 caracteres' })
  @MaxLength(128)
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&\-_#^()])/,
    { message: 'Senha deve conter maiúscula, minúscula, número e símbolo (@$!%*?&-_#^())' },
  )
  password: string;

  /**
   * VULN-010: role restrito — ADMIN só pode ser criado via endpoint de admin.
   * Auto-registro sempre resulta em RECEPTIONIST independente do que for enviado.
   */
  @ApiPropertyOptional({
    enum: [UserRole.RECEPTIONIST, UserRole.TATTOO_ARTIST],
    default: UserRole.RECEPTIONIST,
  })
  @IsOptional()
  @IsEnum([UserRole.RECEPTIONIST, UserRole.TATTOO_ARTIST], {
    message: 'Papel inválido para auto-registro. Use RECEPTIONIST ou TATTOO_ARTIST.',
  })
  role?: Extract<UserRole, 'RECEPTIONIST' | 'TATTOO_ARTIST'>;
}
