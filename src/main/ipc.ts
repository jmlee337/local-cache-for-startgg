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
  refreshEvent,
  setApiKey,
  startggInit,
} from './startgg';
import {
  dbInit,
  deleteTournament,
  deleteTransaction,
  getLastTournament,
  getLoadedEventIds,
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
  assignSetStationTransaction,
  assignSetStreamTransaction,
  initTransaction,
  reportSetTransaction,
  resetSetTransaction,
  setAutoSyncTransaction,
  startSetTransaction,
} from './transaction';
import { ApiGameData, TransactionType } from '../common/types';

const DEFAULT_PORT = 50000;

export default function setupIPCs(mainWindow: BrowserWindow) {
  const updateClients = () => {
    // defer
    setImmediate(() => {
      mainWindow.webContents.send('tournament', getLastTournament());
      updateSubscribers();
    });
  };

  const initTransactionNum = dbInit();
  startggInit(mainWindow);
  onTransaction((completedTransactionNum, updates) => {
    if (completedTransactionNum !== null) {
      deleteTransaction(completedTransactionNum, updates);
    }
    getTournament();
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

  let loadedEventIds: number[] = [];
  const resetLoadedEventIds = () => {
    loadedEventIds = getLoadedEventIds();
  };
  const refreshEvents = async () => {
    const tournamentId = getTournamentId();
    await Promise.all(
      loadedEventIds.map(async (eventId) => {
        await refreshEvent(tournamentId, eventId);
      }),
    );
  };

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
        refreshEvents();
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

  ipcMain.removeHandler('deleteLocalTournament');
  ipcMain.handle(
    'deleteLocalTournament',
    (event: IpcMainInvokeEvent, id: number) => {
      const currentId = getTournamentId();
      deleteTournament(id);
      if (id === currentId) {
        setTournamentId(0);
        resetLoadedEventIds();
        getTournament();
        updateClients();
      }
    },
  );

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
      const oldId = getTournamentId();
      const newId = await getApiTournament(slug);
      setTournamentId(newId);
      if (oldId !== newId) {
        resetLoadedEventIds();
        await refreshEvents();
        getTournament();
        const queuedTransactions = getQueuedTransactions();
        queueTransactions(
          queuedTransactions.length > 0
            ? queuedTransactions
            : [{ type: TransactionType.REFRESH_TOURNAMENT }],
        );
      }
      updateClients();
    },
  );

  ipcMain.removeHandler('setTournament');
  ipcMain.handle(
    'setTournament',
    async (event: IpcMainInvokeEvent, newId: number, slug: string) => {
      const oldId = getTournamentId();
      if (oldId !== newId) {
        setTournamentId(newId);
        resetLoadedEventIds();
        getTournament();
        (async () => {
          try {
            await Promise.all([getApiTournament(slug), refreshEvents()]);
          } catch {
            // just catch
          }
          getTournament();
          const queuedTransactions = getQueuedTransactions();
          queueTransactions(
            queuedTransactions.length > 0
              ? queuedTransactions
              : [{ type: TransactionType.REFRESH_TOURNAMENT }],
          );
        })();
      }
      updateClients();
    },
  );

  ipcMain.removeHandler('loadEvent');
  ipcMain.handle(
    'loadEvent',
    async (event: IpcMainInvokeEvent, eventId: number) => {
      await loadEvent(getTournamentId(), eventId);
      updateClients();
      loadedEventIds.push(eventId);
    },
  );

  ipcMain.removeHandler('resetSet');
  ipcMain.handle('resetSet', (event: IpcMainInvokeEvent, id: number) => {
    resetSetTransaction(id);
  });

  ipcMain.removeHandler('assignSetStation');
  ipcMain.handle(
    'assignSetStation',
    (event: IpcMainInvokeEvent, id: number, stationId: number) => {
      assignSetStationTransaction(id, stationId);
    },
  );

  ipcMain.removeHandler('assignSetStream');
  ipcMain.handle(
    'assignSetStream',
    (event: IpcMainInvokeEvent, id: number, streamId: number) => {
      assignSetStreamTransaction(id, streamId);
    },
  );

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
      entrantScores:
        | [
            { entrantId: number; score: number },
            { entrantId: number; score: number },
          ]
        | null,
    ) => {
      const apiGameData: ApiGameData[] = [];
      if (!isDQ && entrantScores !== null) {
        let gameNum = 1;
        for (let i = 0; i < entrantScores[0].score; i += 1) {
          apiGameData.push({
            gameNum,
            winnerId: entrantScores[0].entrantId,
            selections: [],
          });
          gameNum += 1;
        }
        for (let i = 0; i < entrantScores[1].score; i += 1) {
          apiGameData.push({
            gameNum,
            winnerId: entrantScores[1].entrantId,
            selections: [],
          });
          gameNum += 1;
        }
      }
      reportSetTransaction(id, winnerId, isDQ, apiGameData);
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
