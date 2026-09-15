import { argon2, randomBytes, timingSafeEqual } from 'node:crypto';
import { ContractError } from '../../packages/domain/src/identity.js';

export const passwordPolicy = Object.freeze({ version: 'argon2id-node24-m65536-t3-p1-v1', memory: 65536, passes: 3, parallelism: 1, tagLength: 32 });
const phc = /^\$argon2id\$v=19\$m=65536,t=3,p=1\$([A-Za-z0-9+/]{22})\$([A-Za-z0-9+/]{43})$/;
function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => argon2('argon2id', {
    message: password, nonce: salt, memory: passwordPolicy.memory, passes: passwordPolicy.passes,
    parallelism: passwordPolicy.parallelism, tagLength: passwordPolicy.tagLength,
  }, (error, result) => error ? reject(error) : resolve(result)));
}
function checkedPassword(password: string): void {
  if (password.length < 12 || Buffer.byteLength(password, 'utf8') > 1024)
    throw new ContractError('INVALID_INPUT', 'Password must be at least 12 characters and at most 1024 UTF-8 bytes');
}
const b64 = (bytes: Buffer) => bytes.toString('base64').replace(/=+$/u, '');
export async function hashPassword(password: string): Promise<string> {
  checkedPassword(password);
  const salt = randomBytes(16);
  return `$argon2id$v=19$m=65536,t=3,p=1$${b64(salt)}$${b64(await derive(password, salt))}`;
}
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (Buffer.byteLength(password, 'utf8') > 1024) return false;
  const match = phc.exec(stored);
  if (!match?.[1] || !match[2]) return false; // Never accept attacker-controlled work factors.
  const actual = await derive(password, Buffer.from(match[1], 'base64'));
  return timingSafeEqual(actual, Buffer.from(match[2], 'base64'));
}
