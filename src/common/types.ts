// TODO field for fully synced
export type AdminedTournament = {
  id: number;
  slug: string;
  name: string;
  isSynced: boolean;
  startAt: number;
};

export enum ConflictReason {
  RESET_DEPENDENT_SETS,
  MISSING_ENTRANTS,
  REPORT_COMPLETED,
  UPDATE_CHANGE_WINNER,
  UPDATE_STAGE_DATA,
}

export enum SyncState {
  SYNCED,
  QUEUED,
  LOCAL,
}

export enum TransactionType {
  RESET,
  START,
  ASSIGN_STATION,
  ASSIGN_STREAM,
  REPORT,
}

export type RendererStation = {
  id: number;
  number: number;
};

export type RendererStream = {
  id: number;
  streamName: string;
  streamSource: string;
};

export type RendererSet = {
  id: number;
  ordinal: number;
  fullRoundText: string;
  identifier: string;
  round: number;
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
  station: RendererStation | null;
  stream: RendererStream | null;
  hasStageData: 1 | null;
  syncState: SyncState;
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
  isLoaded: boolean;
  phases: RendererPhase[];
};

export type RendererTournament = {
  id: number;
  slug: string;
  events: RendererEvent[];
  stations: RendererStation[];
  streams: RendererStream[];
};

export type RendererConflict = {
  fullRoundText: string;
  identifier: string;
  transactionNum: number;
  type: TransactionType;
  reason: ConflictReason;
  winnerName: string | null;
};

export type DbStation = {
  id: number;
  tournamentId: number;
  number: number;
  streamId: number | null;
};

export type DbStream = {
  id: number;
  tournamentId: number;
  streamName: string;
  streamSource: string;
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
  stationIdPresent: null | 1;
  stationId: number | null;
  streamIdPresent: null | 1;
  streamId: number | null;
  hasStageDataPresent: null | 1;
  hasStageData: null | 1;

  // locally mutable and required
  updatedAt: number;

  // local only
  transactionNum: number;
  isReleased: null | 1;
  requiresUpdateHack: null | 1;
};

export type DbSet = {
  // ids
  id: number;
  phaseGroupId: number;
  phaseId: number;
  eventId: number;
  tournamentId: number;

  // locally immutable
  ordinal: number;
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

  // locally mutable
  state: number;
  entrant1Id: number | null;
  entrant1Score: number | null;
  entrant2Id: number | null;
  entrant2Score: number | null;
  winnerId: number | null;
  updatedAt: number;
  stationId: number | null;
  streamId: number | null;
  hasStageData: null | 1;

  // we only store SYNCED, but we modify after query via setMutation
  syncState: SyncState;
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

export type DbLoadedEvent = {
  id: number;
  tournamentId: number;
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

export type DbTransactionSelections = {
  transactionNumber: number;
  gameNum: number;
  entrantId: number;
  characterId: number;
};

export type DbTransactionGameData = {
  transactionNum: number;
  gameNum: number;
  winnerId: number;
  stageId: number | null;
  entrant1Score: number | null;
  entrant2Score: number | null;
};

export type DbTransaction = {
  transactionNum: number;
  tournamentId: number;
  eventId: number;
  type: TransactionType;
  setId: number;
  stationId: number | null;
  streamId: number | null;
  expectedEntrant1Id: number | null;
  expectedEntrant2Id: number | null;
  winnerId: number | null;
  isDQ: null | 1;
  isUpdate: null | 1;
  isConflict: null | 1;
  reason: ConflictReason | null;
};

export type ApiGameData = {
  // 1-indexed
  gameNum: number;
  winnerId: number;
  stageId?: number;
  entrant1Score?: number;
  entrant2Score?: number;
  selections: {
    entrantId: number;
    characterId: number;
  }[];
};

export type ApiTransaction = {
  setId: number;
  transactionNum: number;
} & (
  | {
      type: TransactionType.RESET | TransactionType.START;
    }
  | {
      type: TransactionType.ASSIGN_STATION;
      stationId: number;
    }
  | {
      type: TransactionType.ASSIGN_STREAM;
      streamId: number;
    }
  | {
      type: TransactionType.REPORT;
      winnerId: number;
      isDQ: boolean;
      gameData: ApiGameData[];
      isUpdate: boolean;
    }
);

export type ApiSetUpdate = {
  id: number;
  state: number;
  entrant1Id: number | null;
  entrant1Score: number | null;
  entrant2Id: number | null;
  entrant2Score: number | null;
  winnerId: number | null;
  updatedAt: number;
  stationId: number | null;
  streamId: number | null;
  hasStageData: null | 1;
};

export class ApiError extends Error {
  public fetch: boolean;

  public status?: number;

  public gqlErrors: { message: string }[];

  constructor(e: {
    message: string;
    cause?: unknown;
    fetch?: boolean;
    status?: number;
    gqlErrors?: { message: string }[];
  }) {
    super(e.message, e.cause !== undefined ? { cause: e.cause } : undefined);
    this.fetch = e.fetch ?? false;
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
