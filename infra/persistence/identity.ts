import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type pg from 'pg';
import { ContractError, assertUuid } from '../../packages/domain/src/identity.js';
import { hashPassword, passwordPolicy, verifyPassword } from '../security/passwords.js';
import { transaction } from './database.js';

const digest = (value: string) => createHash('sha256').update(value, 'utf8').digest();
const unauthorized = () => new ContractError('UNAUTHENTICATED', 'Authentication required');
export interface Principal { sessionId: string; userId: string; csrfHash: Buffer; roles: string[] }
export class IdentityRepository {
  private dummyHash: Promise<string>;
  constructor(private readonly pool: pg.Pool) { this.dummyHash = hashPassword(randomBytes(32).toString('base64url')); }
  async allowLogin(key: string): Promise<boolean> {
    return transaction(this.pool, async (db) => {
      await db.query('DELETE FROM auth_rate_windows WHERE expires_at<now()');
      const result = await db.query(`INSERT INTO auth_rate_windows(key_hash,attempts,expires_at) VALUES($1,1,now()+interval '15 minutes')
        ON CONFLICT(key_hash) DO UPDATE SET attempts=auth_rate_windows.attempts+1 RETURNING attempts`, [digest(key)]);
      return (result.rows[0]?.attempts as number) <= 8;
    });
  }
  /** Controlled provisioning primitive. Public signup/reset/verification UI is not opened in P2. */
  async provision(email: string, password: string) {
    const normalized = email.trim().normalize('NFC').toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(normalized) || normalized.length > 254) throw new ContractError('INVALID_INPUT', 'Valid email required');
    const hash = await hashPassword(password);
    return transaction(this.pool, async (db) => {
      const id = randomUUID();
      await db.query('INSERT INTO users(id,email_normalized) VALUES($1,$2)', [id, normalized]);
      await db.query('INSERT INTO credentials(id,user_id,password_hash,policy_version) VALUES($1,$2,$3,$4)', [randomUUID(), id, hash, passwordPolicy.version]);
      await db.query(`INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE stable_code='learner'`, [id]);
      await db.query('INSERT INTO user_settings(user_id) VALUES($1)', [id]);
      await db.query(`INSERT INTO audit_events(actor_id,action,target_id) VALUES($1,'identity.provisioned',$1)`, [id]);
      return id;
    });
  }
  async login(email: string, password: string) {
    // The public API adds bounded throttling; failed identity lookups still execute Argon2id.
    const row = (await this.pool.query(`SELECT u.id,u.status,c.password_hash FROM users u JOIN credentials c ON c.user_id=u.id
      WHERE u.email_normalized=$1 AND u.account_type='human'`, [email.trim().normalize('NFC').toLowerCase()])).rows[0];
    const valid = await verifyPassword(password, (row?.password_hash as string | undefined) ?? await this.dummyHash);
    if (!valid || !row || row.status !== 'active') throw unauthorized();
    return transaction(this.pool, async (db) => {
      const current = (await db.query(`SELECT u.status,c.password_hash FROM users u JOIN credentials c ON c.user_id=u.id
        WHERE u.id=$1 FOR UPDATE OF u,c`, [row.id])).rows[0];
      if (current?.status !== 'active' || current.password_hash !== row.password_hash) throw unauthorized();
      const token = randomBytes(32).toString('base64url'); const csrf = randomBytes(32).toString('base64url'); const sessionId = randomUUID();
      await db.query(`INSERT INTO sessions(id,user_id,token_hash,csrf_hash,expires_at) VALUES($1,$2,$3,$4,now()+interval '12 hours')`, [sessionId, row.id, digest(token), digest(csrf)]);
      await db.query(`INSERT INTO audit_events(actor_id,action,target_id) VALUES($1,'identity.login',$2)`, [row.id, sessionId]);
      return { token, csrf, sessionId };
    });
  }
  async authenticate(token: string): Promise<Principal> {
    if (!/^[A-Za-z0-9_-]{43}$/u.test(token)) throw unauthorized();
    const row = (await this.pool.query(`SELECT s.id,s.user_id,s.csrf_hash FROM sessions s JOIN users u ON u.id=s.user_id
      WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at>now() AND u.status='active'`, [digest(token)])).rows[0];
    if (!row) throw unauthorized();
    const roles = (await this.pool.query('SELECT r.stable_code FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=$1', [row.user_id])).rows.map((r) => r.stable_code as string);
    return { sessionId: row.id as string, userId: row.user_id as string, csrfHash: row.csrf_hash as Buffer, roles };
  }
  checkCsrf(principal: Principal, csrf: string): void {
    if (!/^[A-Za-z0-9_-]{43}$/u.test(csrf) || !timingSafeEqual(digest(csrf), principal.csrfHash)) throw new ContractError('FORBIDDEN', 'CSRF verification required');
  }
  async logout(principal: Principal) {
    await this.pool.query('UPDATE sessions SET revoked_at=now() WHERE id=$1 AND user_id=$2', [principal.sessionId, principal.userId]);
  }
  async profiles(principal: Principal) {
    return (await this.pool.query(`SELECT p.id,p.language_id,l.stable_code AS language,v.code AS variety FROM language_profiles p
      JOIN languages l ON l.id=p.language_id JOIN variants v ON v.id=p.variant_id WHERE p.user_id=$1 ORDER BY l.stable_code`, [principal.userId])).rows;
  }
  async createProfile(principal: Principal, languageId: string, variety?: string) {
    assertUuid(languageId);
    const variant = (await this.pool.query('SELECT id FROM variants WHERE language_id=$1 AND ($2::text IS NULL AND is_default OR code=$2)', [languageId, variety ?? null])).rows[0];
    if (!variant) throw new ContractError('INVALID_INPUT', 'Invalid language/variety');
    const id = randomUUID();
    await this.pool.query('INSERT INTO language_profiles(id,user_id,language_id,variant_id) VALUES($1,$2,$3,$4)', [id, principal.userId, languageId, variant.id]);
    return id;
  }
  async settings(principal: Principal) {
    return (await this.pool.query(`SELECT active_language_profile_id,active_language_id,ui_locale,timezone,learner_ai_opt_in,revision FROM user_settings WHERE user_id=$1`, [principal.userId])).rows[0];
  }
  async switchProfile(principal: Principal, profileId: string, expectedRevision: number) {
    assertUuid(profileId);
    return transaction(this.pool, async (db) => {
      const profile = (await db.query('SELECT language_id FROM language_profiles WHERE id=$1 AND user_id=$2', [profileId, principal.userId])).rows[0];
      if (!profile) throw new ContractError('NOT_FOUND', 'Profile not found'); // No foreign-owner disclosure.
      const result = await db.query(`UPDATE user_settings SET active_language_profile_id=$1,active_language_id=$2 WHERE user_id=$3 AND revision=$4 RETURNING revision`, [profileId, profile.language_id, principal.userId, expectedRevision]);
      if (!result.rowCount) throw new ContractError('CONFLICT', 'Settings revision changed');
      return result.rows[0]?.revision as number;
    });
  }
  async selectVariety(principal: Principal, profileId: string, variety: string) {
    assertUuid(profileId);
    const result = await this.pool.query(`UPDATE language_profiles p SET variant_id=v.id FROM variants v WHERE p.id=$1 AND p.user_id=$2
      AND v.language_id=p.language_id AND v.code=$3 RETURNING p.id`, [profileId, principal.userId, variety]);
    if (!result.rowCount) throw new ContractError('NOT_FOUND', 'Profile/variety not found');
  }
  async consent(principal: Principal, granted: boolean, policyVersion: string) {
    if (!policyVersion.trim()) throw new ContractError('INVALID_INPUT', 'Policy version required');
    return transaction(this.pool, async (db) => {
      // The preference is not AI authorization. P8/P9 policy and zero-budget gates remain closed.
      await db.query('SELECT 1 FROM user_settings WHERE user_id=$1 FOR UPDATE', [principal.userId]);
      await db.query(`INSERT INTO consents(id,user_id,purpose,policy_version,granted) VALUES($1,$2,'learner_ai',$3,$4)`, [randomUUID(), principal.userId, policyVersion, granted]);
      await db.query('UPDATE user_settings SET learner_ai_opt_in=$1 WHERE user_id=$2', [granted, principal.userId]);
    });
  }
}
