export type AdminedTournament = {
  slug: string;
  name: string;
};

export type RendererEvent = {
  id: number;
  name: string;
};

export type RendererTournament = {
  slug: string;
  name: string;
  events: RendererEvent[];
};

export type DbEvent = {
  id: number;
  tournamentId: number;
  name: string;
};

export type DbTournament = {
  id: number;
  name: string;
  slug: string;
};
