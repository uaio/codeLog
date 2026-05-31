import type { Request, Response, NextFunction } from 'express';

interface FailRecord {
  count: number;
  lockedUntil: number;
}

const MAX_FAILURES = 10;
const LOCKOUT_MS = 60_000; // 1 minute

const failures = new Map<string, FailRecord>();

function getClientIp(req: Request): string {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

function isLocked(ip: string): boolean {
  const rec = failures.get(ip);
  if (!rec) return false;
  if (Date.now() < rec.lockedUntil) return true;
  failures.delete(ip);
  return false;
}

function recordFailure(ip: string): void {
  const rec = failures.get(ip) ?? { count: 0, lockedUntil: 0 };
  rec.count += 1;
  if (rec.count >= MAX_FAILURES) {
    rec.lockedUntil = Date.now() + LOCKOUT_MS;
    rec.count = 0;
  }
  failures.set(ip, rec);
}

function recordSuccess(ip: string): void {
  failures.delete(ip);
}

/**
 * Creates an Express middleware that validates API key (or password).
 * Protected paths: /api/*, /metrics
 * Auth methods:
 *   1. Header: X-Api-Key: <key>
 *   2. Query: ?apiKey=<key>
 *   3. Header: Authorization: Bearer <key>
 * Rate limits: 10 failures per IP per minute.
 */
export function createAuthMiddleware(apiKey: string) {
  return function authMiddleware(req: Request, res: Response, next: NextFunction) {
    const path = req.path;
    const isProtected =
      path.startsWith('/api/') || path === '/metrics' || path.startsWith('/metrics');

    if (!isProtected) return next();

    const ip = getClientIp(req);
    if (isLocked(ip)) {
      res.setHeader('Retry-After', '60');
      return res.status(429).json({ error: 'Too many failed auth attempts. Try again in 60s.' });
    }

    const provided =
      (req.headers['x-api-key'] as string) ||
      (req.query['apiKey'] as string) ||
      extractBearer(req.headers['authorization'] as string);

    if (provided === apiKey) {
      recordSuccess(ip);
      return next();
    }

    recordFailure(ip);
    res
      .status(401)
      .setHeader('WWW-Authenticate', 'Bearer realm="codeLog"')
      .json({ error: 'Unauthorized: invalid API key' });
  };
}

function extractBearer(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1];
}
