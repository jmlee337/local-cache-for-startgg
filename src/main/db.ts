import DatabaseContstructor, { Database } from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';
import { mkdirSync } from 'fs';
import {
  DbEntrant,
  DbEvent,
  DbPhase,
  DbPlayer,
  DbPool,
  DbSeed,
  DbSet,
  DbTournament,
  RendererSet,
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
  db.prepare(
    `CREATE TABLE IF NOT EXISTS sets (
      id INTEGER PRIMARY KEY,
      phaseGroupId INTEGER,
      phaseId INTEGER,
      eventId INTEGER,
      callOrder REAL,
      fullRoundText TEXT,
      identifier TEXT,
      round INTEGER,
      state INTEGER,
      streamId INTEGER,
      entrant1Id INTEGER,
      entrant1Score INTEGER,
      entrant1PrereqType TEXT,
      entrant1PrereqId INTEGER,
      entrant1PrereqCondition TEXT,
      entrant1PrereqStr TEXT,
      entrant2Id INTEGER,
      entrant2Score INTEGER,
      entrant2PrereqType TEXT,
      entrant2PrereqId INTEGER,
      entrant2PrereqCondition TEXT,
      entrant2PrereqStr TEXT,
      winnerId INTEGER,
      wProgressionSeedId INTEGER,
      wProgressingPhaseGroupId INTEGER,
      wProgressingPhaseId INTEGER,
      wProgressingName TEXT,
      loserId INTEGER,
      lProgressionSeedId INTEGER,
      lProgressingPhaseGroupId INTEGER,
      lProgressingPhaseId INTEGER,
      lProgressingName TEXT,
      createdAt INTEGER,
      startedAt INTEGER,
      completedAt INTEGER,
      updatedAt INTEGER
    )`,
  ).run();
  db.prepare(
    'CREATE TABLE IF NOT EXISTS seeds (id INTEGER PRIMARY KEY, phaseGroupId INTEGER, entrantId INTEGER, seedNum INTEGER, groupSeedNum INTEGER)',
  ).run();
  db.prepare(
    `CREATE TABLE IF NOT EXISTS entrants(
      id INTEGER PRIMARY KEY,
      eventId INTEGER,
      name TEXT,
      participant1Id INTEGER,
      participant1GamerTag TEXT,
      participant1Prefix TEXT,
      participant1Pronouns TEXT,
      participant1PlayerId INTEGER,
      participant1UserSlug TEXT,
      participant2Id INTEGER,
      participant2GamerTag TEXT,
      participant2Prefix TEXT,
      participant2Pronouns TEXT,
      participant2PlayerId INTEGER,
      participant2UserSlug TEXT
    )`,
  ).run();
  db.prepare(
    'CREATE TABLE IF NOT EXISTS players (id INTEGER PRIMARY KEY, pronouns TEXT, userSlug TEXT)',
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

  db!.prepare(TOURNAMENT_UPSERT_SQL).run(tournament);
  events.forEach((event) => {
    db!.prepare(EVENT_UPSERT_SQL).run(event);
  });
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

  db!.prepare(EVENT_UPDATE_SQL).run(event);
  phases.forEach((phase) => {
    db!.prepare(PHASE_UPSERT_SQL).run(phase);
  });
  pools.forEach((pool) => {
    db!.prepare(POOL_UPSERT_SQL).run(pool);
  });
}

const PLAYER_UPSERT_SQL =
  'REPLACE INTO players (id, pronouns, userSlug) VALUES (@id, @pronouns, @userSlug)';
export function upsertPlayer(player: DbPlayer) {
  if (!db) {
    throw new Error('not init');
  }

  db!.prepare(PLAYER_UPSERT_SQL).run(player);
}

export function upsertPlayers(players: DbPlayer[]) {
  if (!db) {
    throw new Error('not init');
  }

  players.forEach((player) => {
    db!.prepare(PLAYER_UPSERT_SQL).run(player);
  });
}

const PLAYER_GET_SQL = 'SELECT * FROM players WHERE id = @id';
export function getPlayer(id: number) {
  if (!db) {
    throw new Error('not init');
  }

  return db!.prepare(PLAYER_GET_SQL).get({ id }) as DbPlayer | undefined;
}

const POOL_UPDATE_SQL =
  'UPDATE pools SET bracketType = @bracketType, name = @name WHERE id = @id';
const ENTRANT_UPSERT_SQL = `REPLACE INTO entrants (
  id,
  eventId,
  name,
  participant1Id,
  participant1GamerTag,
  participant1Prefix,
  participant1Pronouns,
  participant1PlayerId,
  participant1UserSlug,
  participant2Id,
  participant2GamerTag,
  participant2Prefix,
  participant2Pronouns,
  participant2PlayerId,
  participant2UserSlug
) values (
  @id,
  @eventId,
  @name,
  @participant1Id,
  @participant1GamerTag,
  @participant1Prefix,
  @participant1Pronouns,
  @participant1PlayerId,
  @participant1UserSlug,
  @participant2Id,
  @participant2GamerTag,
  @participant2Prefix,
  @participant2Pronouns,
  @participant2PlayerId,
  @participant2UserSlug
)`;
const SEED_UPSERT_SQL = `REPLACE INTO seeds (
  id, phaseGroupId, entrantId, seedNum, groupSeedNum
) values (
  @id, @phaseGroupId, @entrantId, @seedNum, @groupSeedNum
)`;
const SET_UPSERT_SQL = `REPLACE INTO sets (
  id,
  phaseGroupId,
  phaseId,
  eventId,
  callOrder,
  fullRoundText,
  identifier,
  round,
  state,
  streamId,
  entrant1Id,
  entrant1Score,
  entrant1PrereqType,
  entrant1PrereqId,
  entrant1PrereqCondition,
  entrant1PrereqStr,
  entrant2Id,
  entrant2Score,
  entrant2PrereqType,
  entrant2PrereqId,
  entrant2PrereqCondition,
  entrant2PrereqStr,
  winnerId,
  wProgressionSeedId,
  wProgressingPhaseGroupId,
  wProgressingPhaseId,
  wProgressingName,
  loserId,
  lProgressionSeedId,
  lProgressingPhaseGroupId,
  lProgressingPhaseId,
  lProgressingName,
  createdAt,
  startedAt,
  completedAt,
  updatedAt
) values (
  @id,
  @phaseGroupId,
  @phaseId,
  @eventId,
  @callOrder,
  @fullRoundText,
  @identifier,
  @round,
  @state,
  @streamId,
  @entrant1Id,
  @entrant1Score,
  @entrant1PrereqType,
  @entrant1PrereqId,
  @entrant1PrereqCondition,
  @entrant1PrereqStr,
  @entrant2Id,
  @entrant2Score,
  @entrant2PrereqType,
  @entrant2PrereqId,
  @entrant2PrereqCondition,
  @entrant2PrereqStr,
  @winnerId,
  @wProgressionSeedId,
  @wProgressingPhaseGroupId,
  @wProgressingPhaseId,
  @wProgressingName,
  @loserId,
  @lProgressionSeedId,
  @lProgressingPhaseGroupId,
  @lProgressingPhaseId,
  @lProgressingName,
  @createdAt,
  @startedAt,
  @completedAt,
  @updatedAt
)`;
export function updatePool(
  pool: DbPool,
  entrants: DbEntrant[],
  seeds: DbSeed[],
  sets: DbSet[],
) {
  if (!db) {
    throw new Error('not init');
  }
  db!.prepare(POOL_UPDATE_SQL).run(pool);
  entrants.forEach((entrant) => {
    db!.prepare(ENTRANT_UPSERT_SQL).run(entrant);
  });
  seeds.forEach((seed) => {
    db!.prepare(SEED_UPSERT_SQL).run(seed);
  });
  sets.forEach((set) => {
    db!.prepare(SET_UPSERT_SQL).run(set);
  });
}

type ProgressionSet = {
  id: number;
  identifier: string;
  entrantNum: 1 | 2;
  entrantId: number;
  prereqStr: string;
};
export function reportSet(
  id: number,
  winnerId: number,
  loserId: number,
  entrant1Score: number | null,
  entrant2Score: number | null,
) {
  if (!db) {
    throw new Error('not init');
  }

  const set = db!.prepare('SELECT * FROM sets WHERE id = @id').get({ id }) as
    | DbSet
    | undefined;
  if (!set) {
    throw new Error(`no such set: ${id}`);
  }
  if (!set.entrant1Id || !set.entrant2Id) {
    throw new Error(
      `set not reportable: ${id}, entrant1Id ${set.entrant1Id}, entrant2Id ${set.entrant2Id}`,
    );
  }
  if (
    !(set.entrant1Id === winnerId && set.entrant2Id === loserId) &&
    !(set.entrant1Id === loserId && set.entrant2Id === winnerId)
  ) {
    throw new Error(
      `wrong ids: entrant1Id: ${set.entrant1Id}, entrant2Id: ${set.entrant2Id}, winnerId: ${winnerId}, loserId: ${loserId}`,
    );
  }

  let wProgressionSet: ProgressionSet | undefined;
  let lProgressionSet: ProgressionSet | undefined;
  const maybeAssignProgression = (
    setId: number,
    identifier: string,
    entrantNum: 1 | 2,
    prereqCondition: string | null,
    prereqStr: string | null,
  ) => {
    if (prereqCondition === 'winner') {
      if (wProgressionSet) {
        throw new Error(
          `already have wProgressionSet: ${wProgressionSet.id}, found: ${setId}`,
        );
      }
      wProgressionSet = {
        id: setId,
        identifier,
        entrantNum,
        entrantId: winnerId,
        prereqStr: prereqStr!,
      };
    }
    if (prereqCondition === 'loser') {
      if (lProgressionSet) {
        throw new Error(
          `already have lProgressionSet: ${lProgressionSet.id}, found: ${setId}`,
        );
      }
      lProgressionSet = {
        id: setId,
        identifier,
        entrantNum,
        entrantId: loserId,
        prereqStr: prereqStr!,
      };
    }
    throw new Error(
      `prereqCondition was not 'winner' or 'loser': ${prereqCondition}`,
    );
  };
  (
    db!
      .prepare(
        'SELECT * FROM sets WHERE entrant1PrereqId = @id OR entrant2PrereqId = @id',
      )
      .all({ id }) as DbSet[]
  ).forEach((dbSet) => {
    if (
      dbSet.entrant1PrereqId === id &&
      dbSet.entrant2PrereqId === id &&
      winnerId === set.entrant1Id
    ) {
      // no progressions if GF won from winners
      return;
    }
    if (dbSet.entrant1PrereqId === id) {
      maybeAssignProgression(
        dbSet.id,
        dbSet.identifier,
        1,
        dbSet.entrant1PrereqCondition,
        dbSet.entrant1PrereqStr,
      );
    }
    if (dbSet.entrant2PrereqId === id) {
      maybeAssignProgression(
        dbSet.id,
        dbSet.identifier,
        2,
        dbSet.entrant2PrereqCondition,
        dbSet.entrant2PrereqStr,
      );
    }
  });
  if (set.wProgressionSeedId) {
    const affectedSet = db!
      .prepare(
        'SELECT * FROM sets WHERE entrant1PrereqId = @seedId OR entrant2PrereqId = @seedId',
      )
      .get({ seedId: set.wProgressionSeedId }) as DbSet | undefined;
    if (affectedSet) {
      if (wProgressionSet) {
        throw new Error(
          `already have wProgressionSet: ${wProgressionSet.id}, found: ${affectedSet.id}`,
        );
      }
      const entrantNum =
        affectedSet.entrant1PrereqId === set.wProgressionSeedId ? 1 : 2;
      wProgressionSet = {
        id: affectedSet.id,
        identifier: affectedSet.identifier,
        entrantNum,
        entrantId: winnerId,
        prereqStr:
          entrantNum === 1
            ? affectedSet.entrant1PrereqStr!
            : affectedSet.entrant2PrereqStr!,
      };
    }
  }
  if (set.lProgressionSeedId) {
    const affectedSet = db!
      .prepare(
        'SELECT * FROM sets WHERE entrant1PrereqId = @seedId OR entrant2PrereqId = @seedId',
      )
      .get({ seedId: set.lProgressionSeedId }) as DbSet | undefined;
    if (affectedSet) {
      if (lProgressionSet) {
        throw new Error(
          `already have lProgressionSet: ${lProgressionSet.id}, found: ${affectedSet.id}`,
        );
      }
      const entrantNum =
        affectedSet.entrant1PrereqId === set.lProgressionSeedId ? 1 : 2;
      lProgressionSet = {
        id: affectedSet.id,
        identifier: affectedSet.identifier,
        entrantNum,
        entrantId: loserId,
        prereqStr:
          entrantNum === 1
            ? affectedSet.entrant1PrereqStr!
            : affectedSet.entrant2PrereqStr!,
      };
    }
  }
  console.log(
    `Reporting ${set.identifier}: ${set.entrant1Id} ${
      entrant1Score ?? (winnerId === set.entrant1Id ? 'W' : 'L')
    } - ${entrant2Score ?? (winnerId === set.entrant2Id ? 'W' : 'L')} ${
      set.entrant2Id
    }`,
  );
  if (wProgressionSet) {
    console.log(
      `Winner progresses to ${wProgressionSet.identifier}, entrant${wProgressionSet.entrantNum}: ${wProgressionSet.prereqStr}`,
    );
  }
  if (lProgressionSet) {
    console.log(
      `Loser progresses to ${lProgressionSet.identifier}, entrant${lProgressionSet.entrantNum}: ${lProgressionSet.prereqStr}`,
    );
  }
}

function getEntrantName(id: number): string | null {
  const maybeEntrant = db!
    .prepare('SELECT * FROM entrants WHERE id = @id')
    .get({ id }) as DbEntrant | undefined;
  if (!maybeEntrant) {
    return null;
  }

  return maybeEntrant.participant2Id
    ? maybeEntrant.name
    : maybeEntrant.participant1GamerTag;
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
  const dbPools = (
    db
      .prepare('SELECT * FROM pools WHERE tournamentId = @id')
      .all({ id }) as DbPool[]
  ).sort((a, b) => {
    if (a.name.length === b.name.length) {
      return a.name.localeCompare(b.name);
    }
    return a.name.length - b.name.length;
  });
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
            .map((dbPool) => {
              const sets = (
                db!
                  .prepare(
                    'SELECT * FROM sets WHERE phaseGroupId = @id ORDER BY callOrder, id',
                  )
                  .all({ id: dbPool.id }) as DbSet[]
              ).map((dbSet): RendererSet => {
                const entrant1Name = dbSet.entrant1Id
                  ? getEntrantName(dbSet.entrant1Id)
                  : null;
                const entrant2Name = dbSet.entrant2Id
                  ? getEntrantName(dbSet.entrant2Id)
                  : null;
                return {
                  id: dbSet.id,
                  fullRoundText: dbSet.fullRoundText,
                  identifier: dbSet.identifier,
                  state: dbSet.state,
                  entrant1Id: dbSet.entrant1Id,
                  entrant1Name,
                  entrant1PrereqStr: dbSet.entrant1PrereqStr,
                  entrant1Score: dbSet.entrant1Score,
                  entrant2Id: dbSet.entrant2Id,
                  entrant2Name,
                  entrant2PrereqStr: dbSet.entrant2PrereqStr,
                  entrant2Score: dbSet.entrant2Score,
                  winnerId: dbSet.winnerId,
                };
              });
              return {
                id: dbPool.id,
                name: dbPool.name,
                bracketType: dbPool.bracketType,
                sets,
              };
            }),
        })),
    })),
  };
}
