import {
  app,
  BrowserWindow,
  clipboard,
  ipcMain,
  IpcMainInvokeEvent,
} from 'electron';
import Store from 'electron-store';
import { getAdminedTournaments, setTournament } from './startgg';
import { dbInit, getTournament } from './db';

let tournamentId = 0;
export default function setupIPCs(mainWindow: BrowserWindow) {
  dbInit();
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
      tournamentId = await setTournament(apiKey, slug);
      mainWindow.webContents.send('tournament', getTournament(tournamentId));
    },
  );

  ipcMain.removeHandler('getAppVersion');
  ipcMain.handle('getAppVersion', () => app.getVersion());

  ipcMain.removeHandler('copy');
  ipcMain.handle('copy', (event: IpcMainInvokeEvent, text: string) => {
    clipboard.writeText(text);
  });
}
