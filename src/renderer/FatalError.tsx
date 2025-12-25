import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import { useEffect, useState } from 'react';

export default function FatalError({
  tournamentId,
  tournamentSlug,
}: {
  tournamentId: number | undefined;
  tournamentSlug: string | undefined;
}) {
  const [open, setOpen] = useState(false);
  const [fatalErrorMessage, setFatalErrorMessage] = useState('');

  useEffect(() => {
    window.electron.onFatalError((event, newFatalErrorMessage) => {
      setFatalErrorMessage(newFatalErrorMessage);
      if (newFatalErrorMessage) {
        setOpen(true);
      } else {
        setOpen(false);
      }
    });
    (async () => {
      setFatalErrorMessage(await window.electron.getFatalErrorMessage());
    })();
  }, []);

  return (
    fatalErrorMessage && (
      <>
        <Button
          color="error"
          variant="contained"
          onClick={() => {
            setOpen(true);
          }}
        >
          Error!
        </Button>
        <Dialog
          open={open}
          onClose={() => {
            setOpen(false);
          }}
        >
          <DialogTitle>start.gg Error!</DialogTitle>
          <DialogContent>
            <DialogContentText>{fatalErrorMessage}</DialogContentText>
          </DialogContent>
          {tournamentId && tournamentSlug && (
            <DialogActions>
              <Button
                variant="contained"
                onClick={async () => {
                  await window.electron.retryTournament(
                    tournamentId,
                    tournamentSlug,
                  );
                  setOpen(false);
                }}
              >
                Retry
              </Button>
            </DialogActions>
          )}
        </Dialog>
      </>
    )
  );
}
