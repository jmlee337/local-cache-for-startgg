import {
  app,
  BrowserWindow,
  clipboard,
  ipcMain,
  IpcMainInvokeEvent,
} from 'electron';
import Store from 'electron-store';
import { getAdminedTournaments, setMainWindow, setTournament } from './startgg';

export default function setupIPCs(mainWindow: BrowserWindow) {
  const store = new Store();

  let apiKey = store.has('apiKey') ? (store.get('apiKey') as string) : '';
  ipcMain.removeHandler('getApiKey');
  ipcMain.handle('getApiKey', () => apiKey);

  ipcMain.removeHandler('setApiKey');
  ipcMain.handle(
    'setApiKey',
    (event: IpcMainInvokeEvent, newApiKey: string) => {
      store.set('apiKey', newApiKey);
      apiKey = newApiKey;
    },
  );

  setMainWindow(mainWindow);
  ipcMain.removeHandler('getAdminedTournaments');
  ipcMain.handle('getAdminedTournaments', async () => {
    if (!apiKey) {
      throw new Error('Please set API key.');
    }
    return getAdminedTournaments(apiKey);
  });

  ipcMain.removeHandler('setTournament');
  ipcMain.handle(
    'setTournament',
    async (event: IpcMainInvokeEvent, slug: string) => {
      if (!apiKey) {
        throw new Error('Please set API key.');
      }
      await setTournament(apiKey, slug);
    },
  );

  ipcMain.removeHandler('getAppVersion');
  ipcMain.handle('getAppVersion', () => app.getVersion());

  ipcMain.removeHandler('copy');
  ipcMain.handle('copy', (event: IpcMainInvokeEvent, text: string) => {
    clipboard.writeText(text);
  });
}
