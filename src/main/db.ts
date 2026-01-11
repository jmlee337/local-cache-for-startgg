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
  RendererConflictServerSet,
  DbSeed,
  DbParticipantToEntrant,
  DbParticipant,
  RendererParticipant,
  PoolSiblings,
  DbSetGame,
  DbSetMutationGame,
  RendererPool,
  RendererEvent,
  RendererUnloadedEvent,
  SubscriberTournament,
  RendererPhase,
  RendererSeed,
  DbSeedMutation,
} from '../common/types';
import getPlacementToEntrantId from './standing';

enum SyncStatus {
  BEHIND,
  AHEAD,
  CONFLICT,
}

function dbCommonGamesHaveStagesAndScores(games: DbSetGame[]) {
  return (
    games.length > 0 &&
    games.every(
      (game) =>
        game.entrant1Score !== null &&
        game.entrant2Score !== null &&
        game.stageId !== null,
    )
  );
}

function apiGameDatasHaveStagesAndScores(gameDatas: ApiGameData[]) {
  return (
    gameDatas.length > 0 &&
    gameDatas.every(
      (gameData) =>
        gameData.entrant1Score !== undefined &&
        gameData.entrant2Score !== undefined &&
        gameData.stageId !== undefined,
    )
  );
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
    'CREATE TABLE IF NOT EXISTS tournaments (id INTEGER PRIMARY KEY, slug TEXT, name TEXT, startAt INTEGER, location TEXT)',
  ).run();
  db.prepare(
    `CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY,
      tournamentId INTEGER,
      name TEXT,
      slug TEXT,
      isOnline INTEGER,
      videogameId INTGER
    )`,
  ).run();
  db.prepare(
    'CREATE TABLE IF NOT EXISTS loadedEvents (id INTEGER PRIMARY KEY, tournamentId INTEGER NOT NULL)',
  ).run();
  db.prepare(
    `CREATE TABLE IF NOT EXISTS phases (
      id INTEGER PRIMARY KEY,
      eventId INTEGER,
      tournamentId INTEGER,
      name TEXT,
      phaseOrder INTEGER
    )`,
  ).run();
  db.prepare(
    `CREATE TABLE IF NOT EXISTS pools (
      id INTEGER PRIMARY KEY,
      waveId INTEGER,
      phaseId INTEGER,
      eventId INTEGER,
      tournamentId INTEGER,
      name TEXT,
      bracketType INTEGER,
      state INTEGER,
      winnersTargetPhaseId INTEGER,
      tiebreakMethod1 TEXT,
      tiebreakMethod2 TEXT,
      tiebreakMethod3 TEXT
    )`,
  ).run();
  db.prepare(
    `CREATE TABLE IF NOT EXISTS sets (
      id INTEGER PRIMARY KEY,
      setId NOT NULL,
      phaseGroupId INTEGER NOT NULL,
      phaseId INTEGER NOT NULL,
      eventId INTEGER NOT NULL,
      tournamentId INTEGER NOT NULL,
      ordinal INTEGER,
      fullRoundText TEXT,
      identifier TEXT,
      bestOf INTEGER,
      round INTEGER,
      state INTEGER,
      stationId INTEGER,
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
      startedAt INTEGER,
      completedAt INTEGER,
      syncState INTEGER NOT NULL,
      UNIQUE (identifier, phaseGroupId)
    )`,
  ).run();
  db.prepare(
    `CREATE TABLE IF NOT EXISTS setMutations (
      id INTEGER PRIMARY KEY,
      setId INTEGER NOT NULL,
      phaseGroupId INTEGER NOT NULL,
      phaseId INTEGER NOT NULL,
      eventId INTEGER NOT NULL,
      tournamentId INTEGER NOT NULL,
      identifier TEXT NOT NULL,
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
      startedAtPresent INTEGER,
      startedAt INTEGER,
      completedAtPresent INTEGER,
      completedAt INTEGER,
      stationIdPresent INTEGER,
      stationId INTEGER,
      streamIdPresent INTEGER,
      streamId INTEGER,
      gamesPresent INTEGER,
      updatedAt INTEGER NOT NULL
    )`,
  ).run();
  db.prepare(
    `CREATE TABLE IF NOT EXISTS setGames(
      id INTEGER PRIMARY KEY,
      setId INTEGER NOT NULL,
      eventId INTEGER NOT NULL,
      orderNum INTEGER NOT NULL,
      entrant1Score INTEGER,
      entrant2Score INTEGER,
      stageId INTEGER,
      state INTEGER,
      updatedAt INTEGER NOT NULL,
      winnerId INTEGER
    )`,
  ).run();
  db.prepare(
    `CREATE TABLE IF NOT EXISTS setMutationGames(
      id INTEGER PRIMARY KEY,
      setId INTEGER NOT NULL,
      eventId INTEGER NOT NULL,
      orderNum INTEGER NOT NULL,
      entrant1Score INTEGER,
      entrant2Score INTEGER,
      stageId INTEGER,
      state INTEGER,
      updatedAt INTEGER NOT NULL,
      winnerId INTEGER,
      transactionNum INTEGER NOT NULL
    )`,
  ).run();
  db.prepare(
    `CREATE TABLE IF NOT EXISTS seeds (
      id INTEGER PRIMARY KEY,
      poolId INTEGER NOT NULL,
      phaseId INTEGER NOT NULL,
      eventId INTEGER NOT NULL,
      tournamentId INTEGER NOT NULL,
      seedNum INTEGER NOT NULL,
      groupSeedNum INTEGER NOT NULL,
      placeholderName TEXT,
      originPlacement INTEGER,
      originPoolId INTEGER,
      entrantId INTEGER
    )`,
  ).run();
  db.prepare(
    `CREATE TABLE IF NOT EXISTS seedMutations (
      id INTEGER PRIMARY KEY,
      seedId INTEGER NOT NULL,
      tournamentId INTEGER NOT NULL,
      entrantIdPresent INTEGER,
      entrantId INTEGER,
      transactionNum INTEGER NOT NULL
    )`,
  ).run();
  db.prepare(
    `CREATE TABLE IF NOT EXISTS participants(
      id INTEGER PRIMARY KEY,
      tournamentId INTEGER NOT NULL,
      connectCode TEXT,
      discordId TEXT,
      discordUsername TEXT,
      gamerTag TEXT,
      prefix TEXT,
      pronouns TEXT,
      userSlug TEXT
    )`,
  ).run();
  db.prepare(
    `CREATE TABLE IF NOT EXISTS participantsToEntrant (
      tournamentId INTEGER NOT NULL,
      participantId INTEGER,
      entrantId INTEGER,
      PRIMARY KEY (participantId, entrantId)
    )`,
  ).run();
  db.prepare(
    `CREATE TABLE IF NOT EXISTS entrants (
      id INTEGER PRIMARY KEY,
      tournamentId INTEGER NOT NULL,
      eventId INTEGER NOT NULL,
      name TEXT
    )`,
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

type RendererEntrant = {
  name: string;
  participants: RendererParticipant[];
};
function getRendererEntrant(id: number): RendererEntrant {
  if (!db) {
    throw new Error('not init');
  }

  const entrant = db
    .prepare('SELECT * FROM entrants WHERE id = @id')
    .get({ id }) as DbEntrant | undefined;
  if (!entrant) {
    throw new Error(`entrant not found: ${id}`);
  }

  const participantsToEntrant = db
    .prepare('SELECT * FROM participantsToEntrant WHERE entrantId = @id')
    .all({ id }) as DbParticipantToEntrant[];
  if (participantsToEntrant.length === 0) {
    throw new Error(`participant(s) not found for entrant: ${id}`);
  }
  const participantIds = participantsToEntrant.map(
    (participantToEntrant) => participantToEntrant.participantId,
  );

  const participants = db
    .prepare(
      `SELECT * FROM participants WHERE id IN (${participantIds.join(', ')})`,
    )
    .all() as DbParticipant[];
  if (participantIds.length !== participants.length) {
    throw new Error(
      `participant(s) not found, expected: [${participantIds.join(
        ', ',
      )}], actual: [${participants
        .map((participant) => participant.id)
        .join(', ')}]`,
    );
  }

  return {
    name: entrant.name,
    participants,
  };
}

let currentTournamentId = 0;
export function getTournamentId() {
  return currentTournamentId;
}
export function setTournamentId(newTournamentId: number) {
  currentTournamentId = newTournamentId;
}

const TOURNAMENT_UPSERT_SQL =
  'REPLACE INTO tournaments (id, name, slug, startAt, location) VALUES (@id, @name, @slug, @startAt, @location)';
export function upsertTournament(tournament: DbTournament, events: DbEvent[]) {
  if (!db) {
    throw new Error('not init');
  }

  db.prepare(TOURNAMENT_UPSERT_SQL).run(tournament);
  events.forEach((event) => {
    db!
      .prepare(
        `REPLACE INTO events (
          id, tournamentId, name, slug, isOnline, videogameId
        ) VALUES (
          @id, @tournamentId, @name, @slug, @isOnline, @videogameId
        )`,
      )
      .run(event);
  });
}

export function loadEvent(eventId: number, tournamentId: number) {
  if (!db) {
    throw new Error('not init');
  }

  db.prepare(
    'REPLACE INTO loadedEvents (id, tournamentId) VALUES (@eventId, @tournamentId)',
  ).run({ eventId, tournamentId });
}

export function replaceParticipants(participants: DbParticipant[]) {
  if (!db) {
    throw new Error('not init');
  }

  participants.forEach((participant) => {
    db!
      .prepare(
        `REPLACE INTO participants (
          id,
          tournamentId,
          connectCode,
          discordId,
          discordUsername,
          gamerTag,
          prefix,
          pronouns,
          userSlug
        ) VALUES (
          @id,
          @tournamentId,
          @connectCode,
          @discordId,
          @discordUsername,
          @gamerTag,
          @prefix,
          @pronouns,
          @userSlug
        )`,
      )
      .run(participant);
  });
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

let autoSync = false;
export function setAutoSync(newAutoSync: boolean) {
  autoSync = newAutoSync;
}

function applyMutation(
  set: DbSet,
  games: DbSetGame[],
  setMutation: DbSetMutation,
) {
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
  if (setMutation.startedAtPresent) {
    set.startedAt = setMutation.startedAt;
  }
  if (setMutation.completedAtPresent) {
    set.completedAt = setMutation.completedAt;
  }
  if (setMutation.stationIdPresent) {
    set.stationId = setMutation.stationId;
  }
  if (setMutation.streamIdPresent) {
    set.streamId = setMutation.streamId;
  }
  if (setMutation.gamesPresent) {
    games.length = 0;
    games.push(
      ...(db!
        .prepare(
          'SELECT * FROM setMutationGames WHERE transactionNum = @transactionNum ORDER BY orderNum ASC',
        )
        .all({
          transactionNum: setMutation.transactionNum,
        }) as DbSetMutationGame[]),
    );
  }
  if (autoSync) {
    set.syncState = SyncState.QUEUED;
  } else {
    set.syncState = SyncState.LOCAL;
  }
}
function applyMutations(set: DbSet, games: DbSetGame[]) {
  (
    db!
      .prepare(
        `SELECT *
          FROM setMutations
          WHERE setId = @id
          ORDER BY transactionNum ASC`,
      )
      .all(set) as DbSetMutation[]
  ).forEach((setMutation) => {
    applyMutation(set, games, setMutation);
  });
}

function applySeedMutations(seed: DbSeed) {
  (
    db!
      .prepare(
        `SELECT *
          FROM seedMutations
          WHERE seedId = @id
          ORDER BY transactionNum ASC`,
      )
      .all(seed) as DbSeedMutation[]
  ).forEach((dbSeedMutation) => {
    if (dbSeedMutation.entrantIdPresent) {
      seed.entrantId = dbSeedMutation.entrantId;
    }
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

const shortRoundTextRegex = /([A-Z]|[0-9])/g;
function dbSetToRendererSet(
  dbSet: DbSet,
  dbSetGames: DbSetGame[],
  idToRendererEntrant?: Map<number, RendererEntrant>,
): RendererSet {
  let entrant1: RendererEntrant | null = null;
  if (dbSet.entrant1Id) {
    if (idToRendererEntrant) {
      const rendererEntrant = idToRendererEntrant.get(dbSet.entrant1Id);
      if (!rendererEntrant) {
        throw new Error(`entrant not found ${dbSet.entrant1Id}`);
      }
      entrant1 = rendererEntrant;
    } else {
      entrant1 = getRendererEntrant(dbSet.entrant1Id);
    }
  }
  let entrant2: RendererEntrant | null = null;
  if (dbSet.entrant2Id) {
    if (idToRendererEntrant) {
      const rendererEntrant = idToRendererEntrant.get(dbSet.entrant2Id);
      if (!rendererEntrant) {
        throw new Error(`entrant not found ${dbSet.entrant2Id}`);
      }
      entrant2 = rendererEntrant;
    } else {
      entrant2 = getRendererEntrant(dbSet.entrant2Id);
    }
  }
  return {
    id: dbSet.id,
    setId: dbSet.setId,
    ordinal: dbSet.ordinal,
    fullRoundText: dbSet.fullRoundText,
    shortRoundText: dbSet.fullRoundText
      .split('')
      .filter((c) => c.match(shortRoundTextRegex))
      .join(''),
    identifier: dbSet.identifier,
    bestOf: dbSet.bestOf,
    round: dbSet.round,
    state: dbSet.state,
    entrant1Id: dbSet.entrant1Id,
    entrant1Name: entrant1?.name ?? null,
    entrant1Participants: entrant1?.participants ?? [],
    entrant1PrereqStr: dbSet.entrant1PrereqStr,
    entrant1Score: dbSet.entrant1Score,
    entrant2Id: dbSet.entrant2Id,
    entrant2Name: entrant2?.name ?? null,
    entrant2Participants: entrant2?.participants ?? [],
    entrant2PrereqStr: dbSet.entrant2PrereqStr,
    entrant2Score: dbSet.entrant2Score,
    games: dbSetGames.map((dbGame) => ({
      entrant1Score: dbGame.entrant1Score,
      entrant2Score: dbGame.entrant2Score,
      stageId: dbGame.stageId,
      winnerId: dbGame.winnerId,
    })),
    winnerId: dbSet.winnerId,
    updatedAt: dbSet.updatedAt,
    startedAt: dbSet.startedAt,
    completedAt: dbSet.completedAt,
    station:
      dbSet.stationId === null
        ? null
        : getRendererStation(dbSet.stationId) ?? null,
    stream:
      dbSet.streamId === null
        ? null
        : getRendererStream(dbSet.streamId) ?? null,
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
        WHERE state != 1
          AND (
            entrant1PrereqId = @setId OR entrant2PrereqId = @setId
          )`,
    )
    .all(set) as DbSet[];
  const dependentSetIds = new Set(
    dependentSets.map((dependentSet) => dependentSet.id),
  );
  if (set.wProgressionSeedId) {
    const affectedSet = db
      .prepare(
        `SELECT *
          FROM sets
          WHERE eventId = @eventId
            AND state != 1
            AND (
              entrant1PrereqId = @wProgressionSeedId
                OR entrant2PrereqId = @wProgressionSeedId
            )`,
      )
      .get(set) as DbSet | undefined;
    if (affectedSet) {
      dependentSets.push(affectedSet);
      dependentSetIds.add(affectedSet.id);
    }
  }
  if (set.lProgressionSeedId) {
    const affectedSet = db
      .prepare(
        `SELECT *
          FROM sets
          WHERE eventId = @eventId
            AND state != 1
            AND (
              entrant1PrereqId = @lProgressionSeedId
                OR entrant2PrereqId = @lProgressionSeedId
            )`,
      )
      .get(set) as DbSet | undefined;
    if (affectedSet) {
      dependentSets.push(affectedSet);
      dependentSetIds.add(affectedSet.id);
    }
  }

  const recursiveDependentSets: DbSet[] = [];
  dependentSets.forEach((dependentSet) => {
    if (dependentSet.state === 3) {
      recursiveDependentSets.push(dependentSet);
    }
  });
  recursiveDependentSets.forEach((dependentSet) => {
    findResetDependentSets(dependentSet).forEach((recursiveDependentSet) => {
      if (!dependentSetIds.has(recursiveDependentSet.id)) {
        dependentSetIds.add(recursiveDependentSet.id);
        dependentSets.push(recursiveDependentSet);
      }
    });
  });
  return dependentSets;
}

function findEntrantDependencySets(set: DbSet): DbSet[] {
  if (!db) {
    throw new Error('not init');
  }

  const dependencySetIds = new Set<number>();
  const dependencySets: DbSet[] = [];
  if (set.entrant1PrereqType === 'set') {
    const dependencySet = db
      .prepare('SELECT * FROM sets WHERE setId = @entrant1PrereqId')
      .get(set) as DbSet | undefined;
    if (dependencySet && dependencySet.state !== 3) {
      dependencySetIds.add(dependencySet.id);
      dependencySets.push(dependencySet);
    }
  } else if (set.entrant1PrereqType === 'seed') {
    const dependencySet = db
      .prepare(
        `SELECT *
          FROM sets
          WHERE eventId = @eventId
            AND (
              wProgressionSeedId = @entrant1PrereqId
                OR lProgressionSeedId = @entrant1PrereqId
            )`,
      )
      .get(set) as DbSet | undefined;
    if (dependencySet && dependencySet.state !== 3) {
      dependencySetIds.add(dependencySet.id);
      dependencySets.push(dependencySet);
    }
  }
  if (set.entrant2PrereqType === 'set') {
    const dependencySet = db
      .prepare('SELECT * FROM sets WHERE setId = @entrant2PrereqId')
      .get(set) as DbSet | undefined;
    if (dependencySet && dependencySet.state !== 3) {
      dependencySetIds.add(dependencySet.id);
      dependencySets.push(dependencySet);
    }
  } else if (set.entrant2PrereqType === 'seed') {
    const dependencySet = db
      .prepare(
        `SELECT *
          FROM sets
          WHERE eventId = @eventId
            AND (
              wProgressionSeedId = @entrant2PrereqId
                OR lProgressionSeedId = @entrant2PrereqId
            )`,
      )
      .get(set) as DbSet | undefined;
    if (dependencySet && dependencySet.state !== 3) {
      dependencySetIds.add(dependencySet.id);
      dependencySets.push(dependencySet);
    }
  }

  const recursiveDependencySets = dependencySets.flatMap(
    findEntrantDependencySets,
  );
  recursiveDependencySets.forEach((recursiveDependencySet) => {
    if (!dependencySetIds.has(recursiveDependencySet.id)) {
      dependencySetIds.add(recursiveDependencySet.id);
      dependencySets.push(recursiveDependencySet);
    }
  });
  return dependencySets;
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

  const games = db
    .prepare(
      'SELECT * FROM setGames WHERE setId = @setId ORDER BY orderNum ASC',
    )
    .all({ setId: set.setId }) as DbSetGame[];

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

  const serverSets: RendererConflictServerSet[] = [
    {
      eventId: set.eventId,
      phaseId: set.phaseId,
      poolId: set.phaseGroupId,
      set: dbSetToRendererSet(set, games),
    },
  ];
  if (conflictTransactions[0].reason === ConflictReason.RESET_DEPENDENT_SETS) {
    const dependentSets = findResetDependentSets(set);
    serverSets.push(
      ...dependentSets
        .sort((a, b) => {
          if (a.phaseId !== b.phaseId) {
            return a.phaseId - b.phaseId;
          }
          return a.ordinal - b.ordinal;
        })
        .map((dependentSet) => {
          const dependentSetGames = db!
            .prepare(
              'SELECT * FROM setGames WHERE setId = @setId ORDER BY orderNum ASC',
            )
            .all({ setId: dependentSet.setId }) as DbSetGame[];
          return {
            eventId: dependentSet.eventId,
            phaseId: dependentSet.phaseId,
            poolId: dependentSet.phaseGroupId,
            set: dbSetToRendererSet(dependentSet, dependentSetGames),
          };
        }),
    );
  } else if (
    conflictTransactions[0].reason === ConflictReason.MISSING_ENTRANTS
  ) {
    const dependencySets = findEntrantDependencySets(set);
    serverSets.push(
      ...dependencySets
        .sort((a, b) => {
          if (a.phaseId !== b.phaseId) {
            return b.phaseId - a.phaseId;
          }
          return b.ordinal - a.ordinal;
        })
        .map((dependentSet) => {
          const dependentSetGames = db!
            .prepare(
              'SELECT * FROM setGames WHERE setId = @setId ORDER BY orderNum ASC',
            )
            .all({ setId: dependentSet.setId }) as DbSetGame[];

          return {
            eventId: dependentSet.eventId,
            phaseId: dependentSet.phaseId,
            poolId: dependentSet.phaseGroupId,
            set: dbSetToRendererSet(dependentSet, dependentSetGames),
          };
        }),
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
    applyMutation(set, games, setMutations[i]);
    localSets.push({
      transactionNum: setMutations[i].transactionNum,
      set: dbSetToRendererSet(set, games),
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
  setId: number,
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
      setId,
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
          expectedEntrant1Id,
          expectedEntrant2Id,
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
          @expectedEntrant1Id,
          @expectedEntrant2Id,
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
  identifier: string;
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

  applyMutations(set, []);
  if (set.state === 1) {
    throw new Error(`set cannot be reset: ${id}`);
  }

  // always check for dependent sets due to CALL state bug
  let wProgressionSet: ResetProgressionSet | undefined;
  let lProgressionSet: ResetProgressionSet | undefined;
  const dependentSetIds: number[] = [];
  const { wProgressionSeedId, lProgressionSeedId, state } = set;
  const maybeAssignProgression = (
    setId: number,
    phaseGroupId: number,
    phaseId: number,
    eventId: number,
    tournamentId: number,
    identifier: string,
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
        identifier,
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
        identifier,
        entrantNum,
      };
    }
  };
  (
    db
      .prepare(
        'SELECT * FROM sets WHERE entrant1PrereqId = @setId OR entrant2PrereqId = @setId',
      )
      .all(set) as DbSet[]
  ).forEach((dbSet) => {
    if (
      dbSet.entrant1PrereqId === set.setId &&
      dbSet.entrant2PrereqId === set.setId &&
      set.winnerId === set.entrant1Id &&
      set.fullRoundText === 'Grand Final'
    ) {
      // no progressions if GF won from winners
      return;
    }
    applyMutations(dbSet, []);
    if (dbSet.state !== 1) {
      dependentSetIds.push(dbSet.id);
    } else {
      if (dbSet.entrant1PrereqId === set.setId) {
        maybeAssignProgression(
          dbSet.id,
          dbSet.phaseGroupId,
          dbSet.phaseId,
          dbSet.eventId,
          dbSet.tournamentId,
          dbSet.identifier,
          1,
          dbSet.entrant1PrereqCondition,
        );
      }
      if (dbSet.entrant2PrereqId === set.setId) {
        maybeAssignProgression(
          dbSet.id,
          dbSet.phaseGroupId,
          dbSet.phaseId,
          dbSet.eventId,
          dbSet.tournamentId,
          dbSet.identifier,
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
      applyMutations(affectedSet, []);
      if (affectedSet.state !== 1) {
        dependentSetIds.push(affectedSet.id);
      } else {
        wProgressionSet = {
          id: affectedSet.id,
          phaseGroupId: affectedSet.phaseGroupId,
          phaseId: affectedSet.phaseId,
          eventId: affectedSet.eventId,
          tournamentId: affectedSet.tournamentId,
          identifier: affectedSet.identifier,
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
      applyMutations(affectedSet, []);
      if (affectedSet.state !== 1) {
        dependentSetIds.push(affectedSet.id);
      } else {
        lProgressionSet = {
          id: affectedSet.id,
          phaseGroupId: affectedSet.phaseGroupId,
          phaseId: affectedSet.phaseId,
          eventId: affectedSet.eventId,
          tournamentId: affectedSet.tournamentId,
          identifier: affectedSet.identifier,
          entrantNum:
            affectedSet.entrant1PrereqId === lProgressionSeedId ? 1 : 2,
        };
      }
    }
  }
  const rrProgressions: {
    seedId: number;
    progressionSet: ResetProgressionSet;
  }[] = [];
  if (state === 3) {
    const dbPool = db
      .prepare('SELECT * FROM pools WHERE id = @phaseGroupId')
      .get(set) as DbPool;
    if (dbPool.bracketType === 3) {
      if (
        (
          db
            .prepare(
              'SELECT * FROM sets WHERE phaseGroupId = @id AND id != @setId',
            )
            .all({ ...dbPool, setId: set.id }) as DbSet[]
        )
          .map((dbSet) => {
            applyMutations(dbSet, []);
            return dbSet.state;
          })
          .every((rrState) => rrState === 3)
      ) {
        (
          db
            .prepare('SELECT * FROM seeds WHERE originPoolId = @id')
            .all(dbPool) as DbSeed[]
        ).forEach((dbSeed) => {
          const affectedSet = db!
            .prepare(
              'SELECT * FROM sets WHERE entrant1PrereqId = @seedId OR entrant2PrereqId = @seedId',
            )
            .get({ seedId: dbSeed.id }) as DbSet | undefined;
          if (affectedSet) {
            applyMutations(affectedSet, []);
            if (affectedSet.state !== 1) {
              dependentSetIds.push(affectedSet.id);
            } else {
              const progressionSet: ResetProgressionSet = {
                id: affectedSet.id,
                phaseGroupId: affectedSet.phaseGroupId,
                phaseId: affectedSet.phaseId,
                eventId: affectedSet.eventId,
                tournamentId: affectedSet.tournamentId,
                identifier: affectedSet.identifier,
                entrantNum: affectedSet.entrant1PrereqId === dbSeed.id ? 1 : 2,
              };
              rrProgressions.push({ seedId: dbSeed.id, progressionSet });
            }
          }
        });
      }
    }
  }
  if (!preempt && dependentSetIds.length > 0) {
    throw new Error(
      `Cannot reset due to dependent set(s): ${dependentSetIds.join(', ')}`,
    );
  }

  const updatedAt = Date.now() / 1000;
  set.state = 1;
  set.entrant1Score = null;
  set.entrant2Score = null;
  set.winnerId = null;
  // match sgg behavior: do not reset startedAt
  set.completedAt = null;
  set.updatedAt = updatedAt;
  db.transaction(() => {
    db!
      .prepare(
        `INSERT INTO setMutations (
          setId,
          phaseGroupId,
          phaseId,
          eventId,
          tournamentId,
          identifier,
          transactionNum,
          statePresent,
          state,
          entrant1ScorePresent,
          entrant1Score,
          entrant2ScorePresent,
          entrant2Score,
          winnerIdPresent,
          winnerId,
          completedAtPresent,
          completedAt,
          gamesPresent,
          updatedAt
        ) VALUES (
          @id,
          @phaseGroupId,
          @phaseId,
          @eventId,
          @tournamentId,
          @identifier,
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
          @completedAt,
          1,
          @updatedAt
        )`,
      )
      .run({
        ...set,
        transactionNum,
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
            identifier,
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
            @identifier,
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
          ...wProgressionSet,
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
            identifier,
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
            @identifier,
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
          ...lProgressionSet,
          transactionNum,
          updatedAt,
        });
    }
    if (wProgressionSeedId && wProgressionSet) {
      db!
        .prepare(
          `INSERT INTO seedMutations (
            seedId,
            tournamentId,
            entrantIdPresent,
            entrantId,
            transactionNum
          ) VALUES (
            @seedId,
            @tournamentId,
            1,
            null,
            @transactionNum
          )`,
        )
        .run({
          ...wProgressionSet,
          seedId: wProgressionSeedId,
          transactionNum,
        });
    }
    if (lProgressionSeedId && lProgressionSet) {
      db!
        .prepare(
          `INSERT INTO seedMutations (
            seedId,
            tournamentId,
            entrantIdPresent,
            entrantId,
            transactionNum
          ) VALUES (
            @seedId,
            @tournamentId,
            1,
            null,
            @transactionNum
          )`,
        )
        .run({
          ...lProgressionSet,
          seedId: lProgressionSeedId,
          transactionNum,
        });
    }
    if (rrProgressions.length > 0) {
      rrProgressions.forEach(({ seedId, progressionSet }) => {
        db!
          .prepare(
            `INSERT INTO seedMutations (
              seedId,
              tournamentId,
              entrantIdPresent,
              entrantId,
              transactionNum
            ) VALUES (
              @seedId,
              @tournamentId,
              1,
              null,
              @transactionNum
            )`,
          )
          .run({
            seedId,
            tournamentId: set.tournamentId,
            transactionNum,
          });
        db!
          .prepare(
            `INSERT INTO setMutations (
                setId,
                phaseGroupId,
                phaseId,
                eventId,
                tournamentId,
                identifier,
                transactionNum,
                requiresUpdateHack,
                statePresent,
                state,
                entrant${progressionSet.entrantNum}IdPresent,
                entrant${progressionSet.entrantNum}Id,
                updatedAt
              ) VALUES (
                @id,
                @phaseGroupId,
                @phaseId,
                @eventId,
                @tournamentId,
                @identifier,
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
            ...progressionSet,
            transactionNum,
            updatedAt,
          });
      });
    }
  })();
  insertTransaction(
    {
      transactionNum,
      type: TransactionType.RESET,
      setId: set.setId,
      isRecursive: false,
    },
    set.tournamentId,
    set.eventId,
    set.id,
    set.entrant1Id,
    set.entrant2Id,
  );
  return {
    tournamentId: set.tournamentId,
    set: dbSetToRendererSet(set, []),
  };
}

export function callSet(id: number, transactionNum: number) {
  if (!db) {
    throw new Error('not init');
  }

  const set = db.prepare('SELECT * FROM sets WHERE id = @id').get({ id }) as
    | DbSet
    | undefined;
  if (!set) {
    throw new Error(`no such set: ${id}`);
  }

  applyMutations(set, []);
  const { entrant1Id, entrant2Id, state } = set;
  if (state === 3) {
    throw new Error(`set is already completed: ${id}`);
  }
  if (state === 6) {
    throw new Error(`set is already called: ${id}`);
  }
  if (state !== 1 && state !== 2) {
    throw new Error(`set: ${id} has unexpected state: ${state}`);
  }
  if (!entrant1Id || !entrant2Id) {
    throw new Error(
      `set not callable: ${id}, entrant1Id ${entrant1Id}, entrant2Id ${entrant2Id}`,
    );
  }

  const updatedAt = Date.now() / 1000;
  set.state = 6;
  set.startedAt = updatedAt;
  set.updatedAt = updatedAt;

  db.prepare(
    `INSERT INTO setMutations (
      setId,
      phaseGroupId,
      phaseId,
      eventId,
      tournamentId,
      identifier,
      transactionNum,
      statePresent,
      state,
      startedAtPresent,
      startedAt,
      updatedAt
    ) VALUES (
      @id,
      @phaseGroupId,
      @phaseId,
      @eventId,
      @tournamentId,
      @identifier,
      @transactionNum,
      1,
      @state,
      1,
      @startedAt,
      @updatedAt
    )`,
  ).run({
    ...set,
    transactionNum,
  });
  insertTransaction(
    {
      transactionNum,
      type: TransactionType.CALL,
      setId: set.setId,
    },
    set.tournamentId,
    set.eventId,
    set.id,
    set.entrant1Id,
    set.entrant2Id,
  );
  return {
    tournamentId: set.tournamentId,
    set: dbSetToRendererSet(set, []),
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

  applyMutations(set, []);
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

  const updatedAt = Date.now() / 1000;
  set.state = 2;
  set.startedAt = updatedAt;
  set.updatedAt = updatedAt;

  db.prepare(
    `INSERT INTO setMutations (
      setId,
      phaseGroupId,
      phaseId,
      eventId,
      tournamentId,
      identifier,
      transactionNum,
      statePresent,
      state,
      startedAtPresent,
      startedAt,
      updatedAt
    ) VALUES (
      @id,
      @phaseGroupId,
      @phaseId,
      @eventId,
      @tournamentId,
      @identifier,
      @transactionNum,
      1,
      @state,
      1,
      @startedAt,
      @updatedAt
    )`,
  ).run({
    ...set,
    transactionNum,
  });
  insertTransaction(
    {
      transactionNum,
      type: TransactionType.START,
      setId: set.setId,
    },
    set.tournamentId,
    set.eventId,
    set.id,
    set.entrant1Id,
    set.entrant2Id,
  );
  return {
    tournamentId: set.tournamentId,
    set: dbSetToRendererSet(set, []),
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
  if (typeof set.setId === 'string') {
    throw new Error(`cannot assign preview set to station: ${id}`);
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

  applyMutations(set, []);
  set.stationId = stationId;
  set.streamId = station.streamId;
  set.updatedAt = Date.now() / 1000;

  db.prepare(
    `INSERT INTO setMutations (
      setId,
      phaseGroupId,
      phaseId,
      eventId,
      tournamentId,
      identifier,
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
      @identifier,
      @transactionNum,
      1,
      @stationId,
      1,
      @streamId,
      @updatedAt
    )`,
  ).run({
    ...set,
    transactionNum,
  });
  insertTransaction(
    {
      transactionNum,
      type: TransactionType.ASSIGN_STATION,
      setId: set.setId,
      stationId,
    },
    set.tournamentId,
    set.eventId,
    set.id,
    set.entrant1Id,
    set.entrant2Id,
  );
  return {
    tournamentId: set.tournamentId,
    set: dbSetToRendererSet(set, []),
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
  if (typeof set.setId === 'string') {
    throw new Error(`cannot assign preview set to stream: ${id}`);
  }

  applyMutations(set, []);
  const { tournamentId } = set;
  if (streamId !== 0) {
    const stream = db
      .prepare(
        'SELECT * FROM streams WHERE id = @streamId AND tournamentId = @tournamentId',
      )
      .get({ streamId, tournamentId }) as DbStream | undefined;
    if (!stream) {
      throw new Error(`no such stream: ${streamId}`);
    }
    set.streamId = streamId;
  } else {
    set.streamId = null;
  }
  set.updatedAt = Date.now() / 1000;

  db.prepare(
    `INSERT INTO setMutations (
      setId,
      phaseGroupId,
      phaseId,
      eventId,
      tournamentId,
      identifier,
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
      @identifier,
      @transactionNum,
      1,
      @streamId,
      @updatedAt
    )`,
  ).run({
    ...set,
    transactionNum,
  });
  insertTransaction(
    {
      transactionNum,
      type: TransactionType.ASSIGN_STREAM,
      setId: set.setId,
      streamId,
    },
    set.tournamentId,
    set.eventId,
    set.id,
    set.entrant1Id,
    set.entrant2Id,
  );
  return {
    tournamentId: set.tournamentId,
    set: dbSetToRendererSet(set, []),
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
  const games = db
    .prepare(
      'SELECT * FROM setGames WHERE setId = @setId ORDER BY orderNum ASC',
    )
    .all({ setId: set.setId }) as DbSetGame[];

  applyMutations(set, games);
  const {
    entrant1Id,
    entrant2Id,
    wProgressionSeedId,
    lProgressionSeedId,
    state,
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
  if (state === 3 && gameData.length === 0) {
    throw new Error('cannot update set without gameData');
  }
  if (
    state === 3 &&
    dbCommonGamesHaveStagesAndScores(games) &&
    !apiGameDatasHaveStagesAndScores(gameData)
  ) {
    throw new Error('cannot remove stage data in update');
  }

  const updatedAt = Date.now() / 1000;
  set.state = 3;
  set.winnerId = winnerId;
  set.updatedAt = updatedAt;
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
  if (state !== 3) {
    set.completedAt = updatedAt;
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
      identifier: string,
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
          identifier,
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
          identifier,
          requiresUpdateHack: false,
          entrantNum,
          entrantId: loserId,
        };
      }
    };
    (
      db
        .prepare(
          'SELECT * FROM sets WHERE entrant1PrereqId = @setId OR entrant2PrereqId = @setId',
        )
        .all(set) as DbSet[]
    ).forEach((dbSet) => {
      if (
        dbSet.entrant1PrereqId === set.setId &&
        dbSet.entrant2PrereqId === set.setId &&
        winnerId === entrant1Id &&
        set.fullRoundText === 'Grand Final'
      ) {
        // no progressions if GF won from winners
        return;
      }
      if (dbSet.entrant1PrereqId === set.setId) {
        maybeAssignProgression(
          dbSet.id,
          dbSet.phaseGroupId,
          dbSet.phaseId,
          dbSet.eventId,
          dbSet.tournamentId,
          dbSet.identifier,
          1,
          dbSet.entrant1PrereqCondition,
        );
      }
      if (dbSet.entrant2PrereqId === set.setId) {
        maybeAssignProgression(
          dbSet.id,
          dbSet.phaseGroupId,
          dbSet.phaseId,
          dbSet.eventId,
          dbSet.tournamentId,
          dbSet.identifier,
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
          identifier: affectedSet.identifier,
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
          identifier: affectedSet.identifier,
          requiresUpdateHack: true,
          entrantNum:
            affectedSet.entrant1PrereqId === lProgressionSeedId ? 1 : 2,
          entrantId: loserId,
        };
      }
    }
  }

  const rrProgressions: {
    seedId: number;
    progressionSet: ReportProgressionSet;
  }[] = [];
  if (state !== 3) {
    const dbPool = db
      .prepare('SELECT * FROM pools WHERE id = @phaseGroupId')
      .get(set) as DbPool;
    if (dbPool.bracketType === 3) {
      const rrSets = (
        db
          .prepare(
            'SELECT * FROM sets WHERE phaseGroupId = @id AND id != @setId',
          )
          .all({ ...dbPool, setId: set.id }) as DbSet[]
      ).map((dbSet) => {
        applyMutations(dbSet, []);
        return dbSet;
      });
      if (rrSets.every((rrSet) => rrSet.state === 3)) {
        const dbSeeds = db
          .prepare('SELECT * FROM seeds WHERE poolId = @id')
          .all(dbPool) as DbSeed[];
        const placementToEntrantId = getPlacementToEntrantId(
          dbPool,
          [set, ...rrSets],
          dbSeeds,
        );
        (
          db
            .prepare(
              'SELECT * FROM seeds WHERE originPoolId = @id ORDER BY originPlacement ASC',
            )
            .all(dbPool) as DbSeed[]
        ).forEach((dbSeed) => {
          if (dbSeed.originPlacement !== null) {
            const entrantId = placementToEntrantId.get(dbSeed.originPlacement);
            if (entrantId) {
              const affectedSet = db!
                .prepare(
                  'SELECT * FROM sets WHERE entrant1PrereqId = @seedId OR entrant2PrereqId = @seedId',
                )
                .get({ seedId: dbSeed.id }) as DbSet | undefined;
              if (affectedSet) {
                const progressionSet: ReportProgressionSet = {
                  id: affectedSet.id,
                  phaseGroupId: affectedSet.phaseGroupId,
                  phaseId: affectedSet.phaseId,
                  eventId: affectedSet.eventId,
                  tournamentId: affectedSet.tournamentId,
                  identifier: affectedSet.identifier,
                  requiresUpdateHack: true,
                  entrantNum:
                    affectedSet.entrant1PrereqId === dbSeed.id ? 1 : 2,
                  entrantId,
                };
                rrProgressions.push({ seedId: dbSeed.id, progressionSet });
              }
            }
          }
        });
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
          identifier,
          transactionNum,
          statePresent,
          state,
          entrant1IdPresent,
          entrant1Id,
          entrant1ScorePresent,
          entrant1Score,
          entrant2IdPresent,
          entrant2Id,
          entrant2ScorePresent,
          entrant2Score,
          winnerIdPresent,
          winnerId,
          completedAtPresent,
          completedAt,
          gamesPresent,
          updatedAt
        ) VALUES (
          @id,
          @phaseGroupId,
          @phaseId,
          @eventId,
          @tournamentId,
          @identifier,
          @transactionNum,
          1,
          @state,
          1,
          @entrant1Id,
          1,
          @entrant1Score,
          1,
          @entrant2Id,
          1,
          @entrant2Score,
          1,
          @winnerId,
          @completedAtPresent,
          @completedAt,
          1,
          @updatedAt
        )`,
      )
      .run({
        ...set,
        transactionNum,
        entrant1Id,
        entrant2Id,
        completedAtPresent: state === 3 ? null : 1,
        completedAt: state === 3 ? null : updatedAt,
      });
    games.length = 0;
    if (gameData.length > 0) {
      games.push(
        ...gameData.map(
          (game): DbSetMutationGame => ({
            id: 0, // auto assigned
            setId: set.id,
            eventId: set.eventId,
            orderNum: game.gameNum,
            entrant1Score: game.entrant1Score ?? null,
            entrant2Score: game.entrant2Score ?? null,
            stageId: game.stageId ?? null,
            state: 3,
            updatedAt,
            winnerId: game.winnerId,
            transactionNum,
          }),
        ),
      );
      games.forEach((game) => {
        db!
          .prepare(
            `INSERT INTO setMutationGames (
                setId,
                eventId,
                orderNum,
                entrant1Score,
                entrant2Score,
                stageId,
                state,
                updatedAt,
                winnerId,
                transactionNum
              ) values (
                @setId,
                @eventId,
                @orderNum,
                @entrant1Score,
                @entrant2Score,
                @stageId,
                @state,
                @updatedAt,
                @winnerId,
                @transactionNum
              )`,
          )
          .run(game);
      });
    }

    if (wProgressionSet) {
      db!
        .prepare(
          `INSERT INTO setMutations (
            setId,
            phaseGroupId,
            phaseId,
            eventId,
            tournamentId,
            identifier,
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
            @identifier,
            @transactionNum,
            @requiresUpdateHack,
            1,
            @entrantId,
            @updatedAt
          )`,
        )
        .run({
          ...wProgressionSet,
          transactionNum,
          requiresUpdateHack: wProgressionSet.requiresUpdateHack ? 1 : null,
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
            identifier,
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
            @identifier,
            @transactionNum,
            @requiresUpdateHack,
            1,
            @entrantId,
            @updatedAt
          )`,
        )
        .run({
          ...lProgressionSet,
          transactionNum,
          requiresUpdateHack: lProgressionSet.requiresUpdateHack ? 1 : null,
          updatedAt,
        });
    }
    if (wProgressionSeedId && wProgressionSet) {
      db!
        .prepare(
          `INSERT INTO seedMutations (
            seedId,
            tournamentId,
            entrantIdPresent,
            entrantId,
            transactionNum
          ) VALUES (
            @seedId,
            @tournamentId,
            1,
            @entrantId,
            @transactionNum
          )`,
        )
        .run({
          ...wProgressionSet,
          seedId: wProgressionSeedId,
          transactionNum,
        });
    }
    if (lProgressionSeedId && lProgressionSet) {
      db!
        .prepare(
          `INSERT INTO seedMutations (
            seedId,
            tournamentId,
            entrantIdPresent,
            entrantId,
            transactionNum
          ) VALUES (
            @seedId,
            @tournamentId,
            1,
            @entrantId,
            @transactionNum
          )`,
        )
        .run({
          ...lProgressionSet,
          seedId: lProgressionSeedId,
          transactionNum,
        });
    }
    if (rrProgressions.length > 0) {
      rrProgressions.forEach(({ seedId, progressionSet }) => {
        db!
          .prepare(
            `INSERT INTO seedMutations (
              seedId,
              tournamentId,
              entrantIdPresent,
              entrantId,
              transactionNum
            ) VALUES (
              @seedId,
              @tournamentId,
              1,
              @entrantId,
              @transactionNum
            )`,
          )
          .run({
            seedId,
            tournamentId: set.tournamentId,
            entrantId: progressionSet.entrantId,
            transactionNum,
          });
        db!
          .prepare(
            `INSERT INTO setMutations (
                setId,
                phaseGroupId,
                phaseId,
                eventId,
                tournamentId,
                identifier,
                transactionNum,
                requiresUpdateHack,
                entrant${progressionSet.entrantNum}IdPresent,
                entrant${progressionSet.entrantNum}Id,
                updatedAt
              ) VALUES (
                @id,
                @phaseGroupId,
                @phaseId,
                @eventId,
                @tournamentId,
                @identifier,
                @transactionNum,
                @requiresUpdateHack,
                1,
                @entrantId,
                @updatedAt
              )`,
          )
          .run({
            ...progressionSet,
            transactionNum,
            requiresUpdateHack: progressionSet.requiresUpdateHack ? 1 : null,
            updatedAt,
          });
      });
    }
  })();
  // TODO: seedMutations if report completes an RR pool

  insertTransaction(
    {
      transactionNum,
      type: TransactionType.REPORT,
      setId: set.setId,
      winnerId,
      isDQ,
      gameData,
      isUpdate: state === 3,
    },
    set.tournamentId,
    set.eventId,
    set.id,
    entrant1Id,
    entrant2Id,
  );
  return {
    tournamentId: set.tournamentId,
    set: dbSetToRendererSet(set, games),
  };
}

function toApiTransaction(dbTransaction: DbTransaction): ApiTransaction {
  if (!db) {
    throw new Error('not init');
  }

  const set = db
    .prepare('SELECT * FROM sets WHERE id = @setId')
    .get(dbTransaction) as DbSet | undefined;
  if (!set) {
    throw new Error(
      `set not found for transaction: ${dbTransaction.transactionNum}`,
    );
  }
  const { setId } = set;

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
      setId,
      isRecursive: dbTransaction.isRecursive === 1,
    };
  }
  if (dbTransaction.type === TransactionType.CALL) {
    return {
      transactionNum: dbTransaction.transactionNum,
      type: dbTransaction.type,
      setId,
    };
  }
  if (dbTransaction.type === TransactionType.START) {
    return {
      transactionNum: dbTransaction.transactionNum,
      type: dbTransaction.type,
      setId,
    };
  }
  if (dbTransaction.type === TransactionType.ASSIGN_STATION) {
    return {
      transactionNum: dbTransaction.transactionNum,
      type: dbTransaction.type,
      setId,
      stationId: dbTransaction.stationId ?? 0,
    };
  }
  if (dbTransaction.type === TransactionType.ASSIGN_STREAM) {
    return {
      transactionNum: dbTransaction.transactionNum,
      type: dbTransaction.type,
      setId,
      streamId: dbTransaction.streamId ?? 0,
    };
  }
  // TransactionType.REPORT
  return {
    transactionNum: dbTransaction.transactionNum,
    type: dbTransaction.type,
    setId,
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
    case TransactionType.CALL:
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
    for (const transaction of transactions.slice(1)) {
      if (canTransactNow(transaction)) {
        mainWindow?.webContents.send('conflict', null);
        return toApiTransaction(transaction);
      }
    }
    if (
      transactions[0].reason === ConflictReason.SET_NOT_FOUND ||
      transactions[0].reason === ConflictReason.REPORT_COMPLETED
    ) {
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
      (
        db!
          .prepare(
            `SELECT *
              FROM setMutations
              WHERE transactionNum = @transactionNum
                AND requiresUpdateHack = 1
                AND (identifier, phaseGroupId) NOT IN (VALUES ${updates
                  .map(
                    (update) =>
                      `('${update.identifier}', ${update.phaseGroupId})`,
                  )
                  .join(', ')})`,
          )
          .all({ transactionNum }) as DbSetMutation[]
      ).forEach((dbSetMutation) => {
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
        if (dbSetMutation.startedAtPresent) {
          exprs.push('startedAt = @startedAt');
        }
        if (dbSetMutation.completedAtPresent) {
          exprs.push('completedAt = @completedAt');
        }
        if (dbSetMutation.stationIdPresent) {
          exprs.push('stationId = @stationId');
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
      });

      // of course, start.gg does not return seed updates at all so apply those
      // here as well.
      (
        db!
          .prepare(
            'SELECT * FROM seedMutations WHERE transactionNum = @transactionNum',
          )
          .all({ transactionNum }) as DbSeedMutation[]
      ).forEach((dbSeedMutation) => {
        if (!dbSeedMutation.entrantIdPresent) {
          throw new Error(
            `no mutations in dbSeedMutation: ${dbSeedMutation.id}, transactionNum: ${dbSeedMutation.transactionNum}`,
          );
        }
        db!
          .prepare(`UPDATE seeds SET entrantId = @entrantId WHERE id = @seedId`)
          .run(dbSeedMutation);
      });
    }

    db!
      .prepare(
        'DELETE FROM setMutations WHERE transactionNum = @transactionNum',
      )
      .run({ transactionNum });
    db!
      .prepare(
        'DELETE FROM setMutationGames WHERE transactionNum = @transactionNum',
      )
      .run({ transactionNum });
    db!
      .prepare(
        'DELETE FROM seedMutations WHERE transactionNum = @transactionNum',
      )
      .run({ transactionNum });
    updates.forEach((update) => {
      db!
        .prepare(
          `UPDATE sets
            SET
              setId = @setId,
              state = @state,
              entrant1Id = @entrant1Id,
              entrant1Score = @entrant1Score,
              entrant2Id = @entrant2Id,
              entrant2Score = @entrant2Score,
              winnerId = @winnerId,
              updatedAt = @updatedAt,
              startedAt = @startedAt,
              completedAt = @completedAt,
              stationId = @stationId,
              streamId = @streamId
            WHERE identifier = @identifier AND phaseGroupId = @phaseGroupId`,
        )
        .run(update);
    });
  })();
}

export function updateSetIds(oldSetIds: string[], newSetIds: number[]) {
  if (!db) {
    throw new Error('not init');
  }

  if (oldSetIds.length !== newSetIds.length) {
    throw new Error(
      `deleteSetIds length: ${oldSetIds.length} does not match updateSetIds length: ${newSetIds.length}`,
    );
  }

  for (let i = 0; i < oldSetIds.length; i += 1) {
    db.prepare(
      'UPDATE sets SET setId = @updateSetId WHERE setId = @deleteSetId',
    ).run({ deleteSetId: oldSetIds[i], updateSetId: newSetIds[i] });
  }
}

function getSyncStatus(
  dbTransaction: DbTransaction,
  afterSet: DbSet,
  containsValidReset: boolean,
  setMutations: DbSetMutation[],
):
  | { syncStatus: SyncStatus.AHEAD | SyncStatus.BEHIND }
  | { syncStatus: SyncStatus.CONFLICT; reason: ConflictReason } {
  switch (dbTransaction.type) {
    case TransactionType.RESET: {
      if (dbTransaction.isRecursive === 1) {
        return { syncStatus: SyncStatus.AHEAD };
      }

      // always check for dependent sets due to CALL state bug
      const dependentSets = db!
        .prepare(
          'SELECT * FROM sets WHERE entrant1PrereqId = @setId OR entrant2PrereqId = @setId',
        )
        .all(afterSet) as DbSet[];
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
      if (afterSet.state === 1) {
        return { syncStatus: SyncStatus.BEHIND };
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
    case TransactionType.CALL: {
      const mutationSet: DbSet = { ...afterSet };
      for (const setMutation of setMutations) {
        if (setMutation.transactionNum > dbTransaction.transactionNum) {
          break;
        }
        applyMutation(mutationSet, [], setMutation);
      }
      if (mutationSet.entrant1Id === null || mutationSet.entrant2Id === null) {
        return {
          syncStatus: SyncStatus.CONFLICT,
          reason: ConflictReason.MISSING_ENTRANTS,
        };
      }

      if (containsValidReset || afterSet.state === 1 || afterSet.state === 2) {
        return { syncStatus: SyncStatus.AHEAD };
      }
      return { syncStatus: SyncStatus.BEHIND };
    }
    case TransactionType.START: {
      const mutationSet: DbSet = { ...afterSet };
      for (const setMutation of setMutations) {
        if (setMutation.transactionNum > dbTransaction.transactionNum) {
          break;
        }
        applyMutation(mutationSet, [], setMutation);
      }
      if (mutationSet.entrant1Id === null || mutationSet.entrant2Id === null) {
        return {
          syncStatus: SyncStatus.CONFLICT,
          reason: ConflictReason.MISSING_ENTRANTS,
        };
      }

      if (containsValidReset || afterSet.state === 1 || afterSet.state === 6) {
        return { syncStatus: SyncStatus.AHEAD };
      }
      return { syncStatus: SyncStatus.BEHIND };
    }
    case TransactionType.REPORT: {
      const games = db!
        .prepare(
          'SELECT * FROM setGames WHERE setId = @setId ORDER BY orderNum ASC',
        )
        .all({ setId: afterSet.setId }) as DbSetGame[];
      const mutationSet: DbSet = { ...afterSet };
      for (const setMutation of setMutations) {
        if (setMutation.transactionNum > dbTransaction.transactionNum) {
          break;
        }
        applyMutation(mutationSet, games, setMutation);
      }
      if (mutationSet.entrant1Id === null || mutationSet.entrant2Id === null) {
        return {
          syncStatus: SyncStatus.CONFLICT,
          reason: ConflictReason.MISSING_ENTRANTS,
        };
      }

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
      if (dbCommonGamesHaveStagesAndScores(games)) {
        const apiTransaction = toApiTransaction(dbTransaction);
        if (apiTransaction.type !== TransactionType.REPORT) {
          throw new Error('unreachable');
        }
        if (!apiGameDatasHaveStagesAndScores(apiTransaction.gameData)) {
          return {
            syncStatus: SyncStatus.CONFLICT,
            reason: ConflictReason.UPDATE_REMOVE_STAGES_STOCKS,
          };
        }
        return { syncStatus: SyncStatus.AHEAD };
      }
      if (
        afterSet.entrant1Score !== -1 &&
        afterSet.entrant2Score !== -1 &&
        dbTransaction.isDQ === 1
      ) {
        return { syncStatus: SyncStatus.BEHIND };
      }
      return { syncStatus: SyncStatus.AHEAD };
    }
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
        'DELETE FROM setMutationGames WHERE transactionNum = @transactionNum',
      )
      .run({ transactionNum });
    db!
      .prepare(
        'DELETE FROM seedMutations WHERE transactionNum = @transactionNum',
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

export function updateEvent(
  tournamentId: number,
  eventId: number,
  phases: DbPhase[],
  pools: DbPool[],
  entrants: DbEntrant[],
  entrantIdToParticipantIds: Map<number, number[]>,
  participants: DbParticipant[],
  seeds: DbSeed[],
  sets: DbSet[],
  games: DbSetGame[],
) {
  if (!db) {
    throw new Error('not init');
  }

  phases.forEach((phase) => {
    db!
      .prepare(
        `REPLACE INTO
          phases
            (id, eventId, tournamentId, name, phaseOrder)
          VALUES
            (@id, @eventId, @tournamentId, @name, @phaseOrder)`,
      )
      .run(phase);
  });
  db.prepare(
    `DELETE FROM phases
      WHERE eventId = @eventId AND id NOT IN (${phases
        .map((phase) => phase.id)
        .join(', ')})`,
  ).run({ eventId });

  pools.forEach((pool) => {
    db!
      .prepare(
        `REPLACE INTO
          pools (
            id,
            waveId,
            phaseId,
            eventId,
            tournamentId,
            name,
            bracketType,
            state,
            winnersTargetPhaseId,
            tiebreakMethod1,
            tiebreakMethod2,
            tiebreakMethod3
          ) VALUES (
            @id,
            @waveId,
            @phaseId,
            @eventId,
            @tournamentId,
            @name,
            @bracketType,
            @state,
            @winnersTargetPhaseId,
            @tiebreakMethod1,
            @tiebreakMethod2,
            @tiebreakMethod3
          )`,
      )
      .run(pool);
  });
  db.prepare(
    `DELETE FROM pools
      WHERE eventId = @eventId AND id NOT IN (${pools
        .map((pool) => pool.id)
        .join(', ')})`,
  ).run({ eventId });

  entrants.forEach((entrant) => {
    db!
      .prepare(
        `REPLACE INTO entrants (
          id,
          tournamentId,
          eventId,
          name
        ) values (
          @id,
          @tournamentId,
          @eventId,
          @name
        )`,
      )
      .run(entrant);
  });
  db.prepare(
    `DELETE FROM entrants
      WHERE eventId = @eventId AND id NOT IN (${entrants
        .map((entrant) => entrant.id)
        .join(', ')})`,
  ).run({ eventId });

  Array.from(entrantIdToParticipantIds.entries()).forEach(
    ([entrantId, participantIds]) => {
      participantIds.forEach((participantId) => {
        db!
          .prepare(
            `REPLACE INTO participantsToEntrant (
              tournamentId, participantId, entrantId
            ) VALUES (
              @tournamentId, @participantId, @entrantId
            )`,
          )
          .run({ tournamentId, participantId, entrantId });
      });
      db!
        .prepare(
          `DELETE FROM participantsToEntrant
            WHERE entrantId = @entrantId
              AND participantId NOT IN (${participantIds.join(', ')})`,
        )
        .run({ entrantId });
    },
  );

  participants.forEach((participant) => {
    db!
      .prepare(
        `INSERT OR IGNORE INTO participants (
          id,
          tournamentId,
          connectCode,
          discordId,
          discordUsername,
          gamerTag,
          prefix,
          pronouns,
          userSlug
        ) VALUES (
          @id,
          @tournamentId,
          @connectCode,
          @discordId,
          @discordUsername,
          @gamerTag,
          @prefix,
          @pronouns,
          @userSlug
        )`,
      )
      .run(participant);
  });

  seeds.forEach((seed) => {
    db!
      .prepare(
        `REPLACE INTO seeds (
          id,
          poolId,
          phaseId,
          eventId,
          tournamentId,
          seedNum,
          groupSeedNum,
          placeholderName,
          originPlacement,
          originPoolId,
          entrantId
        ) values (
          @id,
          @poolId,
          @phaseId,
          @eventId,
          @tournamentId,
          @seedNum,
          @groupSeedNum,
          @placeholderName,
          @originPlacement,
          @originPoolId,
          @entrantId
        )`,
      )
      .run(seed);
  });
  db.prepare(
    `DELETE FROM seeds
      WHERE eventId = @eventId AND id NOT IN (${seeds
        .map((seed) => seed.id)
        .join(', ')})`,
  ).run({ eventId });

  sets.forEach((set) => {
    db!
      .prepare(
        `INSERT INTO sets
          (
            setId,
            phaseGroupId,
            phaseId,
            eventId,
            tournamentId,
            ordinal,
            fullRoundText,
            identifier,
            bestOf,
            round,
            state,
            stationId,
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
            @setId,
            @phaseGroupId,
            @phaseId,
            @eventId,
            @tournamentId,
            @ordinal,
            @fullRoundText,
            @identifier,
            @bestOf,
            @round,
            @state,
            @stationId,
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
          )
          ON CONFLICT(identifier, phaseGroupId)
          DO UPDATE SET
            setId = @setId,
            phaseId = @phaseId,
            eventId = @eventId,
            tournamentId = @tournamentId,
            ordinal = @ordinal,
            fullRoundText = @fullRoundText,
            bestOf = @bestOf,
            round = @round,
            state = @state,
            stationId = @stationId,
            streamId = @streamId,
            entrant1Id = @entrant1Id,
            entrant1Score = @entrant1Score,
            entrant1PrereqType = @entrant1PrereqType,
            entrant1PrereqId = @entrant1PrereqId,
            entrant1PrereqCondition = @entrant1PrereqCondition,
            entrant1PrereqStr = @entrant1PrereqStr,
            entrant2Id = @entrant2Id,
            entrant2Score = @entrant2Score,
            entrant2PrereqType = @entrant2PrereqType,
            entrant2PrereqId = @entrant2PrereqId,
            entrant2PrereqCondition = @entrant2PrereqCondition,
            entrant2PrereqStr = @entrant2PrereqStr,
            winnerId = @winnerId,
            wProgressionSeedId = @wProgressionSeedId,
            wProgressingPhaseGroupId = @wProgressingPhaseGroupId,
            wProgressingPhaseId = @wProgressingPhaseId,
            wProgressingName = @wProgressingName,
            lProgressionSeedId = @lProgressionSeedId,
            lProgressingPhaseGroupId = @lProgressingPhaseGroupId,
            lProgressingPhaseId = @lProgressingPhaseId,
            lProgressingName = @lProgressingName,
            updatedAt = @updatedAt,
            syncState = @syncState
          WHERE updatedAt <= @updatedAt`,
      )
      .run(set);
  });
  if (sets.length > 0) {
    db.prepare(
      `DELETE FROM sets
        WHERE eventId = @eventId AND (identifier, phaseGroupId) NOT IN (VALUES ${sets
          .map((set) => `('${set.identifier}', ${set.phaseGroupId})`)
          .join(', ')})`,
    ).run({ eventId });
  }

  games.forEach((game) => {
    db!
      .prepare(
        `REPLACE INTO setGames (
          id,
          setId,
          eventId,
          orderNum,
          entrant1Score,
          entrant2Score,
          stageId,
          state,
          updatedAt,
          winnerId
        ) values (
          @id,
          @setId,
          @eventId,
          @orderNum,
          @entrant1Score,
          @entrant2Score,
          @stageId,
          @state,
          @updatedAt,
          @winnerId
        )`,
      )
      .run(game);
  });
  db.prepare(
    `DELETE FROM setGames
      WHERE eventId = @eventId and id NOT IN (${games
        .map((game) => game.id)
        .join(', ')})`,
  ).run({ eventId });

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
      // - multiple call/start
      // - reset, call, start, report, update before reset
      const resetStationStreamCoalescedDbTransactions: DbTransaction[] = [];
      let foundReset = false;
      let foundCallStart = false;
      let foundAssignStation = false;
      let foundAssignStream = false;
      for (let i = dbTransactions.length - 1; i >= 0; i -= 1) {
        const dbTransaction = dbTransactions[i];
        if (
          (foundReset &&
            (dbTransaction.type === TransactionType.RESET ||
              dbTransaction.type === TransactionType.CALL ||
              dbTransaction.type === TransactionType.START ||
              dbTransaction.type === TransactionType.REPORT)) ||
          (foundCallStart &&
            (dbTransaction.type === TransactionType.CALL ||
              dbTransaction.type === TransactionType.START)) ||
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
        } else if (
          dbTransaction.type === TransactionType.CALL ||
          dbTransaction.type === TransactionType.START
        ) {
          foundCallStart = true;
        } else if (dbTransaction.type === TransactionType.ASSIGN_STATION) {
          foundAssignStation = true;
        } else if (dbTransaction.type === TransactionType.ASSIGN_STREAM) {
          foundAssignStream = true;
        }
        resetStationStreamCoalescedDbTransactions.unshift(dbTransaction);
      }

      // coalesce call or start before report
      const reportCoalescedDbTransactions: DbTransaction[] = [];
      let foundReport = false;
      for (
        let i = resetStationStreamCoalescedDbTransactions.length - 1;
        i >= 0;
        i -= 1
      ) {
        const dbTransaction = resetStationStreamCoalescedDbTransactions[i];
        if (
          foundReport &&
          (dbTransaction.type === TransactionType.CALL ||
            dbTransaction.type === TransactionType.START)
        ) {
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
        // at this point there's 1 CALL, 1 START, or 1 REPORT (after RESET) or none
        const callOrStartOrReportTransaction =
          reportCoalescedDbTransactions.find(
            (dbTransaction) =>
              dbTransaction.type === TransactionType.CALL ||
              dbTransaction.type === TransactionType.START ||
              (dbTransaction.type === TransactionType.REPORT &&
                dbTransaction.isUpdate === null),
          );
        if (
          callOrStartOrReportTransaction &&
          ((callOrStartOrReportTransaction.type === TransactionType.CALL &&
            (afterSet.state === 1 || afterSet.state === 2)) ||
            (callOrStartOrReportTransaction.type === TransactionType.START &&
              (afterSet.state === 1 || afterSet.state === 6)) ||
            (callOrStartOrReportTransaction.type === TransactionType.REPORT &&
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
            // leave any seedMutations alone
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
                'DELETE FROM setMutationGames WHERE transactionNum = @reportTransactionNum',
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
            db!
              .prepare(
                `UPDATE setMutationGames
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

      const setMutations = db!
        .prepare(
          `SELECT *
          FROM setMutations
          WHERE setId = @setId
            AND transactionNum NOT IN (${dbTransactions
              .map((transaction) => transaction.transactionNum)
              .join(', ')})
          ORDER BY transactionNum ASC`,
        )
        .all({ setId }) as DbSetMutation[];
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
          setMutations,
        );
        switch (statusObj.syncStatus) {
          case SyncStatus.AHEAD:
            aheadTransactionNums.push(dbTransaction.transactionNum);
            break;
          case SyncStatus.BEHIND:
            transactionNumsToDelete.push(dbTransaction.transactionNum);
            if (dbTransaction.type === TransactionType.RESET) {
              containsValidReset = false;
            }
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

export function getPoolSiblings(waveId: number | null, phaseId: number) {
  if (!db) {
    throw new Error('not init');
  }

  const dbPhasePools = db
    .prepare('SELECT * FROM pools WHERE phaseId = @phaseId')
    .all({ phaseId }) as DbPool[];
  const siblings: PoolSiblings = {
    wave: [],
    phase: dbPhasePools
      .map((dbPool) => dbPool.name)
      .sort((a, b) => {
        if (a.length === b.length) {
          return a.localeCompare(b);
        }
        return a.length - b.length;
      }),
  };

  if (waveId !== null) {
    const dbWavePools = db
      .prepare('SELECT * FROM pools WHERE waveId = @waveId')
      .all({ waveId }) as DbPool[];
    siblings.wave = dbWavePools
      .map((dbPool) => dbPool.name)
      .sort((a, b) => {
        if (a.length === b.length) {
          return a.localeCompare(b);
        }
        return a.length - b.length;
      });
  }

  return siblings;
}

export function getPreviewSetIdFromPool(poolId: number) {
  if (!db) {
    throw new Error('not init');
  }

  const dbSet = db
    .prepare('SELECT * FROM sets WHERE phaseGroupId = @poolId LIMIT 1')
    .get({ poolId }) as DbSet;
  if (typeof dbSet.setId === 'string') {
    return dbSet.setId;
  }
  return '';
}

export function getPreviewSetIdsFromWave(waveId: number) {
  if (!db) {
    throw new Error('not init');
  }

  const dbPools = db
    .prepare('SELECT * FROM pools WHERE waveId = @waveId')
    .all({ waveId }) as DbPool[];
  return dbPools
    .map((dbPool) => getPreviewSetIdFromPool(dbPool.id))
    .filter((previewSetId) => previewSetId);
}

export function getPreviewSetIdsFromPhase(phaseId: number) {
  if (!db) {
    throw new Error('not init');
  }

  const dbPools = db
    .prepare('SELECT * FROM pools WHERE phaseId = @phaseId')
    .all({ phaseId }) as DbPool[];
  return dbPools
    .map((dbPool) => getPreviewSetIdFromPool(dbPool.id))
    .filter((previewSetId) => previewSetId);
}

export function getLoadedEventIds(tournamentId?: number) {
  if (!db) {
    throw new Error('not init');
  }

  const id = tournamentId ?? currentTournamentId;
  return (
    db
      .prepare('SELECT * FROM loadedEvents WHERE tournamentId = @id')
      .all({ id }) as DbLoadedEvent[]
  ).map((loadedEvent) => loadedEvent.id);
}

let lastTournament: RendererTournament | undefined;
export function getLastTournament() {
  return lastTournament;
}
export function getLastSubscriberTournament() {
  if (!lastTournament) {
    return undefined;
  }

  const subscriberTournament: SubscriberTournament = {
    id: lastTournament.id,
    name: lastTournament.name,
    slug: lastTournament.slug,
    location: lastTournament.location,
    events: lastTournament.events,
    participants: lastTournament.participants,
    stations: lastTournament.stations,
    streams: lastTournament.streams,
  };
  return subscriberTournament;
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
  const unloadedEvents: DbEvent[] = [];
  const loadedEvents: DbEvent[] = [];
  dbEvents.forEach((dbEvent) => {
    if (dbLoadedEventIds.has(dbEvent.id)) {
      loadedEvents.push(dbEvent);
    } else {
      unloadedEvents.push(dbEvent);
    }
  });

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
  const dbParticipants = db
    .prepare(
      'SELECT * FROM participants WHERE tournamentId = @id ORDER BY gamerTag ASC',
    )
    .all({ id: currentTournamentId }) as DbParticipant[];
  const idToParticipant = new Map(
    dbParticipants.map((participant) => [participant.id, participant]),
  );
  const entrantIdToParticipants = new Map<number, DbParticipant[]>();
  (
    db
      .prepare('SELECT * FROM participantsToEntrant WHERE tournamentId = @id')
      .all({ id: currentTournamentId }) as DbParticipantToEntrant[]
  ).forEach((dbParticipantToEntrant) => {
    const participant = idToParticipant.get(
      dbParticipantToEntrant.participantId,
    );
    if (participant) {
      const { entrantId } = dbParticipantToEntrant;
      const participants = entrantIdToParticipants.get(entrantId);
      if (participants) {
        participants.push(participant);
      } else {
        entrantIdToParticipants.set(entrantId, [participant]);
      }
    }
  });
  const idToRendererEntrant = new Map<number, RendererEntrant>();
  (
    db
      .prepare('SELECT * FROM entrants WHERE tournamentId = @id')
      .all({ id: currentTournamentId }) as DbEntrant[]
  ).forEach((dbEntrant) => {
    const participants = entrantIdToParticipants.get(dbEntrant.id);
    if (participants) {
      idToRendererEntrant.set(dbEntrant.id, {
        name: dbEntrant.name,
        participants,
      });
    }
  });
  const dbStations = db
    .prepare(
      'SELECT * FROM stations WHERE tournamentId = @id ORDER BY number ASC',
    )
    .all({ id: currentTournamentId }) as DbStation[];
  const dbStreams = db
    .prepare(
      `SELECT *
        FROM streams
        WHERE tournamentId = @id
        ORDER BY streamSource ASC, streamName ASC`,
    )
    .all({ id: currentTournamentId }) as DbStream[];
  lastTournament = {
    id: dbTournament.id,
    name: dbTournament.name,
    slug: dbTournament.slug,
    location: dbTournament.location,
    unloadedEvents: unloadedEvents.map(
      (dbEvent): RendererUnloadedEvent => ({
        id: dbEvent.id,
        name: dbEvent.name,
        slug: dbEvent.slug,
        isOnline: dbEvent.isOnline === 1,
        videogameId: dbEvent.videogameId,
      }),
    ),
    events: loadedEvents.map(
      (dbEvent): RendererEvent => ({
        id: dbEvent.id,
        name: dbEvent.name,
        slug: dbEvent.slug,
        isOnline: dbEvent.isOnline === 1,
        videogameId: dbEvent.videogameId,
        phases: dbPhases
          .filter((dbPhase) => dbPhase.eventId === dbEvent.id)
          .sort((a, b) => a.phaseOrder - b.phaseOrder)
          .map(
            (dbPhase): RendererPhase => ({
              id: dbPhase.id,
              name: dbPhase.name,
              phaseOrder: dbPhase.phaseOrder,
              pools: dbPools
                .filter((dbPool) => dbPool.phaseId === dbPhase.id)
                .map((dbPool): RendererPool => {
                  const seeds = (
                    db!
                      .prepare(
                        'SELECT * FROM seeds WHERE poolId = @id ORDER BY groupSeedNum ASC',
                      )
                      .all({ id: dbPool.id }) as DbSeed[]
                  ).map((dbSeed): RendererSeed => {
                    applySeedMutations(dbSeed);
                    let entrant: {
                      id: number;
                      participants: RendererParticipant[];
                    } | null = null;
                    if (dbSeed.entrantId !== null) {
                      const participants = entrantIdToParticipants.get(
                        dbSeed.entrantId,
                      );
                      if (participants !== undefined) {
                        entrant = {
                          id: dbSeed.entrantId,
                          participants,
                        };
                      }
                    }

                    return {
                      id: dbSeed.id,
                      seedNum: dbSeed.seedNum,
                      groupSeedNum: dbSeed.groupSeedNum,
                      placeholder: dbSeed.placeholderName,
                      entrant,
                    };
                  });
                  const rendererSets = (
                    db!
                      .prepare(
                        'SELECT * FROM sets WHERE phaseGroupId = @id ORDER BY ordinal, id',
                      )
                      .all({ id: dbPool.id }) as DbSet[]
                  ).map((dbSet) => {
                    const dbSetGames = db!
                      .prepare(
                        'SELECT * FROM setGames WHERE setId = @setId ORDER BY orderNum ASC',
                      )
                      .all({ setId: dbSet.setId }) as DbSetGame[];
                    applyMutations(dbSet, dbSetGames);
                    return dbSetToRendererSet(
                      dbSet,
                      dbSetGames,
                      idToRendererEntrant,
                    );
                  });

                  return {
                    id: dbPool.id,
                    name: dbPool.name,
                    bracketType: dbPool.bracketType,
                    waveId: dbPool.waveId,
                    winnersTargetPhaseId: dbPool.winnersTargetPhaseId,
                    seeds,
                    sets: rendererSets,
                  };
                }),
            }),
          ),
      }),
    ),
    participants: dbParticipants,
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
    db!
      .prepare('DELETE FROM participants WHERE tournamentId = @id')
      .run({ id });
    db!
      .prepare('DELETE FROM participantsToEntrant WHERE tournamentId = @id')
      .run({ id });
    db!.prepare('DELETE FROM entrants WHERE tournamentId = @id').run({ id });
    db!.prepare('DELETE FROM phases WHERE tournamentId = @id').run({ id });
    db!.prepare('DELETE FROM pools WHERE tournamentId = @id').run({ id });
    db!.prepare('DELETE FROM seeds WHERE tournamentId = @id').run({ id });
    db!.prepare('DELETE FROM sets WHERE tournamentId = @id').run({ id });
    db!
      .prepare('DELETE FROM setMutations WHERE tournamentId = @id')
      .run({ id });
    db!
      .prepare('DELETE FROM seedMutations WHERE tournamentId = @id')
      .run({ id });
    db!.prepare('DELETE FROM stations WHERE tournamentId = @id').run({ id });
    db!.prepare('DELETE FROM streams WHERE tournamentId = @id').run({ id });
    db!
      .prepare('DELETE FROM transactions WHERE tournamentId = @id')
      .run({ id });

    eventIds.forEach((eventId) => {
      db!
        .prepare('DELETE FROM setGames WHERE eventId = @eventId')
        .run({ eventId });
      db!
        .prepare('DELETE FROM setMutationGames WHERE eventId = @eventId')
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
