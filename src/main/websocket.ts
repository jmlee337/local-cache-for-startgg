import http from 'http';
import type { connection, Message } from 'websocket';
import websocket from 'websocket';
import { BrowserWindow } from 'electron';
import { createHash, randomBytes } from 'crypto';
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
  SubscriberTournament,
  WebsocketStatus,
} from '../common/types';

type Request = {
  num: number;
} & (
  | {
      op?: 'reset-set-request' | 'call-set-request' | 'start-set-request';
      id?: number;
    }
  | {
      op?: 'assign-set-station-request';
      id?: number;
      stationId?: number;
    }
  | {
      op?: 'assign-set-stream-request';
      id?: number;
      streamId?: number;
    }
  | {
      op?: 'report-set-request';
      id?: number;
      winnerId?: number;
      isDQ?: boolean;
      gameData?: ApiGameData[];
    }
  | {
      op?: 'client-id-request';
      computerName?: string;
      clientName?: string;
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
    | 'report-set-response'
    | 'client-id-response';
  err?: string;
  data?: {
    set: RendererSet;
  };
};

type Event =
  | {
      op: 'auth-success-event';
    }
  | {
      op: 'tournament-update-event';
      tournament?: SubscriberTournament;
    };

type AuthHello = {
  op: 'auth-hello';
  challenge: string;
  salt: string;
};

type AuthIdentify = {
  op: 'auth-identify';
  authentication: string;
};

const ADMIN_PROTOCOL = 'admin-protocol';
const BRACKET_PROTOCOL = 'bracket-protocol';
const UNAUTH_CODE = 4009;
const DEFAULT_PORT = 50000;

let httpServer: http.Server | null = null;
let websocketServer: websocket.server | null = null;

let err = '';
let port = 0;
const connections = new Map<
  connection,
  {
    computerName: string;
    clientName: string;
  }
>();
let mainWindow: BrowserWindow | null = null;
export function getWebsocketStatus(): WebsocketStatus {
  return {
    err,
    port,
    connections: Array.from(connections.entries())
      .filter(
        ([connection]) =>
          connection.socket.remoteAddress && connection.socket.remotePort,
      )
      .map(([connection, clientId]) => {
        let ret = `${connection.socket.remoteAddress}:${connection.socket.remotePort}`;
        if (clientId.computerName) {
          ret += ` - ${clientId.computerName}`;
        }
        if (clientId.clientName) {
          ret += ` - ${clientId.clientName}`;
        }
        return ret;
      }),
  };
}
function sendStatus() {
  mainWindow?.webContents.send('websocketStatus', getWebsocketStatus());
}

function sendTournamentUpdateEvent(
  connection: connection,
  subscriberTournament: SubscriberTournament | undefined,
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

function handleClientIdRequest(json: Request, newConnection: connection) {
  if (json.op !== 'client-id-request') {
    throw new Error('unreachable');
  }

  const response: Response = {
    num: json.num,
    op: 'client-id-response',
  };
  if (typeof json.computerName !== 'string') {
    response.err = 'computerName must be string';
    newConnection.sendUTF(JSON.stringify(response));
    return;
  }
  if (typeof json.clientName !== 'string') {
    response.err = 'clientName must be string';
    newConnection.sendUTF(JSON.stringify(response));
    return;
  }
  connections.set(newConnection, {
    computerName: json.computerName,
    clientName: json.clientName,
  });
  sendStatus();
  newConnection.sendUTF(JSON.stringify(response));
}

async function acceptAdminAuthentication(newConnection: connection) {
  connections.set(newConnection, { computerName: '', clientName: '' });
  sendStatus();
  const authSuccessEvent: Event = {
    op: 'auth-success-event',
  };
  newConnection.sendUTF(JSON.stringify(authSuccessEvent));
  sendTournamentUpdateEvent(newConnection, getLastSubscriberTournament());
  newConnection.on('message', async (data) => {
    if (data.type === 'binary') {
      return;
    }

    let json: Request | undefined;
    try {
      json = JSON.parse(data.utf8Data) as Request;
    } catch {
      return;
    }

    if (json.op === 'client-id-request') {
      handleClientIdRequest(json, newConnection);
    } else if (json.op === 'reset-set-request') {
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
      if (json.stationId === undefined || !Number.isInteger(json.stationId)) {
        response.err = 'stationId must be integer';
        newConnection.sendUTF(JSON.stringify(response));
        return;
      }
      try {
        response.data = assignSetStationTransaction(json.id, json.stationId);
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
      if (json.streamId === undefined || !Number.isInteger(json.streamId)) {
        response.err = 'streamId must be integer';
        newConnection.sendUTF(JSON.stringify(response));
        return;
      }
      try {
        response.data = assignSetStreamTransaction(json.id, json.streamId);
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
      if (json.winnerId === undefined || !Number.isInteger(json.winnerId)) {
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
}

let websocketPassword = '';
export function setWebsocketPassword(newWebsocketPassword: string) {
  if (websocketServer) {
    throw new Error(
      'cannot change websocket password while websocket server is running',
    );
  }

  websocketPassword = newWebsocketPassword;
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
        if (request.requestedProtocols[0] === ADMIN_PROTOCOL) {
          const newConnection = request.accept(ADMIN_PROTOCOL, request.origin);
          const salt = Buffer.from(randomBytes(32)).toString('base64url');
          const secret = createHash('sha256')
            .update(websocketPassword)
            .update(salt)
            .digest()
            .toString('base64url');
          const challenge = Buffer.from(randomBytes(32)).toString('base64url');
          const authentication = createHash('sha256')
            .update(secret)
            .update(challenge)
            .digest()
            .toString('base64url');
          const authHello: AuthHello = {
            op: 'auth-hello',
            salt,
            challenge,
          };
          const identifyCb = (data: Message) => {
            if (data.type === 'binary') {
              newConnection.close(UNAUTH_CODE);
              return;
            }

            try {
              const json = JSON.parse(data.utf8Data) as AuthIdentify;
              if (json.op === 'auth-identify') {
                if (json.authentication === authentication) {
                  newConnection.removeListener('message', identifyCb);
                  acceptAdminAuthentication(newConnection);
                  return;
                }
              }
            } catch {
              // just catch
            }
            newConnection.close(UNAUTH_CODE);
          };
          newConnection.on('message', identifyCb);
          newConnection.sendUTF(JSON.stringify(authHello));
          return;
        }
        if (request.requestedProtocols[0] === BRACKET_PROTOCOL) {
          const newConnection = request.accept(
            BRACKET_PROTOCOL,
            request.origin,
          );
          connections.set(newConnection, { computerName: '', clientName: '' });
          newConnection.on('message', (data) => {
            if (data.type === 'binary') {
              return;
            }

            let json: Request | undefined;
            try {
              json = JSON.parse(data.utf8Data) as Request;
            } catch {
              return;
            }

            if (json.op === 'client-id-request') {
              handleClientIdRequest(json, newConnection);
            }
          });
          newConnection.on('close', () => {
            newConnection.removeAllListeners();
            connections.delete(newConnection);
            sendStatus();
          });
          sendStatus();
          sendTournamentUpdateEvent(
            newConnection,
            getLastSubscriberTournament(),
          );
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
  subscriberTournament: SubscriberTournament | undefined,
) {
  Array.from(connections.keys()).forEach((connection) => {
    sendTournamentUpdateEvent(connection, subscriberTournament);
  });
}
