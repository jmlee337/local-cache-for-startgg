import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { AdminedTournament, RendererTournament } from '../common/types';

const electronHandler = {
  getApiKey: (): Promise<string> => ipcRenderer.invoke('getApiKey'),
  setApiKey: (apiKey: string): Promise<void> =>
    ipcRenderer.invoke('setApiKey', apiKey),
  getAdminedTournaments: (): Promise<AdminedTournament[]> =>
    ipcRenderer.invoke('getAdminedTournaments'),
  setTournament: (slug: string): Promise<boolean> =>
    ipcRenderer.invoke('setTournament', slug),
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
