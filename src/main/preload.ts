import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import {
  AdminedTournament,
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
  retryTournament: (id: number, slug: string): Promise<void> =>
    ipcRenderer.invoke('retryTournament', id, slug),
  loadEvent: (eventId: number): Promise<void> =>
    ipcRenderer.invoke('loadEvent', eventId),
  resetSet: (id: number | string): Promise<void> =>
    ipcRenderer.invoke('resetSet', id),
  assignSetStation: (id: number | string, stationId: number): Promise<void> =>
    ipcRenderer.invoke('assignSetStation', id, stationId),
  assignSetStream: (id: number | string, streamId: number): Promise<void> =>
    ipcRenderer.invoke('assignSetStream', id, streamId),
  startSet: (id: number | string): Promise<void> =>
    ipcRenderer.invoke('startSet', id),
  reportSet: (
    id: number | string,
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
  preemptReset: (setId: number | string): Promise<void> =>
    ipcRenderer.invoke('preemptReset', setId),
  preemptReport: (
    id: number | string,
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
};

contextBridge.exposeInMainWorld('electron', electronHandler);
export type ElectronHandler = typeof electronHandler;
