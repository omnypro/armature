// src/auth.ts
import type { Env } from "./env";

export const COOKIE_NAME = "armature_seat";

const equal = (a: string, b: string): boolean => {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  if (x.byteLength !== y.byteLength) return false;
  return crypto.subtle.timingSafeEqual(x, y);
};

const presented = (request: Request): string | null => {
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7).trim();
  const cookie = request.headers.get("cookie") ?? "";
  for (const part of cookie.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === COOKIE_NAME) return rest.join("=");
  }
  return null;
};

export const isPilot = (request: Request, env: Env): boolean => {
  const token = presented(request);
  return token !== null && env.PILOT_TOKEN.length > 0 && equal(token, env.PILOT_TOKEN);
};

export const seatCookie = (token: string): string =>
  `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000`;
