import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Tooltip,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { CloudDone, CloudOff } from '@mui/icons-material';
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

  const [open, setOpen] = useState(false);

  const success = useMemo(
    () =>
      syncResult.success ||
      syncResult.lastErrorMs - syncResult.errorSinceMs < ERROR_THRESHOLD_MS,
    [syncResult],
  );
  const syncButton = useMemo(() => {
    return success ? (
      <Tooltip title="Online">
        <IconButton
          color="primary"
          onClick={() => {
            setOpen(true);
          }}
        >
          <CloudDone />
        </IconButton>
      </Tooltip>
    ) : (
      <Tooltip title="Offline">
        <IconButton
          color="warning"
          onClick={() => {
            setOpen(true);
          }}
        >
          <CloudOff />
        </IconButton>
      </Tooltip>
    );
  }, [success]);

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
            : `Offline since ${format(
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
