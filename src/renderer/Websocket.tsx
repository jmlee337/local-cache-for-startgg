import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
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
  Tab,
  Tabs,
  Tooltip,
} from '@mui/material';
import { VerifiedUser } from '@mui/icons-material';
import { Protocol, RendererTournament, WebsocketStatus } from '../common/types';
import WebsocketReporters from './WebsocketReporters';
import WebsocketApps from './WebsocketApps';
import WebsocketAdmin from './WebsocketAdmin';
import WebsocketAddresses from './WebsocketAddresses';

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

export default function Websocket({
  tournament,
  websocketStatus,
}: {
  tournament: RendererTournament | undefined;
  websocketStatus: WebsocketStatus;
}) {
  const [open, setOpen] = useState(false);
  const [websocketEnabled, setWebsocketEnabled] = useState(false);
  const [websocketPassword, setWebsocketPassword] = useState('');
  const [tabId, setTabId] = useState(1);

  useEffect(() => {
    const inner = async () => {
      const websocketEnabledPromise = window.electron.getWebsocket();
      const websocketPasswordPromise = window.electron.getWebsocketPassword();
      setWebsocketEnabled(await websocketEnabledPromise);
      setWebsocketPassword(await websocketPasswordPromise);
    };
    inner();
  }, []);

  const websocketTitle = useMemo(() => {
    let title = 'Remote access disabled';
    if (websocketStatus.err) {
      title = 'Remote access error!';
    } else if (websocketStatus.port) {
      title = 'Remote access enabled';
    }
    return title;
  }, [websocketStatus]);

  const websocketButton = useMemo(() => {
    return (
      <Tooltip title={websocketTitle}>
        <IconButton
          color={websocketStatus.err ? 'error' : 'default'}
          onClick={() => {
            setOpen(true);
          }}
        >
          <VerifiedUser />
        </IconButton>
      </Tooltip>
    );
  }, [websocketStatus, websocketTitle]);

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
        <DialogContent style={{ paddingTop: 0 }}>
          {websocketStatus.err && (
            <Alert severity="error" style={{ marginTop: '8px' }}>
              {websocketStatus.err}
            </Alert>
          )}
          <Tabs
            value={tabId}
            variant="fullWidth"
            style={{ marginBottom: '8px' }}
            onChange={(event, value: any) => {
              if (Number.isInteger(value)) {
                setTabId(value);
              }
            }}
          >
            <Tab label="Apps" value={1} id="tab-1" aria-controls="tabpanel-1" />
            <Tab
              label="Admin"
              value={3}
              id="tab-3"
              aria-controls="tabpanel-3"
            />
            <Tab
              label="Reporters"
              value={2}
              id="tab-2"
              aria-controls="tabpanel-2"
            />
            <Tab
              label="Public"
              value={4}
              id="tab-4"
              aria-controls="tabpanel-4"
            />
          </Tabs>
          <div
            role="tabpanel"
            hidden={tabId !== 1}
            id="tabpanel-1"
            aria-labelledby="tab-1"
          >
            <WebsocketApps
              websocketPassword={websocketPassword}
              setWebsocketPassword={setWebsocketPassword}
              websocketStatus={websocketStatus}
            />
          </div>
          <div
            role="tabpanel"
            hidden={tabId !== 3}
            id="tabpanel-3"
            aria-labelledby="tab-3"
          >
            <WebsocketAdmin
              websocketPassword={websocketPassword}
              setWebsocketPassword={setWebsocketPassword}
              websocketStatus={websocketStatus}
            />
          </div>
          <div
            role="tabpanel"
            hidden={tabId !== 2}
            id="tabpanel-2"
            aria-labelledby="tab-2"
          >
            <WebsocketReporters
              events={tournament?.events ?? []}
              reporters={tournament?.reporters ?? []}
              websocketStatus={websocketStatus}
            />
          </div>
          <div
            role="tabpanel"
            hidden={tabId !== 4}
            id="tabpanel-4"
            aria-labelledby="tab-4"
          >
            <WebsocketAddresses websocketStatus={websocketStatus} path="" />
          </div>
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
        </DialogContent>
      </Dialog>
    </>
  );
}
