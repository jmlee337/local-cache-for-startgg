export type AdminedTournament = {
  slug: string;
  name: string;
};

export type RendererSet = {
  id: number;
  fullRoundText: string;
  identifier: string;
  state: number;
  entrant1Id: number | null;
  entrant1Name: string | null;
  entrant1PrereqStr: string | null;
  entrant1Score: number | null;
  entrant2Id: number | null;
  entrant2Name: string | null;
  entrant2PrereqStr: string | null;
  entrant2Score: number | null;
  winnerId: number | null;
  isLocal: 0 | 1;
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
  name: string;
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

export type DbSetMutation = {
  id: number;
  setId: number;
  phaseGroupId: number;
  phaseId: number;
  eventId: number;
  isLocal: 1;

  // locally mutable
  state: number | null;
  entrant1Id: number | null;
  entrant1Score: number | null;
  entrant2Id: number | null;
  entrant2Score: number | null;
  winnerId: number | null;
  loserId: number | null;

  // hopefully locally mutable
  streamId: number | null;
};

export type DbSet = {
  // ids
  id: number;
  phaseGroupId: number;
  phaseId: number;
  eventId: number;

  // locally immutable
  callOrder: number;
  fullRoundText: string;
  identifier: string;
  round: number;
  entrant1PrereqType: string;
  entrant1PrereqId: number;
  entrant1PrereqCondition: string | null;
  entrant1PrereqStr: string | null;
  entrant2PrereqType: string;
  entrant2PrereqId: number;
  entrant2PrereqCondition: string | null;
  entrant2PrereqStr: string | null;
  wProgressionSeedId: number | null;
  wProgressingPhaseGroupId: number | null;
  wProgressingPhaseId: number | null;
  wProgressingName: string | null;
  lProgressionSeedId: number | null;
  lProgressingPhaseGroupId: number | null;
  lProgressingPhaseId: number | null;
  lProgressingName: string | null;
  updatedAt: number;

  // locally mutable
  state: number;
  entrant1Id: number | null;
  entrant1Score: number | null;
  entrant2Id: number | null;
  entrant2Score: number | null;
  winnerId: number | null;
  loserId: number | null;

  // hopefully locally mutable
  streamId: number | null;

  // mutable but not really...
  isLocal: 0 | 1;
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
