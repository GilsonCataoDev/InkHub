import { IsEmail, IsString, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SignupDto {
  @ApiProperty({ example: 'Tattoo Studio Black' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  studioName: string;

  @ApiProperty({ example: 'tattoo-black', description: 'Slug único: só letras minúsculas, números e hífens' })
  @IsString()
  @Matches(/^[a-z0-9-]{3,50}$/, { message: 'Slug deve ter 3–50 caracteres: letras minúsculas, números e hífens' })
  slug: string;

  @ApiProperty({ example: 'João Silva' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  adminName: string;

  @ApiProperty({ example: 'joao@tattoo.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ minLength: 10 })
  @IsString()
  @MinLength(10, { message: 'Senha deve ter pelo menos 10 caracteres' })
  @MaxLength(128)
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&\-_#^()])/,
    { message: 'Senha deve conter maiúscula, minúscula, número e símbolo' },
  )
  password: string;
}
