import http from 'http';
import type { connection } from 'websocket';
import websocket from 'websocket';
import { BrowserWindow } from 'electron';
import { getLastSubscriberTournament } from './db';
import {
  assignSetStationTransaction,
  assignSetStreamTransaction,
  callSetTransaction,
  reportSetTransaction,
  resetSetTransaction,
  startSetTransaction,
} from './transaction';
import {
  ApiGameData,
  RendererSet,
  RendererTournament,
  WebsocketStatus,
} from '../common/types';

type Request = {
  num: number;
  id?: number;
} & (
  | {
      op?: 'reset-set-request' | 'call-set-request' | 'start-set-request';
    }
  | {
      op?: 'assign-set-station-request';
      stationId?: number;
    }
  | {
      op?: 'assign-set-stream-request';
      streamId?: number;
    }
  | {
      op?: 'report-set-request';
      winnerId?: number;
      isDQ?: boolean;
      gameData?: ApiGameData[];
    }
);

type Response = {
  num: number;
  op:
    | 'reset-set-response'
    | 'call-set-response'
    | 'start-set-response'
    | 'assign-set-station-response'
    | 'assign-set-stream-response'
    | 'report-set-response';
  err?: string;
  data?: {
    set: RendererSet;
  };
};

type Event = {
  op: 'tournament-update-event';
  tournament?: RendererTournament;
};

const BRACKET_PROTOCOL = 'bracket-protocol';
const DEFAULT_PORT = 50000;

let httpServer: http.Server | null = null;
let websocketServer: websocket.server | null = null;

let err = '';
let port = 0;
const connections = new Set<connection>();
let mainWindow: BrowserWindow | null = null;
export function getWebsocketStatus(): WebsocketStatus {
  return {
    err,
    port,
    connections: Array.from(connections.values())
      .filter(
        (connection) =>
          connection.socket.remoteAddress && connection.socket.remotePort,
      )
      .map(
        (connection) =>
          `${connection.socket.remoteAddress}:${connection.socket.remotePort}`,
      ),
  };
}
function sendStatus() {
  mainWindow?.webContents.send('websocketStatus', getWebsocketStatus());
}

function sendTournamentUpdateEvent(
  connection: connection,
  subscriberTournament: RendererTournament | undefined,
) {
  const event: Event = {
    op: 'tournament-update-event',
    tournament: subscriberTournament,
  };
  connection.sendUTF(JSON.stringify(event));
}

const PORT_IN_USE_ERR = 'Port in use';
async function startHttpServer(httpPort: number) {
  try {
    await new Promise<void>((resolve, reject) => {
      httpServer = http.createServer();
      httpServer.once('error', (e) => {
        httpServer?.removeAllListeners();
        httpServer = null;
        reject(e);
      });
      httpServer.listen(
        httpPort,
        '127.0.0.1', // allow only local conenctions
        511, // default backlog queue length
        () => {
          httpServer!.removeAllListeners('error');
          httpServer!.on('error', (error) => {
            err = error.message;
            sendStatus();
          });
          resolve();
        },
      );
    });
    return '';
  } catch (e: any) {
    if (e.code === 'EADDRINUSE') {
      return PORT_IN_USE_ERR;
    }
    return e instanceof Error ? e.message : (e as string);
  }
}

export async function startWebsocketServer() {
  if (!httpServer) {
    port = DEFAULT_PORT;
    err = await startHttpServer(port);
    if (err === PORT_IN_USE_ERR) {
      do {
        port += 1;
        err = await startHttpServer(port);
      } while (err === PORT_IN_USE_ERR);
    }
    if (err) {
      sendStatus();
      return;
    }
    if (!httpServer) {
      throw new Error('unreachable');
    }
  }

  if (!websocketServer) {
    // eslint-disable-next-line new-cap
    websocketServer = new websocket.server({ httpServer });
    websocketServer.on('request', async (request) => {
      if (request.requestedProtocols.length === 1) {
        if (request.requestedProtocols[0] === BRACKET_PROTOCOL) {
          const newConnection = request.accept(
            BRACKET_PROTOCOL,
            request.origin,
          );
          connections.add(newConnection);
          sendStatus();
          sendTournamentUpdateEvent(
            newConnection,
            getLastSubscriberTournament(),
          );
          newConnection.on('message', async (data) => {
            if (data.type === 'binary') {
              return;
            }

            const json = JSON.parse(data.utf8Data) as Request;
            if (json.op === 'reset-set-request') {
              const response: Response = {
                num: json.num,
                op: 'reset-set-response',
              };
              if (json.id === undefined || !Number.isInteger(json.id)) {
                response.err = 'id must be integer';
                newConnection.sendUTF(JSON.stringify(response));
                return;
              }
              try {
                response.data = resetSetTransaction(json.id);
                newConnection.sendUTF(JSON.stringify(response));
              } catch (e: any) {
                response.err = e instanceof Error ? e.message : e.toString();
                newConnection.sendUTF(JSON.stringify(response));
              }
            } else if (json.op === 'call-set-request') {
              const response: Response = {
                num: json.num,
                op: 'call-set-response',
              };
              if (json.id === undefined || !Number.isInteger(json.id)) {
                response.err = 'id must be integer';
                newConnection.sendUTF(JSON.stringify(response));
                return;
              }
              try {
                response.data = callSetTransaction(json.id);
                newConnection.sendUTF(JSON.stringify(response));
              } catch (e: any) {
                response.err = e instanceof Error ? e.message : e.toString();
                newConnection.sendUTF(JSON.stringify(response));
              }
            } else if (json.op === 'start-set-request') {
              const response: Response = {
                num: json.num,
                op: 'start-set-response',
              };
              if (json.id === undefined || !Number.isInteger(json.id)) {
                response.err = 'id must be integer';
                newConnection.sendUTF(JSON.stringify(response));
                return;
              }
              try {
                response.data = startSetTransaction(json.id);
                newConnection.sendUTF(JSON.stringify(response));
              } catch (e: any) {
                response.err = e instanceof Error ? e.message : e.toString();
                newConnection.sendUTF(JSON.stringify(response));
              }
            } else if (json.op === 'assign-set-station-request') {
              const response: Response = {
                num: json.num,
                op: 'assign-set-station-response',
              };
              if (json.id === undefined || !Number.isInteger(json.id)) {
                response.err = 'id must be integer';
                newConnection.sendUTF(JSON.stringify(response));
                return;
              }
              if (
                json.stationId === undefined ||
                !Number.isInteger(json.stationId)
              ) {
                response.err = 'stationId must be integer';
                newConnection.sendUTF(JSON.stringify(response));
                return;
              }
              try {
                response.data = assignSetStationTransaction(
                  json.id,
                  json.stationId,
                );
                newConnection.sendUTF(JSON.stringify(response));
              } catch (e: any) {
                response.err = e instanceof Error ? e.message : e.toString();
                newConnection.sendUTF(JSON.stringify(response));
              }
            } else if (json.op === 'assign-set-stream-request') {
              const response: Response = {
                num: json.num,
                op: 'assign-set-stream-response',
              };
              if (json.id === undefined || !Number.isInteger(json.id)) {
                response.err = 'id must be integer';
                newConnection.sendUTF(JSON.stringify(response));
                return;
              }
              if (
                json.streamId === undefined ||
                !Number.isInteger(json.streamId)
              ) {
                response.err = 'streamId must be integer';
                newConnection.sendUTF(JSON.stringify(response));
                return;
              }
              try {
                response.data = assignSetStreamTransaction(
                  json.id,
                  json.streamId,
                );
                newConnection.sendUTF(JSON.stringify(response));
              } catch (e: any) {
                response.err = e instanceof Error ? e.message : e.toString();
                newConnection.sendUTF(JSON.stringify(response));
              }
            } else if (json.op === 'report-set-request') {
              const response: Response = {
                num: json.num,
                op: 'report-set-response',
              };
              if (json.id === undefined || !Number.isInteger(json.id)) {
                response.err = 'id must be integer';
                newConnection.sendUTF(JSON.stringify(response));
                return;
              }
              if (
                json.winnerId === undefined ||
                !Number.isInteger(json.winnerId)
              ) {
                response.err = 'winnerId must be integer';
                newConnection.sendUTF(JSON.stringify(response));
                return;
              }
              if (typeof json.isDQ !== 'boolean') {
                response.err = 'isDQ must be boolean';
                newConnection.sendUTF(JSON.stringify(response));
                return;
              }
              if (!Array.isArray(json.gameData)) {
                response.err = 'gameData must be array';
                newConnection.sendUTF(JSON.stringify(response));
                return;
              }
              try {
                response.data = reportSetTransaction(
                  json.id,
                  json.winnerId,
                  json.isDQ,
                  json.gameData,
                );
                newConnection.sendUTF(JSON.stringify(response));
              } catch (e: any) {
                response.err = e instanceof Error ? e.message : e.toString();
                newConnection.sendUTF(JSON.stringify(response));
              }
            }
          });
          newConnection.on('close', () => {
            newConnection.removeAllListeners();
            connections.delete(newConnection);
            sendStatus();
          });
          return;
        }
      }
      request.reject(
        400,
        `invalid requested protocol(s): ${request.requestedProtocols}`,
      );
    });
  }

  sendStatus();
}

export function stopWebsocketServer() {
  if (websocketServer) {
    websocketServer.removeAllListeners();
    websocketServer.shutDown();
    websocketServer = null;
  }
  if (httpServer) {
    httpServer.removeAllListeners();
    httpServer.close();
    httpServer = null;
  }
  connections.clear();
  err = '';
  port = 0;
  sendStatus();
}

export function initWebsocket(initMainWindow: BrowserWindow) {
  stopWebsocketServer();
  mainWindow = initMainWindow;
}

export function updateSubscribers(
  subscriberTournament: RendererTournament | undefined,
) {
  Array.from(connections.keys()).forEach((connection) => {
    sendTournamentUpdateEvent(connection, subscriberTournament);
  });
}
