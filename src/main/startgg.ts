import {
  AdminedTournament,
  DbEvent,
  DbPhase,
  DbPool,
  DbTournament,
} from '../common/types';
import { updateEvent, upsertTournament } from './db';

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

export async function setTournament(slug: string) {
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
        (previewSetId) => `
          ${previewSetId}: reportBracketSet(setId: "${previewSetId}") {
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

  console.log(poolIdsToLoad);
}
