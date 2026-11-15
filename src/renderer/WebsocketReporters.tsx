import { FormEvent, useMemo, useState } from 'react';
import {
  Button,
  Checkbox,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Stack,
  TextField,
  Tooltip,
} from '@mui/material';
import {
  ContentCopy,
  Delete,
  KeyboardArrowDown,
  KeyboardArrowRight,
} from '@mui/icons-material';
import {
  RendererEvent,
  RendererReporter,
  WebsocketStatus,
} from '../common/types';
import WebsocketAddresses from './WebsocketAddresses';

function ReporterListItemInner({ reporter }: { reporter: RendererReporter }) {
  const [copied, setCopied] = useState(false);
  const [updated, setUpdated] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <ListItemText>
        {reporter.pools.map((pool) => pool.name).join(', ')}
      </ListItemText>
      <Button
        disabled={copied}
        endIcon={copied ? undefined : <ContentCopy />}
        onClick={async () => {
          try {
            await window.electron.copy(reporter.password);
            setCopied(true);
            setTimeout(() => {
              setCopied(false);
            }, 5000);
          } catch {
            // just catch
          }
        }}
        variant="contained"
      >
        {copied ? 'Password Copied!' : 'Copy Password'}
      </Button>
      <form
        onSubmit={async (ev: FormEvent<HTMLFormElement>) => {
          ev.preventDefault();
          ev.stopPropagation();
          const target = ev.target as typeof ev.target & {
            name: { value: string };
          };
          try {
            await window.electron.setReporterName(
              reporter.password,
              target.name.value,
            );
            setUpdated(true);
            setTimeout(() => {
              setUpdated(false);
            }, 5000);
          } catch {
            // just catch
          }
        }}
      >
        <TextField
          defaultValue={reporter.name}
          disabled={updated}
          label={updated ? 'Updated!' : 'Name'}
          name="name"
          size="small"
          style={{ width: '172px' }}
          variant="standard"
        />
      </form>
      <Tooltip title="Delete">
        <IconButton
          onClick={() => {
            setDeleteOpen(true);
          }}
        >
          <Delete />
        </IconButton>
      </Tooltip>
      <Dialog
        open={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
        }}
      >
        <DialogTitle>
          {reporter.name ? `Delete ${reporter.name}?` : 'Delete?'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {reporter.pools.length === 1 ? 'Pool ' : 'Pools '}
            {reporter.pools.map((pool) => pool.name).join(', ')}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            color="error"
            onClick={async () => {
              try {
                await window.electron.deleteReporter(reporter.password);
                setDeleteOpen(false);
              } catch {
                // just catch
              }
            }}
            variant="contained"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default function WebsocketReporters({
  events,
  reporters,
  websocketStatus,
}: {
  events: RendererEvent[];
  reporters: RendererReporter[];
  websocketStatus: WebsocketStatus;
}) {
  const [createOpen, setCreateOpen] = useState(true);
  const [selectedPoolIds, setSelectedPoolIds] = useState(new Set<number>());

  const waves = useMemo(() => {
    const waveIdToPools = new Map<number, { id: number; name: string }[]>();
    const noWavePools: {
      id: number;
      name: string;
      eventId: number;
      phaseId: number;
      winnersTargetPhaseId: number | null;
    }[] = [];

    events.forEach((event) => {
      event.phases.forEach((phase) => {
        const parentName = event.phases.length > 1 ? phase.name : event.name;
        phase.pools.forEach((pool) => {
          if (pool.waveId) {
            let pools = waveIdToPools.get(pool.waveId);
            if (!pools) {
              pools = [];
              waveIdToPools.set(pool.waveId, pools);
            }
            pools.push({
              id: pool.id,
              name: pool.name,
            });
          } else {
            noWavePools.push({
              ...pool,
              name:
                phase.pools.length > 1
                  ? `${parentName}, ${pool.name}`
                  : parentName,
              eventId: event.id,
              phaseId: phase.id,
              winnersTargetPhaseId: pool.winnersTargetPhaseId,
            });
          }
        });
      });
    });

    noWavePools.sort((a, b) => {
      if (a.eventId !== b.eventId) {
        return a.eventId - b.eventId;
      }

      if (a.winnersTargetPhaseId !== null && b.winnersTargetPhaseId === null) {
        return -1;
      }
      if (a.winnersTargetPhaseId === null && b.winnersTargetPhaseId !== null) {
        return 1;
      }
      if (
        a.winnersTargetPhaseId !== null &&
        b.winnersTargetPhaseId !== null &&
        a.winnersTargetPhaseId !== b.winnersTargetPhaseId
      ) {
        if (a.winnersTargetPhaseId === b.phaseId) {
          return -1;
        }
        if (a.phaseId === b.winnersTargetPhaseId) {
          return 1;
        }
        return a.winnersTargetPhaseId - b.winnersTargetPhaseId;
      }

      if (a.phaseId !== b.phaseId) {
        return a.phaseId - b.phaseId;
      }

      return a.name.length === b.name.length
        ? a.name.localeCompare(b.name)
        : a.name.length - b.name.length;
    });

    const phasePartitionedNoWavePools: {
      id: number;
      pools: { id: number; name: string }[];
    }[] = [];
    noWavePools.forEach((noWavePool) => {
      const lastPhase =
        phasePartitionedNoWavePools[phasePartitionedNoWavePools.length - 1];
      if (lastPhase && lastPhase.id === noWavePool.phaseId) {
        lastPhase.pools.push({ id: noWavePool.id, name: noWavePool.name });
      } else {
        phasePartitionedNoWavePools.push({
          id: noWavePool.phaseId,
          pools: [{ id: noWavePool.id, name: noWavePool.name }],
        });
      }
    });

    Array.from(waveIdToPools.values()).forEach((pools) =>
      pools.sort((a, b) =>
        a.name.length === b.name.length
          ? a.name.localeCompare(b.name)
          : a.name.length - b.name.length,
      ),
    );

    return [
      ...Array.from(waveIdToPools.entries())
        .sort(([a], [b]) => a - b)
        .map(([id, pools]) => ({
          id,
          pools,
        })),
      ...phasePartitionedNoWavePools,
    ];
  }, [events]);

  return (
    <>
      {waves.length === 0 && (
        <DialogContentText marginBottom="8px">
          Load at least one event to set up pool captains
        </DialogContentText>
      )}
      {waves.length > 0 && (
        <>
          <Stack
            direction="row"
            alignItems="center"
            gap="8px"
            marginLeft="-24px"
            marginRight="-24px"
          >
            <ListItemButton
              onClick={() => {
                setCreateOpen((oldCreateOpen) => !oldCreateOpen);
              }}
            >
              {createOpen ? <KeyboardArrowDown /> : <KeyboardArrowRight />}
              <ListItemText>New Pool Captain</ListItemText>
            </ListItemButton>
          </Stack>
          <Collapse in={createOpen}>
            <Stack
              direction="row"
              flexWrap="wrap"
              columnGap="32px"
              rowGap="16px"
            >
              {waves.map((wave) => (
                <List key={wave.id} disablePadding>
                  {wave.pools.map((pool) => (
                    <ListItem key={pool.id} disablePadding>
                      <ListItemButton
                        onClick={() => {
                          const newSelectedPoolIds = new Set(selectedPoolIds);
                          if (newSelectedPoolIds.has(pool.id)) {
                            newSelectedPoolIds.delete(pool.id);
                          } else {
                            newSelectedPoolIds.add(pool.id);
                          }
                          setSelectedPoolIds(newSelectedPoolIds);
                        }}
                        style={{ padding: 0 }}
                      >
                        <Checkbox checked={selectedPoolIds.has(pool.id)} />
                        <ListItemText>{pool.name}</ListItemText>
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              ))}
            </Stack>
            <Stack direction="row" justifyContent="end" marginBottom="8px">
              <Button
                disabled={selectedPoolIds.size === 0}
                onClick={async () => {
                  try {
                    const poolIds = waves
                      .flatMap((wave) => wave.pools)
                      .map((pool) => pool.id)
                      .filter((poolId) => selectedPoolIds.has(poolId));
                    await window.electron.createReporter(poolIds);
                    setSelectedPoolIds(new Set());
                  } catch {
                    // just catch
                  }
                }}
                variant="contained"
              >
                Create!
              </Button>
            </Stack>
          </Collapse>
        </>
      )}
      <WebsocketAddresses websocketStatus={websocketStatus} path="reporter" />
      {reporters.length > 0 && (
        <List style={{ paddingLeft: 0, paddingRight: 0 }}>
          {reporters.map((reporter) => (
            <ListItem
              key={reporter.password}
              disablePadding
              style={{ gap: '8px' }}
            >
              <ReporterListItemInner reporter={reporter} />
            </ListItem>
          ))}
        </List>
      )}
    </>
  );
}
