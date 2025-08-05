import { ApiGameData, ApiTransaction, TransactionType } from '../common/types';
import {
  assignSetStation,
  assignSetStream,
  insertTransaction,
  reportSet,
  resetSet,
  startSet,
} from './db';
import { queueTransaction } from './startgg';

let autoSync = false;
let transactionNum = 0;
let updateClients = () => {};
export function initTransaction(
  initAutoSync: boolean,
  initTransactionNum: number,
  initUpdateClients: () => void,
) {
  autoSync = initAutoSync;
  transactionNum = initTransactionNum;
  updateClients = initUpdateClients;
}

export function setAutoSyncTransaction(newAutoSync: boolean) {
  autoSync = newAutoSync;
}

export function resetSetTransaction(id: number) {
  const currentTransactionNum = transactionNum;
  transactionNum += 1;
  const ret = resetSet(
    id,
    currentTransactionNum,
    autoSync ? Date.now() : 0, // queuedMs
  );
  const apiTransaction: ApiTransaction = {
    transactionNum: currentTransactionNum,
    type: TransactionType.RESET,
    setId: id,
  };
  insertTransaction(apiTransaction, ret.eventId);
  if (autoSync) {
    queueTransaction(apiTransaction);
  }
  updateClients();
  return { set: ret.set };
}

export function startSetTransaction(id: number) {
  const currentTransactionNum = transactionNum;
  transactionNum += 1;
  const ret = startSet(
    id,
    currentTransactionNum,
    autoSync ? Date.now() : 0, // queuedMs
  );
  const apiTransaction: ApiTransaction = {
    transactionNum: currentTransactionNum,
    type: TransactionType.START,
    setId: id,
  };
  insertTransaction(apiTransaction, ret.eventId);
  if (autoSync) {
    queueTransaction(apiTransaction);
  }
  updateClients();
  return { set: ret.set };
}

export function assignSetStationTransaction(id: number, stationId: number) {
  const currentTransactionNum = transactionNum;
  transactionNum += 1;
  const ret = assignSetStation(
    id,
    stationId,
    currentTransactionNum,
    autoSync ? Date.now() : 0, // queuedMs
  );
  const apiTransaction: ApiTransaction = {
    transactionNum: currentTransactionNum,
    type: TransactionType.ASSIGN_STATION,
    setId: id,
    stationId,
  };
  insertTransaction(apiTransaction, ret.eventId);
  if (autoSync) {
    queueTransaction(apiTransaction);
  }
  updateClients();
  return { set: ret.set };
}

export function assignSetStreamTransaction(id: number, streamId: number) {
  const currentTransactionNum = transactionNum;
  transactionNum += 1;
  const ret = assignSetStream(
    id,
    streamId,
    currentTransactionNum,
    autoSync ? Date.now() : 0, // queuedMs
  );
  const apiTransaction: ApiTransaction = {
    transactionNum: currentTransactionNum,
    type: TransactionType.ASSIGN_STREAM,
    setId: id,
    streamId,
  };
  insertTransaction(apiTransaction, ret.eventId);
  if (autoSync) {
    queueTransaction(apiTransaction);
  }
  updateClients();
  return { set: ret.set };
}

export function reportSetTransaction(
  id: number,
  winnerId: number,
  isDQ: boolean,
  gameData: ApiGameData[],
) {
  const error = new Error(`invalid gameData: ${gameData}`);
  if (!Array.isArray(gameData)) {
    throw error;
  }
  for (let i = 0; i < gameData.length; i += 1) {
    const game = gameData[i];
    if (!Number.isInteger(game.gameNum) || game.gameNum < 1) {
      throw error;
    }
    if (!Number.isInteger(game.winnerId) || game.winnerId < 0) {
      throw error;
    }
    if (
      game.stageId !== undefined &&
      (!Number.isInteger(game.stageId) || game.stageId < 1)
    ) {
      throw error;
    }
    if (!Array.isArray(game.selections)) {
      throw error;
    }
    for (let j = 0; j < game.selections.length; j += 1) {
      const selection = game.selections[j];
      if (
        !Number.isInteger(selection.characterId) ||
        selection.characterId < 1
      ) {
        throw error;
      }
      if (!Number.isInteger(selection.entrantId) || selection.entrantId < 0) {
        throw error;
      }
    }
  }

  const currentTransactionNum = transactionNum;
  transactionNum += 1;
  const ret = reportSet(
    id,
    winnerId,
    isDQ,
    gameData,
    currentTransactionNum,
    autoSync ? Date.now() : 0, // queuedMs
  );
  const apiTransaction: ApiTransaction = {
    transactionNum: currentTransactionNum,
    type: TransactionType.REPORT,
    setId: id,
    winnerId,
    isDQ,
    gameData,
  };
  insertTransaction(apiTransaction, ret.eventId);
  if (autoSync) {
    queueTransaction(apiTransaction);
  }
  updateClients();
  return { set: ret.set };
}
