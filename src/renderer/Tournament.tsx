import {
  BackupOutlined,
  Close,
  CloudDone,
  CloudOff,
  Download,
  Edit,
  Group,
  HourglassTop,
  KeyboardArrowDown,
  KeyboardArrowRight,
  NotificationsActive,
  Refresh,
  RestartAlt,
  Router,
  Stadium,
  StadiumOutlined,
  Tv,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';
import {
  Alert,
  AppBar,
  Box,
  Button,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputBase,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  AdminedTournament,
  ApiError,
  ConflictReason,
  RendererConflict,
  RendererConflictResolve,
  RendererEvent,
  RendererParticipant,
  RendererPhase,
  RendererPool,
  RendererSet,
  RendererTournament,
  TransactionType,
} from '../common/types';
import ErrorDialog from './ErrorDialog';
import Settings from './Settings';
import IconButton from './IconButton';
import Sync from './Sync';
import Websocket from './Websocket';
import FatalError from './FatalError';

const SET_FIXED_WIDTH = '162px';

const CONFLICT_BACKGROUND_COLOR = '#ed6c02';
const LOSERS_BACKGROUND_COLOR = '#ffebee';
const SET_BACKGROUND_COLOR = '#fafafa';
const WINNER_BACKGROUND_HIGHLIGHT = '#ba68c8';
const TEXT_COLOR_LIGHT = '#fff';

function getColor(set: RendererSet) {
  if (set.state === 2) {
    return '#0d8225';
  }
  if (set.state === 6) {
    return '#f9a825';
  }
  return undefined;
}

function getBackgroundColor(set: RendererSet) {
  if (set.round < 0) {
    return LOSERS_BACKGROUND_COLOR;
  }
  return SET_BACKGROUND_COLOR;
}

function getEntrantName(participants: RendererParticipant[]) {
  if (participants.length === 0) {
    return null;
  }
  return participants.map((participant) => participant.gamerTag).join(' / ');
}

function SetEntrant({
  entrantName,
  prereqStr,
}: {
  entrantName: string | null;
  prereqStr: string | null;
}) {
  let secondary = false;
  let text = '\u00A0';
  if (entrantName) {
    text = entrantName;
  } else if (prereqStr) {
    secondary = true;
    text = prereqStr;
  }
  return (
    <Box
      flexGrow={1}
      overflow="hidden"
      textOverflow="ellipsis"
      whiteSpace="nowrap"
      width="100%"
      color={secondary ? '#757575' : undefined}
      fontStyle={secondary ? 'italic' : undefined}
    >
      {text}
    </Box>
  );
}

function SetListItemInner({ set }: { set: RendererSet }) {
  let titleStart = <CloudOff fontSize="small" />;
  if (set.syncState === 1) {
    titleStart = <BackupOutlined fontSize="small" />;
  } else if (set.syncState === 0) {
    titleStart = <CloudDone fontSize="small" />;
  }

  let titleEnd = <Box width="20px" />;
  if (set.state === 2) {
    titleEnd = (
      <HourglassTop
        fontSize="small"
        style={{ marginLeft: '5px', marginRight: '-5px' }}
      />
    );
  } else if (set.state === 3) {
    if (set.hasStageData) {
      titleEnd = (
        <Stadium fontSize="small" style={{ margin: '-2px -8px 2px 8px' }} />
      );
    }
  } else if (set.state === 6) {
    titleEnd = (
      <NotificationsActive
        fontSize="small"
        style={{ marginLeft: '2px', marginRight: '-2px' }}
      />
    );
  }

  let entrant1Score: number | string = '\u00A0';
  if (set.state === 3) {
    if (set.entrant1Score !== null) {
      entrant1Score = set.entrant1Score;
    } else {
      entrant1Score = set.winnerId === set.entrant1Id ? 'W' : 'L';
    }
  }

  let entrant2Score: number | string = '\u00A0';
  if (set.state === 3) {
    if (set.entrant2Score !== null) {
      entrant2Score = set.entrant2Score;
    } else {
      entrant2Score = set.winnerId === set.entrant2Id ? 'W' : 'L';
    }
  }

  return (
    <Stack alignItems="stretch" width="100%">
      <Stack
        direction="row"
        alignItems="center"
        gap="4px"
        width="100%"
        style={{ color: getColor(set) }}
      >
        {titleStart}
        <Typography flexGrow={1} textAlign="center" variant="caption">
          {set.shortRoundText} ({set.identifier})
        </Typography>
        {titleEnd}
      </Stack>
      <Stack direction="row" alignItems="center" width="100%">
        <Stack
          flexGrow={1}
          maxWidth={
            set.state !== 3 && (set.station || set.stream)
              ? `calc(${SET_FIXED_WIDTH} - 40px)`
              : `calc(${SET_FIXED_WIDTH} - 8px)`
          }
          sx={{ typography: (theme) => theme.typography.body2 }}
        >
          <Stack
            direction="row"
            alignItems="center"
            marginRight="-8px"
            width="100%"
            style={{
              fontWeight:
                set.entrant1Id && set.entrant1Id === set.winnerId
                  ? 700
                  : undefined,
            }}
          >
            <SetEntrant
              entrantName={getEntrantName(set.entrant1Participants)}
              prereqStr={set.entrant1PrereqStr}
            />
            {set.state === 3 && (
              <Box
                textAlign="center"
                width="18px"
                sx={
                  set.entrant1Id && set.entrant1Id === set.winnerId
                    ? {
                        backgroundColor: WINNER_BACKGROUND_HIGHLIGHT,
                        color: TEXT_COLOR_LIGHT,
                      }
                    : undefined
                }
              >
                {entrant1Score}
              </Box>
            )}
          </Stack>
          <Stack
            direction="row"
            alignItems="center"
            marginRight="-8px"
            width="100%"
            style={{
              fontWeight:
                set.entrant2Id && set.entrant2Id === set.winnerId
                  ? 700
                  : undefined,
            }}
          >
            <SetEntrant
              entrantName={getEntrantName(set.entrant2Participants)}
              prereqStr={set.entrant2PrereqStr}
            />
            {set.state === 3 && (
              <Box
                textAlign="center"
                width="18px"
                sx={
                  set.entrant2Id && set.entrant2Id === set.winnerId
                    ? {
                        backgroundColor: WINNER_BACKGROUND_HIGHLIGHT,
                        color: TEXT_COLOR_LIGHT,
                      }
                    : undefined
                }
              >
                {entrant2Score}
              </Box>
            )}
          </Stack>
        </Stack>
        {set.state !== 3 && (set.station || set.stream) && (
          <Stack flexGrow={0} justifyContent="center">
            {set.stream ? (
              <Tooltip
                title={`${set.stream.streamSource} ${set.stream.streamName}`}
              >
                <Tv />
              </Tooltip>
            ) : (
              <Typography variant="body1">{set.station?.number}</Typography>
            )}
          </Stack>
        )}
      </Stack>
    </Stack>
  );
}

function SetListItemButton({
  set,
  conflictTransactionNum,
  reportSet,
}: {
  set: RendererSet;
  conflictTransactionNum: number | null;
  reportSet: (set: RendererSet) => void;
}) {
  return (
    <ListItemButton
      style={{
        backgroundColor:
          conflictTransactionNum !== null
            ? CONFLICT_BACKGROUND_COLOR
            : getBackgroundColor(set),
        color: conflictTransactionNum !== null ? TEXT_COLOR_LIGHT : undefined,
        flexGrow: 0,
        opacity: '100%',
        padding: '8px',
        width: SET_FIXED_WIDTH,
      }}
      onClick={() => {
        reportSet(set);
      }}
    >
      <SetListItemInner set={set} />
    </ListItemButton>
  );
}

function PoolListItem({
  pool,
  conflict,
  reportSet,
}: {
  pool: RendererPool;
  conflict: RendererConflict | null;
  reportSet: (poolId: number, set: RendererSet) => void;
}) {
  const [open, setOpen] = useState(false);
  const [completedOpen, setCompletedOpen] = useState(true);

  const winnersSets = pool.sets.filter((set) => set.round > 0);
  const losersSets = pool.sets.filter((set) => set.round < 0);

  return (
    <Box marginLeft="16px">
      <ListItemButton
        disableGutters
        style={{
          justifyContent: 'space-between',
          marginRight: '-8px',
          padding: '0 16px 0 0',
        }}
        onClick={() => {
          setOpen(!open);
        }}
      >
        <ListItemText style={{ flexGrow: 0 }}>
          {pool.name} <Typography variant="caption">({pool.id})</Typography>
        </ListItemText>
        {open ? (
          <Tooltip title="Hide sets">
            <KeyboardArrowDown />
          </Tooltip>
        ) : (
          <Tooltip title="Show sets">
            <KeyboardArrowRight />
          </Tooltip>
        )}
      </ListItemButton>
      <Collapse in={open}>
        <ListItemButton
          disableGutters
          style={{
            justifyContent: 'space-between',
            marginLeft: '16px',
            marginRight: '-8px',
            padding: '0 16px 0 0',
          }}
          onClick={() => {
            setCompletedOpen(!completedOpen);
          }}
        >
          <ListItemText style={{ flexGrow: 0 }}>
            <Typography variant="caption">completed</Typography>
          </ListItemText>
          {completedOpen ? (
            <Tooltip title="Hide completed sets">
              <Visibility />
            </Tooltip>
          ) : (
            <Tooltip title="Show completed sets">
              <VisibilityOff />
            </Tooltip>
          )}
        </ListItemButton>
        {winnersSets.length > 0 && (
          <Stack
            direction="row"
            flexWrap="wrap"
            gap="8px"
            marginLeft="16px"
            marginRight="32px"
          >
            {winnersSets
              .sort((a, b) => {
                if (a.identifier.length === b.identifier.length) {
                  return a.identifier.localeCompare(b.identifier);
                }
                return a.identifier.length - b.identifier.length;
              })
              .map(
                (set) =>
                  (completedOpen || set.state !== 3) && (
                    <SetListItemButton
                      key={set.id}
                      set={set}
                      conflictTransactionNum={
                        conflict && conflict.setId === set.id
                          ? conflict.transactionNum
                          : null
                      }
                      reportSet={(rendererSet: RendererSet) =>
                        reportSet(pool.id, rendererSet)
                      }
                    />
                  ),
              )}
          </Stack>
        )}
        {losersSets.length > 0 && (
          <Stack
            direction="row"
            flexWrap="wrap"
            gap="8px"
            marginLeft="16px"
            marginRight="32px"
            marginTop="8px"
          >
            {losersSets
              .sort((a, b) => {
                if (a.identifier.length === b.identifier.length) {
                  return a.identifier.localeCompare(b.identifier);
                }
                return a.identifier.length - b.identifier.length;
              })
              .map(
                (set) =>
                  (completedOpen || set.state !== 3) && (
                    <SetListItemButton
                      key={set.id}
                      set={set}
                      conflictTransactionNum={
                        conflict && conflict.setId === set.id
                          ? conflict.transactionNum
                          : null
                      }
                      reportSet={(rendererSet: RendererSet) =>
                        reportSet(pool.id, rendererSet)
                      }
                    />
                  ),
              )}
          </Stack>
        )}
      </Collapse>
    </Box>
  );
}

function PhaseListItem({
  phase,
  conflict,
  reportSet,
}: {
  phase: RendererPhase;
  conflict: RendererConflict | null;
  reportSet: (phaseId: number, poolId: number, set: RendererSet) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Box marginLeft="16px">
      <ListItemButton
        disableGutters
        style={{
          justifyContent: 'space-between',
          marginRight: '-8px',
          padding: '0 16px 0 0',
        }}
        onClick={() => {
          setOpen(!open);
        }}
      >
        <ListItemText>
          {phase.name} <Typography variant="caption">({phase.id})</Typography>
        </ListItemText>
        {open ? (
          <Tooltip title="Hide pools">
            <KeyboardArrowDown />
          </Tooltip>
        ) : (
          <Tooltip title="Show pools">
            <KeyboardArrowRight />
          </Tooltip>
        )}
      </ListItemButton>
      <Collapse in={open}>
        {phase.pools.length > 0 &&
          phase.pools.map((pool) => (
            <PoolListItem
              key={pool.id}
              pool={pool}
              conflict={conflict}
              reportSet={(poolId: number, set: RendererSet) =>
                reportSet(phase.id, poolId, set)
              }
            />
          ))}
      </Collapse>
    </Box>
  );
}

function LoadedEventListItem({
  event,
  conflict,
  reportSet,
}: {
  event: RendererEvent;
  conflict: RendererConflict | null;
  reportSet: (
    eventId: number,
    phaseId: number,
    poolId: number,
    set: RendererSet,
  ) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <ListItemButton
        disableGutters
        style={{
          justifyContent: 'space-between',
          marginRight: '-8px',
          padding: '0 16px 0 0',
        }}
        onClick={() => {
          setOpen(!open);
        }}
      >
        <Stack direction="row">
          <ListItemText style={{ marginRight: '8px' }}>
            {event.name} <Typography variant="caption">({event.id})</Typography>
          </ListItemText>
          {event.isOnline ? (
            <Tooltip title="Online" placement="right">
              <Router />
            </Tooltip>
          ) : (
            <Tooltip title="Offline" placement="right">
              <Group />
            </Tooltip>
          )}
        </Stack>
        {open ? (
          <Tooltip title="Hide pools">
            <KeyboardArrowDown />
          </Tooltip>
        ) : (
          <Tooltip title="Show pools">
            <KeyboardArrowRight />
          </Tooltip>
        )}
      </ListItemButton>
      <Collapse in={open}>
        {event.phases.length > 0 &&
          event.phases.map((phase) => (
            <PhaseListItem
              key={phase.id}
              phase={phase}
              conflict={conflict}
              reportSet={(phaseId: number, poolId: number, set: RendererSet) =>
                reportSet(event.id, phaseId, poolId, set)
              }
            />
          ))}
      </Collapse>
    </>
  );
}

function UnloadedEventListItem({
  event,
  showError,
}: {
  event: RendererEvent;
  showError: (message: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  return (
    <ListItem disablePadding style={{ justifyContent: 'space-between' }}>
      <Stack direction="row">
        <ListItemText style={{ marginRight: '8px' }}>
          {event.name} <Typography variant="caption">({event.id})</Typography>
        </ListItemText>
        {event.isOnline ? (
          <Tooltip title="Online" placement="right">
            <Router />
          </Tooltip>
        ) : (
          <Tooltip title="Offline" placement="right">
            <Group />
          </Tooltip>
        )}
      </Stack>
      {loading ? (
        <CircularProgress size="24px" style={{ padding: '8px' }} />
      ) : (
        <Tooltip title={`Load event: ${event.name}`} placement="left">
          <IconButton
            onClick={async () => {
              setLoading(true);
              try {
                await window.electron.loadEvent(event.id);
              } catch (e: any) {
                const message = e instanceof Error ? e.message : e;
                showError(message);
              } finally {
                setLoading(false);
              }
            }}
          >
            <Download />
          </IconButton>
        </Tooltip>
      )}
    </ListItem>
  );
}

function LocalTournamentItemButton({
  localTournament,
  set,
  setLocalTournaments,
  showError,
}: {
  localTournament: AdminedTournament;
  set: (id: number, slug: string) => Promise<void>;
  setLocalTournaments: (localTournaments: AdminedTournament[]) => void;
  showError: (message: string) => void;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  return (
    <>
      <ListItemButton
        style={{ gap: '8px', padding: '4px 8px 4px 16px' }}
        onClick={async () => {
          await set(localTournament.id, localTournament.slug);
        }}
      >
        <ListItemText>{localTournament.name}</ListItemText>
        {localTournament.isSynced ? (
          <Tooltip title="Fully synced">
            <CloudDone />
          </Tooltip>
        ) : (
          <Tooltip title="Not fully synced">
            <CloudOff />
          </Tooltip>
        )}
        <Tooltip title="Delete">
          <IconButton
            disabled={deleting}
            onClick={(ev) => {
              ev.stopPropagation();
              setDeleteOpen(true);
            }}
          >
            <Close />
          </IconButton>
        </Tooltip>
      </ListItemButton>
      <Dialog
        open={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
        }}
      >
        <DialogTitle>
          Delete {localTournament.name}? ({localTournament.id})
        </DialogTitle>
        <DialogActions>
          <Button
            variant="contained"
            color="error"
            onClick={async () => {
              setDeleting(true);
              try {
                await window.electron.deleteLocalTournament(localTournament.id);
                setLocalTournaments(
                  await window.electron.getLocalTournaments(),
                );
              } catch (e: any) {
                showError(e instanceof Error ? e.message : e);
              } finally {
                setDeleting(false);
              }
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function getDescription(type: TransactionType) {
  switch (type) {
    case TransactionType.RESET:
      return 'Reset';
    case TransactionType.START:
      return 'Start';
    case TransactionType.ASSIGN_STATION:
      return 'Assign Station';
    case TransactionType.ASSIGN_STREAM:
      return 'Assign Stream';
    case TransactionType.REPORT:
      return 'Report';
    default:
      throw new Error(`unknown type: ${type}`);
  }
}

export default function Tournament() {
  const [gettingAdminedTournaments, setGettingAdminedTournaments] =
    useState(false);
  const [adminedTournaments, setAdminedTournaments] = useState<
    AdminedTournament[]
  >([]);
  const [adminedTournamentsError, setAdminedTournamentsError] = useState('');
  const getAdminedTournaments = async () => {
    setGettingAdminedTournaments(true);
    try {
      setAdminedTournaments(await window.electron.getAdminedTournaments());
      setAdminedTournamentsError('');
    } catch (err: any) {
      const getApiError = (e: any) => {
        if (e instanceof ApiError) {
          return e;
        }
        if (e instanceof Error && e.cause) {
          return getApiError(e.cause);
        }
        return undefined;
      };
      const apiError = getApiError(err);
      if (apiError) {
        if (apiError.status !== undefined) {
          if (Math.floor(apiError.status / 100) === 5) {
            setAdminedTournamentsError(
              `***Please retry*** - failed to get tournaments from start.gg: ${apiError.status}, ${apiError.message}`,
            );
          } else {
            setAdminedTournamentsError(
              `Failed to get tournaments from start.gg: ${apiError.status}, ${apiError.message}`,
            );
          }
        } else if (apiError.fetch) {
          setAdminedTournamentsError(
            '***You may be offline*** - failed to get tournaments from start.gg.',
          );
        } else {
          setAdminedTournamentsError(
            `Failed to get tournaments from start.gg: ${apiError.message}`,
          );
        }
      } else if (err instanceof Error) {
        setAdminedTournamentsError(
          `Failed to get tournaments from start.gg: ${err.message}`,
        );
      } else {
        setAdminedTournamentsError(
          `Failed to get tournaments from start.gg: ${err}`,
        );
      }
    } finally {
      setGettingAdminedTournaments(false);
    }
  };
  const [localTournaments, setLocalTournaments] = useState<AdminedTournament[]>(
    [],
  );
  const refresh = async () => {
    setLocalTournaments(await window.electron.getLocalTournaments());
    getAdminedTournaments();
  };
  useEffect(() => {
    window.electron.onAdminedTournaments((event, newAdminedTournaments) => {
      setAdminedTournaments(newAdminedTournaments);
    });
  }, []);

  const [open, setOpen] = useState(false);
  const [settingTournament, setSettingTournament] = useState(false);
  const [error, setError] = useState('');
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const showError = (message: string) => {
    setError(message);
    setErrorDialogOpen(true);
  };
  const getTournament = async (slug: string) => {
    setSettingTournament(true);
    try {
      await window.electron.getTournament(slug);
      setOpen(false);
    } catch (e: any) {
      const message = e instanceof Error ? e.message : e;
      showError(message);
    } finally {
      setSettingTournament(false);
    }
  };

  const [stationStreamDialogOpen, setStationStreamDialogOpen] = useState(false);
  const [choosing, setChoosing] = useState(false);

  const [resetting, setResetting] = useState(false);
  const [starting, setStarting] = useState(false);

  const [reportEventId, setReportEventId] = useState(0);
  const [reportPhaseId, setReportPhaseId] = useState(0);
  const [reportPoolId, setReportPoolId] = useState(0);

  const [reportSet, setReportSet] = useState<RendererSet | null>(null);
  const [reportPreempt, setReportPreempt] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportWinnerId, setReportWinnerId] = useState(0);
  const [reportIsDq, setReportIsDq] = useState(false);
  const [reportEntrant1Score, setReportEntrant1Score] = useState(0);
  const [reportEntrant2Score, setReportEntrant2Score] = useState(0);
  const [reporting, setReporting] = useState(false);

  const setReportState = useCallback(
    (
      newReportEventId: number,
      newReportPhaseId: number,
      newReportPoolId: number,
      newReportSet: RendererSet,
      newReportPreempt: boolean = false,
    ) => {
      setReportWinnerId(newReportSet.winnerId ?? 0);
      setReportIsDq(
        newReportSet.entrant1Score === -1 || newReportSet.entrant2Score === -1,
      );
      setReportEntrant1Score(newReportSet.entrant1Score ?? 0);
      setReportEntrant2Score(newReportSet.entrant2Score ?? 0);
      setReportPreempt(newReportPreempt);
      setReportSet(newReportSet);
      setReportPoolId(newReportPoolId);
      setReportPhaseId(newReportPhaseId);
      setReportEventId(newReportEventId);
    },
    [],
  );

  const [tournament, setTournament] = useState<RendererTournament | null>(null);
  useEffect(() => {
    (async () => {
      const currentTournament = await window.electron.getCurrentTournament();
      if (currentTournament) {
        setTournament(currentTournament);
      }
    })();
  }, []);
  useEffect(() => {
    window.electron.onTournament((e, newTournament) => {
      if (
        reportDialogOpen &&
        reportEventId &&
        reportPhaseId &&
        reportPoolId &&
        reportSet
      ) {
        const newEvent = newTournament.events.find(
          (event) => event.id === reportEventId,
        );
        if (newEvent) {
          const newPhase = newEvent.phases.find(
            (phase) => phase.id === reportPhaseId,
          );
          if (newPhase) {
            const newPool = newPhase.pools.find(
              (pool) => pool.id === reportPoolId,
            );
            if (newPool) {
              const newReportSet = newPool.sets.find(
                (set) => set.identifier === reportSet.identifier,
              );
              if (newReportSet) {
                setReportState(
                  reportEventId,
                  reportPhaseId,
                  reportPoolId,
                  newReportSet,
                );
              }
            }
          }
        }
      }
      setTournament(newTournament);
    });
  }, [
    reportDialogOpen,
    reportEventId,
    reportPhaseId,
    reportPoolId,
    reportSet,
    setReportState,
  ]);

  const [unloadedOpen, setUnloadedOpen] = useState(true);
  const unloadedEvents = tournament
    ? tournament.events.filter((event) => !event.isLoaded)
    : [];
  const loadedEvents = tournament
    ? tournament.events.filter((event) => event.isLoaded)
    : [];

  let reportGameData:
    | [
        { entrantId: number; score: number },
        { entrantId: number; score: number },
      ]
    | null = null;
  if (reportSet && reportSet.entrant1Id && reportSet.entrant2Id) {
    if (reportEntrant1Score > reportEntrant2Score) {
      reportGameData = [
        { entrantId: reportSet.entrant1Id, score: reportEntrant1Score },
        { entrantId: reportSet.entrant2Id, score: reportEntrant2Score },
      ];
    } else if (reportEntrant1Score < reportEntrant2Score) {
      reportGameData = [
        { entrantId: reportSet.entrant2Id, score: reportEntrant2Score },
        { entrantId: reportSet.entrant1Id, score: reportEntrant1Score },
      ];
    }
  }

  let updateUnchanged = false;
  if (reportSet && reportSet.state === 3) {
    if (reportIsDq) {
      if (reportSet.winnerId === reportSet.entrant1Id) {
        updateUnchanged = reportSet.entrant2Score === -1;
      } else {
        updateUnchanged = reportSet.entrant1Score === -1;
      }
    } else {
      updateUnchanged =
        reportEntrant1Score === reportSet.entrant1Score &&
        reportEntrant2Score === reportSet.entrant2Score;
    }
  }

  const [conflictResolve, setConflictResolve] =
    useState<RendererConflictResolve | null>(null);
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false);

  const [conflict, setConflict] = useState<RendererConflict | null>(null);
  useEffect(() => {
    window.electron.onConflict((event, newConflict) => {
      if (
        newConflict === null ||
        conflict?.transactionNum !== newConflict.transactionNum
      ) {
        setConflictResolve(null);
        setConflictDialogOpen(false);
      }
      setConflict(newConflict);
    });
    (async () => {
      setConflict(await window.electron.getConflict());
    })();
  }, [conflict]);

  return (
    <>
      <AppBar position="fixed" style={{ backgroundColor: '#fff' }}>
        <Toolbar
          disableGutters
          style={{
            justifyContent: 'space-between',
            gap: '8px',
            paddingRight: '8px',
          }}
        >
          <Stack direction="row" alignItems="center" marginLeft="-3px">
            <Sync />
            <Websocket />
            {conflict && (
              <Button
                color="warning"
                size="large"
                variant="contained"
                onClick={async () => {
                  setConflictResolve(
                    await window.electron.getConflictResolve(
                      conflict.setId,
                      conflict.transactionNum,
                    ),
                  );
                  setConflictDialogOpen(true);
                }}
              >
                Conflict!
              </Button>
            )}
            <FatalError
              tournamentId={tournament?.id}
              tournamentSlug={tournament?.slug}
            />
          </Stack>
          <Settings showError={showError} />
        </Toolbar>
      </AppBar>
      <Toolbar />
      <Stack marginTop="8px">
        <Stack direction="row" alignItems="center">
          <InputBase
            disabled
            size="small"
            value={
              tournament
                ? `${tournament.slug} (${tournament.id})`
                : 'Set tournament'
            }
            style={{ flexGrow: 1 }}
          />
          <Tooltip title="Set tournament">
            <IconButton
              onClick={() => {
                refresh();
                setOpen(true);
              }}
            >
              <Edit />
            </IconButton>
          </Tooltip>
          {unloadedEvents.length > 0 &&
            (unloadedOpen ? (
              <Tooltip title="Hide unloaded events">
                <IconButton
                  onClick={() => {
                    setUnloadedOpen(false);
                  }}
                >
                  <Visibility />
                </IconButton>
              </Tooltip>
            ) : (
              <Tooltip title="Show unloaded events">
                <IconButton
                  onClick={() => {
                    setUnloadedOpen(true);
                  }}
                >
                  <VisibilityOff />
                </IconButton>
              </Tooltip>
            ))}
          <Dialog
            fullWidth
            open={open}
            onClose={() => {
              setOpen(false);
            }}
            PaperProps={{
              style: { height: 'calc(100% - 64px)' },
            }}
          >
            <DialogTitle
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                paddingRight: '32px',
              }}
            >
              Set tournament
              <Tooltip title="Refresh">
                <IconButton
                  disabled={gettingAdminedTournaments}
                  onClick={refresh}
                >
                  {gettingAdminedTournaments ? (
                    <CircularProgress size="24px" />
                  ) : (
                    <Refresh />
                  )}
                </IconButton>
              </Tooltip>
            </DialogTitle>
            <DialogContent>
              {localTournaments.length > 0 && (
                <>
                  <Box
                    sx={{ typography: (theme) => theme.typography.subtitle2 }}
                  >
                    Local tournaments
                  </Box>
                  {localTournaments.map((localTournament) => (
                    <LocalTournamentItemButton
                      key={localTournament.id}
                      localTournament={localTournament}
                      set={async (id: number, slug: string) => {
                        setSettingTournament(true);
                        await window.electron.setTournament(id, slug);
                        setOpen(false);
                        setSettingTournament(false);
                      }}
                      setLocalTournaments={setLocalTournaments}
                      showError={showError}
                    />
                  ))}
                </>
              )}
              <Box sx={{ typography: (theme) => theme.typography.subtitle2 }}>
                Fetch from start.gg
              </Box>
              <form
                style={{
                  alignItems: 'center',
                  display: 'flex',
                  margin: '8px 4px',
                  gap: '8px',
                }}
                onSubmit={async (event: FormEvent<HTMLFormElement>) => {
                  const target = event.target as typeof event.target & {
                    slug: { value: string };
                  };
                  const newSlug = target.slug.value;
                  event.preventDefault();
                  event.stopPropagation();
                  if (newSlug) {
                    await getTournament(newSlug);
                  }
                }}
              >
                <TextField
                  autoFocus
                  label="Tournament Slug"
                  name="slug"
                  placeholder="super-smash-con-2023"
                  size="small"
                  variant="outlined"
                />
                <Button
                  disabled={settingTournament}
                  endIcon={
                    settingTournament && <CircularProgress size="24px" />
                  }
                  type="submit"
                  variant="contained"
                >
                  Get!
                </Button>
              </form>
              {adminedTournamentsError.length > 0 && (
                <Alert severity="error" style={{ marginTop: '8px' }}>
                  {adminedTournamentsError}
                </Alert>
              )}
              {adminedTournaments.map((adminedTournament) => (
                <ListItemButton
                  key={adminedTournament.slug}
                  onClick={async () => {
                    await getTournament(adminedTournament.slug);
                  }}
                >
                  <ListItemText
                    style={{ overflowX: 'hidden', whiteSpace: 'nowrap' }}
                  >
                    {adminedTournament.name}{' '}
                    <Typography variant="caption">
                      ({adminedTournament.slug})
                    </Typography>
                  </ListItemText>
                </ListItemButton>
              ))}
            </DialogContent>
          </Dialog>
        </Stack>
        {unloadedEvents.length > 0 && (
          <Collapse in={unloadedOpen}>
            <List>
              {unloadedEvents.map((event) => (
                <UnloadedEventListItem
                  key={event.id}
                  event={event}
                  showError={showError}
                />
              ))}
            </List>
          </Collapse>
        )}
        {loadedEvents.length > 0 && (
          <List>
            {loadedEvents.map((event) => (
              <LoadedEventListItem
                key={event.id}
                event={event}
                conflict={conflict}
                reportSet={(eventId, phaseId, poolId, set) => {
                  setReportState(eventId, phaseId, poolId, set);
                  setReportDialogOpen(true);
                }}
              />
            ))}
          </List>
        )}
        <Dialog
          open={reportDialogOpen}
          onClose={() => {
            setReportDialogOpen(false);
          }}
        >
          <Stack
            color={reportSet ? getColor(reportSet) : undefined}
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            padding="16px 24px"
          >
            <Typography variant="h6" display="flex" alignItems="center">
              {reportSet?.fullRoundText} ({reportSet?.identifier})
              {reportSet?.state === 2 && (
                <HourglassTop style={{ marginLeft: '3px' }} />
              )}
              {reportSet?.state === 6 && (
                <NotificationsActive style={{ marginLeft: '6px' }} />
              )}
            </Typography>
            <Stack direction="row" alignItems="center" spacing="8px">
              {reportSet?.hasStageData === 1 && (
                <Tooltip title="Games and stages reported">
                  <StadiumOutlined />
                </Tooltip>
              )}
              {reportSet?.station && (
                <Typography variant="body1">
                  Station {reportSet?.station?.number}
                </Typography>
              )}
              {reportSet?.stream && (
                <Tooltip
                  title={`${reportSet?.stream.streamSource} ${reportSet?.stream.streamName}`}
                >
                  <Tv />
                </Tooltip>
              )}
              <Typography variant="caption">({reportSet?.setId})</Typography>
            </Stack>
          </Stack>
          <DialogContent style={{ paddingTop: 0 }}>
            <Stack
              alignItems="center"
              sx={{ typography: (theme) => theme.typography.body2 }}
            >
              <Stack direction="row" alignItems="center">
                <Box
                  overflow="hidden"
                  textOverflow="ellipsis"
                  whiteSpace="nowrap"
                  width="176px"
                >
                  {reportSet && getEntrantName(reportSet.entrant1Participants)}
                </Box>
                <Button
                  disabled={
                    !reportSet?.entrant1Id ||
                    !reportSet?.entrant2Id ||
                    reportSet?.state === 3
                  }
                  variant={
                    reportIsDq && reportWinnerId === reportSet?.entrant2Id
                      ? 'contained'
                      : 'text'
                  }
                  onClick={() => {
                    setReportWinnerId(reportSet!.entrant2Id!);
                    setReportIsDq(true);
                    setReportEntrant1Score(0);
                    setReportEntrant2Score(0);
                  }}
                >
                  DQ
                </Button>
                <Button
                  disabled={
                    !reportSet?.entrant1Id ||
                    !reportSet?.entrant2Id ||
                    (reportSet?.state === 3 &&
                      (reportSet?.winnerId === reportSet?.entrant1Id ||
                        reportSet?.hasStageData === 1))
                  }
                  variant={
                    !reportIsDq &&
                    !(
                      reportEntrant2Score === 0 &&
                      (reportWinnerId === reportSet?.entrant1Id ||
                        reportWinnerId === reportSet?.entrant2Id)
                    ) &&
                    reportEntrant1Score === 0
                      ? 'contained'
                      : 'text'
                  }
                  onClick={() => {
                    setReportWinnerId(
                      reportEntrant2Score > 0 ? reportSet!.entrant2Id! : 0,
                    );
                    setReportIsDq(false);
                    setReportEntrant1Score(0);
                  }}
                >
                  0
                </Button>
                <Button
                  disabled={
                    !reportSet?.entrant1Id ||
                    !reportSet?.entrant2Id ||
                    (reportSet?.state === 3 &&
                      ((reportSet?.winnerId === reportSet?.entrant1Id &&
                        reportEntrant2Score >= 1) ||
                        (reportSet?.winnerId === reportSet?.entrant2Id &&
                          reportEntrant2Score <= 1) ||
                        reportSet?.hasStageData === 1))
                  }
                  variant={
                    !reportIsDq && reportEntrant1Score === 1
                      ? 'contained'
                      : 'text'
                  }
                  onClick={() => {
                    if (reportEntrant2Score > 1) {
                      setReportWinnerId(reportSet!.entrant2Id!);
                    } else if (reportEntrant2Score < 1) {
                      setReportWinnerId(reportSet!.entrant1Id!);
                    } else {
                      setReportWinnerId(0);
                    }
                    setReportIsDq(false);
                    setReportEntrant1Score(1);
                  }}
                >
                  1
                </Button>
                <Button
                  disabled={
                    !reportSet?.entrant1Id ||
                    !reportSet?.entrant2Id ||
                    (reportSet?.state === 3 &&
                      ((reportSet?.winnerId === reportSet?.entrant1Id &&
                        reportEntrant2Score >= 2) ||
                        (reportSet?.winnerId === reportSet?.entrant2Id &&
                          reportEntrant2Score <= 2) ||
                        reportSet?.hasStageData === 1))
                  }
                  variant={
                    !reportIsDq && reportEntrant1Score === 2
                      ? 'contained'
                      : 'text'
                  }
                  onClick={() => {
                    if (reportEntrant2Score > 2) {
                      setReportWinnerId(reportSet!.entrant2Id!);
                    } else if (reportEntrant2Score < 2) {
                      setReportWinnerId(reportSet!.entrant1Id!);
                    } else {
                      setReportWinnerId(0);
                    }
                    setReportIsDq(false);
                    setReportEntrant1Score(2);
                  }}
                >
                  2
                </Button>
                <Button
                  disabled={
                    !reportSet?.entrant1Id ||
                    !reportSet?.entrant2Id ||
                    (reportSet?.state === 3 &&
                      (reportSet?.winnerId === reportSet?.entrant2Id ||
                        reportSet?.hasStageData === 1))
                  }
                  variant={
                    !reportIsDq && reportEntrant1Score === 3
                      ? 'contained'
                      : 'text'
                  }
                  onClick={() => {
                    if (reportEntrant2Score > 3) {
                      setReportWinnerId(reportSet!.entrant2Id!);
                    } else if (reportEntrant2Score < 3) {
                      setReportWinnerId(reportSet!.entrant1Id!);
                    } else {
                      setReportWinnerId(0);
                    }
                    setReportIsDq(false);
                    setReportEntrant1Score(3);
                  }}
                >
                  3
                </Button>
                <Button
                  disabled={
                    !reportSet?.entrant1Id ||
                    !reportSet?.entrant2Id ||
                    (reportSet?.state === 3 &&
                      (reportSet?.winnerId === reportSet?.entrant2Id ||
                        reportSet?.hasStageData === 1))
                  }
                  variant={
                    reportWinnerId === reportSet?.entrant1Id
                      ? 'contained'
                      : 'text'
                  }
                  onClick={() => {
                    setReportWinnerId(reportSet!.entrant1Id!);
                    setReportIsDq(false);
                    setReportEntrant1Score(0);
                    setReportEntrant2Score(0);
                  }}
                >
                  W
                </Button>
              </Stack>
              <Stack direction="row" alignItems="center">
                <Box
                  overflow="hidden"
                  textOverflow="ellipsis"
                  whiteSpace="nowrap"
                  width="176px"
                >
                  {reportSet && getEntrantName(reportSet.entrant2Participants)}
                </Box>
                <Button
                  disabled={
                    !reportSet?.entrant1Id ||
                    !reportSet?.entrant2Id ||
                    reportSet?.state === 3
                  }
                  variant={
                    reportIsDq && reportWinnerId === reportSet?.entrant1Id
                      ? 'contained'
                      : 'text'
                  }
                  onClick={() => {
                    setReportWinnerId(reportSet!.entrant1Id!);
                    setReportIsDq(true);
                    setReportEntrant1Score(0);
                    setReportEntrant2Score(0);
                  }}
                >
                  DQ
                </Button>
                <Button
                  disabled={
                    !reportSet?.entrant1Id ||
                    !reportSet?.entrant2Id ||
                    (reportSet?.state === 3 &&
                      (reportSet?.winnerId === reportSet?.entrant2Id ||
                        reportSet?.hasStageData === 1))
                  }
                  variant={
                    !reportIsDq &&
                    !(
                      reportEntrant1Score === 0 &&
                      (reportWinnerId === reportSet?.entrant1Id ||
                        reportWinnerId === reportSet?.entrant2Id)
                    ) &&
                    reportEntrant2Score === 0
                      ? 'contained'
                      : 'text'
                  }
                  onClick={() => {
                    setReportWinnerId(
                      reportEntrant1Score > 0 ? reportSet!.entrant1Id! : 0,
                    );
                    setReportIsDq(false);
                    setReportEntrant2Score(0);
                  }}
                >
                  0
                </Button>
                <Button
                  disabled={
                    !reportSet?.entrant1Id ||
                    !reportSet?.entrant2Id ||
                    (reportSet?.state === 3 &&
                      ((reportSet?.winnerId === reportSet?.entrant2Id &&
                        reportEntrant1Score >= 1) ||
                        (reportSet?.winnerId === reportSet?.entrant1Id &&
                          reportEntrant1Score <= 1) ||
                        reportSet?.hasStageData === 1))
                  }
                  variant={
                    !reportIsDq && reportEntrant2Score === 1
                      ? 'contained'
                      : 'text'
                  }
                  onClick={() => {
                    if (reportEntrant1Score > 1) {
                      setReportWinnerId(reportSet!.entrant1Id!);
                    } else if (reportEntrant1Score < 1) {
                      setReportWinnerId(reportSet!.entrant2Id!);
                    } else {
                      setReportWinnerId(0);
                    }
                    setReportIsDq(false);
                    setReportEntrant2Score(1);
                  }}
                >
                  1
                </Button>
                <Button
                  disabled={
                    !reportSet?.entrant1Id ||
                    !reportSet?.entrant2Id ||
                    (reportSet?.state === 3 &&
                      ((reportSet?.winnerId === reportSet?.entrant2Id &&
                        reportEntrant1Score >= 2) ||
                        (reportSet?.winnerId === reportSet?.entrant1Id &&
                          reportEntrant1Score <= 2) ||
                        reportSet?.hasStageData === 1))
                  }
                  variant={
                    !reportIsDq && reportEntrant2Score === 2
                      ? 'contained'
                      : 'text'
                  }
                  onClick={() => {
                    if (reportEntrant1Score > 2) {
                      setReportWinnerId(reportSet!.entrant1Id!);
                    } else if (reportEntrant1Score < 2) {
                      setReportWinnerId(reportSet!.entrant2Id!);
                    } else {
                      setReportWinnerId(0);
                    }
                    setReportIsDq(false);
                    setReportEntrant2Score(2);
                  }}
                >
                  2
                </Button>
                <Button
                  disabled={
                    !reportSet?.entrant1Id ||
                    !reportSet?.entrant2Id ||
                    (reportSet?.state === 3 &&
                      (reportSet?.winnerId === reportSet?.entrant1Id ||
                        reportSet?.hasStageData === 1))
                  }
                  variant={
                    !reportIsDq && reportEntrant2Score === 3
                      ? 'contained'
                      : 'text'
                  }
                  onClick={() => {
                    if (reportEntrant1Score > 3) {
                      setReportWinnerId(reportSet!.entrant1Id!);
                    } else if (reportEntrant1Score < 3) {
                      setReportWinnerId(reportSet!.entrant2Id!);
                    } else {
                      setReportWinnerId(0);
                    }
                    setReportIsDq(false);
                    setReportEntrant2Score(3);
                  }}
                >
                  3
                </Button>
                <Button
                  disabled={
                    !reportSet?.entrant1Id ||
                    !reportSet?.entrant2Id ||
                    (reportSet?.state === 3 &&
                      (reportSet?.winnerId === reportSet?.entrant1Id ||
                        reportSet?.hasStageData === 1))
                  }
                  variant={
                    reportWinnerId === reportSet?.entrant2Id
                      ? 'contained'
                      : 'text'
                  }
                  onClick={() => {
                    setReportWinnerId(reportSet!.entrant2Id!);
                    setReportIsDq(false);
                    setReportEntrant1Score(0);
                    setReportEntrant2Score(0);
                  }}
                >
                  W
                </Button>
              </Stack>
            </Stack>
          </DialogContent>
          <DialogActions>
            <IconButton
              color="primary"
              disabled={
                choosing ||
                reportPreempt ||
                typeof reportSet?.setId === 'string'
              }
              size="small"
              onClick={async () => {
                setStationStreamDialogOpen(true);
              }}
            >
              {choosing ? <CircularProgress size="24px" /> : <Tv />}
            </IconButton>
            <IconButton
              color="error"
              disabled={reportSet?.state === 1 || resetting || reportPreempt}
              onClick={async () => {
                setResetting(true);
                try {
                  await window.electron.resetSet(reportSet!.setId);
                  setReportDialogOpen(false);
                } catch (e: any) {
                  showError(e instanceof Error ? e.message : e);
                } finally {
                  setResetting(false);
                }
              }}
            >
              {resetting ? <CircularProgress size="24px" /> : <RestartAlt />}
            </IconButton>
            <IconButton
              color="primary"
              disabled={
                starting ||
                !reportSet?.entrant1Id ||
                !reportSet?.entrant2Id ||
                !(reportSet?.state === 1 || reportSet?.state === 6) ||
                reportPreempt
              }
              onClick={async () => {
                setStarting(true);
                try {
                  await window.electron.startSet(reportSet!.setId);
                  setReportDialogOpen(false);
                } catch (e: any) {
                  showError(e instanceof Error ? e.message : e);
                } finally {
                  setStarting(false);
                }
              }}
            >
              {starting ? <CircularProgress size="24px" /> : <HourglassTop />}
            </IconButton>
            <Button
              variant="contained"
              disabled={
                !reportSet?.entrant1Id ||
                !reportSet?.entrant2Id ||
                (reportSet?.state === 3 &&
                  (updateUnchanged || reportSet?.hasStageData === 1)) ||
                reporting ||
                !reportWinnerId
              }
              endIcon={reporting ? <CircularProgress size="24px" /> : undefined}
              onClick={async () => {
                setReporting(true);
                try {
                  if (reportPreempt) {
                    await window.electron.preemptReport(
                      reportSet!.setId,
                      reportWinnerId,
                      reportIsDq,
                      reportGameData,
                    );
                  } else {
                    await window.electron.reportSet(
                      reportSet!.setId,
                      reportWinnerId,
                      reportIsDq,
                      reportGameData,
                    );
                  }
                  setReportDialogOpen(false);
                  setConflictDialogOpen(false);
                } catch (e: any) {
                  showError(e instanceof Error ? e.message : e);
                } finally {
                  setReporting(false);
                }
              }}
            >
              Report
            </Button>
          </DialogActions>
        </Dialog>
        <Dialog
          open={stationStreamDialogOpen}
          onClose={() => {
            setStationStreamDialogOpen(false);
          }}
        >
          <DialogContent>
            {tournament && tournament.streams.length > 0 && (
              <>
                {reportSet?.stream && (
                  <ListItemButton
                    disabled={choosing}
                    disableGutters
                    style={{ marginTop: '8px' }}
                    onClick={async () => {
                      setChoosing(true);
                      try {
                        await window.electron.assignSetStream(
                          reportSet!.setId,
                          0,
                        );
                        setStationStreamDialogOpen(false);
                        setReportDialogOpen(false);
                      } catch (e: any) {
                        showError(e instanceof Error ? e.message : e);
                      } finally {
                        setChoosing(false);
                      }
                    }}
                  >
                    <ListItemText>
                      Remove from {reportSet!.stream.streamName}
                    </ListItemText>
                  </ListItemButton>
                )}
                <List disablePadding>
                  {tournament.streams
                    .filter((stream) => stream.id !== reportSet?.stream?.id)
                    .map((stream) => (
                      <ListItemButton
                        disabled={choosing}
                        key={stream.id}
                        disableGutters
                        onClick={async () => {
                          setChoosing(true);
                          try {
                            await window.electron.assignSetStream(
                              reportSet!.setId,
                              stream.id,
                            );
                            setStationStreamDialogOpen(false);
                            setReportDialogOpen(false);
                          } catch (e: any) {
                            showError(e instanceof Error ? e.message : e);
                          } finally {
                            setChoosing(false);
                          }
                        }}
                      >
                        <ListItemText>{stream.streamName}</ListItemText>
                      </ListItemButton>
                    ))}
                </List>
              </>
            )}
            {tournament && tournament.stations.length > 0 && (
              <>
                {reportSet?.station && (
                  <ListItemText
                    style={{ padding: '12px 0', margin: '8px 0 0' }}
                  >
                    Assigned to station {reportSet!.station.number}
                  </ListItemText>
                )}
                <List
                  disablePadding
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                  }}
                >
                  {tournament.stations
                    .filter((station) => station.id !== reportSet?.station?.id)
                    .map((station) => (
                      <ListItemButton
                        disabled={choosing}
                        key={station.id}
                        style={{ flexGrow: 0 }}
                        onClick={async () => {
                          setChoosing(true);
                          try {
                            await window.electron.assignSetStation(
                              reportSet!.setId,
                              station.id,
                            );
                            setStationStreamDialogOpen(false);
                            setReportDialogOpen(false);
                          } catch (e: any) {
                            showError(e instanceof Error ? e.message : e);
                          } finally {
                            setChoosing(false);
                          }
                        }}
                      >
                        <ListItemText>{station.number}</ListItemText>
                      </ListItemButton>
                    ))}
                </List>
              </>
            )}
          </DialogContent>
        </Dialog>
        <Dialog
          maxWidth="md"
          open={conflictDialogOpen}
          onClose={() => {
            setConflictDialogOpen(false);
          }}
        >
          <Stack
            direction="row"
            alignItems="center"
            padding="16px 24px"
            gap="8px"
          >
            <Typography variant="h6">Resolve Conflict:</Typography>
            <Typography variant="body1">
              {conflictResolve?.eventName}, {conflictResolve?.phaseName}, Pool{' '}
              {conflictResolve?.poolName}
            </Typography>
          </Stack>
          <DialogContent>
            {conflictResolve && (
              <Stack direction="row" gap="8px" alignItems="start">
                <Stack
                  gap="8px"
                  alignItems="stretch"
                  flexShrink={0}
                  marginLeft="-8px"
                >
                  <Box
                    padding="8px"
                    sx={{
                      backgroundColor: getBackgroundColor(
                        conflictResolve.serverSets[0].set,
                      ),
                      boxSizing: 'border-box',
                      width: SET_FIXED_WIDTH,
                    }}
                  >
                    <Typography variant="body2">Server</Typography>
                    <SetListItemInner set={conflictResolve.serverSets[0].set} />
                  </Box>
                  {conflictResolve.serverSets.length > 1 &&
                    conflictResolve.serverSets.slice(1).map((serverSet) =>
                      conflictResolve.reason ===
                        ConflictReason.MISSING_ENTRANTS &&
                      serverSet.set.entrant1Id &&
                      serverSet.set.entrant2Id ? (
                        <SetListItemButton
                          key={serverSet.set.id}
                          set={serverSet.set}
                          conflictTransactionNum={null}
                          reportSet={(rendererSet) => {
                            setReportState(
                              serverSet.eventId,
                              serverSet.phaseId,
                              serverSet.poolId,
                              rendererSet,
                              /* reportPreempt */ true,
                            );
                            setReportDialogOpen(true);
                          }}
                        />
                      ) : (
                        <Box
                          padding="8px"
                          sx={{
                            backgroundColor: getBackgroundColor(serverSet.set),
                            boxSizing: 'border-box',
                            width: SET_FIXED_WIDTH,
                          }}
                        >
                          <SetListItemInner
                            key={serverSet.set.id}
                            set={serverSet.set}
                          />
                        </Box>
                      ),
                    )}
                  {conflictResolve.serverSets.length === 1 && (
                    <>
                      {conflictResolve.reason ===
                        ConflictReason.RESET_DEPENDENT_SETS && (
                        <Typography variant="caption">
                          Try refreshing tournament
                          <br />
                          to see dependent sets
                        </Typography>
                      )}
                      {conflictResolve.reason ===
                        ConflictReason.MISSING_ENTRANTS && (
                        <Typography variant="caption">
                          Try refreshing tournament
                          <br />
                          to see dependency sets
                        </Typography>
                      )}
                    </>
                  )}
                </Stack>
                <Stack
                  gap="8px"
                  alignItems="stretch"
                  flexShrink={0}
                  padding="0 8px"
                >
                  <Box
                    sx={{
                      backgroundColor: CONFLICT_BACKGROUND_COLOR,
                      boxSizing: 'border-box',
                      color: TEXT_COLOR_LIGHT,
                      padding: '8px',
                      width: SET_FIXED_WIDTH,
                    }}
                  >
                    <Typography variant="body2">
                      Local {getDescription(conflictResolve.localSets[0].type)}
                    </Typography>
                    <SetListItemInner set={conflictResolve.localSets[0].set} />
                  </Box>
                  <div style={{ marginTop: '8px' }} />
                  {conflictResolve.localSets.length > 1 &&
                    conflictResolve.localSets.slice(1).map((localSet) => (
                      <Box
                        key={localSet.transactionNum}
                        sx={{
                          backgroundColor: getBackgroundColor(localSet.set),
                          boxSizing: 'border-box',
                          padding: '8px',
                          width: SET_FIXED_WIDTH,
                        }}
                      >
                        <Typography variant="body2">
                          Local {getDescription(localSet.type)}
                        </Typography>
                        <SetListItemInner set={localSet.set} />
                      </Box>
                    ))}
                </Stack>
                <Stack gap="8px" alignItems="stretch" marginLeft="8px">
                  {conflictResolve.reason ===
                    ConflictReason.RESET_DEPENDENT_SETS && (
                    <Button
                      color="error"
                      variant="contained"
                      onClick={() => {
                        if (conflict) {
                          window.electron.makeResetRecursive(
                            conflict.transactionNum,
                          );
                          setConflictDialogOpen(false);
                        }
                      }}
                    >
                      Reset dependent sets
                    </Button>
                  )}
                  {conflictResolve.reason ===
                    ConflictReason.MISSING_ENTRANTS && (
                    <Paper
                      elevation={2}
                      style={{
                        boxSizing: 'border-box',
                        padding: '6px 16px',
                      }}
                    >
                      <Typography
                        variant="body2"
                        fontWeight="700"
                        lineHeight="24.5px"
                        textAlign="center"
                      >
                        REPORT DEPENDENCY SETS
                      </Typography>
                    </Paper>
                  )}
                  {conflictResolve.reason ===
                    ConflictReason.UPDATE_CHANGE_WINNER && (
                    <Button
                      color="warning"
                      variant="contained"
                      onClick={() => {
                        window.electron.preemptReset(
                          conflictResolve.localSets[0].set.setId,
                        );
                        setConflictDialogOpen(false);
                      }}
                    >
                      Reset set
                    </Button>
                  )}
                  {conflictResolve.reason ===
                    ConflictReason.UPDATE_STAGE_DATA && (
                    <Paper
                      elevation={2}
                      style={{
                        boxSizing: 'border-box',
                        padding: '6px 16px',
                      }}
                    >
                      <Typography
                        variant="body2"
                        fontWeight="700"
                        lineHeight="24.5px"
                        textAlign="center"
                      >
                        WOULD REMOVE STAGE DATA
                      </Typography>
                    </Paper>
                  )}
                  <Button
                    color="error"
                    variant="contained"
                    onClick={() => {
                      if (conflict) {
                        window.electron.deleteTransaction(
                          conflict.transactionNum,
                        );
                        setConflictDialogOpen(false);
                      }
                    }}
                  >
                    Abandon {getDescription(conflictResolve.localSets[0].type)}
                  </Button>
                </Stack>
              </Stack>
            )}
          </DialogContent>
        </Dialog>
        <ErrorDialog
          open={errorDialogOpen}
          error={error}
          close={() => {
            setErrorDialogOpen(false);
          }}
        />
      </Stack>
    </>
  );
}
