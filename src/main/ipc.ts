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
  getFatalErrorMessage,
  getSyncResult,
  loadEvent,
  onTransaction,
  startRefreshingTournament,
  setApiKey,
  startggInit,
} from './startgg';
import {
  dbInit,
  deleteTournament,
  getConflict,
  getConflictResolve,
  getLastTournament,
  getTournament,
  getTournamentId,
  getTournaments,
  setAutoSync,
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
  startSetTransaction,
} from './transaction';
import { ApiGameData } from '../common/types';

const DEFAULT_PORT = 50000;

export default function setupIPCs(mainWindow: BrowserWindow) {
  const updateClients = () => {
    // defer
    setImmediate(() => {
      getTournament();
      mainWindow.webContents.send('tournament', getLastTournament());
      updateSubscribers();
    });
  };

  const initTransactionNum = dbInit(mainWindow);
  startggInit(mainWindow);
  onTransaction(() => {
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
  setAutoSync(autoSync);
  initTransaction(initTransactionNum, updateClients);
  ipcMain.removeHandler('getAutoSync');
  ipcMain.handle('getAutoSync', () => autoSync);

  ipcMain.removeHandler('setAutoSync');
  ipcMain.handle(
    'setAutoSync',
    (event: IpcMainInvokeEvent, newAutoSync: boolean) => {
      if (autoSync !== newAutoSync) {
        store.set('autoSync', newAutoSync);
        autoSync = newAutoSync;
        setAutoSync(newAutoSync);
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
      if (oldId !== newId) {
        setTournamentId(newId);
        updateClients();
        startRefreshingTournament(newId, slug);
      }
    },
  );

  ipcMain.removeHandler('setTournament');
  ipcMain.handle(
    'setTournament',
    async (event: IpcMainInvokeEvent, newId: number, slug: string) => {
      const oldId = getTournamentId();
      if (oldId !== newId) {
        setTournamentId(newId);
        updateClients();
        startRefreshingTournament(newId, slug);
      }
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

  ipcMain.removeHandler('getConflictResolve');
  ipcMain.handle(
    'getConflictResolve',
    (event: IpcMainInvokeEvent, setId: number, transactionNum: number) =>
      getConflictResolve(setId, transactionNum),
  );

  ipcMain.removeHandler('getConflict');
  ipcMain.handle('getConflict', getConflict);

  ipcMain.removeHandler('getFatalErrorMessage');
  ipcMain.handle('getFatalErrorMessage', getFatalErrorMessage);

  ipcMain.removeHandler('getSyncResult');
  ipcMain.handle('getSyncResult', getSyncResult);

  ipcMain.removeHandler('getAppVersion');
  ipcMain.handle('getAppVersion', () => app.getVersion());

  ipcMain.removeHandler('copy');
  ipcMain.handle('copy', (event: IpcMainInvokeEvent, text: string) => {
    clipboard.writeText(text);
  });
}
