import { useMemo, useState } from 'react';
import { ContentCopy } from '@mui/icons-material';
import {
  Button,
  Tooltip,
  Stack,
  TextField,
  DialogContentText,
} from '@mui/material';
import { WebsocketStatus } from '../common/types';
import WebsocketAddresses from './WebsocketAddresses';

export default function WebsocketAdmin({
  websocketPassword,
  setWebsocketPassword,
  websocketStatus,
}: {
  websocketPassword: string;
  setWebsocketPassword: (websocketPassword: string) => void;
  websocketStatus: WebsocketStatus;
}) {
  const [passwordCopied, setPasswordCopied] = useState(false);
  const [generated, setGenerated] = useState(false);

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
  }, [generated, setWebsocketPassword, websocketStatus.port]);

  return (
    <>
      <DialogContentText marginBottom="8px">
        Admins can report sets in any pool
      </DialogContentText>
      <WebsocketAddresses websocketStatus={websocketStatus} path="admin" />
      <Stack alignItems="center" direction="row" gap="8px">
        <TextField
          label="Admin Password"
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
    </>
  );
}
