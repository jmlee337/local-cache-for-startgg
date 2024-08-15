import { Edit } from '@mui/icons-material';
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
} from '@mui/material';
import { FormEvent, useEffect, useState } from 'react';
import { AdminedTournament, RendererTournament } from '../common/types';

export default function Tournament() {
  const [adminedTournaments, setAdminedTournaments] = useState<
    AdminedTournament[]
  >([]);
  const [gettingAdminedTournaments, setGettingAdminedTournaments] =
    useState(true);
  const [tournament, setTournament] = useState<RendererTournament>({
    slug: '',
    name: '',
    events: [],
  });
  useEffect(() => {
    window.electron.onTournament((event, newTournament) => {
      setTournament(newTournament);
    });
    const inner = async () => {
      setAdminedTournaments(await window.electron.getAdminedTournaments());
      setGettingAdminedTournaments(false);
    };
    inner();
  }, []);

  const [open, setOpen] = useState(false);
  const [settingTournament, setSettingTournament] = useState(false);
  const set = async (slug: string) => {
    setSettingTournament(true);
    try {
      await window.electron.setTournament(slug);
      setOpen(false);
    } catch {
      console.error('not found');
    } finally {
      setSettingTournament(false);
    }
  };

  return (
    <Box>
      <Stack direction="row">
        <InputBase
          disabled
          size="small"
          value={tournament.slug || 'Set tournament'}
          style={{ flexGrow: 1 }}
        />
        <Tooltip arrow title="Set start.gg tournament">
          <IconButton
            aria-label="Set start.gg tournament"
            onClick={() => setOpen(true)}
          >
            <Edit />
          </IconButton>
        </Tooltip>
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
      {tournament.events.length > 0 && (
        <List>
          {tournament.events.map((event) => (
            <ListItem key={event.id} disableGutters>
              <ListItemText>{event.name}</ListItemText>
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
}
