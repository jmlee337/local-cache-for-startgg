import {
  app,
  BrowserWindow,
  clipboard,
  ipcMain,
  IpcMainInvokeEvent,
} from 'electron';
import Store from 'electron-store';
import {
  getAdminedTournaments,
  loadEvent,
  onTransaction,
  queueTransaction,
  setApiKey,
  setTournament,
} from './startgg';
import {
  dbInit,
  deleteTransaction,
  getTournament,
  insertTransaction,
  reportSet,
} from './db';
import { ApiTransaction } from '../common/types';

let tournamentId = 0;
export default function setupIPCs(mainWindow: BrowserWindow) {
  const updateClients = () => {
    mainWindow.webContents.send('tournament', getTournament(tournamentId));
  };
  let transactionNum = dbInit();
  onTransaction((completedTransactionNum, updates) => {
    deleteTransaction([completedTransactionNum], updates);
    updateClients();
  });

  const store = new Store();
  let apiKey = store.has('apiKey') ? (store.get('apiKey') as string) : '';
  setApiKey(apiKey);
  ipcMain.removeHandler('getApiKey');
  ipcMain.handle('getApiKey', () => apiKey);

  ipcMain.removeHandler('setApiKey');
  ipcMain.handle(
    'setApiKey',
    async (event: IpcMainInvokeEvent, newApiKey: string) => {
      const apiKeyChanged = apiKey !== newApiKey;
      store.set('apiKey', newApiKey);
      setApiKey(newApiKey);
      apiKey = newApiKey;

      if (apiKeyChanged) {
        mainWindow.webContents.send(
          'adminedTournaments',
          await getAdminedTournaments(),
        );
      }
    },
  );

  let autoSync = store.has('autoSync')
    ? (store.get('autoSync') as boolean)
    : true;
  ipcMain.removeHandler('getAutoSync');
  ipcMain.handle('getAutoSync', () => autoSync);

  ipcMain.removeHandler('setAutoSync');
  ipcMain.handle(
    'setAutoSync',
    (event: IpcMainInvokeEvent, newAutoSync: boolean) => {
      store.set('autoSync', newAutoSync);
      autoSync = newAutoSync;
    },
  );

  ipcMain.removeHandler('getAdminedTournaments');
  ipcMain.handle('getAdminedTournaments', async () => {
    return getAdminedTournaments();
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
      tournamentId = await setTournament(slug);
      updateClients();
    },
  );

  ipcMain.removeHandler('loadEvent');
  ipcMain.handle(
    'loadEvent',
    async (event: IpcMainInvokeEvent, eventId: number) => {
      await loadEvent(tournamentId, eventId);
      updateClients();
    },
  );

  ipcMain.removeHandler('reportSet');
  ipcMain.handle(
    'reportSet',
    (
      event: IpcMainInvokeEvent,
      id: number,
      winnerId: number,
      entrant1Score: number | null,
      entrant2Score: number | null,
    ) => {
      const currentTransactionNum = transactionNum;
      transactionNum += 1;
      reportSet(
        id,
        winnerId,
        entrant1Score,
        entrant2Score,
        currentTransactionNum,
      );
      const apiTransaction: ApiTransaction = {
        setId: id,
        isReport: true,
        winnerId,
        isDQ: entrant1Score === -1 || entrant2Score === -1,
        gameData: [],
        transactionNum: currentTransactionNum,
      };
      insertTransaction(apiTransaction);
      if (autoSync) {
        queueTransaction(apiTransaction);
      }
      updateClients();
    },
  );

  ipcMain.removeHandler('getAppVersion');
  ipcMain.handle('getAppVersion', () => app.getVersion());

  ipcMain.removeHandler('copy');
  ipcMain.handle('copy', (event: IpcMainInvokeEvent, text: string) => {
    clipboard.writeText(text);
  });
}
