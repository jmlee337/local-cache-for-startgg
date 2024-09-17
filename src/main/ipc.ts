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
  getApiTournament,
  getSyncResult,
  loadEvent,
  onTransaction,
  queueTransactions,
  setApiKey,
  startggInit,
} from './startgg';
import {
  dbInit,
  deleteTransaction,
  getQueuedTransactions,
  getTournament,
  getTournamentId,
  getTournaments,
  queueAllTransactions,
  setTournamentId,
} from './db';
import {
  startWebsocketServer,
  stopWebsocketServer,
  updateSubscribers,
} from './websocket';
import {
  initTransaction,
  reportSetTransaction,
  resetSetTransaction,
  setAutoSyncTransaction,
  startSetTransaction,
} from './transaction';

const DEFAULT_PORT = 50000;

export default function setupIPCs(mainWindow: BrowserWindow) {
  const updateClients = () => {
    mainWindow.webContents.send('tournament', getTournament());
    updateSubscribers();
  };

  const initTransactionNum = dbInit();
  startggInit(mainWindow);
  onTransaction((completedTransactionNum, updates, updatedAt) => {
    deleteTransaction([completedTransactionNum], updates, updatedAt);
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
  initTransaction(autoSync, initTransactionNum, updateClients);
  ipcMain.removeHandler('getAutoSync');
  ipcMain.handle('getAutoSync', () => autoSync);

  ipcMain.removeHandler('setAutoSync');
  ipcMain.handle(
    'setAutoSync',
    (event: IpcMainInvokeEvent, newAutoSync: boolean) => {
      store.set('autoSync', newAutoSync);
      setAutoSyncTransaction(newAutoSync);
      autoSync = newAutoSync;
      if (autoSync && getTournamentId()) {
        queueTransactions(queueAllTransactions());
        updateClients();
      }
    },
  );

  let websocketErr = '';
  let websocketPort = 0;
  ipcMain.removeHandler('getWebsocketStatus');
  ipcMain.handle('getWebsocketStatus', () => ({
    err: websocketErr,
    port: websocketPort,
  }));

  const startWebsocket = async () => {
    let portToTry = DEFAULT_PORT;
    let ret = await startWebsocketServer(portToTry);
    if (ret.err === 'Port in use') {
      do {
        portToTry += 1;
        // eslint-disable-next-line no-await-in-loop
        ret = await startWebsocketServer(portToTry);
      } while (ret.err === 'Port in use');
    }
    if (ret.err) {
      websocketErr = ret.err;
    } else {
      websocketPort = portToTry;
    }
    mainWindow.webContents.send('websocketStatus', {
      err: websocketErr,
      port: websocketPort,
    });
  };
  const stopWebsocket = () => {
    stopWebsocketServer();
    websocketErr = '';
    websocketPort = 0;
    mainWindow.webContents.send('websocketStatus', {
      err: websocketErr,
      port: websocketPort,
    });
  };

  let websocket = store.has('websocket')
    ? (store.get('websocket') as boolean)
    : true;
  if (websocket) {
    startWebsocket();
  }

  ipcMain.removeHandler('getWebsocket');
  ipcMain.handle('getWebsocket', () => websocket);

  ipcMain.removeHandler('setWebsocket');
  ipcMain.handle(
    'setWebsocket',
    (event: IpcMainInvokeEvent, newWebsocket: boolean) => {
      if (websocket !== newWebsocket) {
        store.set('websocket', newWebsocket);
        websocket = newWebsocket;
        if (websocket) {
          startWebsocket();
        } else {
          stopWebsocket();
        }
      }
    },
  );

  ipcMain.removeHandler('getLocalTournaments');
  ipcMain.handle('getLocalTournaments', getTournaments);

  ipcMain.removeHandler('getAdminedTournaments');
  ipcMain.handle('getAdminedTournaments', async () => {
    return getAdminedTournaments();
  });

  ipcMain.removeHandler('getCurrentTournament');
  ipcMain.handle('getCurrentTournament', getTournament);

  ipcMain.removeHandler('getTournament');
  ipcMain.handle(
    'getTournament',
    async (event: IpcMainInvokeEvent, slug: string) => {
      setTournamentId(await getApiTournament(slug));
      queueTransactions(getQueuedTransactions());
      updateClients();
    },
  );

  ipcMain.removeHandler('setTournament');
  ipcMain.handle(
    'setTournament',
    async (event: IpcMainInvokeEvent, id: number, slug: string) => {
      try {
        await getApiTournament(slug);
      } catch {
        // ignore
      }
      setTournamentId(id);
      queueTransactions(getQueuedTransactions());
      updateClients();
    },
  );

  ipcMain.removeHandler('loadEvent');
  ipcMain.handle(
    'loadEvent',
    async (event: IpcMainInvokeEvent, eventId: number) => {
      await loadEvent(getTournamentId(), eventId);
      updateClients();
    },
  );

  ipcMain.removeHandler('resetSet');
  ipcMain.handle('resetSet', (event: IpcMainInvokeEvent, id: number) => {
    resetSetTransaction(id);
  });

  ipcMain.removeHandler('startSet');
  ipcMain.handle('startSet', (event: IpcMainInvokeEvent, id: number) => {
    startSetTransaction(id);
  });

  ipcMain.removeHandler('reportSet');
  ipcMain.handle(
    'reportSet',
    (
      event: IpcMainInvokeEvent,
      id: number,
      winnerId: number,
      isDQ: boolean,
    ) => {
      reportSetTransaction(id, winnerId, isDQ, []);
    },
  );

  ipcMain.removeHandler('getSyncResult');
  ipcMain.handle('getSyncResult', getSyncResult);

  ipcMain.removeHandler('getAppVersion');
  ipcMain.handle('getAppVersion', () => app.getVersion());

  ipcMain.removeHandler('copy');
  ipcMain.handle('copy', (event: IpcMainInvokeEvent, text: string) => {
    clipboard.writeText(text);
  });
}
