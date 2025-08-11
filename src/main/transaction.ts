import { ApiGameData, ApiTransaction, TransactionType } from '../common/types';
import {
  assignSetStation,
  assignSetStream,
  reportSet,
  resetSet,
  startSet,
} from './db';
import { maybeTryNow } from './startgg';

let transactionNum = 0;
let updateClients = () => {};
export function initTransaction(
  initTransactionNum: number,
  initUpdateClients: () => void,
) {
  transactionNum = initTransactionNum;
  updateClients = initUpdateClients;
}

export function resetSetTransaction(id: number) {
  const currentTransactionNum = transactionNum;
  transactionNum += 1;
  const ret = resetSet(id, currentTransactionNum);
  updateClients();
  maybeTryNow(ret.tournamentId);
  return { set: ret.set };
}

export function startSetTransaction(id: number) {
  const currentTransactionNum = transactionNum;
  transactionNum += 1;
  const ret = startSet(id, currentTransactionNum);
  updateClients();
  maybeTryNow(ret.tournamentId);
  return { set: ret.set };
}

export function assignSetStationTransaction(id: number, stationId: number) {
  const currentTransactionNum = transactionNum;
  transactionNum += 1;
  const ret = assignSetStation(id, stationId, currentTransactionNum);
  updateClients();
  maybeTryNow(ret.tournamentId);
  return { set: ret.set };
}

export function assignSetStreamTransaction(id: number, streamId: number) {
  const currentTransactionNum = transactionNum;
  transactionNum += 1;
  const ret = assignSetStream(id, streamId, currentTransactionNum);
  updateClients();
  maybeTryNow(ret.tournamentId);
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
  const ret = reportSet(id, winnerId, isDQ, gameData, currentTransactionNum);
  updateClients();
  maybeTryNow(ret.tournamentId);
  return { set: ret.set };
}
