import { useEffect, useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import { ConflictReason, RendererConflict } from '../common/types';

export default function Conflicts() {
  const [open, setOpen] = useState(false);
  const [conflicts, setConflicts] = useState<RendererConflict[]>([]);
  useEffect(() => {
    window.electron.onConflict((event, newConflicts) => {
      setConflicts(newConflicts);
    });
    (async () => {
      setConflicts(await window.electron.getConflicts());
    })();
  }, []);

  return (
    conflicts.length > 0 && (
      <>
        <Button
          color="warning"
          size="large"
          variant="contained"
          onClick={() => {
            setOpen(true);
          }}
        >
          Conflict!
        </Button>
        <Dialog
          open={open}
          onClose={() => {
            setOpen(false);
          }}
        >
          <DialogTitle>start.gg Conflict!</DialogTitle>
          <DialogContent>
            <List>
              {conflicts.map((conflict) => (
                <ListItem key={conflict.transactionNum}>
                  <ListItemText>
                    {conflict.fullRoundText} ({conflict.identifier}):{' '}
                    {ConflictReason[conflict.reason]}
                  </ListItemText>
                </ListItem>
              ))}
            </List>
          </DialogContent>
        </Dialog>
      </>
    )
  );
}
