import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
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
import { Protocol, WebsocketStatus } from '../common/types';

function protocolToDesc(protocol: Protocol) {
  switch (protocol) {
    case Protocol.ADMIN:
      return 'Admin';
    case Protocol.REPORTER:
      return 'Reporter';
    case Protocol.PUBLIC:
      return 'Public';
    default:
      throw new Error('unreachable');
  }
}

export default function Websocket() {
  const [open, setOpen] = useState(false);
  const [websocketEnabled, setWebsocketEnabled] = useState(false);
  const [websocketPassword, setWebsocketPassword] = useState('');
  const [websocketStatus, setWebsocketStatus] = useState<WebsocketStatus>({
    err: '',
    host: '',
    v4Address: '',
    v6Address: '',
    port: 0,
    connections: [],
  });
  const [passwordCopied, setPasswordCopied] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [hostCopied, setHostCopied] = useState(false);
  const [v4Copied, setV4Copied] = useState(false);
  const [v6Copied, setV6Copied] = useState(false);

  const hostContent = useMemo(
    () => (websocketStatus.host ? `http://${websocketStatus.host}` : ''),
    [websocketStatus.host],
  );
  const v4AddressContent = useMemo(
    () =>
      websocketStatus.v4Address ? `http://${websocketStatus.v4Address}` : '',
    [websocketStatus.v4Address],
  );
  const v6AddressContent = useMemo(
    () =>
      websocketStatus.v6Address ? `http://[${websocketStatus.v6Address}]` : '',
    [websocketStatus.v6Address],
  );

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
      title = 'Websocket running';
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
              label="Websocket Password"
              size="small"
              style={{ flexGrow: 1 }}
              type="password"
              value={websocketPassword}
              variant="standard"
            />
            {generateButton}
            <Button
              disabled={passwordCopied}
              endIcon={passwordCopied ? undefined : <ContentCopy />}
              onClick={async () => {
                await window.electron.copy(websocketPassword);
                setPasswordCopied(true);
                setTimeout(() => setPasswordCopied(false), 5000);
              }}
              variant="contained"
            >
              {passwordCopied ? 'Copied!' : 'Copy'}
            </Button>
          </Stack>
          <Stack alignItems="center" direction="row" gap="8px">
            <TextField
              disabled={!websocketStatus.host}
              label="Hostname"
              size="small"
              style={{ flexGrow: 1 }}
              value={websocketStatus.host}
              variant="standard"
            />
            <Button
              disabled={hostCopied || !hostContent}
              endIcon={hostCopied ? undefined : <ContentCopy />}
              onClick={async () => {
                await window.electron.copy(hostContent);
                setHostCopied(true);
                setTimeout(() => setHostCopied(false), 5000);
              }}
              variant="contained"
            >
              {hostCopied ? 'Copied!' : 'Copy'}
            </Button>
          </Stack>
          <Stack alignItems="center" direction="row" gap="8px">
            <TextField
              disabled={!websocketStatus.v6Address}
              label="Websocket Address (IPv6)"
              size="small"
              style={{ flexGrow: 1 }}
              value={websocketStatus.v6Address}
              variant="standard"
            />
            <Button
              disabled={v6Copied || !v6AddressContent}
              endIcon={v6Copied ? undefined : <ContentCopy />}
              onClick={async () => {
                await window.electron.copy(v6AddressContent);
                setV6Copied(true);
                setTimeout(() => setV6Copied(false), 5000);
              }}
              variant="contained"
            >
              {v6Copied ? 'Copied!' : 'Copy'}
            </Button>
          </Stack>
          <Stack alignItems="center" direction="row" gap="8px">
            <TextField
              disabled={!websocketStatus.v4Address}
              label="Websocket Address (IPv4)"
              size="small"
              style={{ flexGrow: 1 }}
              value={websocketStatus.v4Address}
              variant="standard"
            />
            <Button
              disabled={v4Copied || !v4AddressContent}
              endIcon={v4Copied ? undefined : <ContentCopy />}
              onClick={async () => {
                await window.electron.copy(v4AddressContent);
                setV4Copied(true);
                setTimeout(() => setV4Copied(false), 5000);
              }}
              variant="contained"
            >
              {v4Copied ? 'Copied!' : 'Copy'}
            </Button>
          </Stack>
          {websocketEnabled &&
            websocketStatus.port !== 0 &&
            websocketStatus.connections.length > 0 && (
              <List disablePadding style={{ margin: '8px 0' }}>
                {websocketStatus.connections.map((connection) => (
                  <ListItem disablePadding key={connection.addressPort}>
                    <ListItemText>
                      {protocolToDesc(connection.protocol)}
                      {connection.computerName
                        ? ` - ${connection.computerName}`
                        : ''}
                      {connection.clientName
                        ? ` - ${connection.clientName}`
                        : ''}{' '}
                      - {connection.addressPort}
                    </ListItemText>
                  </ListItem>
                ))}
              </List>
            )}
          {websocketStatus.err && (
            <Alert severity="error" style={{ marginTop: '8px' }}>
              {websocketStatus.err}
            </Alert>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
