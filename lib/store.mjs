import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createRoom, fail } from './domain.mjs';

export function createStore(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS rooms (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, body TEXT NOT NULL); CREATE TABLE IF NOT EXISTS archives (id TEXT PRIMARY KEY, body TEXT NOT NULL)');
  if (!db.prepare('SELECT id FROM rooms WHERE id=1').get()) {
    db.prepare('INSERT INTO rooms VALUES (1, 0, ?)').run(JSON.stringify(createRoom()));
  }
  return {
    read() { return JSON.parse(db.prepare('SELECT body FROM rooms WHERE id=1').get().body); },
    save(room, expected) {
      room.revision = expected + 1;
      const result = db.prepare('UPDATE rooms SET revision=?, body=? WHERE id=1 AND revision=?').run(room.revision, JSON.stringify(room), expected);
      if (result.changes !== 1) fail(409, 'The workspace changed while this request ran. Refresh and try again.');
    },
    restart() {
      const current = this.read();
      db.prepare('INSERT OR IGNORE INTO archives VALUES (?, ?)').run(current.id, JSON.stringify(current));
      const next = createRoom(); this.save(next, current.revision); return next;
    },
    close() { db.close(); },
  };
}
