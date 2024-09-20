import EventEmitter from 'events';
import { BrowserWindow } from 'electron';
import {
  AdminedTournament,
  ApiError,
  ApiGameData,
  ApiSetUpdate,
  ApiTransaction,
  DbEntrant,
  DbEvent,
  DbPhase,
  DbPlayer,
  DbPool,
  DbSet,
  DbTournament,
  SyncResult,
} from '../common/types';
import {
  getEventPoolIds,
  getPlayer,
  getPoolSetIds,
  upsertEvent,
  upsertPool,
  upsertPlayer,
  upsertPlayers,
  upsertTournament,
  updateSets,
} from './db';

let apiKey = '';
export function setApiKey(newApiKey: string) {
  apiKey = newApiKey;
}

async function wrappedFetch(
  input: URL | RequestInfo,
  init?: RequestInit | undefined,
): Promise<Response> {
  const response = await fetch(input, init);
  if (!response.ok) {
    const keyErr =
      response.status === 400
        ? ' ***start.gg API key invalid or expired!***'
        : '';
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

  return json.data;
}

let mainWindow: BrowserWindow | undefined;
export function startggInit(window: BrowserWindow) {
  mainWindow = window;
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
function updateSyncResultWithError(e: Error) {
  const nowMs = Date.now();
  syncResult.success = false;
  syncResult.lastError = e.message;
  syncResult.lastErrorMs = nowMs;
  if (consecutiveErrors === 0) {
    syncResult.errorSinceMs = nowMs;
  }
  consecutiveErrors += 1;
  mainWindow!.webContents.send('syncResult', syncResult);
}
function updateSyncResultWithSuccess() {
  syncResult.success = true;
  syncResult.lastSuccessMs = Date.now();
  consecutiveErrors = 0;
  mainWindow!.webContents.send('syncResult', syncResult);
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
    updateSyncResultWithSuccess();
    return (data.currentUser.tournaments.nodes as any[]).map((tournament) => ({
      id: tournament.id,
      slug: tournament.slug.slice(11),
      name: tournament.name,
      isSynced: true,
      startAt: tournament.startAt,
    }));
  } catch (e: any) {
    updateSyncResultWithError(e as Error);
    throw e;
  }
}

const TOURNAMENT_PLAYERS_QUERY = `
  query TournamentPlayersQuery($slug: String, $eventIds: [ID], $page: Int) {
    tournament(slug: $slug) {
      participants(query: {page: $page, perPage: 499, filter: {eventIds: $eventIds}}) {
        pageInfo {
          totalPages
        }
        nodes {
          player {
            id
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
export async function getApiTournament(slug: string) {
  if (!apiKey) {
    throw new Error('Please set API key.');
  }

  try {
    const response = await wrappedFetch(
      `https://api.smash.gg/tournament/${slug}?expand[]=event`,
    );
    const json = await response.json();
    const { id } = json.entities.tournament;
    const tournament: DbTournament = {
      id,
      slug,
      name: json.entities.tournament.name,
      startAt: json.entities.tournament.startAt,
    };
    const events: DbEvent[] = (json.entities.event as any[])
      .filter((event) => {
        const isMelee = event.videogameId === 1;
        const isSinglesOrDoubles =
          event.teamRosterSize === null ||
          (event.teamRosterSize.minPlayers === 2 &&
            event.teamRosterSize.maxPlayers === 2);
        return isMelee && isSinglesOrDoubles;
      })
      .map((event) => ({
        id: event.id,
        tournamentId: id,
        name: event.name,
        isOnline: event.isOnline ? 1 : 0,
      }));
    upsertTournament(tournament, events);

    let nextData;
    let page = 1;
    do {
      // eslint-disable-next-line no-await-in-loop
      nextData = await fetchGql(apiKey, TOURNAMENT_PLAYERS_QUERY, {
        page,
        slug,
        eventIds: events.map((event) => event.id),
      });
      const { nodes } = nextData.tournament.participants;
      if (Array.isArray(nodes)) {
        upsertPlayers(
          nodes.map(
            (participant): DbPlayer => ({
              id: participant.player.id,
              pronouns: participant.player.user?.genderPronoun || null,
              userSlug: participant.player.user?.slug.slice(5) || null,
            }),
          ),
        );
      }
      page += 1;
    } while (page <= nextData.tournament.participants.pageInfo.totalPages);
    updateSyncResultWithSuccess();
    return id;
  } catch (e: any) {
    updateSyncResultWithError(e as Error);
    throw e;
  }
}

function coalescePrereq(set: DbSet, idToSet: Map<number, DbSet>) {
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
      const prereqSet = idToSet.get(set.entrant2PrereqId)!;
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
      return coalescePrereq(prereqSet, idToSet);
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
      const prereqSet = idToSet.get(set.entrant1PrereqId)!;
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
      return coalescePrereq(prereqSet, idToSet);
    }
  }
  throw new Error(
    `coalescePrereq: ${set.entrant1PrereqType}, ${set.entrant2PrereqType}`,
  );
}

function dbSetsFromApiSets(apiSets: any[], tournamentId: number) {
  const idToSet = new Map<number, DbSet>();
  apiSets
    .filter(
      (set) =>
        !set.unreachable &&
        !(set.entrant1PrereqType === 'bye' && set.entrant2PrereqType === 'bye'),
    )
    .map((set): DbSet => {
      set.tournamentId = tournamentId;
      // correct placeholder entrantIds
      if (!Number.isInteger(set.entrant1Id)) {
        set.entrant1Id = null;
      }
      if (!Number.isInteger(set.entrant2Id)) {
        set.entrant2Id = null;
      }
      // fill in fields that may be missing
      if (set.entrant1PrereqStr === undefined) {
        set.entrant1PrereqStr = null;
      }
      if (set.entrant2PrereqStr === undefined) {
        set.entrant2PrereqStr = null;
      }
      if (set.wProgressingPhaseGroupId === undefined) {
        set.wProgressingPhaseGroupId = null;
      }
      if (set.wProgressingPhaseId === undefined) {
        set.wProgressingPhaseId = null;
      }
      if (set.wProgressingName === undefined) {
        set.wProgressingName = null;
      }
      if (set.lProgressingPhaseGroupId === undefined) {
        set.lProgressingPhaseGroupId = null;
      }
      if (set.lProgressingPhaseId === undefined) {
        set.lProgressingPhaseId = null;
      }
      if (set.lProgressingName === undefined) {
        set.lProgressingName = null;
      }
      return set;
    })
    .forEach((set) => {
      idToSet.set(set.id, set);
    });

  // coalesce byes
  const sets: DbSet[] = [];
  Array.from(idToSet.values()).forEach((dbSet) => {
    if (
      dbSet.entrant1PrereqType === 'bye' ||
      dbSet.entrant2PrereqType === 'bye'
    ) {
      return;
    }
    if (dbSet.entrant1PrereqType === 'set') {
      const prereqSet1 = idToSet.get(dbSet.entrant1PrereqId)!;
      if (
        prereqSet1.entrant1PrereqType === 'bye' ||
        prereqSet1.entrant2PrereqType === 'bye'
      ) {
        const { prereqType, prereqId, prereqCondition, prereqStr } =
          coalescePrereq(prereqSet1, idToSet);
        dbSet.entrant1PrereqType = prereqType;
        dbSet.entrant1PrereqId = prereqId;
        dbSet.entrant1PrereqCondition = prereqCondition;
        dbSet.entrant1PrereqStr = prereqStr;
      }
    }
    if (dbSet.entrant2PrereqType === 'set') {
      const prereqSet2 = idToSet.get(dbSet.entrant2PrereqId)!;
      if (
        prereqSet2.entrant1PrereqType === 'bye' ||
        prereqSet2.entrant2PrereqType === 'bye'
      ) {
        const { prereqType, prereqId, prereqCondition, prereqStr } =
          coalescePrereq(prereqSet2, idToSet);
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

const EVENT_PHASE_GROUP_REPRESENTATIVE_SET_IDS_QUERY = `
  query EventPhaseGroupsQuery($eventId: ID) {
    event(id: $eventId) {
      id
      name
      isOnline
      phases {
        id
        name
        phaseGroups(query: {page: 1, perPage: 500}) {
          nodes {
            id
            bracketType
            displayIdentifier
            sets(page: 1, perPage: 1, filters: {hideEmpty: false, showByes: false}) {
              nodes {
                id
              }
            }
          }
        }
      }
    }
  }
`;
export async function loadEvent(tournamentId: number, eventId: number) {
  if (!apiKey) {
    throw new Error('Please set API key.');
  }

  const poolIdsToLoad: number[] = [];
  const previewSetIds: string[] = [];
  try {
    const data = await fetchGql(
      apiKey,
      EVENT_PHASE_GROUP_REPRESENTATIVE_SET_IDS_QUERY,
      { eventId },
    );
    const { event } = data;
    const { isOnline } = event;
    const dbEvent: DbEvent = {
      id: event.id,
      name: event.name,
      isOnline: isOnline ? 1 : 0,
      tournamentId,
    };
    const dbPhases: DbPhase[] = [];
    const dbPools: DbPool[] = [];
    const { phases } = event;
    if (Array.isArray(phases)) {
      phases.forEach((phase) => {
        dbPhases.push({
          id: phase.id,
          eventId,
          tournamentId,
          name: phase.name,
        });
        const pools = phase.phaseGroups.nodes;
        if (Array.isArray(pools)) {
          pools.forEach((pool) => {
            dbPools.push({
              id: pool.id,
              phaseId: phase.id,
              eventId,
              tournamentId,
              name: pool.displayIdentifier,
              bracketType: pool.bracketType,
            });
            const sets = pool.sets.nodes;
            if (Array.isArray(sets) && sets.length > 0) {
              const setId = sets[0].id;
              if (!isOnline) {
                poolIdsToLoad.push(pool.id);
                if (typeof setId === 'string' && setId.startsWith('preview')) {
                  previewSetIds.push(setId);
                }
              } else if (isOnline && typeof setId === 'number') {
                poolIdsToLoad.push(pool.id);
              }
            }
          });
        }
      });
    }
    upsertEvent(dbEvent, dbPhases, dbPools);
    updateSyncResultWithSuccess();
  } catch (e: any) {
    updateSyncResultWithError(e as Error);
    throw e;
  }

  if (previewSetIds.length > 0) {
    const inner = previewSetIds
      .map(
        (previewSetId, i) => `
          m${i}: reportBracketSet(setId: "${previewSetId}") {
            id
          }`,
      )
      .join('');
    const query = `mutation StartPhaseGroups {${inner}\n}`;
    try {
      await fetchGql(apiKey, query, {});
      updateSyncResultWithSuccess();
    } catch (e: any) {
      if (
        !(e instanceof ApiError) ||
        !e.gqlErrors[0].message.startsWith('Your query complexity is too high.')
      ) {
        updateSyncResultWithError(e as Error);
        throw e;
      }
    }
  }

  try {
    await Promise.all(
      poolIdsToLoad.map(async (id) => {
        const response = await wrappedFetch(
          `https://api.smash.gg/phase_group/${id}?expand[]=sets&expand[]=entrants&expand[]=seeds`,
        );
        const json = await response.json();
        const pool: DbPool = {
          id,
          phaseId: json.entities.groups.phaseId,
          eventId,
          tournamentId,
          name: json.entities.groups.displayIdentifier,
          bracketType: json.entities.groups.groupTypeId,
        };

        // entrants first pass
        const entrants: DbEntrant[] = [];
        const entrantsToUpdate = new Map<number, DbEntrant>();
        const missingPlayerIds: {
          playerId: number;
          playerNum: 1 | 2;
          entrantId: number;
        }[] = [];
        if (Array.isArray(json.entities.entrants)) {
          (json.entities.entrants as any[]).forEach((entrant) => {
            const participants = Object.values(
              entrant.mutations.participants,
            ) as any[];
            let skip = false;
            const players = [getPlayer(participants[0].playerId)];
            if (!players[0]) {
              missingPlayerIds.push({
                playerId: participants[0].playerId,
                playerNum: 1,
                entrantId: entrant.id,
              });
              skip = true;
            }
            if (participants[1]) {
              players.push(getPlayer(participants[1].playerId));
              if (!players[1]) {
                missingPlayerIds.push({
                  playerId: participants[1].playerId,
                  playerNum: 2,
                  entrantId: entrant.id,
                });
                skip = true;
              }
            }
            const newEntrant: DbEntrant = {
              id: entrant.id,
              eventId: entrant.eventId,
              name: entrant.name,
              participant1Id: participants[0].id,
              participant1GamerTag: participants[0].gamerTag,
              participant1Prefix: participants[0].prefix,
              participant1PlayerId: participants[0].playerId,
              participant1Pronouns: players[0]?.pronouns || null,
              participant1UserSlug: players[0]?.userSlug || null,
              participant2Id: participants[1]?.id || null,
              participant2GamerTag: participants[1]?.gamerTag || null,
              participant2Prefix: participants[1]?.prefix || null,
              participant2PlayerId: participants[1]?.playerId || null,
              participant2Pronouns: players[1]?.pronouns || null,
              participant2UserSlug: players[1]?.userSlug || null,
            };
            if (skip) {
              entrantsToUpdate.set(newEntrant.id, newEntrant);
            }
            entrants.push(newEntrant);
          });

          // pick up missing players for entrants
          if (missingPlayerIds.length > 0) {
            do {
              const queryPlayerParticipants = missingPlayerIds.slice(0, 500);
              const inner = queryPlayerParticipants.map(
                ({ playerId }) => `
                  playerId${playerId}: player(id: ${playerId}) {
                    user {
                      genderPronoun
                      slug
                    }
                  }`,
              );
              const query = `query PlayersQuery {${inner}\n}`;
              // eslint-disable-next-line no-await-in-loop
              const playerData = await fetchGql(apiKey, query, {});
              queryPlayerParticipants.forEach(
                ({ playerId, playerNum, entrantId }) => {
                  const player = playerData[`playerId${playerId}`];
                  const pronouns = player.user?.genderPronoun || null;
                  const userSlug = player.user?.slug.slice(5) || null;
                  const entrant = entrantsToUpdate.get(entrantId)!;
                  if (playerNum === 1) {
                    entrant.participant1Pronouns = pronouns;
                    entrant.participant1UserSlug = userSlug;
                  } else {
                    entrant.participant2Pronouns = pronouns;
                    entrant.participant2UserSlug = userSlug;
                  }
                  upsertPlayer({ id: playerId, pronouns, userSlug });
                },
              );
              missingPlayerIds.splice(0, 500);
            } while (missingPlayerIds.length > 0);
          }
        }

        const sets = dbSetsFromApiSets(json.entities.sets, tournamentId);
        upsertPool(pool, entrants, sets);
      }),
    );
    updateSyncResultWithSuccess();
  } catch (e: any) {
    updateSyncResultWithError(e as Error);
    throw e;
  }
}

export async function refreshEvent(tournamentId: number, eventId: number) {
  const expectedPoolIds = getEventPoolIds(eventId);
  const poolIdsToRefresh: number[] = [];
  try {
    const eventResponse = await wrappedFetch(
      `https://api.smash.gg/event/${eventId}?expand[]=groups`,
    );
    const json = await eventResponse.json();
    json.entities.groups.forEach((group: any) => {
      if (group.state !== 1) {
        poolIdsToRefresh.push(group.id);
      }
    });
    updateSyncResultWithSuccess();
  } catch (e: any) {
    updateSyncResultWithError(e as Error);
    throw e;
  }

  poolIdsToRefresh.forEach((poolId) => {
    if (!expectedPoolIds.delete(poolId)) {
      throw new Error(`unexpected poolId: ${poolId}`);
    }
  });
  if (expectedPoolIds.size > 0) {
    throw new Error(`missing poolIds: ${Array.from(expectedPoolIds.keys())}`);
  }

  try {
    await Promise.all(
      poolIdsToRefresh.map(async (id) => {
        const expectedSetIds = getPoolSetIds(id);
        const response = await wrappedFetch(
          `https://api.smash.gg/phase_group/${id}?expand[]=sets&expand[]=entrants&expand[]=seeds`,
        );
        const json = await response.json();
        const sets = dbSetsFromApiSets(json.entities.sets, tournamentId);
        sets.forEach((set) => {
          if (!expectedSetIds.delete(set.id)) {
            throw new Error(`unexpected setId: ${set.id}`);
          }
        });
        if (expectedSetIds.size > 0) {
          throw new Error(
            `missing setIds: ${Array.from(expectedSetIds.keys())}`,
          );
        }
        updateSets(sets);
      }),
    );
    updateSyncResultWithSuccess();
  } catch (e: any) {
    updateSyncResultWithError(e as Error);
    throw e;
  }
}

const UPDATE_SET_INNER = `
      id
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
      winnerId
`;
const RESET_SET_MUTATION = `
  mutation resetSet($setId: ID!) {
    resetSet(setId: $setId) {${UPDATE_SET_INNER}}
  }
`;
async function resetSet(setId: number): Promise<ApiSetUpdate> {
  if (!apiKey) {
    throw new Error('Please set API key.');
  }

  const data = await fetchGql(apiKey, RESET_SET_MUTATION, { setId });
  return {
    id: data.resetSet.id,
    state: data.resetSet.state,
    entrant1Id: data.resetSet.slots[0].entrant.id,
    entrant1Score: data.resetSet.slots[0].standing.stats.score.value,
    entrant2Id: data.resetSet.slots[1].entrant.id,
    entrant2Score: data.resetSet.slots[1].standing.stats.score.values,
    winnerId: data.resetSet.winnerId,
  };
}

const START_SET_MUTATION = `
  mutation startSet($setId: ID!) {
    markSetInProgress(setId: $setId) {${UPDATE_SET_INNER}}
  }
`;
async function startSet(setId: number): Promise<ApiSetUpdate> {
  if (!apiKey) {
    throw new Error('Please set API key.');
  }

  const data = await fetchGql(apiKey, START_SET_MUTATION, { setId });
  return {
    id: data.markSetInProgress.id,
    state: data.markSetInProgress.state,
    entrant1Id: data.markSetInProgress.slots[0].entrant.id,
    entrant1Score: data.markSetInProgress.slots[0].standing.stats.score.value,
    entrant2Id: data.markSetInProgress.slots[1].entrant.id,
    entrant2Score: data.markSetInProgress.slots[1].standing.stats.score.values,
    winnerId: data.markSetInProgress.winnerId,
  };
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
  setId: number,
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
  return (data.reportBracketSet as any[]).map((set): ApiSetUpdate => {
    const entrant1 = set.slots[0].entrant;
    const standing1 = set.slots[0].standing;
    const entrant2 = set.slots[1].entrant;
    const standing2 = set.slots[1].standing;
    return {
      id: set.id,
      state: set.state,
      entrant1Id: entrant1 ? entrant1.id : null,
      entrant1Score: standing1 ? standing1.stats.score.value : null,
      entrant2Id: entrant2 ? entrant2.id : null,
      entrant2Score: standing2 ? standing2.stats.score.value : null,
      winnerId: set.winnerId,
    };
  });
}

let emitter: EventEmitter | undefined;
export function onTransaction(
  callback: (
    transactionNum: number,
    updates: ApiSetUpdate[],
    updatedAt: number,
  ) => void,
) {
  if (emitter) {
    emitter.removeAllListeners();
  }

  emitter = new EventEmitter();
  emitter.addListener('transaction', callback);
}

const queue: ApiTransaction[] = [];
async function tryNextTransaction() {
  if (queue.length === 0) {
    return;
  }
  const transaction = queue[0];
  if (
    transaction.type !== 1 &&
    transaction.type !== 2 &&
    transaction.type !== 3
  ) {
    throw new Error(`unknown transaciton type: ${transaction.type}`);
  }

  try {
    const updatedAt = Date.now() / 1000;
    if (transaction.type === 1) {
      const update = await resetSet(transaction.setId);
      emitter!.emit(
        'transaction',
        transaction.transactionNum,
        [update],
        updatedAt,
      );
    } else if (transaction.type === 2) {
      const update = await startSet(transaction.setId);
      emitter!.emit(
        'transaction',
        transaction.transactionNum,
        [update],
        updatedAt,
      );
    } else if (transaction.type === 3) {
      const updates = await reportSet(
        transaction.setId,
        transaction.winnerId!,
        transaction.isDQ!,
        transaction.gameData!,
      );
      emitter!.emit(
        'transaction',
        transaction.transactionNum,
        updates,
        updatedAt,
      );
    }
    updateSyncResultWithSuccess();

    queue.shift();
    if (queue.length > 0) {
      setTimeout(tryNextTransaction, 1000);
    }
  } catch (e: any) {
    updateSyncResultWithError(e as Error);

    const timeoutS = Math.min(2 ** (consecutiveErrors - 1), 64);
    setTimeout(tryNextTransaction, timeoutS * 1000);
  }
}

export function queueTransaction(transaction: ApiTransaction) {
  queue.push(transaction);
  if (queue.length === 1) {
    setImmediate(tryNextTransaction);
  }
}

export function queueTransactions(transactions: ApiTransaction[]) {
  const shouldTry = queue.length === 0;
  queue.push(...transactions);
  if (shouldTry) {
    setImmediate(tryNextTransaction);
  }
}
