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
