// TODO field for fully synced
export type AdminedTournament = {
  id: number;
  slug: string;
  name: string;
  isSynced: boolean;
  startAt: number;
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
  syncState: 0 | 1 | 2 | 3; // 0: synced, 1: queued, 2: released, 3: local
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

export type DbSetMutation = {
  id: number;
  setId: number;
  phaseGroupId: number;
  phaseId: number;
  eventId: number;
  tournamentId: number;
  transactionNum: number;
  isReleased: null | 1;
  queuedMs: number;
  isCrossPhase: null | 1;

  // locally mutable
  statePresent: null | 1;
  state: number | null;
  entrant1IdPresent: null | 1;
  entrant1Id: number | null;
  entrant1ScorePresent: null | 1;
  entrant1Score: number | null;
  entrant2IdPresent: null | 1;
  entrant2Id: number | null;
  entrant2ScorePresent: null | 1;
  entrant2Score: number | null;
  winnerIdPresent: null | 1;
  winnerId: number | null;

  // hopefully locally mutable
  streamIdPresent: null | 1;
  streamId: number | null;
};

export type DbSet = {
  // ids
  id: number;
  phaseGroupId: number;
  phaseId: number;
  eventId: number;
  tournamentId: number;

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

  // hopefully locally mutable
  streamId: number | null;

  // we only store 0, but we modify after query via setMutation
  syncState: 0 | 1 | 2 | 3; // 0: synced, 1: queued, 2: released, 3: local
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
  startAt: number;
};

export type DbSelections = {
  transactionNumber: number;
  gameNum: number;
  entrantId: number;
  characterId: number;
};

export type DbGameData = {
  transactionNum: number;
  gameNum: number;
  winnerId: number;
  stageId: number | null;
};

export type DbTransaction = {
  transactionNum: number;
  type: 2 | 3; // 2: start, 3: report
  setId: number;
  winnerId: number | null;
  isDQ: 0 | 1;
};

export type ApiGameData = {
  // 1-indexed
  gameNum: number;
  winnerId: number;
  stageId?: number;
  selections: {
    entrantId: number;
    characterId: number;
  }[];
};

export type ApiTransaction = {
  transactionNum: number;
  type: 2 | 3; // 2: start, 3: report
  setId: number;
  winnerId?: number;
  isDQ?: boolean;
  gameData?: ApiGameData[];
};

export type ApiSetUpdate = {
  id: number;
  state: number;
  entrant1Id: number | null;
  entrant1Score: number | null;
  entrant2Id: number | null;
  entrant2Score: number | null;
  winnerId: number | null;
};

export class ApiError extends Error {
  public status?: number;

  public gqlErrors: { message: string }[];

  constructor(e: {
    message?: string;
    options?: ErrorOptions;
    status?: number;
    gqlErrors?: { message: string }[];
  }) {
    super(e.message, e.options);
    this.status = e.status;
    this.gqlErrors = e.gqlErrors ?? [];
  }
}

export type SyncResult = {
  success: boolean;
  errorSinceMs: number;
  lastError: string;
  lastErrorMs: number;
  lastSuccessMs: number;
};

export type WebsocketStatus = {
  err: string;
  port: number;
};
