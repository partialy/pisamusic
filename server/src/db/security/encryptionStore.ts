import type { DbTransaction } from "../core/types";
import { getAppDb } from "../appDb";

export async function readPlaintextPaths(db: DbTransaction = getAppDb()): Promise<string[]> {
  const rows = (await db.query("SELECT path FROM encryption_plaintext_paths ORDER BY sort_order ASC, path ASC", [])) as { path: string }[];
  return rows.map((row) => row.path);
}

export async function replacePlaintextPaths(paths: string[]): Promise<void> {
  const db = getAppDb();
  await db.transaction(async (tx) => {
    await replacePlaintextPathsWithDb(tx, paths);
  });
}

export async function replacePlaintextPathsWithDb(db: DbTransaction, paths: string[]): Promise<void> {
  await db.execute("DELETE FROM encryption_plaintext_paths", []);
  for (let index = 0; index < paths.length; index += 1) {
    const path = paths[index];
    await db.execute("INSERT INTO encryption_plaintext_paths (path, sort_order) VALUES (?, ?)", [path, index]);
  }
}
