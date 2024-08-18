import { Download, Group, Router } from '@mui/icons-material';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
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
  RendererEvent,
  RendererSet,
  RendererTournament,
} from '../common/types';
import ErrorDialog from './ErrorDialog';
import Settings from './Settings';

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
      width="144px"
      color={secondary ? '#757575' : undefined}
      fontWeight={secondary ? undefined : 500}
    >
      {text}
    </Box>
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
                        <ListItemButton
                          key={set.id}
                          disabled={
                            set.state === 3 ||
                            !set.entrant1Name ||
                            !set.entrant2Name
                          }
                          style={{
                            flexGrow: 0,
                            opacity: '100%',
                          }}
                          onClick={() => {
                            reportSet(set);
                          }}
                        >
                          <Stack alignItems="center">
                            <Typography variant="caption">
                              {set.fullRoundText} ({set.identifier})
                            </Typography>
                            <Stack
                              direction="row"
                              alignItems="center"
                              gap="8px"
                              typography="body2"
                            >
                              <Stack>
                                <SetEntrant
                                  entrantName={set.entrant1Name}
                                  prereqStr={set.entrant1PrereqStr}
                                />
                                <SetEntrant
                                  entrantName={set.entrant2Name}
                                  prereqStr={set.entrant2PrereqStr}
                                />
                              </Stack>
                              <Stack>
                                <Box textAlign="end" width="16px">
                                  {(set.entrant1Score ??
                                    (set.state === 3 &&
                                      (set.winnerId === set.entrant1Id
                                        ? 'W'
                                        : 'L'))) ||
                                    '\u00A0'}
                                </Box>
                                <Box textAlign="end" width="16px">
                                  {(set.entrant2Score ??
                                    (set.state === 3 &&
                                      (set.winnerId === set.entrant2Id
                                        ? 'W'
                                        : 'L'))) ||
                                    '\u00A0'}
                                </Box>
                              </Stack>
                            </Stack>
                          </Stack>
                        </ListItemButton>
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

export default function Tournament() {
  const [adminedTournaments, setAdminedTournaments] = useState<
    AdminedTournament[]
  >([]);
  const [gettingAdminedTournaments, setGettingAdminedTournaments] =
    useState(true);
  const [tournament, setTournament] = useState<RendererTournament | null>(null);
  useEffect(() => {
    window.electron.onAdminedTournaments((event, newAdminedTournaments) => {
      setAdminedTournaments(newAdminedTournaments);
    });
    window.electron.onTournament((event, newTournament) => {
      setTournament(newTournament);
    });
    const inner = async () => {
      const adminedTournamentsPromise = window.electron.getAdminedTournaments();
      const currentTournamentPromise = window.electron.getCurrentTournament();
      setAdminedTournaments(await adminedTournamentsPromise);
      setGettingAdminedTournaments(false);
      const currentTournament = await currentTournamentPromise;
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
  const set = async (slug: string) => {
    setSettingTournament(true);
    try {
      await window.electron.setTournament(slug);
      setOpen(false);
    } catch (e: any) {
      const message = e instanceof Error ? e.message : e;
      showError(message);
    } finally {
      setSettingTournament(false);
    }
  };

  const [reportSet, setReportSet] = useState<RendererSet | null>(null);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportWinnerId, setReportWinnerId] = useState(0);
  const [reportLoserId, setReportLoserId] = useState(0);
  const [reportIsDq, setReportIsDq] = useState(false);
  const [reporting, setReporting] = useState(false);
  return (
    <Stack>
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
      <Stack direction="row" justifyContent="space-between" gap="8px">
        <Button
          variant="contained"
          onClick={() => {
            setOpen(true);
          }}
        >
          Set tournament
        </Button>
        <Settings />
        <Dialog
          open={open}
          onClose={() => {
            setOpen(false);
          }}
        >
          <DialogTitle>Set tournament</DialogTitle>
          <DialogContent>
            <form
              style={{
                alignItems: 'center',
                display: 'flex',
                marginTop: '8px',
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
                  await set(newSlug);
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
            {gettingAdminedTournaments ? (
              <Stack direction="row" marginTop="8px" spacing="8px">
                <CircularProgress size="24px" />
                <DialogContentText>
                  Getting admined tournaments...
                </DialogContentText>
              </Stack>
            ) : (
              adminedTournaments.map((adminedTournament) => (
                <ListItemButton
                  key={adminedTournament.slug}
                  onClick={async () => {
                    await set(adminedTournament.slug);
                  }}
                >
                  <ListItemText>{adminedTournament.name}</ListItemText>
                </ListItemButton>
              ))
            )}
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
                setReportSet(newReportSet);
                setReportDialogOpen(true);
              }}
              showError={showError}
            />
          ))}
        </List>
      )}
      <Dialog
        fullWidth
        open={reportDialogOpen}
        onClose={() => {
          setReportDialogOpen(false);
        }}
      >
        <DialogContent>
          <Stack alignItems="center" typography="body2">
            <Box>
              {reportSet?.fullRoundText} ({reportSet?.identifier})
            </Box>
            <Stack direction="row" alignItems="center">
              <Box
                overflow="hidden"
                textOverflow="ellipsis"
                whiteSpace="nowrap"
                width="288px"
              >
                {reportSet?.entrant1Name}
              </Box>
              <Button
                variant={
                  reportIsDq && reportLoserId === reportSet?.entrant1Id
                    ? 'contained'
                    : 'outlined'
                }
                onClick={() => {
                  setReportLoserId(reportSet!.entrant1Id!);
                  setReportWinnerId(reportSet!.entrant2Id!);
                  setReportIsDq(true);
                }}
              >
                DQ
              </Button>
              <Button
                variant={
                  !reportIsDq && reportWinnerId === reportSet?.entrant1Id
                    ? 'contained'
                    : 'outlined'
                }
                onClick={() => {
                  setReportWinnerId(reportSet!.entrant1Id!);
                  setReportLoserId(reportSet!.entrant2Id!);
                  setReportIsDq(false);
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
                width="288px"
              >
                {reportSet?.entrant2Name}
              </Box>
              <Button
                variant={
                  reportIsDq && reportLoserId === reportSet?.entrant2Id
                    ? 'contained'
                    : 'outlined'
                }
                onClick={() => {
                  setReportLoserId(reportSet!.entrant2Id!);
                  setReportWinnerId(reportSet!.entrant1Id!);
                  setReportIsDq(true);
                }}
              >
                DQ
              </Button>
              <Button
                variant={
                  !reportIsDq && reportWinnerId === reportSet?.entrant2Id
                    ? 'contained'
                    : 'outlined'
                }
                onClick={() => {
                  setReportWinnerId(reportSet!.entrant2Id!);
                  setReportLoserId(reportSet!.entrant1Id!);
                  setReportIsDq(false);
                }}
              >
                W
              </Button>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            variant="contained"
            disabled={reporting}
            endIcon={reporting ? <CircularProgress size="24px" /> : undefined}
            onClick={async () => {
              setReporting(true);
              try {
                let entrant1Score: number | null = null;
                let entrant2Score: number | null = null;
                if (reportIsDq) {
                  entrant1Score =
                    reportSet!.entrant1Id === reportWinnerId ? 0 : -1;
                  entrant2Score =
                    reportSet!.entrant2Id === reportWinnerId ? 0 : -1;
                }
                await window.electron.reportSet(
                  reportSet!.id,
                  reportWinnerId,
                  reportLoserId,
                  entrant1Score,
                  entrant2Score,
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
