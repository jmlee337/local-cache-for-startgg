export type AdminedTournament = {
  slug: string;
  name: string;
};

export type RendererParticipant = {
  id: number;
  gamerTag: string;
  prefix: string;
  pronouns: string;
  userSlug: string;
};

export type RendererEntrant = {
  id: number;
  participants: RendererParticipant[];
};

export type RendererSet = {
  id: number;
  callOrder: number;
  fullRoundText: string;
  identifier: string;
  state: number;
  winnerId: number | null;
  entrant1: RendererEntrant | null;
  entrant1PrereqType: string;
  entrant1PrereqStr: string | null;
  entrant1Score: number | null;
  entrant2: RendererEntrant | null;
  entrant2PrereqType: string;
  entrant2PrereqStr: string | null;
  entrant2Score: number | null;
};

export type RendererPool = {
  id: number;
  name: string;
  bracketType: number;
  sets: RendererSet[];
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

export type DbPlayer = {
  id: number;
  pronouns: string | null;
  userSlug: string | null;
};

export type DbEntrant = {
  id: number;
  eventId: number;
  participant1Id: number;
  participant1GamerTag: string;
  participant1Prefix: string;
  participant1Pronouns: string | null;
  participant1PlayerId: number;
  participant1UserSlug: string | null;
  participant2Id: number | null;
  participant2GamerTag: string | null;
  participant2Prefix: string | null;
  participant2Pronouns: string | null;
  participant2PlayerId: number | null;
  participant2UserSlug: string | null;
};

export type DbSeed = {
  id: number;
  phaseGroupId: number;
  entrantId: number;
  seedNum: number;
  groupSeedNum: number;
};

export type DbSet = {
  id: number;
  phaseGroupId: number;
  phaseId: number;
  eventId: number;
  callOrder: number;
  fullRoundText: string;
  identifier: string;
  round: number;
  state: number;
  streamId: number | null;
  entrant1Id: number | null;
  entrant1Score: number | null;
  entrant1PrereqType: string;
  entrant1PrereqId: number;
  entrant1PrereqCondition: string | null;
  entrant1PrereqStr: string | null;
  entrant2Id: number | null;
  entrant2Score: number | null;
  entrant2PrereqType: string;
  entrant2PrereqId: number;
  entrant2PrereqCondition: string | null;
  entrant2PrereqStr: string | null;
  winnerId: number | null;
  wProgressionSeedId: number | null;
  wProgressingPhaseGroupId: number | null;
  wProgressingPhaseId: number | null;
  wProgressingName: string | null;
  loserId: number | null;
  lProgressionSeedId: number | null;
  lProgressingPhaseGroupId: number | null;
  lProgressingPhaseId: number | null;
  lProgressingName: string | null;
  createdAt: number;
  startedAt: number | null;
  completedAt: number | null;
  updatedAt: number;
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
