import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  ListItem,
  ListItemText,
  Radio,
  RadioGroup,
  Stack,
} from '@mui/material';
import { useState } from 'react';
import { PoolSiblings } from '../common/types';

enum UpgradeMethod {
  POOL,
  WAVE,
  PHASE,
}

function PoolItem({ name }: { name: string }) {
  return (
    <ListItem disablePadding style={{ flex: '0 0 content' }}>
      <ListItemText>{name}</ListItemText>
    </ListItem>
  );
}

export default function UpgradeDialog({
  open,
  setOpen,
  pool,
  siblings,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  pool: { id: number; name: string; waveId: number | null; phaseId: number };
  siblings: PoolSiblings;
}) {
  const [upgradeMethod, setUpgradeMethod] = useState(UpgradeMethod.POOL);

  return (
    <Dialog
      open={open}
      onClose={() => {
        setOpen(false);
      }}
    >
      <DialogTitle>Lock Pool {pool.name}</DialogTitle>
      <DialogContent>
        <FormControl>
          <RadioGroup
            row
            value={upgradeMethod}
            onChange={(ev) => {
              setUpgradeMethod(parseInt(ev.target.value, 10));
            }}
          >
            <FormControlLabel
              value={UpgradeMethod.POOL}
              control={<Radio />}
              label="Pool"
            />
            <FormControlLabel
              value={UpgradeMethod.WAVE}
              control={<Radio />}
              label="Wave"
              disabled={pool.waveId === null}
            />
            <FormControlLabel
              value={UpgradeMethod.PHASE}
              control={<Radio />}
              label="Phase"
            />
          </RadioGroup>
        </FormControl>
        <Stack direction="row" flexWrap="wrap" gap="8px" width="300px">
          {upgradeMethod === UpgradeMethod.POOL && (
            <PoolItem name={pool.name} />
          )}
          {upgradeMethod === UpgradeMethod.WAVE &&
            siblings.wave.map((poolName) => <PoolItem name={poolName} />)}
          {upgradeMethod === UpgradeMethod.PHASE &&
            siblings.phase.map((poolName) => <PoolItem name={poolName} />)}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button
          variant="contained"
          disabled={
            upgradeMethod === UpgradeMethod.WAVE && pool.waveId === null
          }
          onClick={async () => {
            if (upgradeMethod === UpgradeMethod.POOL) {
              await window.electron.upgradePoolSets(pool.id);
            } else if (upgradeMethod === UpgradeMethod.WAVE) {
              await window.electron.upgradeWaveSets(pool.waveId!);
            } else if (upgradeMethod === UpgradeMethod.PHASE) {
              await window.electron.upgradePhaseSets(pool.phaseId);
            }
            setOpen(false);
          }}
        >
          {upgradeMethod === UpgradeMethod.POOL && 'Lock Pool'}
          {upgradeMethod === UpgradeMethod.WAVE && 'Lock all Pools in Wave'}
          {upgradeMethod === UpgradeMethod.PHASE && 'Lock all Pools in Phase'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
