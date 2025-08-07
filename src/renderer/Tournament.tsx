import {
  BackupOutlined,
  Close,
  CloudDone,
  CloudOff,
  Download,
  Edit,
  EmojiEvents,
  Group,
  HourglassTop,
  NotificationsActive,
  Refresh,
  RestartAlt,
  Router,
  Tv,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
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
  Tooltip,
  Typography,
} from '@mui/material';
import { FormEvent, useEffect, useState } from 'react';
import {
  AdminedTournament,
  ApiError,
  RendererEvent,
  RendererSet,
  RendererTournament,
} from '../common/types';
import ErrorDialog from './ErrorDialog';
import Settings from './Settings';
import IconButton from './IconButton';
import Sync from './Sync';
import Websocket from './Websocket';

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

function SetListItemButton({
  set,
  reportSet,
}: {
  set: RendererSet;
  reportSet: (set: RendererSet) => void;
}) {
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
    titleEnd = (
      <EmojiEvents
        fontSize="small"
        style={{ marginLeft: '3px', marginRight: '-3px' }}
      />
    );
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
    <ListItemButton
      disabled={!set.entrant1Name || !set.entrant2Name}
      style={{
        backgroundColor: set.state === 3 ? '#eeeeee' : undefined,
        flexGrow: 0,
        opacity: '100%',
        width: '232px',
      }}
      onClick={() => {
        reportSet(set);
      }}
    >
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
    </ListItemButton>
  );
}

function EventListItem({
  event,
  reportSet,
  showError,
}: {
  event: RendererEvent;
  reportSet: (set: RendererSet) => void;
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
          <Box key={phase.id} marginLeft="32px">
            <ListItem disablePadding>
              <ListItemText>
                {phase.name}{' '}
                <Typography variant="caption">({phase.id})</Typography>
              </ListItemText>
            </ListItem>
            {phase.pools.length > 0 &&
              phase.pools.map((pool) => (
                <Box key={pool.id} marginLeft="32px">
                  <ListItem disablePadding>
                    <ListItemText>
                      {pool.name}{' '}
                      <Typography variant="caption">({pool.id})</Typography>
                    </ListItemText>
                  </ListItem>
                  {pool.sets.length > 0 && (
                    <Stack
                      direction="row"
                      flexWrap="wrap"
                      gap="16px"
                      marginLeft="32px"
                    >
                      {pool.sets.map((set) => (
                        <SetListItemButton
                          key={set.id}
                          set={set}
                          reportSet={reportSet}
                        />
                      ))}
                    </Stack>
                  )}
                </Box>
              ))}
          </Box>
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
            onClick={async (ev) => {
              ev.stopPropagation();
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
    </ListItemButton>
  );
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
    } catch (e: any) {
      if (e instanceof ApiError) {
        if (e.status !== undefined) {
          if (
            e.status === 500 ||
            e.status === 502 ||
            e.status === 503 ||
            e.status === 504
          ) {
            setAdminedTournamentsError(
              `Failed to get tournaments from start.gg: ${e.status}. You may retry.`,
            );
          } else {
            setAdminedTournamentsError(
              `Failed to get tournaments from start.gg: ${e.status}.`,
            );
          }
        }
      } else {
        setAdminedTournamentsError(
          'Failed to get tournaments from start.gg. You may be offline.',
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

  return (
    <Stack>
      <Stack direction="row" alignItems="center">
        <InputBase
          disabled
          size="small"
          value={
            tournament
              ? `${tournament.slug} (${tournament.id})`
              : 'Set tournament'
          }
          style={{ flexGrow: 1, height: '48px' }}
        />
        <Tooltip placement="left" title="Set tournament">
          <IconButton
            onClick={() => {
              refresh();
              setOpen(true);
            }}
          >
            <Edit />
          </IconButton>
        </Tooltip>
      </Stack>
      <Stack direction="row" justifyContent="space-between" gap="8px">
        <Stack direction="row">
          <Sync />
          <Websocket />
        </Stack>
        <Settings />
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
                <Box sx={{ typography: (theme) => theme.typography.subtitle2 }}>
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
                endIcon={settingTournament && <CircularProgress size="24px" />}
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
      {tournament && tournament.events.length > 0 && (
        <List>
          {tournament.events.map((event) => (
            <EventListItem
              key={event.id}
              event={event}
              reportSet={(newReportSet: RendererSet) => {
                setReportWinnerId(0);
                setReportIsDq(false);
                setReportEntrant1Score(newReportSet.entrant1Score ?? 0);
                setReportEntrant2Score(newReportSet.entrant2Score ?? 0);
                setReportSet(newReportSet);
                setReportDialogOpen(true);
              }}
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
                disabled={reportSet?.state === 3}
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
                disabled={reportSet?.state === 3}
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
                disabled={reportSet?.state === 3}
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
                disabled={reportSet?.state === 3}
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
                disabled={reportSet?.state === 3}
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
                disabled={reportSet?.state === 3}
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
                disabled={reportSet?.state === 3}
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
                disabled={reportSet?.state === 3}
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
                disabled={reportSet?.state === 3}
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
                disabled={reportSet?.state === 3}
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
                disabled={reportSet?.state === 3}
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
                disabled={reportSet?.state === 3}
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
              starting || !(reportSet?.state === 1 || reportSet?.state === 6)
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
            disabled={reportSet?.state === 3 || reporting || !reportWinnerId}
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
                <ListItemText style={{ padding: '12px 0', margin: '8px 0 0' }}>
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
      <ErrorDialog
        open={errorDialogOpen}
        error={error}
        close={() => {
          setErrorDialogOpen(false);
        }}
      />
    </Stack>
  );
}
