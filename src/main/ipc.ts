import {
  app,
  BrowserWindow,
  clipboard,
  ipcMain,
  IpcMainInvokeEvent,
} from 'electron';
import Store from 'electron-store';
import { getAdminedTournaments, loadEvent, setTournament } from './startgg';
import { dbInit, getTournament, reportSet } from './db';

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
      const apiKeyChanged = apiKey !== newApiKey;
      store.set('apiKey', newApiKey);
      apiKey = newApiKey;

      if (apiKeyChanged) {
        mainWindow.webContents.send(
          'adminedTournaments',
          getAdminedTournaments(apiKey),
        );
      }
    },
  );

  ipcMain.removeHandler('getAdminedTournaments');
  ipcMain.handle('getAdminedTournaments', async () => {
    if (!apiKey) {
      return [];
    }
    return getAdminedTournaments(apiKey);
  });

  ipcMain.removeHandler('getCurrentTournament');
  ipcMain.handle('getCurrentTournament', () => {
    if (!tournamentId) {
      return undefined;
    }
    return getTournament(tournamentId);
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

  ipcMain.removeHandler('loadEvent');
  ipcMain.handle(
    'loadEvent',
    async (event: IpcMainInvokeEvent, eventId: number) => {
      if (!apiKey) {
        throw new Error('Please set API key.');
      }
      await loadEvent(apiKey, tournamentId, eventId);
      mainWindow.webContents.send('tournament', getTournament(tournamentId));
    },
  );

  ipcMain.removeHandler('reportSet');
  ipcMain.handle(
    'reportSet',
    (
      event: IpcMainInvokeEvent,
      id: number,
      winnerId: number,
      loserId: number,
      entrant1Score: number | null,
      entrant2Score: number | null,
    ) => {
      reportSet(id, winnerId, loserId, entrant1Score, entrant2Score);
    },
  );

  ipcMain.removeHandler('getAppVersion');
  ipcMain.handle('getAppVersion', () => app.getVersion());

  ipcMain.removeHandler('copy');
  ipcMain.handle('copy', (event: IpcMainInvokeEvent, text: string) => {
    clipboard.writeText(text);
  });
}
