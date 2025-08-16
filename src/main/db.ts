import DatabaseContstructor, { Database } from 'better-sqlite3';
import path from 'path';
import { app, BrowserWindow } from 'electron';
import { mkdirSync } from 'fs';
import {
  AdminedTournament,
  ApiSetUpdate,
  ApiTransaction,
  TransactionType,
  DbEntrant,
  DbEvent,
  DbTransactionGameData,
  DbLoadedEvent,
  DbPhase,
  DbPlayer,
  DbPool,
  DbTransactionSelections,
  DbSet,
  DbSetMutation,
  DbTournament,
  DbTransaction,
  RendererSet,
  RendererTournament,
  DbStation,
  DbStream,
  ApiGameData,
  RendererStation,
  RendererStream,
  SyncState,
  ConflictReason,
  RendererConflict,
  RendererConflictResolve,
  RendererConflictLocalSet,
} from '../common/types';

enum SyncStatus {
  BEHIND,
  AHEAD,
  CONFLICT,
}

let db: Database | undefined;
let mainWindow: BrowserWindow | undefined;
export function dbInit(window: BrowserWindow) {
  mainWindow = window;
  const userDataPath = app.getPath('userData');
  mkdirSync(userDataPath, { recursive: true });
  db = new DatabaseContstructor(path.join(userDataPath, 'db.sqlite3'));
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
      ordinal INTEGER,
      fullRoundText TEXT,
      identifier TEXT,
      round INTEGER,
      state INTEGER,
      stationId INTEGER,
      streamId INTEGER,
      hasStageData INTEGER,
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
      stationIdPresent INTEGER,
      stationId INTEGER,
      streamIdPresent INTEGER,
      streamId INTEGER,
      hasStageDataPresent INTEGER,
      hasStageData INTEGER,
      updatedAt INTEGER NOT NULL
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
    `CREATE TABLE IF NOT EXISTS stations (
      id INTEGER PRIMARY KEY,
      tournamentId INTEGER NOT NULL,
      number INTEGER,
      streamId INTEGER
    )`,
  ).run();
  db.prepare(
    `CREATE TABLE IF NOT EXISTS streams (
      id INTEGER PRIMARY KEY,
      tournamentId INTEGER NOT NULL,
      streamName TEXT,
      streamSource TEXT
    )`,
  ).run();
  db.prepare(
    `CREATE TABLE IF NOT EXISTS transactions (
      transactionNum INTEGER PRIMARY KEY,
      tournamentId INTEGER NOT NULL,
      eventId INTEGER NOT NULL,
      type INTEGER NOT NULL,
      setId INTEGER NOT NULL,
      isRecursive INTEGER,
      stationId INTEGER,
      streamId INTEGER,
      expectedEntrant1Id INTEGER,
      expectedEntrant2Id INTEGER,
      winnerId INTEGER,
      isDQ INTEGER,
      isUpdate INTEGER,
      isConflict INTEGER,
      reason INTEGER
    )`,
  ).run();
  db.prepare(
    `CREATE TABLE IF NOT EXISTS transactionGameData (
      transactionNum INTEGER,
      gameNum INTEGER,
      winnerId INTEGER NOT NULL,
      stageId INTEGER,
      PRIMARY KEY (transactionNum, gameNum)
    )`,
  ).run();
  db.prepare(
    `CREATE TABLE IF NOT EXISTS transactionSelections (
      id INTEGER PRIMARY KEY,
      transactionNum INTEGER NOT NULL,
      gameNum INTEGER NOT NULL,
      entrantId INTEGER NOT NULL,
      characterId INTEGER NOT NULL
    )`,
  ).run();

  const highTransaction = db
    .prepare('SELECT * FROM transactions ORDER BY transactionNum DESC LIMIT 1')
    .get() as DbTransaction | undefined;
  const lowTransaction = db
    .prepare('SELECT * FROM transactions ORDER BY transactionNum ASC LIMIT 1')
    .get() as DbTransaction | undefined;
  return {
    low: (lowTransaction?.transactionNum ?? 0) - 1,
    high: (highTransaction?.transactionNum ?? 0) + 1,
  };
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

  db.prepare(TOURNAMENT_UPSERT_SQL).run(tournament);
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

  db.prepare(PLAYER_UPSERT_SQL).run(player);
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

  return db.prepare(PLAYER_GET_SQL).get({ id }) as DbPlayer | undefined;
}

const STATION_UPSERT_SQL = `REPLACE INTO
  stations
    (id, tournamentId, number, streamId)
  VALUES
    (@id, @tournamentId, @number, @streamId)`;
export function upsertStations(stations: DbStation[]) {
  if (!db) {
    throw new Error('not init');
  }

  stations.forEach((station) => {
    db!.prepare(STATION_UPSERT_SQL).run(station);
  });
}

const STREAM_UPSERT_SQL = `REPLACE INTO
    streams
      (id, tournamentId, streamName, streamSource)
    VALUES
      (@id, @tournamentId, @streamName, @streamSource)`;
export function upsertStreams(streams: DbStream[]) {
  if (!db) {
    throw new Error('not init');
  }

  streams.forEach((stream) => {
    db!.prepare(STREAM_UPSERT_SQL).run(stream);
  });
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
  ordinal,
  fullRoundText,
  identifier,
  round,
  state,
  stationId,
  streamId,
  hasStageData,
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
  @ordinal,
  @fullRoundText,
  @identifier,
  @round,
  @state,
  @stationId,
  @streamId,
  @hasStageData,
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

let autoSync = false;
export function setAutoSync(newAutoSync: boolean) {
  autoSync = newAutoSync;
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
  if (setMutation.stationIdPresent) {
    set.stationId = setMutation.stationId;
  }
  if (setMutation.streamIdPresent) {
    set.streamId = setMutation.streamId;
  }
  if (setMutation.hasStageDataPresent) {
    set.hasStageData = setMutation.hasStageData;
  }
  if (autoSync) {
    set.syncState = SyncState.QUEUED;
  } else {
    set.syncState = SyncState.LOCAL;
  }
}
function applyMutations(set: DbSet) {
  (
    db!
      .prepare('SELECT * FROM setMutations WHERE setId = @id ORDER BY id ASC')
      .all({ id: set.id }) as DbSetMutation[]
  ).forEach((setMutation) => {
    applyMutation(set, setMutation);
  });
}

function getRendererStation(id: number): RendererStation | null {
  const maybeStation = db!
    .prepare('SELECT * FROM stations WHERE id = @id')
    .get({ id }) as DbStation | undefined;
  if (!maybeStation) {
    return null;
  }

  return maybeStation;
}

function getRendererStream(id: number): RendererStream | null {
  const maybeStream = db!
    .prepare('SELECT * FROM streams WHERE id = @id')
    .get({ id }) as DbStream | undefined;
  if (!maybeStream) {
    return null;
  }

  return maybeStream;
}

function dbSetToRendererSet(dbSet: DbSet): RendererSet {
  const entrant1Name = dbSet.entrant1Id
    ? getEntrantName(dbSet.entrant1Id)
    : null;
  const entrant2Name = dbSet.entrant2Id
    ? getEntrantName(dbSet.entrant2Id)
    : null;
  return {
    id: dbSet.id,
    ordinal: dbSet.ordinal,
    fullRoundText: dbSet.fullRoundText,
    identifier: dbSet.identifier,
    round: dbSet.round,
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
    station:
      dbSet.stationId === null
        ? null
        : getRendererStation(dbSet.stationId) ?? null,
    stream:
      dbSet.streamId === null
        ? null
        : getRendererStream(dbSet.streamId) ?? null,
    hasStageData: dbSet.hasStageData,
    syncState: dbSet.syncState,
  };
}

function findResetDependentSets(set: DbSet) {
  if (!db) {
    throw new Error('not init');
  }

  const dependentSets = db
    .prepare(
      `SELECT *
        FROM sets
        WHERE entrant1PrereqId = @id OR entrant2PrereqId = @id`,
    )
    .all(set) as DbSet[];
  if (set.wProgressionSeedId) {
    const affectedSet = db
      .prepare(
        `SELECT *
          FROM sets
          WHERE eventId = @eventId
            AND (
              entrant1PrereqId = @wProgressionSeedId
                OR entrant2PrereqId = @wProgressionSeedId
            )`,
      )
      .get(set) as DbSet | undefined;
    if (affectedSet) {
      dependentSets.push(affectedSet);
    }
  }
  if (set.lProgressionSeedId) {
    const affectedSet = db
      .prepare(
        `SELECT *
          FROM sets
          WHERE eventId = @eventId
            AND (
              entrant1PrereqId = @lProgressionSeedId
                OR entrant2PrereqId = @lProgressionSeedId
            )`,
      )
      .get(set) as DbSet | undefined;
    if (affectedSet) {
      dependentSets.push(affectedSet);
    }
  }

  const recursiveDependentSets: DbSet[] = [];
  const allDependentSets: DbSet[] = [];
  dependentSets.forEach((dependentSet) => {
    if (dependentSet.state === 3) {
      recursiveDependentSets.push(dependentSet);
    } else if (dependentSet.state !== 1) {
      allDependentSets.push(dependentSet);
    }
  });
  recursiveDependentSets.forEach((dependentSet) => {
    allDependentSets.push(...findResetDependentSets(dependentSet));
  });
  return allDependentSets;
}

export function getConflictResolve(
  setId: number,
  transactionNum: number,
): RendererConflictResolve {
  if (!db) {
    throw new Error('not init');
  }

  const set = db
    .prepare('SELECT * FROM sets WHERE id = @setId')
    .get({ setId }) as DbSet | undefined;
  if (!set) {
    throw new Error(`set: ${setId} not found`);
  }

  const event = db
    .prepare('SELECT * FROM events WHERE id = @eventId')
    .get(set) as DbEvent | undefined;
  if (!event) {
    throw new Error(`event: ${set.eventId} not found for set: ${setId}`);
  }

  const phase = db
    .prepare('SELECT * FROM phases WHERE id = @phaseId')
    .get(set) as DbPhase | undefined;
  if (!phase) {
    throw new Error(`phase: ${set.phaseId} not found for set: ${setId}`);
  }

  const pool = db
    .prepare('SELECT * FROM pools WHERE id = @phaseGroupId')
    .get(set) as DbPool | undefined;
  if (!pool) {
    throw new Error(
      `phaseGroup: ${set.phaseGroupId} not found for set: ${setId}`,
    );
  }

  const conflictTransactions = db
    .prepare(
      `SELECT *
        FROM transactions
        WHERE setId = @setId AND transactionNum >= @transactionNum
        ORDER BY transactionNum ASC`,
    )
    .all({ setId, transactionNum }) as DbTransaction[];
  if (
    conflictTransactions.length === 0 ||
    conflictTransactions[0].transactionNum !== transactionNum
  ) {
    throw new Error(
      `transaction: ${transactionNum} not found for set: ${setId}`,
    );
  }
  if (conflictTransactions[0].isConflict === null) {
    throw new Error(`transaction: ${transactionNum} is not conflict`);
  }
  if (conflictTransactions[0].reason === null) {
    throw new Error(
      `conflict transaction: ${transactionNum} does not have reason`,
    );
  }

  const serverSets = [dbSetToRendererSet(set)];
  if (conflictTransactions[0].reason === ConflictReason.RESET_DEPENDENT_SETS) {
    const dependentSets = findResetDependentSets(set);
    serverSets.push(
      ...dependentSets
        .sort((a, b) => a.ordinal - b.ordinal)
        .map(dbSetToRendererSet),
    );
  }

  const transactionNums = conflictTransactions.map(
    (transaction) => transaction.transactionNum,
  );
  const setMutations = db
    .prepare(
      `SELECT *
        FROM setMutations
        WHERE setId = @setId
          AND transactionNum IN (${transactionNums.join(', ')})
        ORDER BY transactionNum ASC`,
    )
    .all({ setId }) as DbSetMutation[];
  const message = `setMutations not all found for transactionNums: [${transactionNums.join(
    ', ',
  )}], actual: [${setMutations
    .map((setMutation) => setMutation.transactionNum)
    .join(', ')}]`;
  if (setMutations.length !== conflictTransactions.length) {
    throw new Error(message);
  }
  setMutations.forEach((setMutation, i) => {
    if (setMutation.transactionNum !== conflictTransactions[i].transactionNum) {
      throw new Error(message);
    }
  });

  const localSets: RendererConflictLocalSet[] = [];
  for (let i = 0; i < conflictTransactions.length; i += 1) {
    applyMutation(set, setMutations[i]);
    localSets.push({
      transactionNum: setMutations[i].transactionNum,
      set: dbSetToRendererSet(set),
      type: conflictTransactions[i].type,
    });
  }

  return {
    eventName: event.name,
    phaseName: phase.name,
    poolName: pool.name,
    reason: conflictTransactions[0].reason,
    serverSets,
    localSets,
  };
}

function insertTransaction(
  apiTransaction: ApiTransaction,
  tournamentId: number,
  eventId: number,
  expectedEntrant1Id: number | null,
  expectedEntrant2Id: number | null,
) {
  if (!db) {
    throw new Error('not init');
  }

  db.transaction(() => {
    const dbTransaction: DbTransaction = {
      transactionNum: apiTransaction.transactionNum,
      tournamentId,
      eventId,
      type: apiTransaction.type,
      setId: apiTransaction.setId,
      isRecursive:
        apiTransaction.type === TransactionType.RESET &&
        apiTransaction.isRecursive
          ? 1
          : null,
      stationId:
        apiTransaction.type === TransactionType.ASSIGN_STATION
          ? apiTransaction.stationId
          : null,
      streamId:
        apiTransaction.type === TransactionType.ASSIGN_STREAM
          ? apiTransaction.streamId
          : null,
      expectedEntrant1Id,
      expectedEntrant2Id,
      winnerId:
        apiTransaction.type === TransactionType.REPORT
          ? apiTransaction.winnerId
          : null,
      isDQ:
        apiTransaction.type === TransactionType.REPORT && apiTransaction.isDQ
          ? 1
          : null,
      isUpdate:
        apiTransaction.type === TransactionType.REPORT &&
        apiTransaction.isUpdate
          ? 1
          : null,
      isConflict: null,
      reason: null,
    };
    db!
      .prepare(
        `INSERT INTO transactions (
          transactionNum,
          tournamentId,
          eventId,
          type,
          setId,
          stationId,
          streamId,
          winnerId,
          isDQ,
          isUpdate,
          isConflict
        ) VALUES (
          @transactionNum,
          @tournamentId,
          @eventId,
          @type,
          @setId,
          @stationId,
          @streamId,
          @winnerId,
          @isDQ,
          @isUpdate,
          @isConflict
        )`,
      )
      .run(dbTransaction);
    if (apiTransaction.type === TransactionType.REPORT) {
      apiTransaction.gameData?.forEach((gameData) => {
        db!
          .prepare(
            `INSERT INTO transactionGameData (
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
              `INSERT INTO transactionSelections (
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
    }
  })();
}

type ResetProgressionSet = {
  id: number;
  phaseGroupId: number;
  phaseId: number;
  eventId: number;
  tournamentId: number;
  entrantNum: 1 | 2;
};
export function resetSet(
  id: number,
  transactionNum: number,
  preempt: boolean = false,
) {
  if (!db) {
    throw new Error('not init');
  }

  const set = db.prepare('SELECT * FROM sets WHERE id = @id').get({ id }) as
    | DbSet
    | undefined;
  if (!set) {
    throw new Error(`no such set: ${id}`);
  }

  applyMutations(set);
  if (set.state === 1) {
    throw new Error(`set cannot be reset: ${id}`);
  }

  let wProgressionSet: ResetProgressionSet | undefined;
  let lProgressionSet: ResetProgressionSet | undefined;
  if (set.state === 3) {
    const dependentSetIds: number[] = [];
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
      db
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
      applyMutations(dbSet);
      if (dbSet.state !== 1) {
        dependentSetIds.push(dbSet.id);
      } else {
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
      }
    });
    if (wProgressionSeedId) {
      const affectedSet = db
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
        applyMutations(affectedSet);
        if (affectedSet.state !== 1) {
          dependentSetIds.push(affectedSet.id);
        } else {
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
    }
    if (lProgressionSeedId) {
      const affectedSet = db
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
        applyMutations(affectedSet);
        if (affectedSet.state !== 1) {
          dependentSetIds.push(affectedSet.id);
        } else {
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
    if (!preempt && dependentSetIds.length > 0) {
      throw new Error(
        `Cannot reset due to dependent set(s): ${dependentSetIds.join(', ')}`,
      );
    }
  }

  set.state = 1;
  set.entrant1Score = null;
  set.entrant2Score = null;
  set.winnerId = null;
  const updatedAt = Date.now() / 1000;
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
          statePresent,
          state,
          entrant1ScorePresent,
          entrant1Score,
          entrant2ScorePresent,
          entrant2Score,
          winnerIdPresent,
          winnerId,
          updatedAt
        ) VALUES (
          @id,
          @phaseGroupId,
          @phaseId,
          @eventId,
          @tournamentId,
          @transactionNum,
          1,
          @state,
          1,
          @entrant1Score,
          1,
          @entrant2Score,
          1,
          @winnerId,
          @updatedAt
        )`,
      )
      .run({
        id,
        phaseGroupId: set.phaseGroupId,
        phaseId: set.phaseId,
        eventId: set.eventId,
        tournamentId: set.tournamentId,
        transactionNum,
        state: set.state,
        entrant1Score: set.entrant1Score,
        entrant2Score: set.entrant2Score,
        winnerId: set.winnerId,
        updatedAt,
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
            requiresUpdateHack,
            statePresent,
            state,
            entrant${wProgressionSet.entrantNum}IdPresent,
            entrant${wProgressionSet.entrantNum}Id,
            updatedAt
          ) VALUES (
            @id,
            @phaseGroupId,
            @phaseId,
            @eventId,
            @tournamentId,
            @transactionNum,
            1,
            1,
            1,
            1,
            null,
            @updatedAt
          )`,
        )
        .run({
          id: wProgressionSet.id,
          phaseGroupId: wProgressionSet.phaseGroupId,
          phaseId: wProgressionSet.phaseId,
          eventId: wProgressionSet.eventId,
          tournamentId: wProgressionSet.tournamentId,
          transactionNum,
          updatedAt,
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
            requiresUpdateHack,
            statePresent,
            state,
            entrant${lProgressionSet.entrantNum}IdPresent,
            entrant${lProgressionSet.entrantNum}Id,
            updatedAt
          ) VALUES (
            @id,
            @phaseGroupId,
            @phaseId,
            @eventId,
            @tournamentId,
            @transactionNum,
            1,
            1,
            1,
            1,
            null,
            @updatedAt
          )`,
        )
        .run({
          id: lProgressionSet.id,
          phaseGroupId: lProgressionSet.phaseGroupId,
          phaseId: lProgressionSet.phaseId,
          eventId: lProgressionSet.eventId,
          tournamentId: lProgressionSet.tournamentId,
          transactionNum,
          updatedAt,
        });
    }
  })();
  insertTransaction(
    {
      transactionNum,
      type: TransactionType.RESET,
      setId: id,
      isRecursive: false,
    },
    set.tournamentId,
    set.eventId,
    set.entrant1Id,
    set.entrant2Id,
  );
  return {
    tournamentId: set.tournamentId,
    set: dbSetToRendererSet(set),
  };
}

export function startSet(id: number, transactionNum: number) {
  if (!db) {
    throw new Error('not init');
  }

  const set = db.prepare('SELECT * FROM sets WHERE id = @id').get({ id }) as
    | DbSet
    | undefined;
  if (!set) {
    throw new Error(`no such set: ${id}`);
  }

  applyMutations(set);
  const { entrant1Id, entrant2Id, state } = set;
  if (state === 3) {
    throw new Error(`set is already completed: ${id}`);
  }
  if (state === 2) {
    throw new Error(`set is already started: ${id}`);
  }
  if (state !== 1 && state !== 6) {
    throw new Error(`set: ${id} has unexpected state: ${state}`);
  }
  if (!entrant1Id || !entrant2Id) {
    throw new Error(
      `set not startable: ${id}, entrant1Id ${entrant1Id}, entrant2Id ${entrant2Id}`,
    );
  }
  set.state = 2;

  db.prepare(
    `INSERT INTO setMutations (
      setId,
      phaseGroupId,
      phaseId,
      eventId,
      tournamentId,
      transactionNum,
      statePresent,
      state,
      updatedAt
    ) VALUES (
      @id,
      @phaseGroupId,
      @phaseId,
      @eventId,
      @tournamentId,
      @transactionNum,
      1,
      @state,
      @updatedAt
    )`,
  ).run({
    id,
    phaseGroupId: set.phaseGroupId,
    phaseId: set.phaseId,
    eventId: set.eventId,
    tournamentId: set.tournamentId,
    transactionNum,
    state: set.state,
    updatedAt: Date.now() / 1000,
  });
  insertTransaction(
    {
      transactionNum,
      type: TransactionType.START,
      setId: id,
    },
    set.tournamentId,
    set.eventId,
    set.entrant1Id,
    set.entrant2Id,
  );
  return {
    tournamentId: set.tournamentId,
    set: dbSetToRendererSet(set),
  };
}

export function assignSetStation(
  id: number,
  stationId: number,
  transactionNum: number,
) {
  if (!db) {
    throw new Error('not init');
  }
  const set = db.prepare('SELECT * FROM sets WHERE id = @id').get({ id }) as
    | DbSet
    | undefined;
  if (!set) {
    throw new Error(`no such set: ${id}`);
  }

  const { tournamentId } = set;
  const station = db
    .prepare(
      'SELECT * FROM stations WHERE id = @stationId AND tournamentId = @tournamentId',
    )
    .get({ stationId, tournamentId }) as DbStation | undefined;
  if (!station) {
    throw new Error(`no such station: ${stationId}`);
  }

  applyMutations(set);
  set.stationId = stationId;
  set.streamId = station.streamId;

  db.prepare(
    `INSERT INTO setMutations (
      setId,
      phaseGroupId,
      phaseId,
      eventId,
      tournamentId,
      transactionNum,
      stationIdPresent,
      stationId,
      streamIdPresent,
      streamId,
      updatedAt
    ) VALUES (
      @id,
      @phaseGroupId,
      @phaseId,
      @eventId,
      @tournamentId,
      @transactionNum,
      1,
      @stationId,
      1,
      @streamId,
      @updatedAt
    )`,
  ).run({
    id,
    phaseGroupId: set.phaseGroupId,
    phaseId: set.phaseId,
    eventId: set.eventId,
    tournamentId: set.tournamentId,
    transactionNum,
    stationId: set.stationId,
    streamId: set.streamId,
    updatedAt: Date.now() / 1000,
  });
  insertTransaction(
    {
      transactionNum,
      type: TransactionType.ASSIGN_STATION,
      setId: id,
      stationId,
    },
    set.tournamentId,
    set.eventId,
    set.entrant1Id,
    set.entrant2Id,
  );
  return {
    tournamentId: set.tournamentId,
    set: dbSetToRendererSet(set),
  };
}

export function assignSetStream(
  id: number,
  streamId: number,
  transactionNum: number,
) {
  if (!db) {
    throw new Error('not init');
  }
  const set = db.prepare('SELECT * FROM sets WHERE id = @id').get({ id }) as
    | DbSet
    | undefined;
  if (!set) {
    throw new Error(`no such set: ${id}`);
  }

  const { tournamentId } = set;
  const stream = db
    .prepare(
      'SELECT * FROM streams WHERE id = @streamId AND tournamentId = @tournamentId',
    )
    .get({ streamId, tournamentId }) as DbStream | undefined;
  if (!stream) {
    throw new Error(`no such stream: ${streamId}`);
  }

  applyMutations(set);
  set.streamId = streamId;

  db.prepare(
    `INSERT INTO setMutations (
      setId,
      phaseGroupId,
      phaseId,
      eventId,
      tournamentId,
      transactionNum,
      streamIdPresent,
      streamId,
      updatedAt
    ) VALUES (
      @id,
      @phaseGroupId,
      @phaseId,
      @eventId,
      @tournamentId,
      @transactionNum,
      1,
      @streamId,
      @updatedAt
    )`,
  ).run({
    id,
    phaseGroupId: set.phaseGroupId,
    phaseId: set.phaseId,
    eventId: set.eventId,
    tournamentId: set.tournamentId,
    transactionNum,
    streamId: set.streamId,
    updatedAt: Date.now() / 1000,
  });
  insertTransaction(
    {
      transactionNum,
      type: TransactionType.ASSIGN_STREAM,
      setId: id,
      streamId,
    },
    set.tournamentId,
    set.eventId,
    set.entrant1Id,
    set.entrant2Id,
  );
  return {
    tournamentId: set.tournamentId,
    set: dbSetToRendererSet(set),
  };
}

type ReportProgressionSet = ResetProgressionSet & {
  requiresUpdateHack: boolean;
  entrantId: number;
};
export function reportSet(
  id: number,
  winnerId: number,
  isDQ: boolean,
  gameData: ApiGameData[],
  transactionNum: number,
) {
  if (!db) {
    throw new Error('not init');
  }

  const set = db.prepare('SELECT * FROM sets WHERE id = @id').get({ id }) as
    | DbSet
    | undefined;
  if (!set) {
    throw new Error(`no such set: ${id}`);
  }

  applyMutations(set);
  const {
    entrant1Id,
    entrant2Id,
    wProgressionSeedId,
    lProgressionSeedId,
    state,
    hasStageData,
  } = set;
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
  if (state === 3 && winnerId !== set.winnerId) {
    throw new Error('cannot change winner of completed set');
  }
  if (state === 3 && isDQ) {
    throw new Error('cannot change reported set to DQ');
  }
  const reportHasStageData =
    gameData.length > 0 && gameData.every((game) => game.stageId !== undefined);
  if (state === 3 && hasStageData && !reportHasStageData) {
    throw new Error('cannot remove stage data in update');
  }

  set.state = 3;
  set.winnerId = winnerId;
  set.hasStageData = reportHasStageData ? 1 : null;
  if (isDQ) {
    set.entrant1Score = winnerId === entrant1Id ? 0 : -1;
    set.entrant2Score = winnerId === entrant2Id ? 0 : -1;
  } else if (gameData.length > 0) {
    set.entrant1Score = gameData.filter(
      (game) => game.winnerId === entrant1Id,
    ).length;
    set.entrant2Score = gameData.filter(
      (game) => game.winnerId === entrant2Id,
    ).length;
  }
  const loserId = winnerId === entrant1Id ? entrant2Id : entrant1Id;

  let wProgressionSet: ReportProgressionSet | undefined;
  let lProgressionSet: ReportProgressionSet | undefined;
  if (state !== 3) {
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
      db
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
      const affectedSet = db
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
          entrantNum:
            affectedSet.entrant1PrereqId === wProgressionSeedId ? 1 : 2,
          entrantId: winnerId,
        };
      }
    }
    if (lProgressionSeedId) {
      const affectedSet = db
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
          entrantNum:
            affectedSet.entrant1PrereqId === lProgressionSeedId ? 1 : 2,
          entrantId: loserId,
        };
      }
    }
  }
  const updatedAt = Date.now() / 1000;
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
          statePresent,
          state,
          entrant1ScorePresent,
          entrant1Score,
          entrant2ScorePresent,
          entrant2Score,
          winnerIdPresent,
          winnerId,
          hasStageDataPresent,
          hasStageData,
          updatedAt
        ) VALUES (
          @id,
          @phaseGroupId,
          @phaseId,
          @eventId,
          @tournamentId,
          @transactionNum,
          1,
          @state,
          1,
          @entrant1Score,
          1,
          @entrant2Score,
          1,
          @winnerId,
          1,
          @hasStageData,
          @updatedAt
        )`,
      )
      .run({
        id,
        phaseGroupId: set.phaseGroupId,
        phaseId: set.phaseId,
        eventId: set.eventId,
        tournamentId: set.tournamentId,
        transactionNum,
        state: set.state,
        entrant1Score: set.entrant1Score,
        entrant2Score: set.entrant2Score,
        winnerId: set.winnerId,
        hasStageData: set.hasStageData,
        updatedAt,
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
            requiresUpdateHack,
            entrant${wProgressionSet.entrantNum}IdPresent,
            entrant${wProgressionSet.entrantNum}Id,
            updatedAt
          ) VALUES (
            @id,
            @phaseGroupId,
            @phaseId,
            @eventId,
            @tournamentId,
            @transactionNum,
            @requiresUpdateHack,
            1,
            @entrantId,
            @updatedAt
          )`,
        )
        .run({
          id: wProgressionSet.id,
          phaseGroupId: wProgressionSet.phaseGroupId,
          phaseId: wProgressionSet.phaseId,
          eventId: wProgressionSet.eventId,
          tournamentId: wProgressionSet.tournamentId,
          transactionNum,
          requiresUpdateHack: wProgressionSet.requiresUpdateHack ? 1 : null,
          entrantId: wProgressionSet.entrantId,
          updatedAt,
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
            requiresUpdateHack,
            entrant${lProgressionSet.entrantNum}IdPresent,
            entrant${lProgressionSet.entrantNum}Id,
            updatedAt
          ) VALUES (
            @id,
            @phaseGroupId,
            @phaseId,
            @eventId,
            @tournamentId,
            @transactionNum,
            @requiresUpdateHack,
            1,
            @entrantId,
            @updatedAt
          )`,
        )
        .run({
          id: lProgressionSet.id,
          phaseGroupId: lProgressionSet.phaseGroupId,
          phaseId: lProgressionSet.phaseId,
          eventId: lProgressionSet.eventId,
          tournamentId: lProgressionSet.tournamentId,
          transactionNum,
          requiresUpdateHack: lProgressionSet.requiresUpdateHack ? 1 : null,
          entrantId: lProgressionSet.entrantId,
          updatedAt,
        });
    }
  })();
  insertTransaction(
    {
      transactionNum,
      type: TransactionType.REPORT,
      setId: id,
      winnerId,
      isDQ,
      gameData,
      isUpdate: state === 3,
    },
    set.tournamentId,
    set.eventId,
    entrant1Id,
    entrant2Id,
  );
  return {
    tournamentId: set.tournamentId,
    set: dbSetToRendererSet(set),
  };
}

function toApiTransaction(dbTransaction: DbTransaction): ApiTransaction {
  const { transactionNum } = dbTransaction;
  const gameDatas = db!
    .prepare(
      'SELECT * FROM transactionGameData WHERE transactionNum = @transactionNum',
    )
    .all({ transactionNum }) as DbTransactionGameData[];
  const gameNumToSelections = new Map<
    number,
    { entrantId: number; characterId: number }[]
  >();
  (
    db!
      .prepare(
        'SELECT * FROM transactionSelections WHERE transactionNum = @transactionNum',
      )
      .all({ transactionNum }) as DbTransactionSelections[]
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
  if (dbTransaction.type === TransactionType.RESET) {
    return {
      transactionNum: dbTransaction.transactionNum,
      type: dbTransaction.type,
      setId: dbTransaction.setId,
      isRecursive: dbTransaction.isRecursive === 1,
    };
  }
  if (dbTransaction.type === TransactionType.START) {
    return {
      transactionNum: dbTransaction.transactionNum,
      type: dbTransaction.type,
      setId: dbTransaction.setId,
    };
  }
  if (dbTransaction.type === TransactionType.ASSIGN_STATION) {
    return {
      transactionNum: dbTransaction.transactionNum,
      type: dbTransaction.type,
      setId: dbTransaction.setId,
      stationId: dbTransaction.stationId ?? 0,
    };
  }
  if (dbTransaction.type === TransactionType.ASSIGN_STREAM) {
    return {
      transactionNum: dbTransaction.transactionNum,
      type: dbTransaction.type,
      setId: dbTransaction.setId,
      streamId: dbTransaction.streamId ?? 0,
    };
  }
  // TransactionType.REPORT
  return {
    transactionNum: dbTransaction.transactionNum,
    type: dbTransaction.type,
    setId: dbTransaction.setId,
    winnerId: dbTransaction.winnerId ?? 0,
    isDQ: dbTransaction.isDQ === 1,
    gameData: gameDatas.map((gameData) => ({
      gameNum: gameData.gameNum,
      winnerId: gameData.winnerId,
      stageId: gameData.stageId ?? undefined,
      selections: gameNumToSelections.get(gameData.gameNum) || [],
    })),
    isUpdate: dbTransaction.isUpdate === 1,
  };
}

function canTransactNow(transaction: DbTransaction) {
  if (transaction.isConflict === 1) {
    return false;
  }

  if (!db) {
    throw new Error('not init');
  }

  const afterSet = db
    .prepare('SELECT * FROM sets WHERE id = @setId')
    .get(transaction) as DbSet | undefined;
  if (!afterSet) {
    return false;
  }

  switch (transaction.type) {
    case TransactionType.ASSIGN_STATION:
    case TransactionType.ASSIGN_STREAM:
      return true;
    case TransactionType.RESET:
    case TransactionType.START:
    case TransactionType.REPORT:
      return (
        afterSet.entrant1Id === transaction.expectedEntrant1Id &&
        afterSet.entrant2Id === transaction.expectedEntrant2Id
      );
    default:
      throw new Error(`unknown transaction type: ${transaction.type}`);
  }
}

function toRendererConflict(transaction: DbTransaction): RendererConflict {
  if (transaction.isConflict === null) {
    throw new Error(
      `transaction: ${transaction.transactionNum} is not conflict`,
    );
  }
  if (transaction.reason === null) {
    throw new Error(
      `transaction: ${transaction.transactionNum} does not have reason`,
    );
  }

  return {
    setId: transaction.setId,
    transactionNum: transaction.transactionNum,
  };
}

export function getConflict(): RendererConflict | null {
  if (!db) {
    throw new Error('not init');
  }
  if (currentTournamentId === 0) {
    return null;
  }

  const transaction = db
    .prepare(
      `SELECT *
      FROM transactions
      WHERE tournamentId = @currentTournamentId
      ORDER BY transactionNum ASC
      LIMIT 1`,
    )
    .get({ currentTournamentId }) as DbTransaction | undefined;
  if (!transaction || transaction.isConflict === null) {
    return null;
  }
  return toRendererConflict(transaction);
}

export function getNextTransaction() {
  if (!db) {
    throw new Error('not init');
  }

  if (autoSync) {
    const transactions = db
      .prepare(
        `SELECT *
          FROM transactions
          WHERE tournamentId = @currentTournamentId
          ORDER BY transactionNum ASC`,
      )
      .all({ currentTournamentId }) as DbTransaction[];
    if (transactions.length === 0) {
      mainWindow?.webContents.send('conflict', null);
      return null;
    }
    if (transactions[0].isConflict === null) {
      mainWindow?.webContents.send('conflict', null);
      return toApiTransaction(transactions[0]);
    }
    for (let i = 1; i < transactions.length; i += 1) {
      if (canTransactNow(transactions[i])) {
        mainWindow?.webContents.send('conflict', null);
        return toApiTransaction(transactions[i]);
      }
    }
    if (transactions[0].reason === ConflictReason.REPORT_COMPLETED) {
      mainWindow?.webContents.send('conflict', null);
    } else {
      mainWindow?.webContents.send(
        'conflict',
        toRendererConflict(transactions[0]),
      );
    }
  } else {
    // todo: store manuallyReleased somewhere and read it here
  }
  return null;
}

/*
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
  const set = db.prepare('SELECT * FROM sets WHERE id = @id').get({ id }) as
    | DbSet
    | undefined;
  if (!set) {
    throw new Error(`No set with id: ${id}`);
  }

  db.prepare('UPDATE setMutations SET isReleased = 1 WHERE setId = @id').run({
    id,
  });
  const setMutations = db
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
*/

export function finalizeTransaction(
  transactionNum: number,
  updates: ApiSetUpdate[],
) {
  if (!db) {
    throw new Error('not init');
  }

  db.transaction(() => {
    db!
      .prepare(
        'DELETE FROM transactions WHERE transactionNum = @transactionNum',
      )
      .run({ transactionNum });
    db!
      .prepare(
        'DELETE FROM transactionGameData WHERE transactionNum = @transactionNum',
      )
      .run({ transactionNum });
    db!
      .prepare(
        'DELETE FROM transactionSelections WHERE transactionNum = @transactionNum',
      )
      .run({ transactionNum });

    // start.gg does not return sets affected by resetSet or sets affected by
    // reportBracketSet if they are in a different phase/phaseGroup so we
    // have to hack it a little.
    if (updates.length > 0) {
      const { updatedAt } = updates[0];
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
          if (dbSetMutation.stationIdPresent) {
            exprs.push('stationId = @stationId');
          }
          if (dbSetMutation.streamIdPresent) {
            exprs.push('streamId = @streamId');
          }
          if (dbSetMutation.hasStageDataPresent) {
            exprs.push('hasStageData = @hasStageData');
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
              updatedAt = @updatedAt,
              stationId = @stationId,
              streamId = @streamId,
              hasStageData = @hasStageData
            WHERE id = @id`,
        )
        .run(update);
    });
  })();
}

function getSyncStatus(
  dbTransaction: DbTransaction,
  afterSet: DbSet,
  containsValidReset: boolean,
):
  | { syncStatus: SyncStatus.AHEAD | SyncStatus.BEHIND }
  | { syncStatus: SyncStatus.CONFLICT; reason: ConflictReason } {
  switch (dbTransaction.type) {
    case TransactionType.RESET: {
      if (afterSet.state === 1) {
        return { syncStatus: SyncStatus.BEHIND };
      }
      if (dbTransaction.isRecursive === 1) {
        return { syncStatus: SyncStatus.AHEAD };
      }
      if (afterSet.state === 3) {
        const dependentSets = db!
          .prepare(
            'SELECT * FROM sets WHERE entrant1PrereqId = @id OR entrant2PrereqId = @id',
          )
          .all({ id: afterSet.id }) as DbSet[];
        if (afterSet.lProgressionSeedId) {
          const maybeSet = db!
            .prepare(
              'SELECT * FROM sets WHERE entrant1PrereqId = @seedId OR entrant2PrereqId = @seedId',
            )
            .get({ seedId: afterSet.lProgressionSeedId }) as DbSet | undefined;
          if (maybeSet) {
            dependentSets.push(maybeSet);
          }
        }
        if (afterSet.wProgressionSeedId) {
          const maybeSet = db!
            .prepare(
              'SELECT * FROM sets WHERE entrant1PrereqId = @seedId OR entrant2PrereqId = @seedId',
            )
            .get({ seedId: afterSet.wProgressionSeedId }) as DbSet | undefined;
          if (maybeSet) {
            dependentSets.push(maybeSet);
          }
        }
        if (dependentSets.some((dbSet) => dbSet.state !== 1)) {
          return {
            syncStatus: SyncStatus.CONFLICT,
            reason: ConflictReason.RESET_DEPENDENT_SETS,
          };
        }
      }
      return { syncStatus: SyncStatus.AHEAD };
    }
    case TransactionType.ASSIGN_STATION:
      return {
        syncStatus:
          afterSet.stationId === dbTransaction.stationId
            ? SyncStatus.BEHIND
            : SyncStatus.AHEAD,
      };
    case TransactionType.ASSIGN_STREAM:
      return {
        syncStatus:
          afterSet.streamId === dbTransaction.streamId
            ? SyncStatus.BEHIND
            : SyncStatus.AHEAD,
      };
    case TransactionType.START:
      if (containsValidReset || afterSet.state === 1 || afterSet.state === 6) {
        return { syncStatus: SyncStatus.AHEAD };
      }
      return { syncStatus: SyncStatus.BEHIND };
    case TransactionType.REPORT:
      if (containsValidReset) {
        return { syncStatus: SyncStatus.AHEAD };
      }
      if (dbTransaction.isUpdate === null) {
        if (afterSet.state !== 3) {
          return { syncStatus: SyncStatus.AHEAD };
        }
        return {
          syncStatus: SyncStatus.CONFLICT,
          reason: ConflictReason.REPORT_COMPLETED,
        };
      }
      // update, afterSet completed
      if (afterSet.winnerId !== dbTransaction.winnerId) {
        return {
          syncStatus: SyncStatus.CONFLICT,
          reason: ConflictReason.UPDATE_CHANGE_WINNER,
        };
      }
      if (afterSet.hasStageData === 1) {
        const apiTransaction = toApiTransaction(dbTransaction);
        if (apiTransaction.type !== TransactionType.REPORT) {
          throw new Error('unreachable');
        }
        if (
          apiTransaction.gameData.length > 0 &&
          apiTransaction.gameData.every((game) => game.stageId !== undefined)
        ) {
          return {
            syncStatus: SyncStatus.CONFLICT,
            reason: ConflictReason.UPDATE_STAGE_DATA,
          };
        }
        return { syncStatus: SyncStatus.BEHIND };
      }
      if (
        afterSet.entrant1Score !== -1 &&
        afterSet.entrant2Score !== -1 &&
        dbTransaction.isDQ === 1
      ) {
        return { syncStatus: SyncStatus.BEHIND };
      }
      return { syncStatus: SyncStatus.AHEAD };
    default:
      throw new Error(`unknown transaction type: ${dbTransaction.type}`);
  }
}

export function deleteTransaction(transactionNum: number) {
  if (!db) {
    throw new Error('not init');
  }

  let transaction: DbTransaction | undefined;
  db.transaction(() => {
    transaction = db!
      .prepare(
        'DELETE FROM transactions WHERE transactionNum = @transactionNum RETURNING *',
      )
      .get({ transactionNum }) as DbTransaction | undefined;
    db!
      .prepare(
        'DELETE FROM setMutations WHERE transactionNum = @transactionNum',
      )
      .run({ transactionNum });
    db!
      .prepare(
        'DELETE FROM transactionGameData WHERE transactionNum = @transactionNum',
      )
      .run({ transactionNum });
    db!
      .prepare(
        'DELETE FROM transactionSelections WHERE transactionNum = @transactionNum',
      )
      .run({ transactionNum });
  })();

  return transaction!.tournamentId;
}

export function updateEventSets(
  tournamentId: number,
  eventId: number,
  sets: DbSet[],
) {
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
            updatedAt = @updatedAt,
            stationId = @stationId,
            streamId = @streamId,
            hasStageData = @hasStageData
          WHERE id = @id AND updatedAt <= @updatedAt`,
      )
      .run(set);
  });
  const idToAfterSet = new Map(
    (
      db
        .prepare('SELECT * FROM sets WHERE eventId = @eventId')
        .all({ eventId }) as DbSet[]
    ).map((dbSet) => [dbSet.id, dbSet]),
  );

  const setIdToDbTransactions = new Map<number, DbTransaction[]>();
  (
    db
      .prepare(
        `SELECT *
          FROM transactions
          WHERE tournamentId = @tournamentId AND eventId = @eventId
          ORDER BY transactionNum ASC`,
      )
      .all({ tournamentId, eventId }) as DbTransaction[]
  ).forEach((dbTransaction) => {
    const arr = setIdToDbTransactions.get(dbTransaction.setId) ?? [];
    arr.push(dbTransaction);
    setIdToDbTransactions.set(dbTransaction.setId, arr);
  });

  Array.from(setIdToDbTransactions.keys()).forEach((setId) => {
    const dbTransactions = setIdToDbTransactions.get(setId)!;
    const transactionNumsToDelete: number[] = [];
    const afterSet = idToAfterSet.get(setId);
    if (!afterSet) {
      transactionNumsToDelete.push(
        ...dbTransactions.map((dbTransaction) => dbTransaction.transactionNum),
      );
    } else {
      // coalesce
      // - multiple assign station
      // - multiple assign stream
      // - reset, start, report, update before reset
      const resetStationStreamCoalescedDbTransactions: DbTransaction[] = [];
      let foundReset = false;
      let foundAssignStation = false;
      let foundAssignStream = false;
      for (let i = dbTransactions.length - 1; i >= 0; i -= 1) {
        const dbTransaction = dbTransactions[i];
        if (
          (foundReset &&
            (dbTransaction.type === TransactionType.RESET ||
              dbTransaction.type === TransactionType.START ||
              dbTransaction.type === TransactionType.REPORT)) ||
          (foundAssignStation &&
            dbTransaction.type === TransactionType.ASSIGN_STATION) ||
          (foundAssignStream &&
            dbTransaction.type === TransactionType.ASSIGN_STREAM)
        ) {
          transactionNumsToDelete.push(dbTransaction.transactionNum);
          // eslint-disable-next-line no-continue
          continue;
        }
        if (dbTransaction.type === TransactionType.RESET) {
          foundReset = true;
        } else if (dbTransaction.type === TransactionType.ASSIGN_STATION) {
          foundAssignStation = true;
        } else if (dbTransaction.type === TransactionType.ASSIGN_STREAM) {
          foundAssignStream = true;
        }
        resetStationStreamCoalescedDbTransactions.unshift(dbTransaction);
      }

      // coalesce start before report
      const reportCoalescedDbTransactions: DbTransaction[] = [];
      let foundReport = false;
      for (
        let i = resetStationStreamCoalescedDbTransactions.length - 1;
        i >= 0;
        i -= 1
      ) {
        const dbTransaction = resetStationStreamCoalescedDbTransactions[i];
        if (foundReport && dbTransaction.type === TransactionType.START) {
          transactionNumsToDelete.push(dbTransaction.transactionNum);
          // eslint-disable-next-line no-continue
          continue;
        }
        if (dbTransaction.type === TransactionType.REPORT) {
          foundReport = true;
        }
        reportCoalescedDbTransactions.unshift(dbTransaction);
      }

      // coalesce reset
      const resetTransactionI = reportCoalescedDbTransactions.findIndex(
        (dbTransaction) => dbTransaction.type === TransactionType.RESET,
      );
      if (resetTransactionI !== -1) {
        // at this point there's 1 START or 1 REPORT (after RESET) or neither
        const startOrReportTransaction = reportCoalescedDbTransactions.find(
          (dbTransaction) =>
            dbTransaction.type === TransactionType.START ||
            (dbTransaction.type === TransactionType.REPORT &&
              dbTransaction.isUpdate === null),
        );
        if (
          startOrReportTransaction &&
          ((startOrReportTransaction.type === TransactionType.START &&
            (afterSet.state === 1 || afterSet.state === 6)) ||
            (startOrReportTransaction.type === TransactionType.REPORT &&
              afterSet.state !== 3))
        ) {
          const resetTransaction = reportCoalescedDbTransactions.splice(
            resetTransactionI,
            1,
          )[0];
          transactionNumsToDelete.push(resetTransaction.transactionNum);
        }
      }
      const containsReset = reportCoalescedDbTransactions.some(
        (dbTransaction) => dbTransaction.type === TransactionType.RESET,
      );

      // turn report into update
      if (!containsReset && afterSet.state === 3) {
        const reportTransaction = reportCoalescedDbTransactions.find(
          (dbTransaction) =>
            dbTransaction.type === TransactionType.REPORT &&
            dbTransaction.isUpdate === null,
        );
        if (reportTransaction) {
          db!
            .prepare(
              'UPDATE transactions SET isUpdate = 1 WHERE transactionNum = @transactionNum',
            )
            .run(reportTransaction);
          reportTransaction.isUpdate = 1;
        }
      }

      // coalesce multiple update
      const updateCoalescedDbTransactions: DbTransaction[] = [];
      let foundUpdate = false;
      for (let i = reportCoalescedDbTransactions.length - 1; i >= 0; i -= 1) {
        const dbTransaction = reportCoalescedDbTransactions[i];
        if (
          foundUpdate &&
          dbTransaction.type === TransactionType.REPORT &&
          dbTransaction.isUpdate
        ) {
          transactionNumsToDelete.push(dbTransaction.transactionNum);
          // eslint-disable-next-line no-continue
          continue;
        }
        if (
          dbTransaction.type === TransactionType.REPORT &&
          dbTransaction.isUpdate
        ) {
          foundUpdate = true;
        }
        updateCoalescedDbTransactions.unshift(dbTransaction);
      }

      // combine report with update
      const updateTransactionI = updateCoalescedDbTransactions.findIndex(
        (dbTransaction) =>
          dbTransaction.type === TransactionType.REPORT &&
          dbTransaction.isUpdate,
      );
      if (updateTransactionI !== -1) {
        const reportTransactions = updateCoalescedDbTransactions.filter(
          (dbTransaction) => dbTransaction.type === TransactionType.REPORT,
        );
        if (reportTransactions.length > 2) {
          throw new Error(
            'should not be multiple reports or updates during this pass',
          );
        }
        if (reportTransactions.length === 2) {
          if (
            reportTransactions[0].isUpdate ||
            !reportTransactions[1].isUpdate
          ) {
            throw new Error(
              `report should come before update during this pass: ${
                reportTransactions[0].isUpdate ? 'UPDATE' : 'REPORT'
              }, ${reportTransactions[1].isUpdate ? 'UPDATE' : 'REPORT'}`,
            );
          }
          const reportTransactionNum = reportTransactions[0].transactionNum;
          const updateTransactionNum = reportTransactions[1].transactionNum;
          db!.transaction(() => {
            db!
              .prepare(
                'DELETE FROM transactionGameData WHERE transactionNum = @reportTransactionNum',
              )
              .run({ reportTransactionNum });
            db!
              .prepare(
                'DELETE FROM transactionSelections WHERE transactionNum = @reportTransactionNum',
              )
              .run({ reportTransactionNum });
            db!
              .prepare(
                'DELETE FROM setMutations WHERE transactionNum = @reportTransactionNum',
              )
              .run({ reportTransactionNum });
            db!
              .prepare(
                `UPDATE transactionGameData
                  SET transactionNum = @reportTransactionNum
                  WHERE transactionNum = @updateTransactionNum`,
              )
              .run({ reportTransactionNum, updateTransactionNum });
            db!
              .prepare(
                `UPDATE transactionSelections
                  SET transactionNum = @reportTransactionNum
                  WHERE transactionNum = @updateTransactionNum`,
              )
              .run({ reportTransactionNum, updateTransactionNum });
            db!
              .prepare(
                `UPDATE setMutations
                  SET transactionNum = @reportTransactionNum
                  WHERE transactionNum = @updateTransactionNum`,
              )
              .run({ reportTransactionNum, updateTransactionNum });
          })();
          updateCoalescedDbTransactions.splice(updateTransactionI, 1);
          transactionNumsToDelete.push(updateTransactionNum);
        }
      }

      // turn update into report
      if (afterSet.state !== 3) {
        const updateTransaction = updateCoalescedDbTransactions.find(
          (dbTransaction) =>
            dbTransaction.type === TransactionType.REPORT &&
            dbTransaction.isUpdate === 1,
        );
        if (updateTransaction) {
          db!
            .prepare(
              'UPDATE transactions SET isUpdate = NULL WHERE transactionNum = @transactionNum',
            )
            .run(updateTransaction);
          updateTransaction.isUpdate = null;
        }
      }

      let containsValidReset = containsReset;
      const aheadTransactionNums: number[] = [];
      const conflicts: {
        transactionNum: number;
        reason: ConflictReason;
      }[] = [];
      for (const dbTransaction of updateCoalescedDbTransactions) {
        const statusObj = getSyncStatus(
          dbTransaction,
          afterSet,
          containsValidReset,
        );
        switch (statusObj.syncStatus) {
          case SyncStatus.AHEAD:
            aheadTransactionNums.push(dbTransaction.transactionNum);
            break;
          case SyncStatus.BEHIND:
            transactionNumsToDelete.push(dbTransaction.transactionNum);
            break;
          case SyncStatus.CONFLICT:
            conflicts.push({
              transactionNum: dbTransaction.transactionNum,
              reason: statusObj.reason,
            });
            if (dbTransaction.type === TransactionType.RESET) {
              containsValidReset = false;
            }
            break;
          default:
            throw new Error('unknown SyncStatus');
        }
      }
      db!
        .prepare(
          `UPDATE transactions
            SET isConflict = NULL, reason = NULL
            WHERE transactionNum IN (${aheadTransactionNums.join(', ')})`,
        )
        .run();
      conflicts.forEach((conflict) => {
        db!
          .prepare(
            `UPDATE transactions
              SET isConflict = 1, reason = @reason
              WHERE transactionNum = @transactionNum`,
          )
          .run(conflict);
      });
    }
    transactionNumsToDelete.forEach(deleteTransaction);
  });
}

export function markTransactionConflict(
  transactionNum: number,
  reason: ConflictReason,
) {
  if (!db) {
    throw new Error('not init');
  }

  db.prepare(
    `UPDATE transactions
      SET isConflict = 1, reason = @reason
      WHERE transactionNum = @transactionNum`,
  ).run({ transactionNum, reason });
}

export function makeResetRecursive(transactionNum: number) {
  if (!db) {
    throw new Error('not init');
  }

  const transaction = db
    .prepare(
      `UPDATE transactions
        SET isRecursive = 1, isConflict = NULL, reason = NULL
        WHERE transactionNum = @transactionNum AND type = @type
        RETURNING *`,
    )
    .get({ transactionNum, type: TransactionType.RESET }) as
    | DbTransaction
    | undefined;
  if (!transaction) {
    throw new Error(`no reset transaction found for num: ${transactionNum}`);
  }
  return transaction.tournamentId;
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

export function getLoadedEventIds() {
  if (!db) {
    throw new Error('not init');
  }

  return (
    db
      .prepare('SELECT * FROM loadedEvents WHERE tournamentId = @id')
      .all({ id: currentTournamentId }) as DbLoadedEvent[]
  ).map((loadedEvent) => loadedEvent.id);
}

let lastTournament: RendererTournament | undefined;
export function getLastTournament() {
  return lastTournament;
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
  const dbStations = db
    .prepare('SELECT * FROM stations WHERE tournamentId = @id')
    .all({ id: currentTournamentId }) as DbStation[];
  const dbStreams = db
    .prepare('SELECT * FROM streams WHERE tournamentId = @id')
    .all({ id: currentTournamentId }) as DbStream[];
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
                    'SELECT * FROM sets WHERE phaseGroupId = @id ORDER BY ordinal, id',
                  )
                  .all({ id: dbPool.id }) as DbSet[]
              ).forEach((dbSet) => {
                dbSets.push(dbSet);
                idToDbSet.set(dbSet.id, dbSet);
              });
              (
                db!
                  .prepare(
                    'SELECT * FROM setMutations WHERE phaseGroupId = @id ORDER BY id ASC',
                  )
                  .all({ id: dbPool.id }) as DbSetMutation[]
              ).forEach((dbSetMutation) => {
                const dbSet = idToDbSet.get(dbSetMutation.setId);
                if (dbSet) {
                  applyMutation(dbSet, dbSetMutation);
                }
              });

              const rendererSets = dbSets.map(dbSetToRendererSet);
              return {
                id: dbPool.id,
                name: dbPool.name,
                bracketType: dbPool.bracketType,
                sets: rendererSets,
              };
            }),
        })),
    })),
    stations: dbStations,
    streams: dbStreams,
  };
  return lastTournament;
}

export function getTournaments() {
  if (!db) {
    throw new Error('not init');
  }

  const dbTournaments = db
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

export function deleteTournament(id: number) {
  if (!db) {
    throw new Error('not init');
  }

  const dbTournament = db
    .prepare('SELECT * FROM tournaments WHERE id = @id')
    .get({ id }) as DbTournament | undefined;
  if (!dbTournament) {
    throw new Error(`No tournament with id: ${id}`);
  }

  const dbEvents = db
    .prepare('SELECT * FROM events WHERE tournamentId = @id')
    .all({ id }) as DbEvent[];
  const eventIds = dbEvents.map((dbEvent) => dbEvent.id);

  const dbTransactions: DbTransaction[] = db
    .prepare('SELECT * FROM transactions WHERE tournamentId = @id')
    .all({ id }) as DbTransaction[];
  const transactionNums = dbTransactions.map(
    (dbTransaction) => dbTransaction.transactionNum,
  );

  db.transaction(() => {
    db!.prepare('DELETE FROM tournaments WHERE id = @id').run({ id });
    db!.prepare('DELETE FROM events WHERE tournamentId = @id').run({ id });
    db!
      .prepare('DELETE FROM loadedEvents WHERE tournamentId = @id')
      .run({ id });
    db!.prepare('DELETE FROM phases WHERE tournamentId = @id').run({ id });
    db!.prepare('DELETE FROM pools WHERE tournamentId = @id').run({ id });
    db!.prepare('DELETE FROM sets WHERE tournamentId = @id').run({ id });
    db!
      .prepare('DELETE FROM setMutations WHERE tournamentId = @id')
      .run({ id });
    db!.prepare('DELETE FROM stations WHERE tournamentId = @id').run({ id });
    db!.prepare('DELETE FROM streams WHERE tournamentId = @id').run({ id });
    db!
      .prepare('DELETE FROM transactions WHERE tournamentId = @id')
      .run({ id });

    eventIds.forEach((eventId) => {
      db!
        .prepare('DELETE FROM entrants WHERE eventId = @eventId')
        .run({ eventId });
    });

    transactionNums.forEach((transactionNum) => {
      db!
        .prepare(
          'DELETE FROM transactionGameData WHERE transactionNum = @transactionNum',
        )
        .run({ transactionNum });
      db!
        .prepare(
          'DELETE FROM transactionSelections WHERE transactionNum = @transactionNum',
        )
        .run({ transactionNum });
    });
  })();
}
