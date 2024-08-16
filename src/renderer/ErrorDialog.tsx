import {
  Dialog,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';

export default function ErrorDialog({
  open,
  error,
  close,
}: {
  open: boolean;
  error: string;
  close: () => void;
}) {
  return (
    <Dialog open={open} onClose={close}>
      <DialogTitle>Error!</DialogTitle>
      <DialogContent>
        <DialogContentText>{error}</DialogContentText>
      </DialogContent>
    </Dialog>
  );
}
