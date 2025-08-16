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
  Stack,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import { FormEvent, useEffect, useState } from 'react';
import {
  AdminedTournament,
  ApiError,
  ConflictReason,
  RendererConflict,
  RendererConflictResolve,
  RendererEvent,
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
      overflow="hidden"
      textOverflow="ellipsis"
      whiteSpace="nowrap"
      color={secondary ? '#757575' : undefined}
      fontWeight={secondary ? undefined : 500}
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
        style={{ color: '#0d8225', marginLeft: '5px', marginRight: '-5px' }}
      />
    );
  } else if (set.state === 3) {
    if (set.hasStageData) {
      titleEnd = (
        <Stadium fontSize="small" style={{ margin: '-2px -5px 2px 5px' }} />
      );
    }
  } else if (set.state === 6) {
    titleEnd = (
      <NotificationsActive
        fontSize="small"
        style={{ color: '#ffd500', marginLeft: '2px', marginRight: '-2px' }}
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
      <Stack direction="row" alignItems="center" gap="4px" width="100%">
        {titleStart}
        <Typography flexGrow={1} textAlign="center" variant="caption">
          {set.fullRoundText} ({set.identifier})
        </Typography>
        {titleEnd}
      </Stack>
      <Stack
        direction="row"
        alignItems="center"
        gap="8px"
        sx={{ typography: (theme) => theme.typography.body2 }}
        width="100%"
      >
        <Stack flexGrow={1}>
          <SetEntrant
            entrantName={set.entrant1Name}
            prereqStr={set.entrant1PrereqStr}
          />
          <SetEntrant
            entrantName={set.entrant2Name}
            prereqStr={set.entrant2PrereqStr}
          />
        </Stack>
        {set.state === 3 && (
          <Stack flexGrow={0}>
            <Box textAlign="end" width="16px">
              {entrant1Score}
            </Box>
            <Box textAlign="end" width="16px">
              {entrant2Score}
            </Box>
          </Stack>
        )}
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
  resolveConflict,
}: {
  set: RendererSet;
  conflictTransactionNum: number | null;
  reportSet: (set: RendererSet) => void;
  resolveConflict: (setId: number, transactionNum: number) => void;
}) {
  let backgroundColor: string | undefined;
  if (conflictTransactionNum !== null) {
    backgroundColor = '#ed6c02';
  } else if (set.state === 3) {
    backgroundColor = '#eeeeee';
  }
  return (
    <ListItemButton
      style={{
        backgroundColor,
        color: conflictTransactionNum !== null ? '#fff' : undefined,
        flexGrow: 0,
        opacity: '100%',
        padding: '8px',
        width: '228px',
      }}
      onClick={() => {
        if (conflictTransactionNum !== null) {
          resolveConflict(set.id, conflictTransactionNum);
        } else {
          reportSet(set);
        }
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
  resolveConflict,
}: {
  pool: RendererPool;
  conflict: RendererConflict | null;
  reportSet: (set: RendererSet) => void;
  resolveConflict: (setId: number, transactionNum: number) => void;
}) {
  const completedSets = pool.sets.filter((set) => set.state === 3);
  const openSets = pool.sets.filter((set) => set.state !== 3);
  const [open, setOpen] = useState(false);
  const [completedOpen, setCompletedOpen] = useState(openSets.length === 0);

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
        {completedSets.length > 0 && (
          <>
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
              {completedSets.length > 0 &&
                (completedOpen ? (
                  <Tooltip title="Hide completed sets">
                    <KeyboardArrowDown />
                  </Tooltip>
                ) : (
                  <Tooltip title="Show completed sets">
                    <KeyboardArrowRight />
                  </Tooltip>
                ))}
            </ListItemButton>
            <Collapse in={completedOpen}>
              <Stack
                direction="row"
                flexWrap="wrap"
                gap="8px"
                margin="8px 0 8px 16px"
              >
                {completedSets
                  .sort((a, b) => {
                    if (a.round === b.round) {
                      if (a.identifier.length === b.identifier.length) {
                        return a.identifier.localeCompare(b.identifier);
                      }
                      return a.identifier.length - b.identifier.length;
                    }
                    return a.ordinal - b.ordinal;
                  })
                  .map((set) => (
                    <SetListItemButton
                      key={set.id}
                      set={set}
                      conflictTransactionNum={
                        conflict && conflict.setId === set.id
                          ? conflict.transactionNum
                          : null
                      }
                      reportSet={reportSet}
                      resolveConflict={resolveConflict}
                    />
                  ))}
              </Stack>
            </Collapse>
          </>
        )}
        {pool.sets.length > 0 && (
          <Stack direction="row" flexWrap="wrap" gap="8px" marginLeft="16px">
            {openSets
              .sort((a, b) => {
                if (a.round === b.round) {
                  if (a.identifier.length === b.identifier.length) {
                    return a.identifier.localeCompare(b.identifier);
                  }
                  return a.identifier.length - b.identifier.length;
                }
                return a.ordinal - b.ordinal;
              })
              .map((set) => (
                <SetListItemButton
                  key={set.id}
                  set={set}
                  conflictTransactionNum={
                    conflict && conflict.setId === set.id
                      ? conflict.transactionNum
                      : null
                  }
                  reportSet={reportSet}
                  resolveConflict={resolveConflict}
                />
              ))}
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
  resolveConflict,
}: {
  phase: RendererPhase;
  conflict: RendererConflict | null;
  reportSet: (set: RendererSet) => void;
  resolveConflict: (setId: number, transactionNum: number) => void;
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
              reportSet={reportSet}
              resolveConflict={resolveConflict}
            />
          ))}
      </Collapse>
    </Box>
  );
}

function EventListItem({
  event,
  conflict,
  reportSet,
  resolveConflict,
  showError,
}: {
  event: RendererEvent;
  conflict: RendererConflict | null;
  reportSet: (set: RendererSet) => void;
  resolveConflict: (setId: number, transactionNum: number) => void;
  showError: (message: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  return (
    <>
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
      {event.phases.length > 0 &&
        event.phases.map((phase) => (
          <PhaseListItem
            key={phase.id}
            phase={phase}
            conflict={conflict}
            reportSet={reportSet}
            resolveConflict={resolveConflict}
          />
        ))}
    </>
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

  const [tournament, setTournament] = useState<RendererTournament | null>(null);
  useEffect(() => {
    window.electron.onAdminedTournaments((event, newAdminedTournaments) => {
      setAdminedTournaments(newAdminedTournaments);
    });
    window.electron.onTournament((event, newTournament) => {
      setTournament(newTournament);
    });
    const inner = async () => {
      const currentTournament = await window.electron.getCurrentTournament();
      if (currentTournament) {
        setTournament(currentTournament);
      }
    };
    inner();
  }, []);

  const [unloadedOpen, setUnloadedOpen] = useState(true);
  const unloadedEvents = tournament
    ? tournament.events.filter((event) => !event.isLoaded)
    : [];
  const loadedEvents = tournament
    ? tournament.events.filter((event) => event.isLoaded)
    : [];

  const [open, setOpen] = useState(false);
  const [settingTournament, setSettingTournament] = useState(false);
  const [error, setError] = useState('');
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const showError = (message: string) => {
    setError(message);
    setErrorDialogOpen(true);
  };
  const get = async (slug: string) => {
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
  const set = async (id: number, slug: string) => {
    setSettingTournament(true);
    await window.electron.setTournament(id, slug);
    setOpen(false);
    setSettingTournament(false);
  };

  const [stationStreamDialogOpen, setStationStreamDialogOpen] = useState(false);
  const [choosing, setChoosing] = useState(false);

  const [resetting, setResetting] = useState(false);
  const [starting, setStarting] = useState(false);

  const [reportSet, setReportSet] = useState<RendererSet | null>(null);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportWinnerId, setReportWinnerId] = useState(0);
  const [reportIsDq, setReportIsDq] = useState(false);
  const [reportEntrant1Score, setReportEntrant1Score] = useState(0);
  const [reportEntrant2Score, setReportEntrant2Score] = useState(0);
  const [reporting, setReporting] = useState(false);

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
  const openConflictDialog = async (setId: number, transactionNum: number) => {
    setConflictResolve(
      await window.electron.getConflictResolve(setId, transactionNum),
    );
    setConflictDialogOpen(true);
  };

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
                onClick={() => {
                  openConflictDialog(conflict.setId, conflict.transactionNum);
                }}
              >
                Conflict!
              </Button>
            )}
            <FatalError />
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
          {unloadedEvents.length > 0 &&
            (unloadedOpen ? (
              <Tooltip title="Hide unloaded events">
                <IconButton
                  onClick={() => {
                    setUnloadedOpen(false);
                  }}
                >
                  <VisibilityOff />
                </IconButton>
              </Tooltip>
            ) : (
              <Tooltip title="Show unloaded events">
                <IconButton
                  onClick={() => {
                    setUnloadedOpen(true);
                  }}
                >
                  <Visibility />
                </IconButton>
              </Tooltip>
            ))}
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
                      set={set}
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
                    await get(newSlug);
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
                    await get(adminedTournament.slug);
                  }}
                >
                  <ListItemText>{adminedTournament.name}</ListItemText>
                </ListItemButton>
              ))}
            </DialogContent>
          </Dialog>
        </Stack>
        {unloadedEvents.length > 0 && (
          <Collapse in={unloadedOpen}>
            <List>
              {unloadedEvents.map((event) => (
                <EventListItem
                  key={event.id}
                  event={event}
                  conflict={conflict}
                  reportSet={() => {}}
                  resolveConflict={() => {}}
                  showError={() => {}}
                />
              ))}
            </List>
          </Collapse>
        )}
        {loadedEvents.length > 0 && (
          <List>
            {loadedEvents.map((event) => (
              <EventListItem
                key={event.id}
                event={event}
                conflict={conflict}
                reportSet={(newReportSet: RendererSet) => {
                  setReportWinnerId(newReportSet.winnerId ?? 0);
                  setReportIsDq(
                    newReportSet.entrant1Score === -1 ||
                      newReportSet.entrant2Score === -1,
                  );
                  setReportEntrant1Score(newReportSet.entrant1Score ?? 0);
                  setReportEntrant2Score(newReportSet.entrant2Score ?? 0);
                  setReportSet(newReportSet);
                  setReportDialogOpen(true);
                }}
                resolveConflict={openConflictDialog}
                showError={showError}
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
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            padding="16px 24px"
          >
            <Typography variant="h6">
              {reportSet?.fullRoundText} ({reportSet?.identifier})
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
              <Typography variant="caption">({reportSet?.id})</Typography>
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
                  {reportSet?.entrant1Name}
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
                  {reportSet?.entrant2Name}
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
              disabled={choosing}
              size="small"
              onClick={async () => {
                setStationStreamDialogOpen(true);
              }}
            >
              {choosing ? <CircularProgress size="24px" /> : <Tv />}
            </IconButton>
            <IconButton
              color="error"
              disabled={reportSet?.state === 1 || resetting}
              onClick={async () => {
                setResetting(true);
                try {
                  await window.electron.resetSet(reportSet!.id);
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
                !(reportSet?.state === 1 || reportSet?.state === 6)
              }
              onClick={async () => {
                setStarting(true);
                try {
                  await window.electron.startSet(reportSet!.id);
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
                  await window.electron.reportSet(
                    reportSet!.id,
                    reportWinnerId,
                    reportIsDq,
                    reportGameData,
                  );
                  setReportDialogOpen(false);
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
                        await window.electron.assignSetStream(reportSet!.id, 0);
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
                              reportSet!.id,
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
                              reportSet!.id,
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
            spacing="8px"
          >
            <Typography variant="h6">Resolve Conflict:</Typography>
            <Typography variant="body1">
              {conflictResolve?.eventName}, {conflictResolve?.phaseName}, Pool{' '}
              {conflictResolve?.poolName}
            </Typography>
          </Stack>
          <DialogContent>
            {conflictResolve && (
              <Stack direction="row" spacing="32px" alignItems="start">
                <Stack spacing="16px" alignItems="start" flexShrink={0}>
                  <Box>
                    <Typography variant="body2">Server</Typography>
                    <SetListItemInner set={conflictResolve.serverSets[0]} />
                  </Box>
                  {conflictResolve.serverSets.length > 1 &&
                    conflictResolve.serverSets.slice(1).map((serverSet) => (
                      <Box>
                        <SetListItemInner key={serverSet.id} set={serverSet} />
                      </Box>
                    ))}
                  {conflictResolve.serverSets.length === 1 &&
                    conflictResolve.reason ===
                      ConflictReason.RESET_DEPENDENT_SETS && (
                      <Typography variant="caption">
                        Try reopening this dialog
                        <br />
                        to see dependent sets
                      </Typography>
                    )}
                </Stack>
                <Stack spacing="16px" alignItems="start" flexShrink={0}>
                  <div
                    style={{
                      backgroundColor: '#ed6c02',
                      color: '#fff',
                      margin: '-8px',
                      padding: '8px',
                    }}
                  >
                    <Typography variant="body2">
                      Local {getDescription(conflictResolve.localSets[0].type)}
                    </Typography>
                    <SetListItemInner set={conflictResolve.localSets[0].set} />
                  </div>
                  {conflictResolve.localSets.length > 1 &&
                    conflictResolve.localSets.slice(1).map((localSet) => (
                      <Box key={localSet.transactionNum}>
                        <Typography variant="body2">
                          Local {getDescription(localSet.type)}
                        </Typography>
                        <SetListItemInner set={localSet.set} />
                      </Box>
                    ))}
                </Stack>
                <Stack spacing="8px" alignItems="stretch">
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
                    <Button variant="contained">Report dependency sets</Button>
                  )}
                  {conflictResolve.reason ===
                    ConflictReason.UPDATE_CHANGE_WINNER && (
                    <Button
                      color="warning"
                      variant="contained"
                      onClick={() => {
                        if (conflict) {
                          window.electron.preemptReset(conflict.setId);
                          setConflictDialogOpen(false);
                        }
                      }}
                    >
                      Reset set
                    </Button>
                  )}
                  {conflictResolve.reason ===
                    ConflictReason.UPDATE_STAGE_DATA && (
                    <Typography variant="caption">
                      Would remove game/stage data
                    </Typography>
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
