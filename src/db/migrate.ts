import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

export function runMigrations(dbPath: string): void {
  let db: Database.Database;

  try {
    db = new Database(dbPath);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[ERROR] migration: failed to open database at ${dbPath}: ${msg}`);
    process.exit(1);
  }

  db.exec(
    `CREATE TABLE IF NOT EXISTS _migrations (
      id TEXT PRIMARY KEY,
      run_at TEXT NOT NULL
    )`
  );

  const migrationsDir = path.join(__dirname, "migrations");
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const id = file.replace(/\.sql$/, "");
    const already = db
      .prepare("SELECT id FROM _migrations WHERE id = ?")
      .get(id);

    if (already) continue;

    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
    try {
      db.exec(sql);
      db.prepare("INSERT INTO _migrations (id, run_at) VALUES (?, ?)").run(
        id,
        new Date().toISOString()
      );
      console.log(`[INFO] migration: ${file} applied`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[ERROR] migration: ${file} failed: ${msg}`);
      process.exit(1);
    }
  }
}
