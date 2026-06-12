import crypto from "node:crypto";
import type { SessionRecord } from "./types.js";
import { readJson, writeJson } from "../store/jsonDb.js";

const SESSIONS_FILE = "sessions.json";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type SessionStore = Record<string, SessionRecord>;

async function loadSessions(): Promise<SessionStore> {
  return readJson<SessionStore>(SESSIONS_FILE, {});
}

async function saveSessions(store: SessionStore): Promise<void> {
  await writeJson(SESSIONS_FILE, store);
}

function pruneExpired(store: SessionStore): SessionStore {
  const now = Date.now();
  const next: SessionStore = {};
  for (const [token, session] of Object.entries(store)) {
    if (session.expiresAt > now) next[token] = session;
  }
  return next;
}

export async function createSession(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const store = pruneExpired(await loadSessions());
  store[token] = {
    token,
    userId,
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
  await saveSessions(store);
  return token;
}

export async function getSessionUserId(
  token: string | undefined
): Promise<string | null> {
  if (!token) return null;
  let store = pruneExpired(await loadSessions());
  const session = store[token];
  if (!session || session.expiresAt <= Date.now()) {
    if (session) {
      delete store[token];
      await saveSessions(store);
    }
    return null;
  }
  return session.userId;
}

export async function deleteSession(token: string): Promise<void> {
  const store = await loadSessions();
  delete store[token];
  await saveSessions(store);
}
