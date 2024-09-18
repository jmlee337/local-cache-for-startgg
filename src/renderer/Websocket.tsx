import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  Stack,
} from '@mui/material';
import { WebsocketStatus } from '../common/types';

export default function Websocket() {
  const [open, setOpen] = useState(false);
  const [websocketStatus, setWebsocketStatus] = useState<WebsocketStatus>({
    err: '',
    port: 0,
  });
  useEffect(() => {
    window.electron.onWebsocketStatus((event, newWebsocketStatus) => {
      setWebsocketStatus(newWebsocketStatus);
      if (!newWebsocketStatus.err && newWebsocketStatus.port === 0) {
        setOpen(false);
      }
    });
    const inner = async () => {
      const websocketStatusPromise = window.electron.getWebsocketStatus();
      setWebsocketStatus(await websocketStatusPromise);
    };
    inner();
  }, []);

  let websocketButton;
  if (websocketStatus.err) {
    websocketButton = (
      <Button
        color="error"
        variant="text"
        onClick={() => {
          setOpen(true);
        }}
      >
        Websocket Error
      </Button>
    );
  } else if (websocketStatus.port) {
    websocketButton = (
      <Button
        variant="text"
        onClick={() => {
          setOpen(true);
        }}
      >
        Websocket Port: {websocketStatus.port}
      </Button>
    );
  }
  return (
    <Stack direction="row" alignItems="center">
      {websocketButton}
      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
        }}
      >
        <DialogTitle>
          {websocketStatus.err ? 'Websocket Error' : 'Websocket Running'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ typography: (theme) => theme.typography.body2 }}>
            {websocketStatus.err
              ? websocketStatus.err
              : `ws://localhost:${websocketStatus.port}`}
          </Box>
        </DialogContent>
      </Dialog>
    </Stack>
  );
}
