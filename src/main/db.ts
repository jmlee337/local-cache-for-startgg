import DatabaseContstructor, { Database } from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';
import { mkdirSync } from 'fs';
import {
  AdminedTournament,
  ApiSetUpdate,
  ApiTransaction,
  DbEntrant,
  DbEvent,
  DbGameData,
  DbLoadedEvent,
  DbPhase,
  DbPlayer,
  DbPool,
  DbSelections,
  DbSet,
  DbSetMutation,
  DbTournament,
  DbTransaction,
  RendererEvent,
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
    'CREATE TABLE IF NOT EXISTS tournaments (id INTEGER PRIMARY KEY, slug TEXT, name TEXT, startAt INTEGER)',
  ).run();
  db.prepare(
    'CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY, tournamentId INTEGER, name TEXT, isOnline INTEGER)',
  ).run();
  db.prepare(
    'CREATE TABLE IF NOT EXISTS loadedEvents (id INTEGER PRIMARY KEY, tournamentId INTEGER NOT NULL)',
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
      tournamentId, INTEGER,
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
      lProgressionSeedId INTEGER,
      lProgressingPhaseGroupId INTEGER,
      lProgressingPhaseId INTEGER,
      lProgressingName TEXT,
      updatedAt INTEGER,
      syncState INTEGER NOT NULL
    )`,
  ).run();
  db.prepare(
    `CREATE TABLE IF NOT EXISTS setMutations (
      id INTEGER PRIMARY KEY ASC AUTOINCREMENT,
      setId INTEGER NOT NULL,
      phaseGroupId INTEGER NOT NULL,
      phaseId INTEGER NOT NULL,
      eventId INTEGER NOT NULL,
      tournamentId INTEGER NOT NULL,
      transactionNum INTEGER NOT NULL,
      isReleased INTEGER,
      queuedMs INTEGER NOT NULL,
      requiresUpdateHack INTEGER,
      statePresent INTEGER,
      state INTEGER,
      entrant1IdPresent INTEGER,
      entrant1Id INTEGER,
      entrant1ScorePresent INTEGER,
      entrant1Score INTEGER,
      entrant2IdPresent INTEGER,
      entrant2Id INTEGER,
      entrant2ScorePresent INTEGER,
      entrant2Score INTEGER,
      winnerIdPresent INTEGER,
      winnerId INTEGER,
      streamIdPresent INTEGER,
      streamId INTEGER
    )`,
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
  db.prepare(
    `CREATE TABLE IF NOT EXISTS transactions (
      transactionNum INTEGER PRIMARY KEY,
      type INTEGER NOT NULL,
      setId INTEGER NOT NULL,
      winnerId INTEGER,
      isDQ INTEGER
    )`,
  ).run();
  db.prepare(
    `CREATE TABLE IF NOT EXISTS gameData (
      transactionNum INTEGER,
      gameNum INTEGER,
      winnerId INTEGER NOT NULL,
      stageId INTEGER,
      PRIMARY KEY (transactionNum, gameNum)
    )`,
  ).run();
  db.prepare(
    `CREATE TABLE IF NOT EXISTS selections (
      transactionNum INTEGER,
      gameNum INTEGER,
      entrantId INTEGER,
      characterId INTEGER NOT NULL,
      PRIMARY KEY (transactionNum, gameNum, entrantId)
    )`,
  ).run();
  const init = db
    .prepare(
      'SELECT transactionNum FROM transactions ORDER BY transactionNum DESC LIMIT 1',
    )
    .get() as { transactionNum: number } | undefined;
  return init ? init.transactionNum + 1 : 1;
}

let currentTournamentId = 0;
export function getTournamentId() {
  return currentTournamentId;
}
export function setTournamentId(newTournamentId: number) {
  currentTournamentId = newTournamentId;
}

const TOURNAMENT_UPSERT_SQL =
  'REPLACE INTO tournaments (id, name, slug, startAt) VALUES (@id, @name, @slug, @startAt)';
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

export function upsertEvent(
  event: DbEvent,
  phases: DbPhase[],
  pools: DbPool[],
) {
  if (!db) {
    throw new Error('not init');
  }

  db.prepare(
    `REPLACE INTO
      events
        (id, tournamentId, name, isOnline)
      VALUES
        (@id, @tournamentId, @name, @isOnline)`,
  ).run(event);
  db.prepare(
    'REPLACE INTO loadedEvents (id, tournamentId) VALUES (@id, @tournamentId)',
  ).run(event);
  phases.forEach((phase) => {
    db!
      .prepare(
        `REPLACE INTO
          phases
            (id, eventId, tournamentId, name)
          VALUES
            (@id, @eventId, @tournamentId, @name)`,
      )
      .run(phase);
  });
  pools.forEach((pool) => {
    db!
      .prepare(
        `REPLACE INTO
          pools
            (id, phaseId, eventId, tournamentId, name, bracketType)
          VALUES
            (@id, @phaseId, @eventId, @tournamentId, @name, @bracketType)`,
      )
      .run(pool);
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
const SET_UPSERT_SQL = `REPLACE INTO sets (
  id,
  phaseGroupId,
  phaseId,
  eventId,
  tournamentId,
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
  lProgressionSeedId,
  lProgressingPhaseGroupId,
  lProgressingPhaseId,
  lProgressingName,
  updatedAt,
  syncState
) values (
  @id,
  @phaseGroupId,
  @phaseId,
  @eventId,
  @tournamentId,
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
  @lProgressionSeedId,
  @lProgressingPhaseGroupId,
  @lProgressingPhaseId,
  @lProgressingName,
  @updatedAt,
  0
)`;
export function upsertPool(pool: DbPool, entrants: DbEntrant[], sets: DbSet[]) {
  if (!db) {
    throw new Error('not init');
  }

  db.prepare(
    `REPLACE INTO
      pools
        (id, phaseId, eventId, tournamentId, name, bracketType)
      VALUES
        (@id, @phaseId, @eventId, @tournamentId, @name, @bracketType)`,
  ).run(pool);
  entrants.forEach((entrant) => {
    db!.prepare(ENTRANT_UPSERT_SQL).run(entrant);
  });
  sets.forEach((set) => {
    db!.prepare(SET_UPSERT_SQL).run(set);
    // TODO check for setMutations conflicts
  });
}

export function updateSets(sets: DbSet[]) {
  if (!db) {
    throw new Error('not init');
  }

  sets.forEach((set) => {
    db!
      .prepare(
        `UPDATE sets
          SET
            state = @state,
            entrant1Id = @entrant1Id,
            entrant1Score = @entrant1Score,
            entrant2Id = @entrant2Id,
            entrant2Score = @entrant2Score,
            winnerId = @winnerId,
            updatedAt = @updatedAt
          WHERE id = @id AND updatedAt < @updatedAt`,
      )
      .run(set);
    // TODO check for setMutations conflicts
  });
}

function applyMutation(set: DbSet, setMutation: DbSetMutation) {
  if (setMutation.statePresent) {
    set.state = setMutation.state!;
  }
  if (setMutation.entrant1IdPresent) {
    set.entrant1Id = setMutation.entrant1Id;
  }
  if (setMutation.entrant1ScorePresent) {
    set.entrant1Score = setMutation.entrant1Score;
  }
  if (setMutation.entrant2IdPresent) {
    set.entrant2Id = setMutation.entrant2Id;
  }
  if (setMutation.entrant2ScorePresent) {
    set.entrant2Score = setMutation.entrant2Score;
  }
  if (setMutation.winnerIdPresent) {
    set.winnerId = setMutation.winnerId;
  }
  if (setMutation.streamIdPresent) {
    set.streamId = setMutation.streamId;
  }
  if (setMutation.queuedMs > 0) {
    set.syncState = 1;
  } else if (setMutation.isReleased) {
    set.syncState = 2;
  } else {
    set.syncState = 3;
  }
}

type ResetProgressionSet = {
  id: number;
  phaseGroupId: number;
  phaseId: number;
  eventId: number;
  tournamentId: number;
  entrantNum: 1 | 2;
};
export function resetSet(id: number, transactionNum: number, queuedMs: number) {
  if (!db) {
    throw new Error('not init');
  }

  const set = db!.prepare('SELECT * FROM sets WHERE id = @id').get({ id }) as
    | DbSet
    | undefined;
  if (!set) {
    throw new Error(`no such set: ${id}`);
  }
  (
    db!
      .prepare('SELECT * FROM setMutations WHERE setId = @id')
      .all({ id }) as DbSetMutation[]
  ).forEach((setMutation) => {
    applyMutation(set, setMutation);
  });
  if (set.state === 1) {
    return;
  }

  let wProgressionSet: ResetProgressionSet | undefined;
  let lProgressionSet: ResetProgressionSet | undefined;
  if (set.state === 3) {
    const { wProgressionSeedId, lProgressionSeedId } = set;
    const maybeAssignProgression = (
      setId: number,
      phaseGroupId: number,
      phaseId: number,
      eventId: number,
      tournamentId: number,
      entrantNum: 1 | 2,
      prereqCondition: string | null,
    ) => {
      if (prereqCondition !== 'winner' && prereqCondition !== 'loser') {
        throw new Error(
          `prereqCondition was not 'winner' or 'loser': ${prereqCondition}`,
        );
      }

      if (prereqCondition === 'winner') {
        if (wProgressionSet) {
          throw new Error(
            `already have wProgressionSet: ${wProgressionSet.id}, found: ${setId}`,
          );
        }
        wProgressionSet = {
          id: setId,
          phaseGroupId,
          phaseId,
          eventId,
          tournamentId,
          entrantNum,
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
          phaseGroupId,
          phaseId,
          eventId,
          tournamentId,
          entrantNum,
        };
      }
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
        set.winnerId === set.entrant1Id &&
        set.fullRoundText === 'Grand Final'
      ) {
        // no progressions if GF won from winners
        return;
      }
      (
        db!
          .prepare('SELECT * FROM setMutations WHERE setId = @id')
          .all({ id: dbSet.id }) as DbSetMutation[]
      ).forEach((setMutation) => {
        applyMutation(dbSet, setMutation);
      });
      if (dbSet.state !== 1) {
        throw new Error(`Cannot reset due to dependent sets: ${id}`);
      }
      if (dbSet.entrant1PrereqId === id) {
        maybeAssignProgression(
          dbSet.id,
          dbSet.phaseGroupId,
          dbSet.phaseId,
          dbSet.eventId,
          dbSet.tournamentId,
          1,
          dbSet.entrant1PrereqCondition,
        );
      }
      if (dbSet.entrant2PrereqId === id) {
        maybeAssignProgression(
          dbSet.id,
          dbSet.phaseGroupId,
          dbSet.phaseId,
          dbSet.eventId,
          dbSet.tournamentId,
          2,
          dbSet.entrant2PrereqCondition,
        );
      }
    });
    if (wProgressionSeedId) {
      const affectedSet = db!
        .prepare(
          'SELECT * FROM sets WHERE entrant1PrereqId = @seedId OR entrant2PrereqId = @seedId',
        )
        .get({ seedId: wProgressionSeedId }) as DbSet | undefined;
      if (affectedSet) {
        if (wProgressionSet) {
          throw new Error(
            `already have wProgressionSet: ${wProgressionSet.id}, found: ${affectedSet.id}`,
          );
        }
        (
          db!
            .prepare('SELECT * FROM setMutations WHERE setId = @id')
            .all({ id: affectedSet.id }) as DbSetMutation[]
        ).forEach((setMutation) => {
          applyMutation(affectedSet, setMutation);
        });
        if (affectedSet.state !== 1) {
          throw new Error(`Cannot reset due to dependent sets: ${id}`);
        }
        wProgressionSet = {
          id: affectedSet.id,
          phaseGroupId: affectedSet.phaseGroupId,
          phaseId: affectedSet.phaseId,
          eventId: affectedSet.eventId,
          tournamentId: affectedSet.tournamentId,
          entrantNum:
            affectedSet.entrant1PrereqId === wProgressionSeedId ? 1 : 2,
        };
      }
    }
    if (lProgressionSeedId) {
      const affectedSet = db!
        .prepare(
          'SELECT * FROM sets WHERE entrant1PrereqId = @seedId OR entrant2PrereqId = @seedId',
        )
        .get({ seedId: lProgressionSeedId }) as DbSet | undefined;
      if (affectedSet) {
        if (lProgressionSet) {
          throw new Error(
            `already have lProgressionSet: ${lProgressionSet.id}, found: ${affectedSet.id}`,
          );
        }
        (
          db!
            .prepare('SELECT * FROM setMutations WHERE setId = @id')
            .all({ id: affectedSet.id }) as DbSetMutation[]
        ).forEach((setMutation) => {
          applyMutation(affectedSet, setMutation);
        });
        if (affectedSet.state !== 1) {
          throw new Error(`Cannot reset due to dependent sets: ${id}`);
        }
        lProgressionSet = {
          id: affectedSet.id,
          phaseGroupId: affectedSet.phaseGroupId,
          phaseId: affectedSet.phaseId,
          eventId: affectedSet.eventId,
          tournamentId: affectedSet.tournamentId,
          entrantNum:
            affectedSet.entrant1PrereqId === lProgressionSeedId ? 1 : 2,
        };
      }
    }
  }

  db.transaction(() => {
    db!
      .prepare(
        `INSERT INTO setMutations (
          setId,
          phaseGroupId,
          phaseId,
          eventId,
          tournamentId,
          transactionNum,
          queuedMs,
          statePresent,
          state,
          entrant1ScorePresent,
          entrant1Score,
          entrant2ScorePresent,
          entrant2Score,
          winnerIdPresent,
          winnerId
        ) VALUES (
          @id,
          @phaseGroupId,
          @phaseId,
          @eventId,
          @tournamentId,
          @transactionNum,
          @queuedMs,
          1,
          1,
          1,
          null,
          1,
          null,
          1,
          null
        )`,
      )
      .run({
        id,
        phaseGroupId: set.phaseGroupId,
        phaseId: set.phaseId,
        eventId: set.eventId,
        tournamentId: set.tournamentId,
        transactionNum,
        queuedMs,
      });
    if (wProgressionSet) {
      db!
        .prepare(
          `INSERT INTO setMutations (
            setId,
            phaseGroupId,
            phaseId,
            eventId,
            tournamentId,
            transactionNum,
            queuedMs,
            requiresUpdateHack,
            entrant${wProgressionSet.entrantNum}IdPresent,
            entrant${wProgressionSet.entrantNum}Id
          ) VALUES (
            @id,
            @phaseGroupId,
            @phaseId,
            @eventId,
            @tournamentId,
            @transactionNum,
            @queuedMs,
            1,
            1,
            null
          )`,
        )
        .run({
          id: wProgressionSet.id,
          phaseGroupId: wProgressionSet.phaseGroupId,
          phaseId: wProgressionSet.phaseId,
          eventId: wProgressionSet.eventId,
          tournamentId: wProgressionSet.tournamentId,
          transactionNum,
          queuedMs,
        });
    }
    if (lProgressionSet) {
      db!
        .prepare(
          `INSERT INTO setMutations (
            setId,
            phaseGroupId,
            phaseId,
            eventId,
            tournamentId,
            transactionNum,
            queuedMs,
            requiresUpdateHack,
            entrant${lProgressionSet.entrantNum}IdPresent,
            entrant${lProgressionSet.entrantNum}Id
          ) VALUES (
            @id,
            @phaseGroupId,
            @phaseId,
            @eventId,
            @tournamentId,
            @transactionNum,
            @queuedMs,
            1,
            1,
            null
          )`,
        )
        .run({
          id: lProgressionSet.id,
          phaseGroupId: lProgressionSet.phaseGroupId,
          phaseId: lProgressionSet.phaseId,
          eventId: lProgressionSet.eventId,
          tournamentId: lProgressionSet.tournamentId,
          transactionNum,
          queuedMs,
        });
    }
  })();
}

export function startSet(id: number, transactionNum: number, queuedMs: number) {
  if (!db) {
    throw new Error('not init');
  }

  const set = db!.prepare('SELECT * FROM sets WHERE id = @id').get({ id }) as
    | DbSet
    | undefined;
  if (!set) {
    throw new Error(`no such set: ${id}`);
  }
  (
    db!
      .prepare('SELECT * FROM setMutations WHERE setId = @id')
      .all({ id }) as DbSetMutation[]
  ).forEach((setMutation) => {
    applyMutation(set, setMutation);
  });
  if (set.state === 3) {
    throw new Error(`set is already completed: ${id}`);
  }
  if (set.state === 2) {
    return;
  }
  if (set.state !== 1 && set.state !== 6) {
    throw new Error(`set: ${id} has unexpected state: ${set.state}`);
  }

  db!
    .prepare(
      `INSERT INTO setMutations (
        setId,
        phaseGroupId,
        phaseId,
        eventId,
        tournamentId,
        transactionNum,
        queuedMs,
        statePresent,
        state
      ) VALUES (
        @id,
        @phaseGroupId,
        @phaseId,
        @eventId,
        @tournamentId,
        @transactionNum,
        @queuedMs,
        1,
        2
      )`,
    )
    .run({
      id,
      phaseGroupId: set.phaseGroupId,
      phaseId: set.phaseId,
      eventId: set.eventId,
      tournamentId: set.tournamentId,
      transactionNum,
      queuedMs,
    });
}

type ReportProgressionSet = ResetProgressionSet & {
  requiresUpdateHack: boolean;
  entrantId: number;
};
export function reportSet(
  id: number,
  winnerId: number,
  isDQ: boolean,
  transactionNum: number,
  queuedMs: number,
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
  (
    db!
      .prepare('SELECT * FROM setMutations WHERE setId = @id')
      .all({ id }) as DbSetMutation[]
  ).forEach((setMutation) => {
    applyMutation(set, setMutation);
  });
  const { entrant1Id, entrant2Id, wProgressionSeedId, lProgressionSeedId } =
    set;
  if (!entrant1Id || !entrant2Id) {
    throw new Error(
      `set not reportable: ${id}, entrant1Id ${entrant1Id}, entrant2Id ${entrant2Id}`,
    );
  }
  if (winnerId !== entrant1Id && winnerId !== entrant2Id) {
    throw new Error(
      `invalid winnerId: ${winnerId} (${entrant1Id}, ${entrant2Id})`,
    );
  }
  const loserId = winnerId === entrant1Id ? entrant2Id : entrant1Id;
  let entrant1Score: number | null = null;
  let entrant2Score: number | null = null;
  if (isDQ) {
    entrant1Score = winnerId === entrant1Id ? 0 : -1;
    entrant2Score = winnerId === entrant2Id ? 0 : -1;
  }

  let wProgressionSet: ReportProgressionSet | undefined;
  let lProgressionSet: ReportProgressionSet | undefined;
  const maybeAssignProgression = (
    setId: number,
    phaseGroupId: number,
    phaseId: number,
    eventId: number,
    tournamentId: number,
    entrantNum: 1 | 2,
    prereqCondition: string | null,
  ) => {
    if (prereqCondition !== 'winner' && prereqCondition !== 'loser') {
      throw new Error(
        `prereqCondition was not 'winner' or 'loser': ${prereqCondition}`,
      );
    }

    if (prereqCondition === 'winner') {
      if (wProgressionSet) {
        throw new Error(
          `already have wProgressionSet: ${wProgressionSet.id}, found: ${setId}`,
        );
      }
      wProgressionSet = {
        id: setId,
        phaseGroupId,
        phaseId,
        eventId,
        tournamentId,
        requiresUpdateHack: false,
        entrantNum,
        entrantId: winnerId,
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
        phaseGroupId,
        phaseId,
        eventId,
        tournamentId,
        requiresUpdateHack: false,
        entrantNum,
        entrantId: loserId,
      };
    }
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
      winnerId === entrant1Id &&
      set.fullRoundText === 'Grand Final'
    ) {
      // no progressions if GF won from winners
      return;
    }
    if (dbSet.entrant1PrereqId === id) {
      maybeAssignProgression(
        dbSet.id,
        dbSet.phaseGroupId,
        dbSet.phaseId,
        dbSet.eventId,
        dbSet.tournamentId,
        1,
        dbSet.entrant1PrereqCondition,
      );
    }
    if (dbSet.entrant2PrereqId === id) {
      maybeAssignProgression(
        dbSet.id,
        dbSet.phaseGroupId,
        dbSet.phaseId,
        dbSet.eventId,
        dbSet.tournamentId,
        2,
        dbSet.entrant2PrereqCondition,
      );
    }
  });
  if (wProgressionSeedId) {
    const affectedSet = db!
      .prepare(
        'SELECT * FROM sets WHERE entrant1PrereqId = @seedId OR entrant2PrereqId = @seedId',
      )
      .get({ seedId: wProgressionSeedId }) as DbSet | undefined;
    if (affectedSet) {
      if (wProgressionSet) {
        throw new Error(
          `already have wProgressionSet: ${wProgressionSet.id}, found: ${affectedSet.id}`,
        );
      }
      wProgressionSet = {
        id: affectedSet.id,
        phaseGroupId: affectedSet.phaseGroupId,
        phaseId: affectedSet.phaseId,
        eventId: affectedSet.eventId,
        tournamentId: affectedSet.tournamentId,
        requiresUpdateHack: true,
        entrantNum: affectedSet.entrant1PrereqId === wProgressionSeedId ? 1 : 2,
        entrantId: winnerId,
      };
    }
  }
  if (lProgressionSeedId) {
    const affectedSet = db!
      .prepare(
        'SELECT * FROM sets WHERE entrant1PrereqId = @seedId OR entrant2PrereqId = @seedId',
      )
      .get({ seedId: lProgressionSeedId }) as DbSet | undefined;
    if (affectedSet) {
      if (lProgressionSet) {
        throw new Error(
          `already have lProgressionSet: ${lProgressionSet.id}, found: ${affectedSet.id}`,
        );
      }
      lProgressionSet = {
        id: affectedSet.id,
        phaseGroupId: affectedSet.phaseGroupId,
        phaseId: affectedSet.phaseId,
        eventId: affectedSet.eventId,
        tournamentId: affectedSet.tournamentId,
        requiresUpdateHack: true,
        entrantNum: affectedSet.entrant1PrereqId === lProgressionSeedId ? 1 : 2,
        entrantId: loserId,
      };
    }
  }
  db!.transaction(() => {
    db!
      .prepare(
        `INSERT INTO setMutations (
          setId,
          phaseGroupId,
          phaseId,
          eventId,
          tournamentId,
          transactionNum,
          queuedMs,
          statePresent,
          state,
          entrant1ScorePresent,
          entrant1Score,
          entrant2ScorePresent,
          entrant2Score,
          winnerIdPresent,
          winnerId
        ) VALUES (
          @id,
          @phaseGroupId,
          @phaseId,
          @eventId,
          @tournamentId,
          @transactionNum,
          @queuedMs,
          1,
          @state,
          1,
          @entrant1Score,
          1,
          @entrant2Score,
          1,
          @winnerId
        )`,
      )
      .run({
        id,
        phaseGroupId: set.phaseGroupId,
        phaseId: set.phaseId,
        eventId: set.eventId,
        tournamentId: set.tournamentId,
        transactionNum,
        queuedMs,
        state: 3,
        entrant1Score,
        entrant2Score,
        winnerId,
      });
    if (wProgressionSet) {
      db!
        .prepare(
          `INSERT INTO setMutations (
            setId,
            phaseGroupId,
            phaseId,
            eventId,
            tournamentId,
            transactionNum,
            queuedMs,
            requiresUpdateHack,
            entrant${wProgressionSet.entrantNum}IdPresent,
            entrant${wProgressionSet.entrantNum}Id
          ) VALUES (
            @id,
            @phaseGroupId,
            @phaseId,
            @eventId,
            @tournamentId,
            @transactionNum,
            @queuedMs,
            @requiresUpdateHack,
            1,
            @entrantId
          )`,
        )
        .run({
          id: wProgressionSet.id,
          phaseGroupId: wProgressionSet.phaseGroupId,
          phaseId: wProgressionSet.phaseId,
          eventId: wProgressionSet.eventId,
          tournamentId: wProgressionSet.tournamentId,
          transactionNum,
          queuedMs,
          requiresUpdateHack: wProgressionSet.requiresUpdateHack ? 1 : null,
          entrantId: wProgressionSet.entrantId,
        });
    }
    if (lProgressionSet) {
      db!
        .prepare(
          `INSERT INTO setMutations (
            setId,
            phaseGroupId,
            phaseId,
            eventId,
            tournamentId,
            transactionNum,
            queuedMs,
            requiresUpdateHack,
            entrant${lProgressionSet.entrantNum}IdPresent,
            entrant${lProgressionSet.entrantNum}Id
          ) VALUES (
            @id,
            @phaseGroupId,
            @phaseId,
            @eventId,
            @tournamentId,
            @transactionNum,
            @queuedMs,
            @requiresUpdateHack,
            1,
            @entrantId
          )`,
        )
        .run({
          id: lProgressionSet.id,
          phaseGroupId: lProgressionSet.phaseGroupId,
          phaseId: lProgressionSet.phaseId,
          eventId: lProgressionSet.eventId,
          tournamentId: lProgressionSet.tournamentId,
          transactionNum,
          queuedMs,
          requiresUpdateHack: lProgressionSet.requiresUpdateHack ? 1 : null,
          entrantId: lProgressionSet.entrantId,
        });
    }
  })();
}

export function insertTransaction(apiTransaction: ApiTransaction) {
  if (!db) {
    throw new Error('not init');
  }

  db!.transaction(() => {
    db!
      .prepare(
        `INSERT INTO transactions (
          transactionNum, type, setId, winnerId, isDQ
        ) VALUES (
          @transactionNum, @type, @setId, @winnerId, @isDQ
        )`,
      )
      .run({
        transactionNum: apiTransaction.transactionNum,
        type: apiTransaction.type,
        setId: apiTransaction.setId,
        winnerId: apiTransaction.winnerId ?? null,
        isDQ: apiTransaction.isDQ ? 1 : 0,
      });
    apiTransaction.gameData?.forEach((gameData) => {
      db!
        .prepare(
          `INSERT INTO gameData (
            transactionNum, gameNum, winnerId, stageId
          ) VALUES (
           @transactionNum, @gameNum, @winnerId, @stageId
          )`,
        )
        .run({
          transactionNum: apiTransaction.transactionNum,
          gameNum: gameData.gameNum,
          winnerId: gameData.winnerId,
          stageId: gameData.stageId ?? null,
        });
      gameData.selections.forEach((selection) => {
        db!
          .prepare(
            `INSERT INTO selections (
              transactionNum, gameNum, entrantId, characterId
            ) VALUES (
              @transactionNum, @gameNum, @entrantId, @characterId
            )`,
          )
          .run({
            transactionNum: apiTransaction.transactionNum,
            gameNum: gameData.gameNum,
            entrantId: selection.entrantId,
            characterId: selection.characterId,
          });
      });
    });
  })();
}

function toApiTransaction(dbTransaction: DbTransaction): ApiTransaction {
  const { transactionNum } = dbTransaction;
  const gameDatas = db!
    .prepare('SELECT * FROM gameData WHERE transactionNum = @transactionNum')
    .all({ transactionNum }) as DbGameData[];
  const gameNumToSelections = new Map<
    number,
    { entrantId: number; characterId: number }[]
  >();
  (
    db!
      .prepare(
        'SELECT * FROM selections WHERE transactionNum = @transactionNum',
      )
      .all({ transactionNum }) as DbSelections[]
  ).forEach((dbSelection) => {
    const selection = {
      entrantId: dbSelection.entrantId,
      characterId: dbSelection.characterId,
    };
    if (gameNumToSelections.has(dbSelection.gameNum)) {
      gameNumToSelections.get(dbSelection.gameNum)!.push(selection);
    } else {
      gameNumToSelections.set(dbSelection.gameNum, [selection]);
    }
  });
  return {
    transactionNum: dbTransaction.transactionNum,
    type: dbTransaction.type,
    setId: dbTransaction.setId,
    winnerId: dbTransaction.winnerId ?? undefined,
    isDQ: dbTransaction.isDQ === 1,
    gameData: gameDatas.map((gameData) => ({
      gameNum: gameData.gameNum,
      winnerId: gameData.winnerId,
      stageId: gameData.stageId ?? undefined,
      selections: gameNumToSelections.get(gameData.gameNum) || [],
    })),
  };
}

export function getQueuedTransactions() {
  if (!db) {
    throw new Error('not init');
  }

  const transactionNums = (
    db!
      .prepare(
        `SELECT DISTINCT transactionNum
          FROM setMutations
          WHERE tournamentId = @currentTournamentId AND queuedMs > 0
          ORDER BY transactionNum ASC`,
      )
      .all({ currentTournamentId }) as { transactionNum: number }[]
  ).map(({ transactionNum }) => transactionNum);

  return transactionNums.map((transactionNum) => {
    const transaction = db!
      .prepare(
        'SELECT * FROM transactions WHERE transactionNum = @transactionNum',
      )
      .get({ transactionNum }) as DbTransaction | undefined;
    if (!transaction) {
      throw new Error(`transaction not found: ${transactionNum}`);
    }
    return toApiTransaction(transaction);
  });
}

export function queueAllTransactions() {
  if (!db) {
    throw new Error('not init');
  }

  const transactionNums = (
    db!
      .prepare(
        `SELECT DISTINCT transactionNum
          FROM setMutations
          WHERE tournamentId = @currentTournamentId AND queuedMs = 0
          ORDER BY transactionNum ASC`,
      )
      .all({ currentTournamentId }) as { transactionNum: number }[]
  ).map(({ transactionNum }) => transactionNum);

  const apiTransactions = transactionNums.map((transactionNum) => {
    const transaction = db!
      .prepare(
        'SELECT * FROM transactions WHERE transactionNum = @transactionNum',
      )
      .get({ transactionNum }) as DbTransaction | undefined;
    if (!transaction) {
      throw new Error(`transaction not found: ${transactionNum}`);
    }
    return toApiTransaction(transaction);
  });

  db!
    .prepare(
      `UPDATE setMutations
        SET queuedMs = @queuedMs
        WHERE tournamentId = @currentTournamentId AND queuedMs = 0`,
    )
    .run({ queuedMs: Date.now(), currentTournamentId });

  return apiTransactions;
}

const SELECT_PROGRESSION_SET =
  'SELECT * FROM sets WHERE entrant1PrereqId = @id OR entrant2PrereqId = @id';
const SELECT_QUEUEABLE_MUTATIONS =
  'SELECT * FROM setMutations WHERE setId = @setId AND isReleased = 1 AND queuedMs = 0 ORDER BY transactionNum';
function releaseSetInner(
  set: DbSet,
  setMutations: DbSetMutation[],
  transactionNums: Set<number>,
  ignoredPrereqId?: number,
): void {
  const prereqSetIdsToCheck: number[] = [];
  if (set.entrant1PrereqId !== ignoredPrereqId) {
    if (set.entrant1PrereqType === 'set') {
      prereqSetIdsToCheck.push(set.entrant1PrereqId);
    } else if (set.entrant1PrereqType === 'seed') {
      const prereqSet = db!
        .prepare(
          'SELECT * FROM sets WHERE wProgressionSeedId = @seedId OR lProgressionSeedId = @seedId',
        )
        .get({ seedId: set.entrant1PrereqId }) as DbSet | undefined;
      if (prereqSet) {
        prereqSetIdsToCheck.push(prereqSet.id);
      }
    }
  }
  if (set.entrant2PrereqId !== ignoredPrereqId) {
    if (set.entrant2PrereqType === 'set') {
      prereqSetIdsToCheck.push(set.entrant2PrereqId);
    } else if (set.entrant2PrereqType === 'seed') {
      const prereqSet = db!
        .prepare(
          'SELECT * FROM sets WHERE wProgressionSeedId = @seedId OR lProgressionSeedId = @seedId',
        )
        .get({ seedId: set.entrant2PrereqId }) as DbSet | undefined;
      if (prereqSet) {
        prereqSetIdsToCheck.push(prereqSet.id);
      }
    }
  }

  if (
    prereqSetIdsToCheck.some((setId) => {
      const mutations = db!
        .prepare('SELECT * FROM setMutations WHERE setId = @setId')
        .all({ setId }) as DbSetMutation[];
      return mutations.some((mutation) => mutation.queuedMs === 0);
    })
  ) {
    // is blocked by prereq sets
    return;
  }

  setMutations.forEach((mutation) => {
    transactionNums.add(mutation.transactionNum);
  });
  setMutations.forEach((setMutation) => {
    db!
      .prepare('UPDATE setMutations SET queuedMs = @queuedMs WHERE id = @id')
      .run({ id: setMutation.id, queuedMs: Date.now() });
  });

  const progressionSetsToCheck: {
    set: DbSet;
    setMutations: DbSetMutation[];
    prereqId: number;
  }[] = [];
  (db!.prepare(SELECT_PROGRESSION_SET).all({ id: set.id }) as DbSet[]).forEach(
    (progressionSet) => {
      const queueableSetMutations = (
        db!
          .prepare(SELECT_QUEUEABLE_MUTATIONS)
          .all({ setId: progressionSet.id }) as DbSetMutation[]
      ).filter(
        (setMutation) => setMutation.isReleased && setMutation.queuedMs === 0,
      );
      if (queueableSetMutations.length > 0) {
        progressionSetsToCheck.push({
          set: progressionSet,
          setMutations: queueableSetMutations,
          prereqId: set.id,
        });
      }
    },
  );

  if (set.wProgressionSeedId) {
    const progressionSet = db!
      .prepare(SELECT_PROGRESSION_SET)
      .get({ seedId: set.wProgressionSeedId }) as DbSet | undefined;
    if (progressionSet) {
      const queueableSetMutations = (
        db!
          .prepare(SELECT_QUEUEABLE_MUTATIONS)
          .all({ id: progressionSet.id }) as DbSetMutation[]
      ).filter(
        (setMutation) => setMutation.isReleased && setMutation.queuedMs === 0,
      );
      if (queueableSetMutations.length > 0) {
        progressionSetsToCheck.push({
          set: progressionSet,
          setMutations: queueableSetMutations,
          prereqId: set.wProgressionSeedId,
        });
      }
    }
  }
  if (set.lProgressionSeedId) {
    const progressionSet = db!
      .prepare(SELECT_PROGRESSION_SET)
      .get({ seedId: set.lProgressionSeedId }) as DbSet | undefined;
    if (progressionSet) {
      const queueableSetMutations = (
        db!
          .prepare(SELECT_QUEUEABLE_MUTATIONS)
          .all({ id: progressionSet.id }) as DbSetMutation[]
      ).filter(
        (setMutation) => setMutation.isReleased && setMutation.queuedMs === 0,
      );
      if (queueableSetMutations.length > 0) {
        progressionSetsToCheck.push({
          set: progressionSet,
          setMutations: queueableSetMutations,
          prereqId: set.lProgressionSeedId,
        });
      }
    }
  }

  progressionSetsToCheck.forEach((setToCheck) => {
    releaseSetInner(
      setToCheck.set,
      setToCheck.setMutations,
      transactionNums,
      setToCheck.prereqId,
    );
  });
}

export function releaseSet(id: number): ApiTransaction[] {
  if (!db) {
    throw new Error('not init');
  }
  const set = db!.prepare('SELECT * FROM sets WHERE id = @id').get({ id }) as
    | DbSet
    | undefined;
  if (!set) {
    throw new Error(`No set with id: ${id}`);
  }

  db!
    .prepare('UPDATE setMutations SET isReleased = 1 WHERE setId = @id')
    .run({ id });
  const setMutations = db!
    .prepare(SELECT_QUEUEABLE_MUTATIONS)
    .all({ setId: id }) as DbSetMutation[];
  const transactionNums = new Set<number>();
  releaseSetInner(set, setMutations, transactionNums);
  return Array.from(transactionNums.values())
    .sort()
    .map((transactionNum) => {
      const dbTransaction = db!
        .prepare(
          'SELECT * FROM transactions WHERE transactionNum = @transactionNum',
        )
        .get({ transactionNum }) as DbTransaction | undefined;
      if (!dbTransaction) {
        throw new Error(`no transaction with num: ${transactionNum}`);
      }
      return toApiTransaction(dbTransaction);
    });
}

export function deleteTransaction(
  transactionNums: number[],
  updates: ApiSetUpdate[],
  updatedAt: number,
) {
  if (!db) {
    throw new Error('not init');
  }

  db!.transaction(() => {
    transactionNums.forEach((transactionNum) => {
      db!
        .prepare(
          'DELETE FROM transactions WHERE transactionNum = @transactionNum',
        )
        .run({ transactionNum });
      db!
        .prepare('DELETE FROM gameData WHERE transactionNum = @transactionNum')
        .run({ transactionNum });
      db!
        .prepare(
          'DELETE FROM selections WHERE transactionNum = @transactionNum',
        )
        .run({ transactionNum });
      // start.gg does not return sets affected by resetSet or sets affected by
      // reportBracketSet if they are in a different phase/phaseGroup so we
      // have to hack it a little.
      if (updates.length > 0) {
        const setIdToUpdate = new Set(updates.map((update) => update.id));
        (
          db!
            .prepare(
              'SELECT * FROM setMutations WHERE transactionNum = @transactionNum AND requiresUpdateHack = 1',
            )
            .all({ transactionNum }) as DbSetMutation[]
        ).forEach((dbSetMutation) => {
          if (!setIdToUpdate.has(dbSetMutation.setId)) {
            const exprs: string[] = [];
            if (dbSetMutation.statePresent) {
              exprs.push('state = @state');
            }
            if (dbSetMutation.entrant1IdPresent) {
              exprs.push('entrant1Id = @entrant1Id');
            }
            if (dbSetMutation.entrant1ScorePresent) {
              exprs.push('entrant1Score = @entrant1Score');
            }
            if (dbSetMutation.entrant2IdPresent) {
              exprs.push('entrant2Id = @entrant2Id');
            }
            if (dbSetMutation.entrant2ScorePresent) {
              exprs.push('entrant2Score = @entrant2Score');
            }
            if (dbSetMutation.winnerIdPresent) {
              exprs.push('winnerId = @winnerId');
            }
            if (dbSetMutation.streamIdPresent) {
              exprs.push('streamId = @streamId');
            }
            if (exprs.length === 0) {
              throw new Error(
                `no mutations in dbSetMutation: ${dbSetMutation.id}, transactionNum: ${dbSetMutation.transactionNum}`,
              );
            }
            exprs.push('updatedAt = @updatedAt');
            db!
              .prepare(`UPDATE sets SET ${exprs.join(', ')} WHERE id = @setId`)
              .run({ ...dbSetMutation, updatedAt });
          }
        });
      }
      db!
        .prepare(
          'DELETE FROM setMutations WHERE transactionNum = @transactionNum',
        )
        .run({ transactionNum });
    });
    updates.forEach((update) => {
      db!
        .prepare(
          `UPDATE sets
            SET
              state = @state,
              entrant1Id = @entrant1Id,
              entrant1Score = @entrant1Score,
              entrant2Id = @entrant2Id,
              entrant2Score = @entrant2Score,
              winnerId = @winnerId,
              updatedAt = @updatedAt
            WHERE id = @id`,
        )
        .run({ ...update, updatedAt });
    });
  })();
}

export function getEventPoolIds(id: number): Set<number> {
  if (!db) {
    throw new Error('not init');
  }

  const dbPools = db
    .prepare('SELECT * FROM pools WHERE eventId = @id')
    .all({ id }) as DbPool[];
  return new Set(dbPools.map((dbPool) => dbPool.id));
}

export function getPoolSetIds(id: number): Set<number> {
  if (!db) {
    throw new Error('not init');
  }

  const dbSets = db
    .prepare('SELECT * FROM sets WHERE phaseGroupId = @id')
    .all({ id }) as DbSet[];
  return new Set(dbSets.map((dbSet) => dbSet.id));
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

let lastTournament: RendererTournament | undefined;
export function getLastTournament() {
  return lastTournament;
}

const idToLastEvent = new Map<number, RendererEvent>();
export function getLastEvent(id: number) {
  return idToLastEvent.get(id);
}

export function getTournament(): RendererTournament | undefined {
  if (!db) {
    throw new Error('not init');
  }

  if (!currentTournamentId) {
    lastTournament = undefined;
    return lastTournament;
  }

  const dbTournament = db
    .prepare('SELECT * FROM tournaments WHERE id = @id')
    .get({ id: currentTournamentId }) as DbTournament;
  const dbEvents = db
    .prepare('SELECT * FROM events WHERE tournamentId = @id')
    .all({ id: currentTournamentId }) as DbEvent[];
  const dbLoadedEventIds = new Set(
    (
      db
        .prepare('SELECT * FROM loadedEvents WHERE tournamentId = @id')
        .all({ id: currentTournamentId }) as DbLoadedEvent[]
    ).map((loadedEvent) => loadedEvent.id),
  );
  const dbPhases = db
    .prepare('SELECT * FROM phases WHERE tournamentId = @id')
    .all({ id: currentTournamentId }) as DbPhase[];
  const dbPools = (
    db
      .prepare('SELECT * FROM pools WHERE tournamentId = @id')
      .all({ id: currentTournamentId }) as DbPool[]
  ).sort((a, b) => {
    if (a.name.length === b.name.length) {
      return a.name.localeCompare(b.name);
    }
    return a.name.length - b.name.length;
  });
  lastTournament = {
    id: dbTournament.id,
    slug: dbTournament.slug,
    events: dbEvents.map((dbEvent) => ({
      id: dbEvent.id,
      name: dbEvent.name,
      isOnline: dbEvent.isOnline === 1,
      isLoaded: dbLoadedEventIds.has(dbEvent.id),
      phases: dbPhases
        .filter((dbPhase) => dbPhase.eventId === dbEvent.id)
        .map((dbPhase) => ({
          id: dbPhase.id,
          name: dbPhase.name,
          pools: dbPools
            .filter((dbPool) => dbPool.phaseId === dbPhase.id)
            .map((dbPool) => {
              const dbSets: DbSet[] = [];
              const idToDbSet = new Map<number, DbSet>();
              (
                db!
                  .prepare(
                    'SELECT * FROM sets WHERE phaseGroupId = @id ORDER BY callOrder, id',
                  )
                  .all({ id: dbPool.id }) as DbSet[]
              ).forEach((dbSet) => {
                dbSets.push(dbSet);
                idToDbSet.set(dbSet.id, dbSet);
              });
              (
                db!
                  .prepare(
                    'SELECT * FROM setMutations WHERE phaseGroupId = @id',
                  )
                  .all({ id: dbPool.id }) as DbSetMutation[]
              ).forEach((dbSetMutation) => {
                const dbSet = idToDbSet.get(dbSetMutation.setId);
                if (dbSet) {
                  applyMutation(dbSet, dbSetMutation);
                }
              });

              const rendererSets = dbSets.map((dbSet): RendererSet => {
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
                  syncState: dbSet.syncState,
                };
              });
              return {
                id: dbPool.id,
                name: dbPool.name,
                bracketType: dbPool.bracketType,
                sets: rendererSets,
              };
            }),
        })),
    })),
  };
  lastTournament.events.forEach((event) => {
    idToLastEvent.set(event.id, event);
  });
  return lastTournament;
}

export function getTournaments() {
  if (!db) {
    throw new Error('not init');
  }

  const dbTournaments = db!
    .prepare('SELECT * FROM tournaments ORDER BY startAt DESC')
    .all() as DbTournament[];
  return dbTournaments.map((tournament): AdminedTournament => {
    const numSetMutations = db!
      .prepare(
        'SELECT COUNT(id) FROM setMutations WHERE tournamentId = @tournamentId',
      )
      .get({ tournamentId: tournament.id }) as { 'COUNT(id)': number };
    return { ...tournament, isSynced: numSetMutations['COUNT(id)'] === 0 };
  });
}
