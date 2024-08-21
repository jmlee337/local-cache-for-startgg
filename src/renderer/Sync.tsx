import { Box, Button, Dialog, DialogContent, DialogTitle } from '@mui/material';
import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { SyncResult } from '../common/types';

const ERROR_THRESHOLD_MS = 4000;
export default function Sync() {
  const [syncResult, setSyncResult] = useState<SyncResult>({
    success: true,
    errorSinceMs: 0,
    lastError: '',
    lastErrorMs: 0,
    lastSuccessMs: 0,
  });
  useEffect(() => {
    window.electron.onSyncResult((event, newSyncResult) => {
      setSyncResult(newSyncResult);
    });
    const inner = async () => {
      setSyncResult(await window.electron.getSyncResult());
    };
    inner();
  }, []);
  const success =
    syncResult.success ||
    syncResult.lastErrorMs - syncResult.errorSinceMs < ERROR_THRESHOLD_MS;

  const [open, setOpen] = useState(false);
  let syncButton = <Button disabled variant="text" />;
  if (
    syncResult.lastSuccessMs ||
    syncResult.lastErrorMs - syncResult.errorSinceMs >= ERROR_THRESHOLD_MS
  ) {
    if (success) {
      syncButton = (
        <Button
          style={{ marginLeft: '-8px' }}
          variant="text"
          onClick={() => {
            setOpen(true);
          }}
        >
          Connected
        </Button>
      );
    } else {
      syncButton = (
        <Button
          color="error"
          style={{ marginLeft: '-8px' }}
          variant="text"
          onClick={() => {
            setOpen(true);
          }}
        >
          Disconnected
        </Button>
      );
    }
  }

  return (
    <>
      {syncButton}
      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
        }}
      >
        <DialogTitle>
          {success
            ? `Last successful sync: ${format(
                new Date(syncResult.lastSuccessMs),
                'HH:mm:ss',
              )}`
            : `Unable to sync since ${format(
                new Date(syncResult.errorSinceMs),
                'HH:mm:ss',
              )}`}
        </DialogTitle>
        <DialogContent>
          {!success && (
            <>
              {syncResult.lastSuccessMs > 0 && (
                <Box sx={{ typography: (theme) => theme.typography.body1 }}>
                  Last successful sync:{' '}
                  {format(new Date(syncResult.lastSuccessMs), 'HH:mm:ss')}
                </Box>
              )}
              <Box sx={{ typography: (theme) => theme.typography.body1 }}>
                Last retry:{' '}
                {format(new Date(syncResult.lastErrorMs), 'HH:mm:ss')}
              </Box>
              <Box sx={{ typography: (theme) => theme.typography.body2 }}>
                {syncResult.lastError}
              </Box>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
