import http from 'http';
import { BrowserWindow } from 'electron';
import { createHash, randomBytes } from 'crypto';
import { createSocket } from 'dgram';
import { Bonjour } from 'bonjour-service';
import { RawData, WebSocket, WebSocketServer } from 'ws';
import AsyncLock from 'async-lock';
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

const HTTP_PORT = 80;
const ADMIN_PROTOCOL = 'admin-protocol';
const BRACKET_PROTOCOL = 'bracket-protocol';
const UNAUTH_CODE = 4009;

let httpServer: http.Server | null = null;
let websocketServer: WebSocketServer | null = null;

let err = '';
let host = '';
let v4Address = '';
let v6Address = '';
let port = 0;
const webSockets = new Map<
  WebSocket,
  {
    computerName: string;
    clientName: string;
    remoteAddress?: string;
    remotePort?: number;
  }
>();
let mainWindow: BrowserWindow | null = null;
export function getWebsocketStatus(): WebsocketStatus {
  return {
    err,
    host,
    v4Address,
    v6Address,
    port,
    connections: Array.from(webSockets.values())
      .filter(
        (webSocketInfo) =>
          webSocketInfo.remoteAddress && webSocketInfo.remotePort,
      )
      .map((webSocketInfo) => ({
        addressPort: `${webSocketInfo.remoteAddress}:${webSocketInfo.remotePort}`,
        computerName: webSocketInfo.computerName,
        clientName: webSocketInfo.clientName,
      })),
  };
}
function sendStatus() {
  mainWindow?.webContents.send('websocketStatus', getWebsocketStatus());
}

function sendTournamentUpdateEvent(
  webSocket: WebSocket,
  subscriberTournament: SubscriberTournament | undefined,
) {
  const event: Event = {
    op: 'tournament-update-event',
    tournament: subscriberTournament,
  };
  webSocket.send(JSON.stringify(event));
}

function handleClientIdRequest(json: Request, newWebSocket: WebSocket) {
  if (json.op !== 'client-id-request') {
    throw new Error('unreachable');
  }

  const response: Response = {
    num: json.num,
    op: 'client-id-response',
  };
  if (typeof json.computerName !== 'string') {
    response.err = 'computerName must be string';
    newWebSocket.send(JSON.stringify(response));
    return;
  }
  if (typeof json.clientName !== 'string') {
    response.err = 'clientName must be string';
    newWebSocket.send(JSON.stringify(response));
    return;
  }

  const webSocketInfo = webSockets.get(newWebSocket);
  if (webSocketInfo) {
    webSocketInfo.computerName = json.computerName;
    webSocketInfo.clientName = json.clientName;
  }
  sendStatus();
  newWebSocket.send(JSON.stringify(response));
}

async function afterAdminAuthentication(newWebSocket: WebSocket) {
  const authSuccessEvent: Event = {
    op: 'auth-success-event',
  };
  newWebSocket.send(JSON.stringify(authSuccessEvent));
  sendTournamentUpdateEvent(newWebSocket, getLastSubscriberTournament());
  newWebSocket.on('message', (data, isBinary) => {
    if (isBinary) {
      return;
    }

    let json: Request | undefined;
    try {
      json = JSON.parse(data.toString()) as Request;
    } catch {
      return;
    }

    if (json.op === 'client-id-request') {
      handleClientIdRequest(json, newWebSocket);
    } else if (json.op === 'reset-set-request') {
      const response: Response = {
        num: json.num,
        op: 'reset-set-response',
      };
      if (json.id === undefined || !Number.isInteger(json.id)) {
        response.err = 'id must be integer';
        newWebSocket.send(JSON.stringify(response));
        return;
      }
      try {
        response.data = resetSetTransaction(json.id);
        newWebSocket.send(JSON.stringify(response));
      } catch (e: any) {
        response.err = e instanceof Error ? e.message : e.toString();
        newWebSocket.send(JSON.stringify(response));
      }
    } else if (json.op === 'call-set-request') {
      const response: Response = {
        num: json.num,
        op: 'call-set-response',
      };
      if (json.id === undefined || !Number.isInteger(json.id)) {
        response.err = 'id must be integer';
        newWebSocket.send(JSON.stringify(response));
        return;
      }
      try {
        response.data = callSetTransaction(json.id);
        newWebSocket.send(JSON.stringify(response));
      } catch (e: any) {
        response.err = e instanceof Error ? e.message : e.toString();
        newWebSocket.send(JSON.stringify(response));
      }
    } else if (json.op === 'start-set-request') {
      const response: Response = {
        num: json.num,
        op: 'start-set-response',
      };
      if (json.id === undefined || !Number.isInteger(json.id)) {
        response.err = 'id must be integer';
        newWebSocket.send(JSON.stringify(response));
        return;
      }
      try {
        response.data = startSetTransaction(json.id);
        newWebSocket.send(JSON.stringify(response));
      } catch (e: any) {
        response.err = e instanceof Error ? e.message : e.toString();
        newWebSocket.send(JSON.stringify(response));
      }
    } else if (json.op === 'assign-set-station-request') {
      const response: Response = {
        num: json.num,
        op: 'assign-set-station-response',
      };
      if (json.id === undefined || !Number.isInteger(json.id)) {
        response.err = 'id must be integer';
        newWebSocket.send(JSON.stringify(response));
        return;
      }
      if (json.stationId === undefined || !Number.isInteger(json.stationId)) {
        response.err = 'stationId must be integer';
        newWebSocket.send(JSON.stringify(response));
        return;
      }
      try {
        response.data = assignSetStationTransaction(json.id, json.stationId);
        newWebSocket.send(JSON.stringify(response));
      } catch (e: any) {
        response.err = e instanceof Error ? e.message : e.toString();
        newWebSocket.send(JSON.stringify(response));
      }
    } else if (json.op === 'assign-set-stream-request') {
      const response: Response = {
        num: json.num,
        op: 'assign-set-stream-response',
      };
      if (json.id === undefined || !Number.isInteger(json.id)) {
        response.err = 'id must be integer';
        newWebSocket.send(JSON.stringify(response));
        return;
      }
      if (json.streamId === undefined || !Number.isInteger(json.streamId)) {
        response.err = 'streamId must be integer';
        newWebSocket.send(JSON.stringify(response));
        return;
      }
      try {
        response.data = assignSetStreamTransaction(json.id, json.streamId);
        newWebSocket.send(JSON.stringify(response));
      } catch (e: any) {
        response.err = e instanceof Error ? e.message : e.toString();
        newWebSocket.send(JSON.stringify(response));
      }
    } else if (json.op === 'report-set-request') {
      const response: Response = {
        num: json.num,
        op: 'report-set-response',
      };
      if (json.id === undefined || !Number.isInteger(json.id)) {
        response.err = 'id must be integer';
        newWebSocket.send(JSON.stringify(response));
        return;
      }
      if (json.winnerId === undefined || !Number.isInteger(json.winnerId)) {
        response.err = 'winnerId must be integer';
        newWebSocket.send(JSON.stringify(response));
        return;
      }
      if (typeof json.isDQ !== 'boolean') {
        response.err = 'isDQ must be boolean';
        newWebSocket.send(JSON.stringify(response));
        return;
      }
      if (!Array.isArray(json.gameData)) {
        response.err = 'gameData must be array';
        newWebSocket.send(JSON.stringify(response));
        return;
      }
      try {
        response.data = reportSetTransaction(
          json.id,
          json.winnerId,
          json.isDQ,
          json.gameData,
        );
        newWebSocket.send(JSON.stringify(response));
      } catch (e: any) {
        response.err = e instanceof Error ? e.message : e.toString();
        newWebSocket.send(JSON.stringify(response));
      }
    }
  });
  newWebSocket.on('close', () => {
    newWebSocket.removeAllListeners();
    webSockets.delete(newWebSocket);
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

function tryPublish(presentBonjour: Bonjour, suffixNum: number) {
  return new Promise<string>((resolve, reject) => {
    const name = suffixNum === 0 ? 'offlinemode' : `offlinemode-${suffixNum}`;
    const newHost = `${name}.local`;
    const service = presentBonjour.publish({
      host: newHost,
      name,
      port: 80,
      type: 'http',
    });
    const timeout = setTimeout(() => {
      if (service.stop) {
        service.stop();
      }
      reject();
    }, 2000);
    service.on('up', () => {
      clearTimeout(timeout);
      service.removeAllListeners();
      resolve(newHost);
    });
  });
}

const lock = new AsyncLock();
const KEY = 'STARTSTOPKEY';
let bonjour: Bonjour | null;
export function startWebsocketServer() {
  return lock.acquire(KEY, async (release) => {
    if (!httpServer) {
      httpServer = http.createServer();
      try {
        await new Promise<void>((resolve, reject) => {
          httpServer!.once('error', (error) => {
            httpServer!.removeAllListeners();
            err = error.message;
            reject(error);
          });
          httpServer!.listen({ port: HTTP_PORT }, () => {
            httpServer!.removeAllListeners('error');
            httpServer!.on('error', (error) => {
              err = error.message;
              sendStatus();
            });
            resolve();
          });
        });
        port = HTTP_PORT;
      } catch (e: any) {
        httpServer = null;
        sendStatus();
        release();
        return;
      }

      const udp4Socket = createSocket('udp4');
      try {
        await new Promise<void>((resolve, reject) => {
          udp4Socket.connect(53, '8.8.8.8', () => {
            try {
              v4Address = udp4Socket.address().address;
              udp4Socket.close();
              resolve();
            } catch {
              v4Address = '';
              udp4Socket.close();
              reject();
            }
          });
        });
      } catch {
        // just catch
      }

      const udp6Socket = createSocket('udp6');
      try {
        await new Promise<void>((resolve, reject) => {
          udp6Socket.connect(53, '2001:4860:4860::8888', () => {
            try {
              v6Address = udp6Socket.address().address;
              udp6Socket.close();
              resolve();
            } catch {
              v6Address = '';
              udp6Socket.close();
              reject();
            }
          });
        });
      } catch {
        // just catch
      }
    }

    if (!websocketServer) {
      websocketServer = new WebSocketServer({
        server: httpServer,
        handleProtocols: (protocols) => {
          if (protocols.has(ADMIN_PROTOCOL)) {
            return ADMIN_PROTOCOL;
          }
          return BRACKET_PROTOCOL;
        },
      });
      websocketServer.on('connection', (newWebSocket, request) => {
        if (newWebSocket.protocol === ADMIN_PROTOCOL) {
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
          const identifyCb = (data: RawData, isBinary: boolean) => {
            if (isBinary) {
              newWebSocket.close(UNAUTH_CODE);
              return;
            }

            try {
              const json = JSON.parse(data.toString()) as AuthIdentify;
              if (json.op === 'auth-identify') {
                if (json.authentication === authentication) {
                  newWebSocket.removeListener('message', identifyCb);
                  webSockets.set(newWebSocket, {
                    computerName: '',
                    clientName: '',
                    remoteAddress: request.socket.remoteAddress,
                    remotePort: request.socket.remotePort,
                  });
                  sendStatus();
                  afterAdminAuthentication(newWebSocket);
                  return;
                }
              }
            } catch {
              // just catch
            }
            newWebSocket.close(UNAUTH_CODE);
          };
          newWebSocket.on('message', identifyCb);
          newWebSocket.send(JSON.stringify(authHello));
          return;
        }

        webSockets.set(newWebSocket, {
          computerName: '',
          clientName: '',
          remoteAddress: request.socket.remoteAddress,
          remotePort: request.socket.remotePort,
        });
        newWebSocket.on('message', (data, isBinary) => {
          if (isBinary) {
            return;
          }

          let json: Request | undefined;
          try {
            json = JSON.parse(data.toString()) as Request;
          } catch {
            return;
          }

          if (json.op === 'client-id-request') {
            handleClientIdRequest(json, newWebSocket);
          }
        });
        newWebSocket.on('close', () => {
          newWebSocket.removeAllListeners();
          webSockets.delete(newWebSocket);
          sendStatus();
        });
        sendStatus();
        sendTournamentUpdateEvent(newWebSocket, getLastSubscriberTournament());
      });
    }

    if (!bonjour) {
      bonjour = new Bonjour();
      let suffixNum = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        try {
          host = await tryPublish(bonjour, suffixNum);
          break;
        } catch {
          suffixNum += 1;
        }
      }
    }

    sendStatus();
    release();
  });
}

export function stopWebsocketServer() {
  return lock.acquire(KEY, async (release) => {
    const bonjourPromise = new Promise<void>((resolve) => {
      if (!bonjour) {
        resolve();
        return;
      }

      bonjour.unpublishAll(() => {
        bonjour?.destroy(() => {
          bonjour = null;
          resolve();
        });
      });
    });
    await new Promise<void>((resolve) => {
      if (!websocketServer) {
        resolve();
        return;
      }

      Array.from(websocketServer.clients).forEach((webSocket) => {
        webSocket.terminate();
      });

      websocketServer.on('close', () => {
        websocketServer?.removeAllListeners();
        websocketServer = null;
        resolve();
      });
      websocketServer.close();
    });
    await new Promise<void>((resolve) => {
      if (!httpServer) {
        resolve();
        return;
      }

      httpServer.on('close', () => {
        httpServer?.removeAllListeners();
        httpServer = null;
        resolve();
      });
      httpServer.close();
    });
    await bonjourPromise;

    webSockets.clear();
    err = '';
    host = '';
    v4Address = '';
    v6Address = '';
    port = 0;
    sendStatus();
    release();
  });
}

export function initWebsocket(initMainWindow: BrowserWindow) {
  mainWindow = initMainWindow;
}

export function updateSubscribers(
  subscriberTournament: SubscriberTournament | undefined,
) {
  Array.from(webSockets.keys()).forEach((connection) => {
    sendTournamentUpdateEvent(connection, subscriberTournament);
  });
}

export function isBonjourRunning() {
  return !!bonjour;
}
