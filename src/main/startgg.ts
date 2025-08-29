import EventEmitter from 'events';
import { BrowserWindow } from 'electron';
import {
  AdminedTournament,
  ApiError,
  ApiGameData,
  ApiSetUpdate,
  TransactionType,
  DbEntrant,
  DbEvent,
  DbPhase,
  DbPool,
  DbSet,
  DbTournament,
  SyncResult,
  DbStation,
  DbStream,
  SyncState,
  ConflictReason,
  DbSeed,
} from '../common/types';
import {
  upsertTournament,
  updateEvent,
  upsertStations,
  upsertStreams,
  getLoadedEventIds,
  getNextTransaction,
  finalizeTransaction,
  getTournamentId,
  deleteTransaction,
  markTransactionConflict,
  upgradePreviewSets,
  replaceParticipants,
} from './db';

let apiKey = '';
export function setApiKey(newApiKey: string) {
  apiKey = newApiKey;
}

async function wrappedFetch(
  input: URL | RequestInfo,
  init?: RequestInit | undefined,
): Promise<Response> {
  let response: Response | undefined;
  try {
    response = await fetch(input, init);
  } catch (e: any) {
    throw new ApiError({
      cause: e,
      message: '***You may not be connected to the internet***',
      fetch: true,
    });
  }
  if (!response.ok) {
    let keyErr = '';
    if (response.status === 400) {
      keyErr = ' ***start.gg API key invalid!***';
    } else if (response.status === 401) {
      keyErr = ' ***start.gg API key expired!***';
    }
    throw new ApiError({
      message: keyErr || response.statusText,
      status: response.status,
    });
  }
  return response;
}

async function fetchGql(key: string, query: string, variables: any) {
  const response = await wrappedFetch('https://api.start.gg/gql/alpha', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await response.json();
  if (json.errors) {
    throw new ApiError({
      message: json.errors.map((error: any) => error.message).join(', '),
      gqlErrors: json.errors,
    });
  }

  const deleteSetIds = json.actionRecords?.delete?.sets;
  const updateSetIds = json.actionRecords?.update?.sets;
  if (
    Array.isArray(deleteSetIds) &&
    deleteSetIds.every((deleteSetId) => typeof deleteSetId === 'string') &&
    Array.isArray(updateSetIds) &&
    updateSetIds.every((updateSetId) => Number.isInteger(updateSetId))
  ) {
    upgradePreviewSets(deleteSetIds, updateSetIds);
  }

  return json.data;
}

function isRetryableApiError(e: any) {
  if (e instanceof ApiError) {
    if (
      e.fetch ||
      (e.status !== undefined && Math.floor(e.status / 100) === 5)
    ) {
      return true;
    }
  }
  return false;
}

let mainWindow: BrowserWindow | undefined;
const idToSlug = new Map<number, string>();
export function startggInit(window: BrowserWindow) {
  mainWindow = window;
  idToSlug.clear();
}

let fatalErrorMessage = '';
export function getFatalErrorMessage() {
  return fatalErrorMessage;
}
function updateWithFatalError(e: Error) {
  let messagePrefix = '';
  if (e instanceof ApiError) {
    if (e.status !== undefined) {
      messagePrefix = `${e.status}: `;
    }
  }
  fatalErrorMessage = `${messagePrefix}${e.message}`;
  if (e instanceof Error && e.stack) {
    fatalErrorMessage += `\n${e.stack}`;
  }
  mainWindow?.webContents.send('fatalError', fatalErrorMessage);
}

let consecutiveErrors = 0;
const syncResult: SyncResult = {
  success: true,
  errorSinceMs: 0,
  lastError: '',
  lastErrorMs: 0,
  lastSuccessMs: 0,
};
export function getSyncResult() {
  return syncResult;
}
function updateSyncResultWithError(e: ApiError) {
  const nowMs = Date.now();
  syncResult.success = false;
  syncResult.lastError = e.message;
  syncResult.lastErrorMs = nowMs;
  if (consecutiveErrors === 0) {
    syncResult.errorSinceMs = nowMs;
  }
  consecutiveErrors += 1;
  mainWindow?.webContents.send('syncResult', syncResult);
}
function updateSyncResultWithSuccess() {
  syncResult.success = true;
  syncResult.lastSuccessMs = Date.now();
  consecutiveErrors = 0;
  fatalErrorMessage = '';
  mainWindow?.webContents.send('fatalError', fatalErrorMessage);
  mainWindow?.webContents.send('syncResult', syncResult);
}

const GET_ADMINED_TOURNAMENTS_QUERY = `
  query TournamentsQuery {
    currentUser {
      tournaments(query: {perPage: 500, filter: {tournamentView: "admin"}}) {
        nodes {
          id
          slug
          name
          startAt
        }
      }
    }
  }
`;
export async function getAdminedTournaments(): Promise<AdminedTournament[]> {
  if (!apiKey) {
    return [];
  }

  try {
    const data = await fetchGql(apiKey, GET_ADMINED_TOURNAMENTS_QUERY, {});
    return (data.currentUser.tournaments.nodes as any[]).map((tournament) => ({
      id: tournament.id,
      slug: tournament.slug.slice(11),
      name: tournament.name,
      isSynced: true,
      startAt: tournament.startAt,
    }));
  } catch (e: any) {
    if (isRetryableApiError(e)) {
      updateSyncResultWithError(e);
    } else {
      updateWithFatalError(e);
    }
    throw e;
  }
}

async function oneSecondPromise() {
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      resolve();
    }, 1000);
  });
}

const TOURNAMENT_PARTICIPANTS_QUERY = `
  query TournamentPlayersQuery($slug: String, $eventIds: [ID], $page: Int) {
    tournament(slug: $slug) {
      participants(query: {page: $page, perPage: 499, filter: {eventIds: $eventIds}}) {
        pageInfo {
          totalPages
        }
        nodes {
          id
          gamerTag
          prefix
          player {
            user {
              genderPronoun
              slug
            }
          }
        }
      }
    }
  }
`;
const TOURNAMENT_STREAMS_AND_STATIONS_QUERY = `
  query TournamentStreamsAndStationsQuery($slug: String) {
    tournament(slug: $slug) {
      stations(page: 1, perPage: 500) {
        nodes {
          id
          number
          stream {
            id
          }
        }
      }
      streams {
        id
        streamSource
        streamName
      }
    }
  }
`;
export async function getApiTournament(inSlug: string) {
  if (!apiKey) {
    throw new Error('Please set API key.');
  }

  try {
    const response = await wrappedFetch(
      `https://api.smash.gg/tournament/${inSlug}?expand[]=event`,
    );
    const json = await response.json();
    const { id, slug: apiSlug } = json.entities.tournament;
    const slug = apiSlug.slice(11);
    const tournament: DbTournament = {
      id,
      slug,
      name: json.entities.tournament.name,
      startAt: json.entities.tournament.startAt,
    };
    const events: DbEvent[] = (json.entities.event as any[]).map((event) => ({
      id: event.id,
      tournamentId: id,
      name: event.name,
      isOnline: event.isOnline ? 1 : 0,
    }));
    upsertTournament(tournament, events);

    let page = 1;
    const eventIds = getLoadedEventIds(id);
    // eslint-disable-next-line no-constant-condition
    while (true) {
      // eslint-disable-next-line no-await-in-loop
      const nextData = await fetchGql(apiKey, TOURNAMENT_PARTICIPANTS_QUERY, {
        page,
        slug,
        eventIds,
      });
      const { nodes } = nextData.tournament.participants;
      if (Array.isArray(nodes)) {
        replaceParticipants(
          nodes.map((participant) => ({
            id: participant.id,
            tournamentId: id,
            gamerTag: participant.gamerTag,
            prefix: participant.prefix,
            pronouns: participant.player.user?.genderPronoun ?? '',
            userSlug: participant.player.user?.slug.slice(5) ?? '',
          })),
        );
      }
      page += 1;
      if (page <= nextData.tournament.participants.pageInfo.totalPages) {
        await oneSecondPromise();
      } else {
        break;
      }
    }

    const streamsAndStationsData = await fetchGql(
      apiKey,
      TOURNAMENT_STREAMS_AND_STATIONS_QUERY,
      { slug },
    );
    upsertStations(
      streamsAndStationsData.tournament.stations.nodes.map(
        (apiStation: any): DbStation => ({
          id: apiStation.id,
          tournamentId: id,
          number: apiStation.number,
          streamId: apiStation.stream?.id ?? null,
        }),
      ),
    );
    if (Array.isArray(streamsAndStationsData.tournament.streams)) {
      upsertStreams(
        streamsAndStationsData.tournament.streams.map(
          (apiStream: any): DbStream => ({
            id: apiStream.id,
            tournamentId: id,
            streamName: apiStream.streamName,
            streamSource: apiStream.streamSource,
          }),
        ),
      );
    }

    return id;
  } catch (e: any) {
    if (isRetryableApiError(e)) {
      updateSyncResultWithError(e);
    } else {
      updateWithFatalError(e);
    }
    throw e;
  }
}

function coalescePrereq(set: DbSet, setIdToDbSet: Map<number | string, DbSet>) {
  if (set.entrant1PrereqType === 'bye') {
    if (set.entrant2PrereqType === 'seed') {
      return {
        prereqType: set.entrant2PrereqType,
        prereqId: set.entrant2PrereqId,
        prereqCondition: set.entrant2PrereqCondition,
        prereqStr: set.entrant2PrereqStr,
      };
    }
    if (set.entrant2PrereqType === 'set') {
      const prereqSet = setIdToDbSet.get(set.entrant2PrereqId)!;
      if (
        prereqSet.entrant1PrereqType !== 'bye' &&
        prereqSet.entrant2PrereqType !== 'bye'
      ) {
        return {
          prereqType: set.entrant2PrereqType,
          prereqId: set.entrant2PrereqId,
          prereqCondition: set.entrant2PrereqCondition,
          prereqStr: set.entrant2PrereqStr,
        };
      }
      return coalescePrereq(prereqSet, setIdToDbSet);
    }
  }
  if (set.entrant2PrereqType === 'bye') {
    if (set.entrant1PrereqType === 'seed') {
      return {
        prereqType: set.entrant1PrereqType,
        prereqId: set.entrant1PrereqId,
        prereqCondition: set.entrant1PrereqCondition,
        prereqStr: set.entrant1PrereqStr,
      };
    }
    if (set.entrant1PrereqType === 'set') {
      const prereqSet = setIdToDbSet.get(set.entrant1PrereqId)!;
      if (
        prereqSet.entrant1PrereqType !== 'bye' &&
        prereqSet.entrant2PrereqType !== 'bye'
      ) {
        return {
          prereqType: set.entrant1PrereqType,
          prereqId: set.entrant1PrereqId,
          prereqCondition: set.entrant1PrereqCondition,
          prereqStr: set.entrant1PrereqStr,
        };
      }
      return coalescePrereq(prereqSet, setIdToDbSet);
    }
  }
  throw new Error(
    `coalescePrereq: ${set.entrant1PrereqType}, ${set.entrant2PrereqType}`,
  );
}

function dbSetsFromApiSets(
  apiSets: any[],
  tournamentId: number,
  bracketType: number,
) {
  const idToDEOrdinal = new Map<number, number>();
  let roundMax = 0;
  const reachableSets = apiSets.filter((set) => !set.unreachable);
  if (bracketType === 2) {
    const setIdToApiSet = new Map<number, any>(
      reachableSets.map((apiSet) => [apiSet.id, apiSet]),
    );

    const stack: any[] = [];
    const winnersQueue: any[] = [];
    let losersQueue: any[] = [];
    const gfs = reachableSets
      .filter((set) => set.isGF)
      .sort((setA, setB) => setB.round - setA.round);
    if (gfs.length === 2) {
      stack.push(gfs[0]);
      stack.push(gfs[1]);
      // queue losers finals
      if (gfs[1].entrant2PrereqType === 'set') {
        losersQueue.push(setIdToApiSet.get(gfs[1].entrant2PrereqId));
      }
    } else {
      reachableSets
        .filter((set) => set.wProgressionSeedId && set.lProgressionSeedId)
        .forEach((set) => {
          stack.push(set);
        });
      reachableSets
        .filter((set) => set.wProgressionSeedId && set.round < 0)
        .sort((setA, setB) => setA.round - setB.round)
        .forEach((set) => {
          losersQueue.push(set);
        });
    }

    while (losersQueue.length > 0) {
      const newLosersQueue: any[] = [];
      while (losersQueue.length > 0) {
        const curr = losersQueue.shift();
        stack.push(curr);

        if (curr.entrant1PrereqType === 'set') {
          const pushSet = setIdToApiSet.get(curr.entrant1PrereqId);
          if (curr.entrant1PrereqCondition === 'winner') {
            newLosersQueue.push(pushSet);
          } else {
            winnersQueue.push(pushSet);
          }
        }
        if (curr.entrant2PrereqType === 'set') {
          const pushSet = setIdToApiSet.get(curr.entrant2PrereqId);
          if (curr.entrant2PrereqCondition === 'winner') {
            newLosersQueue.push(pushSet);
          } else {
            winnersQueue.push(pushSet);
          }
        }
      }
      while (winnersQueue.length > 0) {
        const curr = winnersQueue.shift();
        stack.push(curr);
      }
      losersQueue = newLosersQueue;
    }

    for (let i = 0; i < stack.length; i += 1) {
      idToDEOrdinal.set(stack[i].id, -i);
    }
  } else {
    roundMax = reachableSets
      .map((apiSet) => apiSet.round)
      .reduce((previous, current) => Math.max(previous, current), 0);
  }
  const setIdToDbSet = new Map<number | string, DbSet>();
  apiSets
    .filter(
      (set) =>
        !set.unreachable &&
        !(set.entrant1PrereqType === 'bye' && set.entrant2PrereqType === 'bye'),
    )
    .map((set): DbSet => {
      const games = Array.isArray(set.games) ? (set.games as any[]) : [];
      return {
        id: 0, // autoincrement
        setId: set.id,
        phaseGroupId: set.phaseGroupId,
        phaseId: set.phaseId,
        eventId: set.eventId,
        fullRoundText: set.fullRoundText,
        identifier: set.identifier,
        round: set.round,
        entrant1PrereqType: set.entrant1PrereqType,
        entrant1PrereqId: set.entrant1PrereqId,
        entrant1PrereqCondition: set.entrant1PrereqCondition,
        entrant2PrereqType: set.entrant2PrereqType,
        entrant2PrereqId: set.entrant2PrereqId,
        entrant2PrereqCondition: set.entrant2PrereqCondition,
        wProgressionSeedId: set.wProgressionSeedId,
        lProgressionSeedId: set.lProgressionSeedId,
        state: set.state,
        entrant1Score: set.entrant1Score,
        entrant2Score: set.entrant2Score,
        winnerId: set.winnerId,
        updatedAt: set.updatedAt,
        stationId: set.stationId,
        streamId: set.streamId,
        // correct placeholder entrantIds
        entrant1Id: Number.isInteger(set.entrant1Id) ? set.entrant1Id : null,
        entrant2Id: Number.isInteger(set.entrant2Id) ? set.entrant2Id : null,
        // fill in fields that may be missing
        entrant1PrereqStr:
          set.entrant1PrereqStr === undefined ? null : set.entrant1PrereqStr,
        entrant2PrereqStr:
          set.entrant2PrereqStr === undefined ? null : set.entrant2PrereqStr,
        wProgressingPhaseGroupId:
          set.wProgressingPhaseGroupId === undefined
            ? null
            : set.wProgressingPhaseGroupId,
        wProgressingPhaseId:
          set.wProgressingPhaseId === undefined
            ? null
            : set.wProgressingPhaseId,
        wProgressingName:
          set.wProgressingName === undefined ? null : set.wProgressingName,
        lProgressingPhaseGroupId:
          set.lProgressingPhaseGroupId === undefined
            ? null
            : set.lProgressingPhaseGroupId,
        lProgressingPhaseId:
          set.lProgressingPhaseId === undefined
            ? null
            : set.lProgressingPhaseId,
        lProgressingName:
          set.lProgressingName === undefined ? null : set.lProgressingName,
        // computed here
        tournamentId,
        ordinal: idToDEOrdinal.get(set.id) ?? set.round - roundMax,
        hasStageData:
          games.length > 0 && games.every((game) => game.stageId !== null)
            ? 1
            : null,
        syncState: SyncState.SYNCED,
      };
    })
    .forEach((set) => {
      setIdToDbSet.set(set.setId, set);
    });

  // coalesce byes
  const sets: DbSet[] = [];
  Array.from(setIdToDbSet.values()).forEach((dbSet) => {
    if (
      dbSet.entrant1PrereqType === 'bye' ||
      dbSet.entrant2PrereqType === 'bye'
    ) {
      return;
    }
    if (dbSet.entrant1PrereqType === 'set') {
      const prereqSet1 = setIdToDbSet.get(dbSet.entrant1PrereqId)!;
      if (
        prereqSet1.entrant1PrereqType === 'bye' ||
        prereqSet1.entrant2PrereqType === 'bye'
      ) {
        const { prereqType, prereqId, prereqCondition, prereqStr } =
          coalescePrereq(prereqSet1, setIdToDbSet);
        dbSet.entrant1PrereqType = prereqType;
        dbSet.entrant1PrereqId = prereqId;
        dbSet.entrant1PrereqCondition = prereqCondition;
        dbSet.entrant1PrereqStr = prereqStr;
      }
    }
    if (dbSet.entrant2PrereqType === 'set') {
      const prereqSet2 = setIdToDbSet.get(dbSet.entrant2PrereqId)!;
      if (
        prereqSet2.entrant1PrereqType === 'bye' ||
        prereqSet2.entrant2PrereqType === 'bye'
      ) {
        const { prereqType, prereqId, prereqCondition, prereqStr } =
          coalescePrereq(prereqSet2, setIdToDbSet);
        dbSet.entrant2PrereqType = prereqType;
        dbSet.entrant2PrereqId = prereqId;
        dbSet.entrant2PrereqCondition = prereqCondition;
        dbSet.entrant2PrereqStr = prereqStr;
      }
    }
    sets.push(dbSet);
  });
  return sets;
}

async function refreshEvent(tournamentId: number, eventId: number) {
  const phases: DbPhase[] = [];
  const pools: DbPool[] = [];
  try {
    const eventResponse = await wrappedFetch(
      `https://api.smash.gg/event/${eventId}?expand[]=phase&expand[]=groups`,
    );
    const json = await eventResponse.json();
    json.entities.phase.forEach((phase: any) => {
      phases.push({
        id: phase.id,
        eventId,
        tournamentId,
        name: phase.name,
        phaseOrder: phase.phaseOrder,
      });
    });
    json.entities.groups.forEach((group: any) => {
      pools.push({
        id: group.id,
        phaseId: group.phaseId,
        eventId,
        tournamentId,
        name: group.displayIdentifier,
        bracketType: group.groupTypeId,
        state: group.state,
      });
    });
    updateSyncResultWithSuccess();
  } catch (e: any) {
    if (isRetryableApiError(e)) {
      updateSyncResultWithError(e);
    } else {
      updateWithFatalError(e);
    }
    throw e;
  }

  const idToEntrant = new Map<number, DbEntrant>();
  const entrantIdToParticipantIds = new Map<number, number[]>();
  const seeds: DbSeed[] = [];
  const sets: DbSet[] = [];
  try {
    await Promise.all(
      pools
        .map((pool) => pool.id)
        .map(async (id) => {
          const response = await wrappedFetch(
            `https://api.smash.gg/phase_group/${id}?expand[]=sets&expand[]=entrants&expand[]=seeds`,
          );
          const json = await response.json();
          const jsonEntrants = json.entities.entrants;
          if (Array.isArray(jsonEntrants)) {
            jsonEntrants.forEach((entrant) => {
              idToEntrant.set(entrant.id, {
                id: entrant.id,
                eventId: entrant.eventId,
                name: entrant.name,
              });
              entrantIdToParticipantIds.set(
                entrant.id,
                (Object.values(entrant.mutations.participants) as any[]).map(
                  (participant) => participant.id,
                ),
              );
            });
          }
          seeds.push(
            ...json.entities.seeds.map((seed: any) => ({
              id: seed.id,
              phaseId: seed.phaseId,
              eventId,
              tournamentId,
              entrantId: Number.isInteger(seed.entrantId)
                ? seed.entrantId
                : null,
            })),
          );
          sets.push(
            ...dbSetsFromApiSets(
              json.entities.sets,
              tournamentId,
              json.entities.groups.groupTypeId,
            ),
          );
        }),
    );
    updateSyncResultWithSuccess();
    updateEvent(
      tournamentId,
      eventId,
      phases,
      pools,
      Array.from(idToEntrant.values()),
      entrantIdToParticipantIds,
      seeds,
      sets,
    );
  } catch (e: any) {
    if (isRetryableApiError(e)) {
      updateSyncResultWithError(e);
    } else {
      updateWithFatalError(e);
    }
    throw e;
  }
}

const UPDATE_SET_INNER = `
  id
  phaseGroup {
    id
  }
  identifier
  state
  slots {
    entrant {
      id
    }
    standing {
      stats {
        score {
          value
        }
      }
    }
  }
  station {
    id
  }
  stream {
    id
  }
  games {
    stage {
      id
    }
  }
  updatedAt
  winnerId
`;
function updateSetToApiSetUpdate(set: any): ApiSetUpdate {
  const games = Array.isArray(set.games) ? (set.games as any[]) : [];
  const entrant1 = set.slots[0].entrant;
  const standing1 = set.slots[0].standing;
  const entrant2 = set.slots[1].entrant;
  const standing2 = set.slots[1].standing;
  return {
    setId: set.id,
    phaseGroupId: set.phaseGroup.id,
    identifier: set.identifier,
    state: set.state,
    entrant1Id: entrant1 ? entrant1.id : null,
    entrant1Score: standing1 ? standing1.stats.score.value : null,
    entrant2Id: entrant2 ? entrant2.id : null,
    entrant2Score: standing2 ? standing2.stats.score.value : null,
    winnerId: set.winnerId,
    updatedAt: set.updatedAt,
    stationId: set.station?.id ?? null,
    streamId: set.stream?.id ?? null,
    hasStageData:
      games.length > 0 && games.every((game) => game.stage) ? 1 : null,
  };
}

const RESET_SET_MUTATION = `
  mutation resetSet($setId: ID!) {
    resetSet(setId: $setId) {${UPDATE_SET_INNER}}
  }
`;
const RESET_SET_RECURSIVE_MUTATION = `
  mutation resetSet($setId: ID!) {
    resetSet(setId: $setId, resetDependentSets: true) {${UPDATE_SET_INNER}}
  }
`;
async function resetSet(
  setId: number | string,
  recursive: boolean,
): Promise<ApiSetUpdate> {
  if (!apiKey) {
    throw new Error('Please set API key.');
  }

  const data = await fetchGql(
    apiKey,
    recursive ? RESET_SET_RECURSIVE_MUTATION : RESET_SET_MUTATION,
    { setId },
  );
  return updateSetToApiSetUpdate(data.resetSet);
}

const ASSIGN_SET_STATION_MUTATION = `
  mutation assignSetStation($setId: ID!, $stationId: ID!) {
    assignStation(setId: $setId, stationId: $stationId) {${UPDATE_SET_INNER}}
  }
`;
async function assignSetStation(
  setId: number | string,
  stationId: number,
): Promise<ApiSetUpdate> {
  if (!apiKey) {
    throw new Error('Please set API key.');
  }

  const data = await fetchGql(apiKey, ASSIGN_SET_STATION_MUTATION, {
    setId,
    stationId,
  });
  return updateSetToApiSetUpdate(data.assignStation);
}

const ASSIGN_SET_STREAM_MUTATION = `
  mutation assignSetStream($setId: ID!, $streamId: ID!) {
    assignStream(setId: $setId, streamId: $streamId) {${UPDATE_SET_INNER}}
  }
`;
async function assignSetStream(
  setId: number | string,
  streamId: number,
): Promise<ApiSetUpdate> {
  if (!apiKey) {
    throw new Error('Please set API key.');
  }

  const data = await fetchGql(apiKey, ASSIGN_SET_STREAM_MUTATION, {
    setId,
    streamId,
  });
  return updateSetToApiSetUpdate(data.assignStream);
}

const START_SET_MUTATION = `
  mutation startSet($setId: ID!) {
    markSetInProgress(setId: $setId) {${UPDATE_SET_INNER}}
  }
`;
async function startSet(setId: number | string): Promise<ApiSetUpdate> {
  if (!apiKey) {
    throw new Error('Please set API key.');
  }

  const data = await fetchGql(apiKey, START_SET_MUTATION, { setId });
  return updateSetToApiSetUpdate(data.markSetInProgress);
}

const REPORT_SET_MUTATION = `
  mutation reportSet($setId: ID!, $winnerId: ID, $isDQ: Boolean, $gameData: [BracketSetGameDataInput]) {
    reportBracketSet(
      setId: $setId
      winnerId: $winnerId
      isDQ: $isDQ
      gameData: $gameData
    ) {${UPDATE_SET_INNER}}
  }
`;
async function reportSet(
  setId: number | string,
  winnerId: number,
  isDQ: boolean,
  gameData: ApiGameData[],
) {
  if (!apiKey) {
    throw new Error('Please set API key.');
  }

  const data = await fetchGql(apiKey, REPORT_SET_MUTATION, {
    setId,
    winnerId,
    isDQ,
    gameData,
  });
  return (data.reportBracketSet as any[]).map(updateSetToApiSetUpdate);
}

const UPDATE_SET_MUTATION = `
  mutation updateSet($setId: ID!, $winnerId: ID, $isDQ: Boolean, $gameData: [BracketSetGameDataInput]) {
    updateBracketSet(
      setId: $setId
      winnerId: $winnerId
      isDQ: $isDQ
      gameData: $gameData
    ) {${UPDATE_SET_INNER}}
  }
`;
async function updateSet(
  setId: number | string,
  winnerId: number,
  isDQ: boolean,
  gameData: ApiGameData[],
): Promise<ApiSetUpdate> {
  if (!apiKey) {
    throw new Error('Please set API key.');
  }

  const data = await fetchGql(apiKey, UPDATE_SET_MUTATION, {
    setId,
    winnerId,
    isDQ,
    gameData,
  });
  return updateSetToApiSetUpdate(data.updateBracketSet);
}

const emitter = new EventEmitter();
export function onTransaction(callback: () => void) {
  emitter.removeAllListeners();
  emitter.addListener('transaction', callback);
}

const slugToTimeout = new Map<string, NodeJS.Timeout>();
async function tryNextTransaction(id: number, slug: string) {
  slugToTimeout.delete(slug);
  if (id !== getTournamentId()) {
    return;
  }

  try {
    await getApiTournament(slug);
    await Promise.all(
      getLoadedEventIds().map((eventId) => refreshEvent(id, eventId)),
    );
    emitter.emit('transaction');

    let transaction = getNextTransaction();
    if (transaction) {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        let updates: ApiSetUpdate[] = [];
        if (transaction.type === TransactionType.RESET) {
          try {
            updates = [
              await resetSet(transaction.setId, transaction.isRecursive),
            ];
          } catch (e: any) {
            if (e instanceof ApiError) {
              if (
                e.gqlErrors.some((gqlError) =>
                  gqlError.message.startsWith('Set not found for id: '),
                )
              ) {
                markTransactionConflict(
                  transaction.transactionNum,
                  ConflictReason.SET_NOT_FOUND,
                );
              } else if (
                e.gqlErrors.some(
                  (gqlError) =>
                    gqlError.message.startsWith(
                      'Resetting this set will also reset ',
                    ) &&
                    gqlError.message.endsWith(
                      ' dependent sets. Please pass the argument resetDependentSets: true to this call in order to reset all dependent sets.',
                    ),
                )
              ) {
                markTransactionConflict(
                  transaction.transactionNum,
                  ConflictReason.RESET_DEPENDENT_SETS,
                );
              } else {
                throw e;
              }
            } else {
              throw e;
            }
          }
        } else if (transaction.type === TransactionType.ASSIGN_STATION) {
          try {
            updates = [
              await assignSetStation(transaction.setId, transaction.stationId),
            ];
          } catch (e: any) {
            if (
              e instanceof ApiError &&
              e.gqlErrors.some((gqlError) =>
                gqlError.message.startsWith('Set not found for id: '),
              )
            ) {
              markTransactionConflict(
                transaction.transactionNum,
                ConflictReason.SET_NOT_FOUND,
              );
            } else {
              throw e;
            }
          }
        } else if (transaction.type === TransactionType.ASSIGN_STREAM) {
          try {
            updates = [
              await assignSetStream(transaction.setId, transaction.streamId),
            ];
          } catch (e: any) {
            if (
              e instanceof ApiError &&
              e.gqlErrors.some((gqlError) =>
                gqlError.message.startsWith('Set not found for id: '),
              )
            ) {
              markTransactionConflict(
                transaction.transactionNum,
                ConflictReason.SET_NOT_FOUND,
              );
            } else {
              throw e;
            }
          }
        } else if (transaction.type === TransactionType.START) {
          try {
            updates = [await startSet(transaction.setId)];
          } catch (e: any) {
            if (e instanceof ApiError) {
              if (
                e.gqlErrors.some((gqlError) =>
                  gqlError.message.startsWith('Set not found for id: '),
                )
              ) {
                markTransactionConflict(
                  transaction.transactionNum,
                  ConflictReason.SET_NOT_FOUND,
                );
              } else if (
                e.gqlErrors.some(
                  (gqlError) => gqlError.message === 'Set is already started',
                )
              ) {
                deleteTransaction(transaction.transactionNum);
              } else if (
                e.gqlErrors.some(
                  (gqlError) =>
                    gqlError.message ===
                    "This set can't be reported until all entrants are filled",
                )
              ) {
                markTransactionConflict(
                  transaction.transactionNum,
                  ConflictReason.MISSING_ENTRANTS,
                );
              } else {
                throw e;
              }
            } else {
              throw e;
            }
          }
        } else if (transaction.type === TransactionType.REPORT) {
          if (transaction.isUpdate) {
            try {
              updates = [
                await updateSet(
                  transaction.setId,
                  transaction.winnerId,
                  transaction.isDQ,
                  transaction.gameData,
                ),
              ];
            } catch (e: any) {
              if (e instanceof ApiError) {
                if (
                  e.gqlErrors.some((gqlError) =>
                    gqlError.message.startsWith('Set not found for id: '),
                  )
                ) {
                  markTransactionConflict(
                    transaction.transactionNum,
                    ConflictReason.SET_NOT_FOUND,
                  );
                } else if (
                  e.gqlErrors.some(
                    (gqlError) =>
                      gqlError.message ===
                      'Set winner cannot be changed with this function. Use resetSet/reportBracketSet mutations instead.',
                  )
                ) {
                  try {
                    updates = await reportSet(
                      transaction.setId,
                      transaction.winnerId,
                      transaction.isDQ,
                      transaction.gameData,
                    );
                  } catch (e2: any) {
                    if (e2 instanceof ApiError) {
                      if (
                        e2.gqlErrors.some(
                          (gqlError) =>
                            gqlError.message ===
                            'Cannot report completed set via API.',
                        )
                      ) {
                        markTransactionConflict(
                          transaction.transactionNum,
                          ConflictReason.UPDATE_CHANGE_WINNER,
                        );
                      } else if (
                        e2.gqlErrors.some(
                          (gqlError) =>
                            gqlError.message ===
                            "This set can't be reported until all entrants are filled",
                        )
                      ) {
                        markTransactionConflict(
                          transaction.transactionNum,
                          ConflictReason.MISSING_ENTRANTS,
                        );
                      } else {
                        throw e2;
                      }
                    } else {
                      throw e2;
                    }
                  }
                } else {
                  throw e;
                }
              } else {
                throw e;
              }
            }
          } else {
            try {
              updates = await reportSet(
                transaction.setId,
                transaction.winnerId,
                transaction.isDQ,
                transaction.gameData,
              );
            } catch (e: any) {
              if (e instanceof ApiError) {
                if (
                  e.gqlErrors.some((gqlError) =>
                    gqlError.message.startsWith('Set not found for id: '),
                  )
                ) {
                  markTransactionConflict(
                    transaction.transactionNum,
                    ConflictReason.SET_NOT_FOUND,
                  );
                } else if (
                  e.gqlErrors.some(
                    (gqlError) =>
                      gqlError.message ===
                      'Cannot report completed set via API.',
                  )
                ) {
                  markTransactionConflict(
                    transaction.transactionNum,
                    ConflictReason.REPORT_COMPLETED,
                  );
                } else if (
                  e.gqlErrors.some(
                    (gqlError) =>
                      gqlError.message ===
                      "This set can't be reported until all entrants are filled",
                  )
                ) {
                  markTransactionConflict(
                    transaction.transactionNum,
                    ConflictReason.MISSING_ENTRANTS,
                  );
                } else {
                  throw e;
                }
              } else {
                throw e;
              }
            }
          }
        }
        if (updates.length > 0) {
          finalizeTransaction(transaction.transactionNum, updates);
          if (
            transaction.type === TransactionType.RESET &&
            transaction.isRecursive
          ) {
            await getApiTournament(slug);
            await Promise.all(
              getLoadedEventIds().map((eventId) => refreshEvent(id, eventId)),
            );
          }
          emitter.emit('transaction');
        }
        updateSyncResultWithSuccess();

        transaction = getNextTransaction();
        if (!transaction) {
          break;
        } else {
          await oneSecondPromise();
        }
      }
    }
    slugToTimeout.set(
      slug,
      setTimeout(() => {
        tryNextTransaction(id, slug);
      }, 12000),
    );
  } catch (e: any) {
    if (isRetryableApiError(e)) {
      updateSyncResultWithError(e);
      const timeoutS = Math.min(2 ** (consecutiveErrors - 1), 64);
      slugToTimeout.set(
        slug,
        setTimeout(() => {
          tryNextTransaction(id, slug);
        }, timeoutS * 1000),
      );
    } else {
      updateWithFatalError(e);
    }
  }
}

export function maybeTryNow(id: number) {
  const slug = idToSlug.get(id);
  if (!slug) {
    throw new Error(`tournamentId not found ${id}`);
  }

  const timeout = slugToTimeout.get(slug);
  if (timeout) {
    clearTimeout(timeout);
    slugToTimeout.delete(slug);
    setImmediate(() => {
      tryNextTransaction(id, slug);
    });
  }
}

export function startRefreshingTournament(id: number, slug: string) {
  idToSlug.set(id, slug);
  setImmediate(() => {
    tryNextTransaction(id, slug);
  });
}
