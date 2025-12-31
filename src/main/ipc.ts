import { app, BrowserWindow, clipboard, ipcMain, shell } from 'electron';
import Store from 'electron-store';
import {
  getAdminedTournaments,
  getApiTournament,
  getFatalErrorMessage,
  getSyncResult,
  onTransaction,
  startRefreshingTournament,
  setApiKey,
  startggInit,
  maybeTryNow,
  upgradePreviewSets,
} from './startgg';
import {
  dbInit,
  deleteTournament,
  deleteTransaction,
  getConflict,
  getConflictResolve,
  getLastSubscriberTournament,
  getLastTournament,
  getPoolSiblings,
  getPreviewSetIdFromPool,
  getPreviewSetIdsFromPhase,
  getPreviewSetIdsFromWave,
  getTournament,
  getTournamentId,
  getTournaments,
  loadEvent,
  makeResetRecursive,
  reportSet,
  resetSet,
  setAutoSync,
  setTournamentId,
} from './db';
import {
  getWebsocketStatus,
  initWebsocket,
  startWebsocketServer,
  stopWebsocketServer,
  updateSubscribers,
} from './websocket';
import {
  assignSetStationTransaction,
  assignSetStreamTransaction,
  callSetTransaction,
  initTransaction,
  reportSetTransaction,
  resetSetTransaction,
  startSetTransaction,
} from './transaction';
import { ApiGameData } from '../common/types';

export default function setupIPCs(mainWindow: BrowserWindow) {
  const updateClients = () => {
    // defer
    setImmediate(() => {
      getTournament();
      mainWindow.webContents.send('tournament', getLastTournament());
      updateSubscribers(getLastSubscriberTournament());
    });
  };

  const initTransactionNums = dbInit(mainWindow);
  let preemptTransactionNum = initTransactionNums.low;
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
  ipcMain.handle('setApiKey', async (event, newApiKey: string) => {
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
  });

  let autoSync = store.has('autoSync')
    ? (store.get('autoSync') as boolean)
    : true;
  setAutoSync(autoSync);
  initTransaction(initTransactionNums.high, updateClients);
  ipcMain.removeHandler('getAutoSync');
  ipcMain.handle('getAutoSync', () => autoSync);

  ipcMain.removeHandler('setAutoSync');
  ipcMain.handle('setAutoSync', (event, newAutoSync: boolean) => {
    if (autoSync !== newAutoSync) {
      store.set('autoSync', newAutoSync);
      autoSync = newAutoSync;
      setAutoSync(newAutoSync);
      updateClients();
    }
  });

  initWebsocket(mainWindow);
  ipcMain.removeHandler('getWebsocketStatus');
  ipcMain.handle('getWebsocketStatus', getWebsocketStatus);

  let websocket = store.has('websocket')
    ? (store.get('websocket') as boolean)
    : true;
  if (websocket) {
    startWebsocketServer();
  }

  ipcMain.removeHandler('getWebsocket');
  ipcMain.handle('getWebsocket', () => websocket);

  ipcMain.removeHandler('setWebsocket');
  ipcMain.handle('setWebsocket', (event, newWebsocket: boolean) => {
    if (websocket !== newWebsocket) {
      store.set('websocket', newWebsocket);
      websocket = newWebsocket;
      if (websocket) {
        startWebsocketServer();
      } else {
        stopWebsocketServer();
      }
    }
  });

  ipcMain.removeHandler('getLocalTournaments');
  ipcMain.handle('getLocalTournaments', getTournaments);

  ipcMain.removeHandler('deleteLocalTournament');
  ipcMain.handle('deleteLocalTournament', (event, id: number) => {
    const currentId = getTournamentId();
    deleteTournament(id);
    if (id === currentId) {
      setTournamentId(0);
      updateClients();
    }
  });

  ipcMain.removeHandler('getAdminedTournaments');
  ipcMain.handle('getAdminedTournaments', async () => {
    return getAdminedTournaments();
  });

  ipcMain.removeHandler('getCurrentTournament');
  ipcMain.handle('getCurrentTournament', getTournament);

  ipcMain.removeHandler('getTournament');
  ipcMain.handle('getTournament', async (event, slug: string) => {
    const oldId = getTournamentId();
    const newId = await getApiTournament(slug);
    if (oldId !== newId) {
      setTournamentId(newId);
      updateClients();
      startRefreshingTournament(newId, slug);
    }
  });

  ipcMain.removeHandler('setTournament');
  ipcMain.handle('setTournament', (event, newId: number, slug: string) => {
    const oldId = getTournamentId();
    if (oldId !== newId) {
      setTournamentId(newId);
      updateClients();
      startRefreshingTournament(newId, slug);
    }
  });

  ipcMain.removeHandler('refreshTournament');
  ipcMain.handle('refreshTournament', () => {
    maybeTryNow(getTournamentId());
    updateClients();
  });

  ipcMain.removeHandler('retryTournament');
  ipcMain.handle('retryTournament', (event, id: number, slug: string) => {
    startRefreshingTournament(id, slug);
  });

  ipcMain.removeHandler('loadEvent');
  ipcMain.handle('loadEvent', async (event, eventId: number) => {
    const tournamentId = getTournamentId();
    await loadEvent(eventId, tournamentId);
    maybeTryNow(tournamentId);
    updateClients();
  });

  ipcMain.removeHandler('getPoolSiblings');
  ipcMain.handle(
    'getPoolSiblings',
    (event, waveId: number | null, phaseId: number) =>
      getPoolSiblings(waveId, phaseId),
  );

  ipcMain.removeHandler('upgradePoolSets');
  ipcMain.handle('upgradePoolSets', async (event, poolId: number) => {
    const previewSetId = getPreviewSetIdFromPool(poolId);
    if (!previewSetId) {
      throw new Error('Pool is already upgraded.');
    }

    await upgradePreviewSets([previewSetId]);
    updateClients();
  });

  ipcMain.removeHandler('upgradeWaveSets');
  ipcMain.handle('upgradeWaveSets', async (event, waveId: number) => {
    const previewSetIds = getPreviewSetIdsFromWave(waveId);
    if (previewSetIds.length === 0) {
      throw new Error('Every pool in wave is already upgraded.');
    }

    await upgradePreviewSets(previewSetIds);
    updateClients();
  });

  ipcMain.removeHandler('upgradePhaseSets');
  ipcMain.handle('upgradePhaseSets', async (event, phaseId: number) => {
    const previewSetIds = getPreviewSetIdsFromPhase(phaseId);
    if (previewSetIds.length === 0) {
      throw new Error('Every pool in phase is already upgraded.');
    }

    await upgradePreviewSets(previewSetIds);
    updateClients();
  });

  ipcMain.removeHandler('resetSet');
  ipcMain.handle('resetSet', (event, id: number) => {
    resetSetTransaction(id);
  });

  ipcMain.removeHandler('assignSetStation');
  ipcMain.handle('assignSetStation', (event, id: number, stationId: number) => {
    assignSetStationTransaction(id, stationId);
  });

  ipcMain.removeHandler('assignSetStream');
  ipcMain.handle('assignSetStream', (event, id: number, streamId: number) => {
    assignSetStreamTransaction(id, streamId);
  });

  ipcMain.removeHandler('callSet');
  ipcMain.handle('callSet', (event, id: number) => {
    callSetTransaction(id);
  });

  ipcMain.removeHandler('startSet');
  ipcMain.handle('startSet', (event, id: number) => {
    startSetTransaction(id);
  });

  ipcMain.removeHandler('reportSet');
  ipcMain.handle(
    'reportSet',
    (
      event,
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

  ipcMain.removeHandler('deleteTransaction');
  ipcMain.handle('deleteTransaction', (event, transactionNum: number) => {
    const tournamentId = deleteTransaction(transactionNum);
    updateClients();
    maybeTryNow(tournamentId);
  });

  ipcMain.removeHandler('makeResetRecursive');
  ipcMain.handle('makeResetRecursive', (event, transactionNum: number) => {
    const tournamentId = makeResetRecursive(transactionNum);
    maybeTryNow(tournamentId);
  });

  ipcMain.removeHandler('preemptReset');
  ipcMain.handle('preemptReset', (event, setId: number) => {
    const transactionNum = preemptTransactionNum;
    preemptTransactionNum -= 1;
    const ret = resetSet(setId, transactionNum, /* preempt */ true);
    updateClients();
    maybeTryNow(ret.tournamentId);
  });

  ipcMain.removeHandler('preemptReport');
  ipcMain.handle(
    'preemptReport',
    (
      event,
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
      const transactionNum = preemptTransactionNum;
      preemptTransactionNum -= 1;
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
      const ret = reportSet(id, winnerId, isDQ, apiGameData, transactionNum);
      updateClients();
      maybeTryNow(ret.tournamentId);
    },
  );

  ipcMain.removeHandler('getConflictResolve');
  ipcMain.handle(
    'getConflictResolve',
    (event, setId: number, transactionNum: number) =>
      getConflictResolve(setId, transactionNum),
  );

  ipcMain.removeHandler('getConflict');
  ipcMain.handle('getConflict', getConflict);

  ipcMain.removeHandler('getFatalErrorMessage');
  ipcMain.handle('getFatalErrorMessage', getFatalErrorMessage);

  ipcMain.removeHandler('getSyncResult');
  ipcMain.handle('getSyncResult', getSyncResult);

  ipcMain.removeHandler('getAppVersion');
  ipcMain.handle('getAppVersion', app.getVersion);

  ipcMain.removeHandler('openDbFolder');
  ipcMain.handle('openDbFolder', async () => {
    await shell.openPath(app.getPath('userData'));
  });

  ipcMain.removeHandler('copy');
  ipcMain.handle('copy', (event, text: string) => {
    clipboard.writeText(text);
  });

  ipcMain.removeAllListeners('getVersionLatest');
  ipcMain.handle('getVersionLatest', async () => {
    try {
      const response = await fetch(
        'https://api.github.com/repos/jmlee337/local-cache-for-startgg/releases/latest',
      );
      const json = await response.json();
      const latestVersion = json.tag_name;
      if (typeof latestVersion !== 'string') {
        return '';
      }
      return latestVersion;
    } catch {
      return '';
    }
  });

  ipcMain.removeAllListeners('update');
  ipcMain.on('update', async () => {
    await shell.openExternal(
      'https://github.com/jmlee337/local-cache-for-startgg/releases/latest',
    );
    app.quit();
  });

  (async () => {
    if (apiKey) {
      try {
        mainWindow.webContents.send(
          'adminedTournaments',
          await getAdminedTournaments(),
        );
      } catch {
        // just catch
      }
    }
  })();
}
