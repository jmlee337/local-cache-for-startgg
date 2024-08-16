import DatabaseContstructor, { Database } from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';
import { mkdirSync } from 'fs';
import { DbEvent, DbTournament, RendererTournament } from '../common/types';

let db: Database | undefined;
export function dbInit() {
  const docsPath = path.join(app.getPath('documents'), 'LocalCacheForStartgg');
  mkdirSync(docsPath, { recursive: true });
  db = new DatabaseContstructor(path.join(docsPath, 'db.sqlite3'));
  db.pragma('journal_mode = WAL');
  db.prepare(
    'CREATE TABLE IF NOT EXISTS tournaments (id INTEGER PRIMARY KEY, slug TEXT, name TEXT)',
  ).run();
  db.prepare(
    'CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY, tournamentId INTEGER, name TEXT)',
  ).run();
}

const TOURNAMENT_UPSERT_SQL =
  'REPLACE INTO tournaments (id, name, slug) VALUES (@id, @name, @slug)';
const EVENT_UPSERT_SQL =
  'REPLACE INTO events (id, tournamentId, name) VALUES (@id, @tournamentId, @name)';
export function upsertTournament(tournament: DbTournament, events: DbEvent[]) {
  if (!db) {
    throw new Error('not init');
  }

  db.transaction(() => {
    db!.prepare(TOURNAMENT_UPSERT_SQL).run(tournament);
    events.forEach((event) => {
      db!.prepare(EVENT_UPSERT_SQL).run(event);
    });
  })();
}

export function getTournament(id: number): RendererTournament {
  if (!db) {
    throw new Error('not init');
  }

  const dbTournament = db
    .prepare('SELECT * FROM tournaments WHERE id = @id')
    .get({ id }) as DbTournament;
  const dbEvents = db
    .prepare('SELECT * FROM events WHERE tournamentId = @id')
    .all({ id }) as DbEvent[];
  return {
    slug: dbTournament.slug,
    name: dbTournament.name,
    events: dbEvents.map((dbEvent) => ({
      id: dbEvent.id,
      name: dbEvent.name,
    })),
  };
}
