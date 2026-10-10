// Password hashing and small crypto helpers.
import { fail } from './http.js';

const PBKDF2_ITER = 20000; // keeps login under the free-plan CPU budget

export const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

export async function hashPw(pw, saltB64) {
  const salt = Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITER }, key, 256);
  return b64(bits);
}

export const newSalt = () => b64(crypto.getRandomValues(new Uint8Array(16)));
export const sha256 = async (s) => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));

/** Constant-time string compare. */
export function safeEq(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export function checkPw(pw) {
  if (typeof pw !== 'string' || pw.length < 6) fail(400, '비밀번호는 6자 이상이어야 합니다');
}
