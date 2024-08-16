export type AdminedTournament = {
  slug: string;
  name: string;
};

export type RendererPool = {
  id: number;
  name: string;
  bracketType: number;
};

export type RendererPhase = {
  id: number;
  name: string;
  pools: RendererPool[];
};

export type RendererEvent = {
  id: number;
  name: string;
  isOnline: boolean;
  phases: RendererPhase[];
};

export type RendererTournament = {
  id: number;
  slug: string;
  events: RendererEvent[];
};

export type DbPool = {
  id: number;
  phaseId: number;
  eventId: number;
  tournamentId: number;
  name: string;
  bracketType: number;
};

export type DbPhase = {
  id: number;
  eventId: number;
  tournamentId: number;
  name: string;
};

export type DbEvent = {
  id: number;
  tournamentId: number;
  name: string;
  isOnline: 0 | 1;
};

export type DbTournament = {
  id: number;
  name: string;
  slug: string;
};
