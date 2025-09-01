import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import {
  CloudDownload,
  ContentCopy,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { lt } from 'semver';
import IconButton from './IconButton';

export default function Settings({
  showError,
}: {
  showError: (message: string) => void;
}) {
  const [apiKey, setApiKey] = useState('');
  const [autoSync, setAutoSync] = useState(true);
  const [websocket, setWebsocket] = useState(true);
  const [appVersion, setAppVersion] = useState('');
  const [versionLatest, setVersionLatest] = useState('');
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const inner = async () => {
      const apiKeyPromise = window.electron.getApiKey();
      const autoSyncPromise = window.electron.getAutoSync();
      const websocketPromise = window.electron.getWebsocket();
      const appVersionPromise = window.electron.getAppVersion();
      const versionLatestPromise = window.electron.getVersionLatest();

      const initApiKey = await apiKeyPromise;
      setApiKey(initApiKey);
      setAutoSync(await autoSyncPromise);
      setWebsocket(await websocketPromise);

      const initAppVersion = await appVersionPromise;
      const initVersionLatest = await versionLatestPromise;
      setAppVersion(initAppVersion);
      setVersionLatest(initVersionLatest);
      if (
        !initApiKey ||
        (initVersionLatest && lt(initAppVersion, initVersionLatest))
      ) {
        setOpen(true);
      }
    };
    inner();
  }, []);

  return (
    <>
      <Tooltip placement="left" title="Settings">
        <IconButton
          onClick={() => {
            setOpen(true);
          }}
        >
          <SettingsIcon />
        </IconButton>
      </Tooltip>
      <Dialog
        fullWidth
        open={open}
        onClose={async () => {
          try {
            await window.electron.setApiKey(apiKey);
            setOpen(false);
          } catch (e: any) {
            showError((e as Error).message);
          }
        }}
      >
        <Stack
          alignItems="center"
          direction="row"
          justifyContent="space-between"
          marginRight="24px"
        >
          <DialogTitle>Settings</DialogTitle>
          <Typography variant="caption">
            Offline Mode for start.gg v{appVersion}
          </Typography>
        </Stack>
        <DialogContent>
          <DialogContentText>
            Get your start.gg API key by clicking “Create new token” in the
            <br />
            “Personal Access Tokens” tab of{' '}
            <a
              href="https://start.gg/admin/profile/developer"
              target="_blank"
              rel="noreferrer"
            >
              this page
            </a>
            . Keep it private!
          </DialogContentText>
          <Stack alignItems="center" direction="row" gap="8px">
            <TextField
              autoFocus
              fullWidth
              label="start.gg API key (Keep it private!)"
              onChange={(event) => {
                setApiKey(event.target.value);
              }}
              size="small"
              type="password"
              value={apiKey}
              variant="standard"
            />
            <Button
              disabled={copied}
              endIcon={copied ? undefined : <ContentCopy />}
              onClick={async () => {
                await window.electron.copy(apiKey);
                setCopied(true);
                setTimeout(() => setCopied(false), 5000);
              }}
              variant="contained"
            >
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          </Stack>
          <FormControlLabel
            label={
              autoSync
                ? 'Auto sync (will sync with start.gg when possible)'
                : 'Manual sync (will sync with start.gg only when asked)'
            }
            control={
              <Switch
                checked={autoSync}
                onChange={async (event) => {
                  const newAutoSync = event.target.checked;
                  await window.electron.setAutoSync(newAutoSync);
                  setAutoSync(newAutoSync);
                }}
              />
            }
          />
          <FormControlLabel
            label={
              websocket
                ? 'Websocket server (enabled)'
                : 'Websocket server (disabled)'
            }
            control={
              <Switch
                checked={websocket}
                onChange={async (event) => {
                  const newWebsocket = event.target.checked;
                  await window.electron.setWebsocket(newWebsocket);
                  setWebsocket(newWebsocket);
                }}
              />
            }
          />
          {appVersion && versionLatest && lt(appVersion, versionLatest) && (
            <Alert
              severity="warning"
              style={{ marginTop: '8px' }}
              action={
                <Button
                  endIcon={<CloudDownload />}
                  variant="contained"
                  onClick={() => {
                    window.electron.update();
                  }}
                >
                  Quit and download
                </Button>
              }
            >
              Update available! v{versionLatest}
            </Alert>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
