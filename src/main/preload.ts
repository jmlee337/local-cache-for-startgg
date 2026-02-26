import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import {
  AdminedTournament,
  PoolSiblings,
  RendererConflict,
  RendererConflictResolve,
  RendererTournament,
  SyncResult,
  WebsocketStatus,
} from '../common/types';

const electronHandler = {
  getApiKey: (): Promise<string> => ipcRenderer.invoke('getApiKey'),
  setApiKey: (apiKey: string): Promise<void> =>
    ipcRenderer.invoke('setApiKey', apiKey),
  getAutoSync: (): Promise<boolean> => ipcRenderer.invoke('getAutoSync'),
  setAutoSync: (autoSync: boolean) =>
    ipcRenderer.invoke('setAutoSync', autoSync),
  getWebsocketPassword: (): Promise<string> =>
    ipcRenderer.invoke('getWebsocketPassword'),
  resetWebsocketPassword: (): Promise<string> =>
    ipcRenderer.invoke('resetWebsocketPassword'),
  getWebsocketStatus: (): Promise<WebsocketStatus> =>
    ipcRenderer.invoke('getWebsocketStatus'),
  getWebsocket: (): Promise<boolean> => ipcRenderer.invoke('getWebsocket'),
  setWebsocket: (websocket: boolean) =>
    ipcRenderer.invoke('setWebsocket', websocket),
  getLocalTournaments: (): Promise<AdminedTournament[]> =>
    ipcRenderer.invoke('getLocalTournaments'),
  deleteLocalTournament: (id: number): Promise<void> =>
    ipcRenderer.invoke('deleteLocalTournament', id),
  getAdminedTournaments: (): Promise<AdminedTournament[]> =>
    ipcRenderer.invoke('getAdminedTournaments'),
  getCurrentTournament: (): Promise<RendererTournament | undefined> =>
    ipcRenderer.invoke('getCurrentTournament'),
  getTournament: (slug: string): Promise<void> =>
    ipcRenderer.invoke('getTournament', slug),
  setTournament: (id: number, slug: string): Promise<void> =>
    ipcRenderer.invoke('setTournament', id, slug),
  refreshTournament: (): Promise<void> =>
    ipcRenderer.invoke('refreshTournament'),
  retryTournament: (id: number, slug: string): Promise<void> =>
    ipcRenderer.invoke('retryTournament', id, slug),
  loadEvent: (eventId: number): Promise<void> =>
    ipcRenderer.invoke('loadEvent', eventId),
  getPoolSiblings: (
    waveId: number | null,
    phaseId: number,
  ): Promise<PoolSiblings> =>
    ipcRenderer.invoke('getPoolSiblings', waveId, phaseId),
  upgradePoolSets: (poolId: number): Promise<void> =>
    ipcRenderer.invoke('upgradePoolSets', poolId),
  upgradeWaveSets: (waveId: number): Promise<void> =>
    ipcRenderer.invoke('upgradeWaveSets', waveId),
  upgradePhaseSets: (phaseId: number): Promise<void> =>
    ipcRenderer.invoke('upgradePhaseSets', phaseId),
  resetSet: (id: number): Promise<void> => ipcRenderer.invoke('resetSet', id),
  assignSetStation: (id: number, stationId: number): Promise<void> =>
    ipcRenderer.invoke('assignSetStation', id, stationId),
  assignSetStream: (id: number, streamId: number): Promise<void> =>
    ipcRenderer.invoke('assignSetStream', id, streamId),
  callSet: (id: number): Promise<void> => ipcRenderer.invoke('callSet', id),
  startSet: (id: number): Promise<void> => ipcRenderer.invoke('startSet', id),
  reportSet: (
    id: number,
    winnerId: number,
    isDQ: boolean,
    entrantScores:
      | [
          { entrantId: number; score: number },
          { entrantId: number; score: number },
        ]
      | null,
  ): Promise<void> =>
    ipcRenderer.invoke('reportSet', id, winnerId, isDQ, entrantScores),
  deleteTransaction: (transactionNum: number): Promise<void> =>
    ipcRenderer.invoke('deleteTransaction', transactionNum),
  makeResetRecursive: (transactionNum: number): Promise<void> =>
    ipcRenderer.invoke('makeResetRecursive', transactionNum),
  preemptReset: (setId: number): Promise<void> =>
    ipcRenderer.invoke('preemptReset', setId),
  preemptReport: (
    id: number,
    winnerId: number,
    isDQ: boolean,
    entrantScores:
      | [
          { entrantId: number; score: number },
          { entrantId: number; score: number },
        ]
      | null,
  ): Promise<void> =>
    ipcRenderer.invoke('preemptReport', id, winnerId, isDQ, entrantScores),
  getConflictResolve: (
    setId: number,
    transactionNum: number,
  ): Promise<RendererConflictResolve> =>
    ipcRenderer.invoke('getConflictResolve', setId, transactionNum),
  getConflict: (): Promise<RendererConflict> =>
    ipcRenderer.invoke('getConflict'),
  getFatalErrorMessage: (): Promise<string> =>
    ipcRenderer.invoke('getFatalErrorMessage'),
  getSyncResult: (): Promise<SyncResult> => ipcRenderer.invoke('getSyncResult'),
  onAdminedTournaments: (
    callback: (
      event: IpcRendererEvent,
      adminedTournaments: AdminedTournament[],
    ) => void,
  ) => {
    ipcRenderer.removeAllListeners('adminedTournaments');
    ipcRenderer.on('adminedTournaments', callback);
  },
  onConflict: (
    callback: (event: IpcRendererEvent, conflicts: RendererConflict) => void,
  ) => {
    ipcRenderer.removeAllListeners('conflict');
    ipcRenderer.on('conflict', callback);
  },
  onFatalError: (
    callback: (event: IpcRendererEvent, message: string) => void,
  ) => {
    ipcRenderer.removeAllListeners('fatalError');
    ipcRenderer.on('fatalError', callback);
  },
  onRefreshing: (
    callback: (event: IpcRendererEvent, refreshing: boolean) => void,
  ) => {
    ipcRenderer.removeAllListeners('refreshing');
    ipcRenderer.on('refreshing', callback);
  },
  onSyncResult: (
    callback: (event: IpcRendererEvent, syncResult: SyncResult) => void,
  ) => {
    ipcRenderer.removeAllListeners('syncResult');
    ipcRenderer.on('syncResult', callback);
  },
  onTournament: (
    callback: (event: IpcRendererEvent, tournament: RendererTournament) => void,
  ) => {
    ipcRenderer.removeAllListeners('tournament');
    ipcRenderer.on('tournament', callback);
  },
  onWebsocketStatus: (
    callback: (
      event: IpcRendererEvent,
      websocketStatus: WebsocketStatus,
    ) => void,
  ) => {
    ipcRenderer.removeAllListeners('websocketStatus');
    ipcRenderer.on('websocketStatus', callback);
  },
  getAppVersion: (): Promise<string> => ipcRenderer.invoke('getAppVersion'),
  getVersionLatest: (): Promise<string> =>
    ipcRenderer.invoke('getVersionLatest'),
  update: (): void => ipcRenderer.send('update'),
  copy: (text: string): Promise<void> => ipcRenderer.invoke('copy', text),
  openDbFolder: (): Promise<void> => ipcRenderer.invoke('openDbFolder'),
};

contextBridge.exposeInMainWorld('electron', electronHandler);
export type ElectronHandler = typeof electronHandler;
