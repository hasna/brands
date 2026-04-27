import { Database } from "bun:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { ensureSchema } from "./schema.js";

function getDbPath(): string {
  if (process.env["BRANDS_DB_PATH"]) {
    return process.env["BRANDS_DB_PATH"];
  }
  const home = process.env["HOME"] || process.env["USERPROFILE"] || "~";
  return join(home, ".hasna", "brands", "brands.db");
}

function getDataDir(): string {
  if (process.env["BRANDS_DATA_DIR"]) {
    return process.env["BRANDS_DATA_DIR"];
  }
  const home = process.env["HOME"] || process.env["USERPROFILE"] || "~";
  return join(home, ".hasna", "brands");
}

function ensureDir(filePath: string): void {
  if (filePath === ":memory:") return;
  const dir = dirname(resolve(filePath));
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

let _db: Database | null = null;

export function getDb(path?: string): Database {
  if (_db) return _db;

  const dbPath = path ?? getDbPath();
  ensureDir(dbPath);

  _db = new Database(dbPath);
  _db.exec("PRAGMA journal_mode = WAL");
  _db.exec("PRAGMA foreign_keys = ON");
  ensureSchema(_db);

  return _db;
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}

export function resetDb(): void {
  _db = null;
}

export function dataDir(): string {
  const dir = getDataDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function outputsDir(): string {
  const dir = join(dataDir(), "outputs");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

export function exportsDir(): string {
  const dir = join(dataDir(), "exports");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

export function importsDir(): string {
  const dir = join(dataDir(), "imports");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}
