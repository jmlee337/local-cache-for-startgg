import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Stack,
  Switch,
  TextField,
  Tooltip,
} from '@mui/material';
import { ContentCopy, LeakAdd, LeakRemove } from '@mui/icons-material';
import { WebsocketStatus } from '../common/types';

export default function Websocket() {
  const [open, setOpen] = useState(false);
  const [websocketEnabled, setWebsocketEnabled] = useState(false);
  const [websocketPassword, setWebsocketPassword] = useState('');
  const [websocketStatus, setWebsocketStatus] = useState<WebsocketStatus>({
    err: '',
    port: 0,
    connections: [],
  });
  const [copied, setCopied] = useState(false);
  const [generated, setGenerated] = useState(false);
  useEffect(() => {
    window.electron.onWebsocketStatus((event, newWebsocketStatus) => {
      setWebsocketStatus(newWebsocketStatus);
    });
    const inner = async () => {
      const websocketEnabledPromise = window.electron.getWebsocket();
      const websocketPasswordPromise = window.electron.getWebsocketPassword();
      const websocketStatusPromise = window.electron.getWebsocketStatus();
      setWebsocketEnabled(await websocketEnabledPromise);
      setWebsocketPassword(await websocketPasswordPromise);
      setWebsocketStatus(await websocketStatusPromise);
    };
    inner();
  }, []);

  const websocketTitle = useMemo(() => {
    let title = 'Websocket disabled';
    if (websocketStatus.err) {
      title = 'Websocket error!';
    } else if (websocketStatus.port) {
      title = `Websocket running on port ${websocketStatus.port}`;
    }
    return title;
  }, [websocketStatus]);

  const websocketButton = useMemo(() => {
    return (
      <Tooltip title={websocketTitle}>
        <IconButton
          color={websocketStatus.err ? 'error' : 'primary'}
          onClick={() => {
            setOpen(true);
          }}
        >
          {websocketStatus.err || websocketStatus.port ? (
            <LeakAdd />
          ) : (
            <LeakRemove />
          )}
        </IconButton>
      </Tooltip>
    );
  }, [websocketStatus, websocketTitle]);

  const generateButton = useMemo(() => {
    const buttonInner = (
      <Button
        disabled={websocketStatus.port > 0}
        onClick={async () => {
          setWebsocketPassword(await window.electron.resetWebsocketPassword());
          setGenerated(true);
          setTimeout(() => setGenerated(false), 5000);
        }}
        variant="contained"
      >
        {generated ? 'New!' : 'New'}
      </Button>
    );
    if (websocketStatus.port) {
      return (
        <Tooltip title="Must stop websocket server to generate new password">
          <div>{buttonInner}</div>
        </Tooltip>
      );
    }
    return buttonInner;
  }, [generated, websocketStatus.port]);
  return (
    <>
      {websocketButton}
      <Dialog
        fullWidth
        open={open}
        onClose={() => {
          setOpen(false);
        }}
      >
        <Stack
          alignItems="center"
          direction="row"
          justifyContent="space-between"
          marginRight="24px"
        >
          <DialogTitle>{websocketTitle}</DialogTitle>
          <FormControlLabel
            label={websocketEnabled ? 'Enabled' : 'Disabled'}
            labelPlacement="start"
            control={
              <Switch
                checked={websocketEnabled}
                onChange={async (event) => {
                  const newWebsocketEnabled = event.target.checked;
                  await window.electron.setWebsocket(newWebsocketEnabled);
                  setWebsocketEnabled(newWebsocketEnabled);
                }}
              />
            }
          />
        </Stack>
        <DialogContent style={{ paddingTop: '8px' }}>
          <Stack alignItems="center" direction="row" gap="8px">
            <TextField
              autoFocus
              fullWidth
              label="Websocket Password"
              size="small"
              type="password"
              value={websocketPassword}
              variant="standard"
            />
            <Button
              disabled={copied}
              endIcon={copied ? undefined : <ContentCopy />}
              onClick={async () => {
                await window.electron.copy(websocketPassword);
                setCopied(true);
                setTimeout(() => setCopied(false), 5000);
              }}
              variant="contained"
            >
              {copied ? 'Copied!' : 'Copy'}
            </Button>
            {generateButton}
          </Stack>
          {websocketEnabled &&
            websocketStatus.port &&
            websocketStatus.connections.length > 0 && (
              <List disablePadding style={{ margin: '8px 0' }}>
                {websocketStatus.connections.map((connection) => (
                  <ListItem disablePadding>
                    <ListItemText>{connection}</ListItemText>
                  </ListItem>
                ))}
              </List>
            )}
        </DialogContent>
      </Dialog>
    </>
  );
}
