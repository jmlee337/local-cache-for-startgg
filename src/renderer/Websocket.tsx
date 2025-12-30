import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Tooltip,
} from '@mui/material';
import { LeakAdd, LeakRemove } from '@mui/icons-material';
import { WebsocketStatus } from '../common/types';

export default function Websocket() {
  const [open, setOpen] = useState(false);
  const [websocketStatus, setWebsocketStatus] = useState<WebsocketStatus>({
    err: '',
    port: 0,
    connections: [],
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

  const websocketButton = useMemo(() => {
    if (websocketStatus.err) {
      return (
        <Tooltip title="Websocket error!">
          <IconButton
            color="error"
            onClick={() => {
              setOpen(true);
            }}
          >
            <LeakRemove />
          </IconButton>
        </Tooltip>
      );
    }
    if (websocketStatus.port) {
      return (
        <Tooltip title="Websocket running">
          <IconButton
            color="primary"
            onClick={() => {
              setOpen(true);
            }}
          >
            <LeakAdd />
          </IconButton>
        </Tooltip>
      );
    }
    return (
      <Tooltip title="Websocket disabled">
        <span>
          <IconButton disabled>
            <LeakRemove />
          </IconButton>
        </span>
      </Tooltip>
    );
  }, [websocketStatus]);
  return (
    <>
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
          <DialogContentText>
            {websocketStatus.err
              ? websocketStatus.err
              : `ws://localhost:${websocketStatus.port}`}
          </DialogContentText>
          {websocketStatus.port && websocketStatus.connections.length > 0 && (
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
