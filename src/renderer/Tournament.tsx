import { Download, Group, Router } from '@mui/icons-material';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
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
  RendererTournament,
} from '../common/types';
import ErrorDialog from './ErrorDialog';
import Settings from './Settings';

function EventListItem({
  event,
  showError,
}: {
  event: RendererEvent;
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
            <EventListItem key={event.id} event={event} showError={showError} />
          ))}
        </List>
      )}
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
