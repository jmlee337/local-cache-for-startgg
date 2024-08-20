import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { AdminedTournament, RendererTournament } from '../common/types';

const electronHandler = {
  getApiKey: (): Promise<string> => ipcRenderer.invoke('getApiKey'),
  setApiKey: (apiKey: string): Promise<void> =>
    ipcRenderer.invoke('setApiKey', apiKey),
  getAutoSync: (): Promise<boolean> => ipcRenderer.invoke('getAutoSync'),
  setAutoSync: (autoSync: boolean) =>
    ipcRenderer.invoke('setAutoSync', autoSync),
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
  reportSet: (
    id: number,
    winnerId: number,
    entrant1Score: number | null,
    entrant2Score: number | null,
  ): Promise<void> =>
    ipcRenderer.invoke('reportSet', id, winnerId, entrant1Score, entrant2Score),
  onAdminedTournaments: (
    callback: (
      event: IpcRendererEvent,
      adminedTournaments: AdminedTournament[],
    ) => void,
  ) => {
    ipcRenderer.removeAllListeners('adminedTournaments');
    ipcRenderer.on('adminedTournaments', callback);
  },
  onTournament: (
    callback: (event: IpcRendererEvent, tournament: RendererTournament) => void,
  ) => {
    ipcRenderer.removeAllListeners('tournament');
    ipcRenderer.on('tournament', callback);
  },
  getAppVersion: (): Promise<string> => ipcRenderer.invoke('getAppVersion'),
  copy: (text: string): Promise<void> => ipcRenderer.invoke('copy', text),
};

contextBridge.exposeInMainWorld('electron', electronHandler);
export type ElectronHandler = typeof electronHandler;
