import DatabaseContstructor, { Database } from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';
import { mkdirSync } from 'fs';
import {
  DbEvent,
  DbPhase,
  DbPool,
  DbTournament,
  RendererTournament,
} from '../common/types';

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
    'CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY, tournamentId INTEGER, name TEXT, isOnline INTEGER)',
  ).run();
  db.prepare(
    'CREATE TABLE IF NOT EXISTS phases (id INTEGER PRIMARY KEY, eventId INTEGER, tournamentId INTEGERY, name TEXT)',
  ).run();
  db.prepare(
    'CREATE TABLE IF NOT EXISTS pools (id INTEGER PRIMARY KEY, phaseId INTEGER, eventId INTEGER, tournamentId INTEGER, name TEXT, bracketType INTEGER)',
  ).run();
}

const TOURNAMENT_UPSERT_SQL =
  'REPLACE INTO tournaments (id, name, slug) VALUES (@id, @name, @slug)';
const EVENT_UPSERT_SQL =
  'REPLACE INTO events (id, tournamentId, name, isOnline) VALUES (@id, @tournamentId, @name, @isOnline)';
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

const EVENT_UPDATE_SQL = 'UPDATE events SET name = @name WHERE id = @id';
const PHASE_UPSERT_SQL =
  'REPLACE INTO phases (id, eventId, tournamentId, name) VALUES (@id, @eventId, @tournamentId, @name)';
const POOL_UPSERT_SQL =
  'REPLACE INTO pools (id, phaseId, eventId, tournamentId, name, bracketType) VALUES (@id, @phaseId, @eventId, @tournamentId, @name, @bracketType)';
export function updateEvent(
  event: DbEvent,
  phases: DbPhase[],
  pools: DbPool[],
) {
  if (!db) {
    throw new Error('not init');
  }

  db.transaction(() => {
    db!.prepare(EVENT_UPDATE_SQL).run(event);
    phases.forEach((phase) => {
      db!.prepare(PHASE_UPSERT_SQL).run(phase);
    });
    pools.forEach((pool) => {
      db!.prepare(POOL_UPSERT_SQL).run(pool);
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
  const dbPhases = db
    .prepare('SELECT * FROM phases WHERE tournamentId = @id')
    .all({ id }) as DbPhase[];
  const dbPools = db
    .prepare('SELECT * FROM pools WHERE tournamentId = @id')
    .all({ id }) as DbPool[];
  return {
    id: dbTournament.id,
    slug: dbTournament.slug,
    events: dbEvents.map((dbEvent) => ({
      id: dbEvent.id,
      name: dbEvent.name,
      isOnline: dbEvent.isOnline === 1,
      phases: dbPhases
        .filter((dbPhase) => dbPhase.eventId === dbEvent.id)
        .map((dbPhase) => ({
          id: dbPhase.id,
          name: dbPhase.name,
          pools: dbPools
            .filter((dbPool) => dbPool.phaseId === dbPhase.id)
            .map((dbPool) => ({
              id: dbPool.id,
              name: dbPool.name,
              bracketType: dbPool.bracketType,
            })),
        })),
    })),
  };
}
