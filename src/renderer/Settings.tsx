import {
  Button,
  Dialog,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { ContentCopy, Settings as SettingsIcon } from '@mui/icons-material';

export default function Settings() {
  const [apiKey, setApiKey] = useState('');
  const [appVersion, setAppVersion] = useState('');
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const inner = async () => {
      const apiKeyPromise = window.electron.getApiKey();
      const appVersionPromise = window.electron.getAppVersion();

      const initApiKey = await apiKeyPromise;
      setApiKey(initApiKey);
      setAppVersion(await appVersionPromise);

      if (!initApiKey) {
        setOpen(true);
      }
    };
    inner();
  }, []);

  return (
    <>
      <Button
        endIcon={<SettingsIcon />}
        variant="contained"
        onClick={() => {
          setOpen(true);
        }}
      >
        Settings
      </Button>
      <Dialog
        fullWidth
        open={open}
        onClose={async () => {
          await window.electron.setApiKey(apiKey);
          setOpen(false);
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
            Replay Manager for Slippi version {appVersion}
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
        </DialogContent>
      </Dialog>
    </>
  );
}
