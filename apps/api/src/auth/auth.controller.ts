import { Controller, Post, Body, Get, UseGuards, Req, Res, HttpCode } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AuthService, TokenPair } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';
import { TenantId } from '../common/decorators/tenant.decorator';

interface GoogleRequest extends Request {
  user?: { googleId: string; email: string; name: string; avatarUrl: string };
}

// Duração dos cookies em ms
const ACCESS_MAX_AGE  = 15 * 60 * 1000;         // 15 min
const REFRESH_MAX_AGE = 7  * 24 * 60 * 60 * 1000; // 7 dias

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // ─── VULN-007: set httpOnly cookies em todas as rotas de autenticação ────────

  private setCookies(res: Response, tokens: TokenPair): void {
    const isProd = process.env['NODE_ENV'] === 'production';

    // access_token: curta duração, disponível em todas as rotas
    res.cookie('access_token', tokens.accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'strict' : 'lax',
      maxAge: ACCESS_MAX_AGE,
      path: '/',
    });

    // refresh_token: longa duração, restrito ao path de refresh
    res.cookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'strict' : 'lax',
      maxAge: REFRESH_MAX_AGE,
      path: '/auth/refresh', // scope mínimo
    });
  }

  private clearCookies(res: Response): void {
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/auth/refresh' });
  }

  // ─── Endpoints ───────────────────────────────────────────────────────────────

  @Public()
  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Login com e-mail e senha' })
  async login(
    @Body() dto: LoginDto,
    @TenantId() tenantId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.login(dto, tenantId);
    this.setCookies(res, tokens);
    // Também retorna no body para clientes não-browser (mobile, API)
    return tokens;
  }

  @Public()
  @Post('register')
  @Throttle({ default: { limit: 3, ttl: 3_600_000 } })
  @ApiOperation({ summary: 'Cadastrar novo usuário no tenant' })
  async register(
    @Body() dto: RegisterDto,
    @TenantId() tenantId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.register(dto, tenantId);
    this.setCookies(res, tokens);
    return tokens;
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Renovar access token via refresh token' })
  async refresh(
    @Body() dto: RefreshTokenDto,
    @TenantId() tenantId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // VULN-007: aceitar token do cookie httpOnly (browser) OU do body (mobile)
    const refreshToken: string = (req.cookies as Record<string, string>)?.['refresh_token']
      ?? dto?.refreshToken;

    const tokens = await this.authService.refreshTokens(refreshToken, tenantId);
    this.setCookies(res, tokens);
    return tokens;
  }

  @Post('logout')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout — invalida refresh token e limpa cookies' })
  async logout(
    @CurrentUser() user: JwtPayload,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.clearCookies(res);
    return this.authService.logout(user.sub);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Dados do usuário autenticado' })
  me(@CurrentUser() user: JwtPayload) {
    return this.authService.me(user.sub);
  }

  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Iniciar OAuth Google' })
  googleAuth() {}

  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Callback OAuth Google' })
  async googleCallback(
    @Req() req: GoogleRequest,
    @Res() res: Response,
    @TenantId() tenantId: string,
  ) {
    if (!req.user) {
      res.redirect('/auth/login?error=google_auth_failed');
      return;
    }
    const tokens = await this.authService.googleCallback(req.user, tenantId);
    this.setCookies(res, tokens);

    // VULN-007: redirecionar sem tokens na URL — cookies já foram setados
    const appUrl = process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000';
    res.redirect(`${appUrl}/auth/callback`);
  }
}
