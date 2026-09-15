import { Body, Catch, Controller, Get, Header, HttpCode, HttpException, Inject, Patch, Post, Put, Req, Res } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { z, ZodError } from 'zod';
import { ContractError, UUID_PATTERN, languageIds } from '../../../packages/domain/src/identity.js';
import type { IdentityRepository } from '../../../infra/persistence/identity.js';
import type { ContentRepository } from '../../../infra/persistence/content.js';

export const IDENTITY = Symbol('P2_IDENTITY'); export const CONTENT = Symbol('P2_CONTENT');
type Request = { headers: Record<string, string | undefined>; ip?: string; query: Record<string, string | undefined> };
type Response = { status(code: number): Response; type(value: string): Response; json(value: unknown): void; setHeader(name: string, value: string): void };
const noStore = 'private, no-store';
const cookieName = '__Host-lingvessa_session';
const uuid = z.string().regex(UUID_PATTERN);
const tokenFrom = (request: Request) => {
  const cookies = (request.headers.cookie ?? '').split(';').map((part) => part.trim().split('='));
  const matching = cookies.filter(([name]) => name === cookieName);
  return matching.length === 1 ? matching[0]?.[1] ?? '' : '';
};

@Catch()
export class FoundationExceptionFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    if (error instanceof HttpException) {
      host.switchToHttp().getResponse<Response>().status(error.getStatus()).json(error.getResponse());
      return;
    }
    const codes = { INVALID_INPUT: 400, NOT_FOUND: 404, FORBIDDEN: 403, CONFLICT: 409, UNAUTHENTICATED: 401 };
    const dbCode = error instanceof Error && 'code' in error ? String(error.code) : '';
    const status = error instanceof ContractError ? codes[error.code] : error instanceof ZodError ? 400 : dbCode === '23505' ? 409 : ['23503', '23514', '22P02'].includes(dbCode) ? 400 : dbCode === '42501' ? 403 : 500;
    const response = host.switchToHttp().getResponse<Response>();
    response.setHeader('Cache-Control', noStore);
    response.status(status).type('application/problem+json').json({ type: 'about:blank', status, title: error instanceof ContractError ? error.code : status === 500 ? 'INTERNAL_ERROR' : 'REQUEST_REJECTED' });
  }
}
@Controller('auth')
export class AuthController {
  constructor(@Inject(IDENTITY) private readonly identity: IdentityRepository) {}
  @Post('login')
  @HttpCode(200)
  @Header('Cache-Control', noStore)
  async login(@Body() body: unknown, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    // JSON/custom header prevents a cross-origin form login. CORS is not enabled.
    if (request.headers['x-lingvessa-client'] !== 'web') throw new ContractError('FORBIDDEN', 'Client header required');
    const input = z.object({ email: z.email().max(254), password: z.string().max(1024) }).strict().parse(body);
    if (!await this.identity.allowLogin(`ip:${request.ip ?? 'unknown'}`) || !await this.identity.allowLogin(`identity:${input.email.trim().normalize('NFC').toLowerCase()}`))
      throw new ContractError('FORBIDDEN', 'Login temporarily limited');
    const session = await this.identity.login(input.email, input.password);
    response.setHeader('Set-Cookie', `${cookieName}=${session.token}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=43200`);
    return { csrf_token: session.csrf };
  }
  @Post('logout')
  @HttpCode(200)
  @Header('Cache-Control', noStore)
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const principal = await this.identity.authenticate(tokenFrom(request)); this.identity.checkCsrf(principal, request.headers['x-csrf-token'] ?? '');
    await this.identity.logout(principal);
    response.setHeader('Set-Cookie', `${cookieName}=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0`);
    return { status: 'signed_out' };
  }
}
@Controller('me')
export class ProfileController {
  constructor(@Inject(IDENTITY) private readonly identity: IdentityRepository) {}
  @Get()
  @Header('Cache-Control', noStore)
  async me(@Req() request: Request) {
    const principal = await this.identity.authenticate(tokenFrom(request));
    return { id: principal.userId, roles: principal.roles, settings: await this.identity.settings(principal) };
  }
  @Patch()
  @Header('Cache-Control', noStore)
  async update(@Req() request: Request, @Body() body: unknown) {
    const principal = await this.identity.authenticate(tokenFrom(request)); this.identity.checkCsrf(principal, request.headers['x-csrf-token'] ?? '');
    const input = z.object({ timezone: z.string().min(1).max(80), expected_revision: z.number().int().positive() }).strict().parse(body);
    return this.identity.updateSettings(principal, input.timezone, input.expected_revision);
  }
  @Get('language-profiles')
  @Header('Cache-Control', noStore)
  async profiles(@Req() request: Request) { return this.identity.profiles(await this.identity.authenticate(tokenFrom(request))); }
  @Post('language-profiles')
  @Header('Cache-Control', noStore)
  async create(@Req() request: Request, @Body() body: unknown) {
    const principal = await this.identity.authenticate(tokenFrom(request)); this.identity.checkCsrf(principal, request.headers['x-csrf-token'] ?? '');
    const input = z.object({ language_id: uuid, variety: z.enum(['en-GB', 'en-US', 'cs-CZ']).optional() }).strict().parse(body);
    return { id: await this.identity.createProfile(principal, input.language_id, input.variety) };
  }
  @Put('active-language')
  @Header('Cache-Control', noStore)
  async activate(@Req() request: Request, @Body() body: unknown) {
    const principal = await this.identity.authenticate(tokenFrom(request)); this.identity.checkCsrf(principal, request.headers['x-csrf-token'] ?? '');
    const input = z.object({ language_profile_id: uuid, expected_revision: z.number().int().positive() }).strict().parse(body);
    return { revision: await this.identity.switchProfile(principal, input.language_profile_id, input.expected_revision) };
  }
}
@Controller('catalog')
export class CatalogController {
  constructor(@Inject(CONTENT) private readonly content: ContentRepository) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  async get(@Req() request: Request) {
    const language = z.enum(['en', 'cs']).parse(request.query.language);
    return this.content.catalog(languageIds[language]); // Stable channel only, never unpublished drafts/test fixtures.
  }
}
