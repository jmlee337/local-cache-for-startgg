import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import {
  AdminedTournament,
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
  getAdminedTournaments: (): Promise<AdminedTournament[]> =>
    ipcRenderer.invoke('getAdminedTournaments'),
  getCurrentTournament: (): Promise<RendererTournament | undefined> =>
    ipcRenderer.invoke('getCurrentTournament'),
  getTournament: (slug: string): Promise<void> =>
    ipcRenderer.invoke('getTournament', slug),
  setTournament: (id: number, slug: string): Promise<void> =>
    ipcRenderer.invoke('setTournament', id, slug),
  loadEvent: (eventId: number): Promise<void> =>
    ipcRenderer.invoke('loadEvent', eventId),
  resetSet: (id: number): Promise<void> => ipcRenderer.invoke('resetSet', id),
  assignSetStation: (id: number, stationId: number): Promise<void> =>
    ipcRenderer.invoke('assignSetStation', id, stationId),
  assignSetStream: (id: number, streamId: number): Promise<void> =>
    ipcRenderer.invoke('assignSetStream', id, streamId),
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
  copy: (text: string): Promise<void> => ipcRenderer.invoke('copy', text),
};

contextBridge.exposeInMainWorld('electron', electronHandler);
export type ElectronHandler = typeof electronHandler;
