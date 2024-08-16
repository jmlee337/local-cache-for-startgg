import { AdminedTournament, DbEvent, DbTournament } from '../common/types';
import { upsertTournament } from './db';

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
    }));
  upsertTournament(tournament, events);
  return id;
}
