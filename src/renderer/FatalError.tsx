import {
  Button,
  Dialog,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import { useEffect, useState } from 'react';

export default function FatalError() {
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
          size="large"
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
        </Dialog>
      </>
    )
  );
}
