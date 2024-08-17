import {
  AdminedTournament,
  DbEntrant,
  DbEvent,
  DbPhase,
  DbPlayer,
  DbPool,
  DbSet,
  DbTournament,
} from '../common/types';
import {
  getPlayer,
  updateEvent,
  updatePool,
  upsertPlayer,
  upsertPlayers,
  upsertTournament,
} from './db';

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
    throw new Error(`${response.status} - ${response.statusText}.${keyErr}`);
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
    throw new Error(json.errors[0].message);
  }

  return json.data;
}

const GET_ADMINED_TOURNAMENTS_QUERY = `
  query TournamentsQuery {
    currentUser {
      tournaments(query: {perPage: 500, filter: {tournamentView: "admin"}}) {
        nodes {
          name
          slug
        }
      }
    }
  }
`;
export async function getAdminedTournaments(
  apiKey: string,
): Promise<AdminedTournament[]> {
  const data = await fetchGql(apiKey, GET_ADMINED_TOURNAMENTS_QUERY, {});
  return data.currentUser.tournaments.nodes.map((tournament: any) => ({
    slug: tournament.slug.slice(11),
    name: tournament.name,
  }));
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
export async function setTournament(apiKey: string, slug: string) {
  const response = await wrappedFetch(
    `https://api.smash.gg/tournament/${slug}?expand[]=event`,
  );
  const json = await response.json();

  const { id } = json.entities.tournament;
  const tournament: DbTournament = {
    id,
    name: json.entities.tournament.name,
    slug,
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
  return id;
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

const EVENT_PHASE_GROUP_REPRESENTATIVE_SET_IDS_QUERY = `
  query EventPhaseGroupsQuery($eventId: ID) {
    event(id: $eventId) {
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
export async function loadEvent(
  apiKey: string,
  tournamentId: number,
  eventId: number,
) {
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
  const poolIdsToLoad: number[] = [];
  const previewSetIds: string[] = [];
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
  updateEvent(dbEvent, dbPhases, dbPools);

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
    } catch (e: any) {
      if (
        !(e instanceof Error) ||
        !e.message.startsWith('Your query complexity is too high.')
      ) {
        throw e;
      }
    }
  }

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
      const idToSet = new Map<number, DbSet>();
      (json.entities.sets as any[])
        .filter(
          (set) =>
            !set.unreachable &&
            !(
              set.entrant1PrereqType === 'bye' &&
              set.entrant2PrereqType === 'bye'
            ),
        )
        .map((set): DbSet => {
          // fill in fields that may be missing
          if (!Number.isInteger(set.entrant1Id)) {
            set.entrant1Id = null;
          }
          if (!Number.isInteger(set.entrant2Id)) {
            set.entrant2Id = null;
          }
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
        if (dbSet.entrant1PrereqType === 'set' && dbSet.entrant1Id === null) {
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
        if (dbSet.entrant2PrereqType === 'set' && dbSet.entrant2Id === null) {
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

      updatePool(pool, entrants, json.entities.seeds, sets);
    }),
  );
}
