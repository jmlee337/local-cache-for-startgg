import {
  AdminedTournament,
  DbEntrant,
  DbEvent,
  DbPhase,
  DbPlayer,
  DbPool,
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

      // fill in fields that may be missing
      const sets = (json.entities.sets as any[])
        .filter((set) => !set.unreachable)
        .map((set) => {
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
        });

      updatePool(pool, entrants, json.entities.seeds, sets);
    }),
  );
}
