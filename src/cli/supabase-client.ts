/**
 * CLI Supabase client.
 *
 * Reads env vars from .env.local (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
 * and manages session tokens in ~/.config/hofap/session.json.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

// ============================================
// ENV LOADING
// ============================================

const loadEnvFile = async (filePath: string): Promise<Record<string, string>> => {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return content
      .split("\n")
      .filter((line) => line.trim() !== "" && !line.startsWith("#"))
      .reduce<Record<string, string>>((acc, line) => {
        const equalsIndex = line.indexOf("=");
        if (equalsIndex === -1) return acc;
        const key = line.slice(0, equalsIndex).trim();
        const value = line.slice(equalsIndex + 1).trim();
        return { ...acc, [key]: value };
      }, {});
  } catch {
    return {};
  }
};

type SupabaseConfig = {
  readonly url: string;
  readonly anonKey: string;
};

export const loadSupabaseConfig = async (): Promise<SupabaseConfig> => {
  const envPath = path.resolve(process.cwd(), ".env.local");
  const env = await loadEnvFile(envPath);

  const url = env["VITE_SUPABASE_URL"] ?? env["SUPABASE_URL"];
  const anonKey = env["VITE_SUPABASE_ANON_KEY"] ?? env["SUPABASE_ANON_KEY"];

  if (url === undefined || anonKey === undefined) {
    console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local");
    process.exit(1);
  }

  return { url, anonKey };
};

// ============================================
// SESSION STORAGE
// ============================================

const SESSION_DIR = path.join(os.homedir(), ".config", "hofap");
const SESSION_FILE = path.join(SESSION_DIR, "session.json");

type StoredSession = {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly email: string;
  readonly expiresAt: number;
};

export const saveSession = async (session: StoredSession): Promise<void> => {
  await fs.mkdir(SESSION_DIR, { recursive: true });
  await fs.writeFile(SESSION_FILE, JSON.stringify(session, null, 2), "utf-8");
};

export const loadSession = async (): Promise<StoredSession | null> => {
  try {
    const content = await fs.readFile(SESSION_FILE, "utf-8");
    const parsed = JSON.parse(content) as StoredSession;
    if (parsed.accessToken === undefined || parsed.email === undefined) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const clearSession = async (): Promise<void> => {
  try {
    await fs.unlink(SESSION_FILE);
  } catch {
    // File doesn't exist — nothing to clear
  }
};

// ============================================
// API HELPERS
// ============================================

export const invokeEdgeFunction = async (
  config: SupabaseConfig,
  accessToken: string,
  functionName: string,
  body: Record<string, unknown>,
): Promise<{ readonly data: unknown; readonly status: number }> => {
  const response = await fetch(`${config.url}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`,
      "apikey": config.anonKey,
    },
    body: JSON.stringify(body),
  });

  const data: unknown = await response.json();
  return { data, status: response.status };
};

export const supabaseLogin = async (
  config: SupabaseConfig,
  email: string,
  password: string,
): Promise<StoredSession> => {
  const response = await fetch(`${config.url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": config.anonKey,
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const body = await response.json() as { error_description?: string; msg?: string };
    const message = body.error_description ?? body.msg ?? `Login failed (${response.status})`;
    throw new Error(message);
  }

  const data = await response.json() as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    user: { email: string };
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    email: data.user.email,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
};
