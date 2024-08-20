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
  DbPhase,
  DbPlayer,
  DbPool,
  DbSelections,
  DbSet,
  DbSetMutation,
  DbTournament,
  DbTransaction,
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
      lProgressionSeedId INTEGER,
      lProgressingPhaseGroupId INTEGER,
      lProgressingPhaseId INTEGER,
      lProgressingName TEXT,
      updatedAt INTEGER,
      isLocal INTEGER NOT NULL
    )`,
  ).run();
  db.prepare(
    `CREATE TABLE IF NOT EXISTS setMutations (
      id INTEGER PRIMARY KEY ASC AUTOINCREMENT,
      setId INTEGER NOT NULL,
      phaseGroupId INTEGER NOT NULL,
      phaseId INTEGER NOT NULL,
      eventId INTEGER NOT NULL,
      transactionNum INTEGER NOT NULL,
      isCrossPhase INTEGER NOT NULL,
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
      setId INTEGER NOT NULL,
      isReport INTEGER NOT NULL,
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
  lProgressionSeedId,
  lProgressingPhaseGroupId,
  lProgressingPhaseId,
  lProgressingName,
  updatedAt,
  isLocal
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
  @lProgressionSeedId,
  @lProgressingPhaseGroupId,
  @lProgressingPhaseId,
  @lProgressingName,
  @updatedAt,
  0
)`;
export function updatePool(pool: DbPool, entrants: DbEntrant[], sets: DbSet[]) {
  if (!db) {
    throw new Error('not init');
  }
  db!.prepare(POOL_UPDATE_SQL).run(pool);
  entrants.forEach((entrant) => {
    db!.prepare(ENTRANT_UPSERT_SQL).run(entrant);
  });
  sets.forEach((set) => {
    db!.prepare(SET_UPSERT_SQL).run(set);
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
  set.isLocal = 1;
}

type ProgressionSet = {
  id: number;
  phaseGroupId: number;
  phaseId: number;
  eventId: number;
  isCrossPhase: boolean;
  entrantNum: 1 | 2;
  entrantId: number;
};
export function reportSet(
  id: number,
  winnerId: number,
  entrant1Score: number | null,
  entrant2Score: number | null,
  transactionNum: number,
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

  let wProgressionSet: ProgressionSet | undefined;
  let lProgressionSet: ProgressionSet | undefined;
  const maybeAssignProgression = (
    setId: number,
    phaseGroupId: number,
    phaseId: number,
    eventId: number,
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
        isCrossPhase: false,
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
        isCrossPhase: false,
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
        isCrossPhase: true,
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
        isCrossPhase: true,
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
          transactionNum,
          isCrossPhase,
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
          @transactionNum,
          @isCrossPhase,
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
        transactionNum,
        isCrossPhase: 0,
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
            transactionNum,
            isCrossPhase,
            entrant${wProgressionSet.entrantNum}IdPresent,
            entrant${wProgressionSet.entrantNum}Id
          ) VALUES (
            @id,
            @phaseGroupId,
            @phaseId,
            @eventId,
            @transactionNum,
            @isCrossPhase,
            1,
            @entrantId
          )`,
        )
        .run({
          id: wProgressionSet.id,
          phaseGroupId: wProgressionSet.phaseGroupId,
          phaseId: wProgressionSet.phaseId,
          eventId: wProgressionSet.eventId,
          transactionNum,
          isCrossPhase: wProgressionSet.isCrossPhase ? 1 : 0,
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
            transactionNum,
            isCrossPhase,
            entrant${lProgressionSet.entrantNum}IdPresent,
            entrant${lProgressionSet.entrantNum}Id
          ) VALUES (
            @id,
            @phaseGroupId,
            @phaseId,
            @eventId,
            @transactionNum,
            @isCrossPhase,
            1,
            @entrantId
          )`,
        )
        .run({
          id: lProgressionSet.id,
          phaseGroupId: lProgressionSet.phaseGroupId,
          phaseId: lProgressionSet.phaseId,
          eventId: lProgressionSet.eventId,
          transactionNum,
          isCrossPhase: lProgressionSet.isCrossPhase ? 1 : 0,
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
          transactionNum, setId, isReport, winnerId, isDQ
        ) VALUES (
          @transactionNum, @setId, @isReport, @winnerId, @isDQ
        )`,
      )
      .run({
        transactionNum: apiTransaction.transactionNum,
        setId: apiTransaction.setId,
        isReport: apiTransaction.isReport ? 1 : 0,
        winnerId: apiTransaction.winnerId ?? null,
        isDQ: apiTransaction.isDQ ? 1 : 0,
      });
    apiTransaction.gameData.forEach((gameData) => {
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

export function getTransaction(transactionNum: number): ApiTransaction {
  if (!db) {
    throw new Error('not init');
  }

  const dbTransaction = db!
    .prepare(
      'SELECT * FROM transactions WHERE transactionNum = @transactionNum',
    )
    .get({ transactionNum }) as DbTransaction | undefined;
  if (!dbTransaction) {
    throw new Error('no such transaction');
  }
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
    setId: dbTransaction.setId,
    isReport: dbTransaction.isReport === 1,
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
      // start.gg does not return sets affected by reportBracketSet if they are
      // in a different phase/phaseGroup so we have to hack it a little.
      if (updates.length > 0) {
        const setIdToUpdate = new Set(updates.map((update) => update.id));
        (
          db!
            .prepare(
              'SELECT * FROM setMutations WHERE transactionNum = @transactionNum AND isCrossPhase = 1',
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
                  isLocal: dbSet.isLocal,
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
}

export function getTournaments() {
  if (!db) {
    throw new Error('not init');
  }

  // todo sort by startAt
  return db!
    .prepare('SELECT * FROM tournaments ORDER BY id DESC')
    .all() as AdminedTournament[];
}
