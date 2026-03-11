import http from 'http';
import { BrowserWindow } from 'electron';
import { createHash, randomBytes } from 'crypto';
import { createSocket } from 'dgram';
import DnsSd, { DnsSdAdvertisement } from '@fugood/dns-sd';
import { CiaoService, getResponder, Responder } from '@homebridge/ciao';
import { RawData, WebSocket, WebSocketServer } from 'ws';
import AsyncLock from 'async-lock';
import { hostname } from 'os';
import express from 'express';
import path from 'path';
import { Socket } from 'net';
import {
  getLastSubscriberTournament,
  getReporterPools,
  getTournamentReporterPools,
  getTournamentReporters,
  reporterHasPermission,
} from './db';
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
  DbReporter,
  Protocol,
  RendererEvent,
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

function getResponseOp(
  requestOp:
    | 'reset-set-request'
    | 'call-set-request'
    | 'start-set-request'
    | 'assign-set-station-request'
    | 'assign-set-stream-request'
    | 'report-set-request',
) {
  switch (requestOp) {
    case 'reset-set-request':
      return 'reset-set-response';
    case 'call-set-request':
      return 'call-set-response';
    case 'start-set-request':
      return 'start-set-response';
    case 'assign-set-station-request':
      return 'assign-set-station-response';
    case 'assign-set-stream-request':
      return 'assign-set-stream-response';
    case 'report-set-request':
      return 'report-set-response';
    default:
      throw new Error('unreachable');
  }
}

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
const REPORTER_PROTOCOL = 'reporter-protocol';
const UNAUTH_CODE = 4009;

let err = '';
let host = '';
let v4Address = '';
let v6Address = '';
let port = 0;
const allWebsockets = new Set<WebSocket>();
const fullyConnectedWebSockets = new Map<
  WebSocket,
  {
    protocol: Protocol;
    computerName: string;
    clientName: string;
    remoteAddress?: string;
    remotePort?: number;
  }
>();
const fullyConnectedReporterWebSockets = new Map<
  WebSocket,
  {
    protocol: Protocol.REPORTER;
    computerName: string;
    clientName: string;
    remoteAddress?: string;
    remotePort?: number;
    reporterId: string;
  }
>();
let mainWindow: BrowserWindow | null = null;
export function getWebsocketStatus(): WebsocketStatus {
  return {
    err,
    host: host ? `http://${host}` : '',
    v4Address: v4Address ? `http://${v4Address}` : '',
    v6Address: v6Address ? `http://[${v6Address}]` : '',
    port,
    connections: [
      ...Array.from(fullyConnectedWebSockets.values())
        .filter(
          (webSocketInfo) =>
            webSocketInfo.remoteAddress && webSocketInfo.remotePort,
        )
        .map((webSocketInfo) => ({
          addressPort: `${webSocketInfo.remoteAddress}:${webSocketInfo.remotePort}`,
          protocol: webSocketInfo.protocol,
          computerName: webSocketInfo.computerName,
          clientName: webSocketInfo.clientName,
        })),
      ...Array.from(fullyConnectedReporterWebSockets.values())
        .filter(
          (webSocketInfo) =>
            webSocketInfo.remoteAddress && webSocketInfo.remotePort,
        )
        .map((webSocketInfo) => ({
          addressPort: `${webSocketInfo.remoteAddress}:${webSocketInfo.remotePort}`,
          protocol: webSocketInfo.protocol,
          computerName: webSocketInfo.computerName,
          clientName: webSocketInfo.clientName,
        })),
    ].sort((a, b) => {
      if (a.protocol !== b.protocol) {
        return a.protocol - b.protocol;
      }
      if (a.clientName !== b.clientName) {
        return a.clientName.localeCompare(b.clientName);
      }
      if (a.computerName !== b.computerName) {
        return a.computerName.localeCompare(b.computerName);
      }
      return a.addressPort.localeCompare(b.addressPort);
    }),
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

  const webSocketInfo =
    fullyConnectedWebSockets.get(newWebSocket) ??
    fullyConnectedReporterWebSockets.get(newWebSocket);
  if (webSocketInfo) {
    if (json.computerName) {
      webSocketInfo.computerName = json.computerName;
    }
    if (json.clientName) {
      webSocketInfo.clientName = json.clientName;
    }
  }
  sendStatus();
  newWebSocket.send(JSON.stringify(response));
}

function handleSetRequest(
  newWebSocket: WebSocket,
  json: Request,
  response: Response,
) {
  if (json.op === 'reset-set-request') {
    try {
      response.data = resetSetTransaction(json.id!);
      newWebSocket.send(JSON.stringify(response));
    } catch (e: any) {
      response.err = e instanceof Error ? e.message : e.toString();
      newWebSocket.send(JSON.stringify(response));
    }
  } else if (json.op === 'call-set-request') {
    try {
      response.data = callSetTransaction(json.id!);
      newWebSocket.send(JSON.stringify(response));
    } catch (e: any) {
      response.err = e instanceof Error ? e.message : e.toString();
      newWebSocket.send(JSON.stringify(response));
    }
  } else if (json.op === 'start-set-request') {
    try {
      response.data = startSetTransaction(json.id!);
      newWebSocket.send(JSON.stringify(response));
    } catch (e: any) {
      response.err = e instanceof Error ? e.message : e.toString();
      newWebSocket.send(JSON.stringify(response));
    }
  } else if (json.op === 'assign-set-station-request') {
    if (json.stationId === undefined || !Number.isInteger(json.stationId)) {
      response.err = 'stationId must be integer';
      newWebSocket.send(JSON.stringify(response));
      return;
    }
    try {
      response.data = assignSetStationTransaction(json.id!, json.stationId);
      newWebSocket.send(JSON.stringify(response));
    } catch (e: any) {
      response.err = e instanceof Error ? e.message : e.toString();
      newWebSocket.send(JSON.stringify(response));
    }
  } else if (json.op === 'assign-set-stream-request') {
    if (json.streamId === undefined || !Number.isInteger(json.streamId)) {
      response.err = 'streamId must be integer';
      newWebSocket.send(JSON.stringify(response));
      return;
    }
    try {
      response.data = assignSetStreamTransaction(json.id!, json.streamId);
      newWebSocket.send(JSON.stringify(response));
    } catch (e: any) {
      response.err = e instanceof Error ? e.message : e.toString();
      newWebSocket.send(JSON.stringify(response));
    }
  } else if (json.op === 'report-set-request') {
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
        json.id!,
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
}

function afterAdminAuthentication(newWebSocket: WebSocket, socket: Socket) {
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
    } else if (
      json.op === 'reset-set-request' ||
      json.op === 'call-set-request' ||
      json.op === 'start-set-request' ||
      json.op === 'assign-set-station-request' ||
      json.op === 'assign-set-stream-request' ||
      json.op === 'report-set-request'
    ) {
      const response: Response = {
        num: json.num,
        op: getResponseOp(json.op),
      };
      if (json.id === undefined || !Number.isInteger(json.id)) {
        response.err = 'id must be integer';
        newWebSocket.send(JSON.stringify(response));
        return;
      }
      handleSetRequest(newWebSocket, json, response);
    }
  });
  newWebSocket.on('close', () => {
    fullyConnectedWebSockets.delete(newWebSocket);
    sendStatus();
  });
  fullyConnectedWebSockets.set(newWebSocket, {
    protocol: Protocol.ADMIN,
    computerName: '',
    clientName: '',
    remoteAddress: socket.remoteAddress,
    remotePort: socket.remotePort,
  });
  sendStatus();
}
function afterReporterAuthentication(
  newWebSocket: WebSocket,
  socket: Socket,
  dbReporter: DbReporter,
) {
  const authSuccessEvent: Event = {
    op: 'auth-success-event',
  };
  const poolIds = new Set(
    getReporterPools(dbReporter.id).map(
      (dbReporterPool) => dbReporterPool.poolId,
    ),
  );
  if (poolIds.size === 0) {
    newWebSocket.close(UNAUTH_CODE);
    return;
  }

  newWebSocket.send(JSON.stringify(authSuccessEvent));
  const lastSubscriberTournament = getLastSubscriberTournament();
  if (lastSubscriberTournament) {
    const events = lastSubscriberTournament.events
      .map((event) => ({
        ...event,
        phases: event.phases
          .map((phase) => ({
            ...phase,
            pools: phase.pools.filter((pool) => poolIds.has(pool.id)),
          }))
          .filter((phase) => phase.pools.length > 0),
      }))
      .filter((event) => event.phases.length > 0);
    sendTournamentUpdateEvent(newWebSocket, {
      ...lastSubscriberTournament,
      events,
    });
  }

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
    } else if (
      json.op === 'reset-set-request' ||
      json.op === 'call-set-request' ||
      json.op === 'start-set-request' ||
      json.op === 'assign-set-station-request' ||
      json.op === 'assign-set-stream-request' ||
      json.op === 'report-set-request'
    ) {
      const response: Response = {
        num: json.num,
        op: getResponseOp(json.op),
      };
      if (json.id === undefined || !Number.isInteger(json.id)) {
        response.err = 'id must be integer';
        newWebSocket.send(JSON.stringify(response));
        return;
      }
      if (!reporterHasPermission(dbReporter.id, json.id)) {
        response.err = 'unauthorized';
        newWebSocket.send(JSON.stringify(response));
        return;
      }
      handleSetRequest(newWebSocket, json, response);
    }
  });
  newWebSocket.on('close', () => {
    fullyConnectedReporterWebSockets.delete(newWebSocket);
    sendStatus();
  });
  fullyConnectedReporterWebSockets.set(newWebSocket, {
    protocol: Protocol.REPORTER,
    computerName: dbReporter.name ?? '',
    clientName: '',
    remoteAddress: socket.remoteAddress,
    remotePort: socket.remotePort,
    reporterId: dbReporter.id,
  });
  sendStatus();
}

let websocketPassword = '';
let websocketServer: WebSocketServer | null = null;
export function setWebsocketPassword(newWebsocketPassword: string) {
  if (websocketServer) {
    throw new Error(
      'cannot change websocket password while websocket server is running',
    );
  }

  websocketPassword = newWebsocketPassword;
}

function getSaltChallenge() {
  return {
    salt: Buffer.from(randomBytes(32)).toString('base64url'),
    challenge: Buffer.from(randomBytes(32)).toString('base64url'),
  };
}

function getAuthentication(password: string, salt: string, challenge: string) {
  const secret = createHash('sha256')
    .update(password)
    .update(salt)
    .digest()
    .toString('base64url');
  return createHash('sha256')
    .update(secret)
    .update(challenge)
    .digest()
    .toString('base64url');
}

let resourcesPath = '';

const lock = new AsyncLock();
const KEY = 'STARTSTOPKEY';
let httpServer: http.Server | null = null;
let advertisement: DnsSdAdvertisement | null = null;
let responder: Responder | null = null;
let ciaoService: CiaoService | null = null;
export function startWebsocketServer() {
  return lock.acquire(KEY, async (release) => {
    if (!httpServer) {
      httpServer = http.createServer(
        express().use(express.static(path.join(resourcesPath, 'public'))),
      );
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
        clientTracking: false,
        handleProtocols: (protocols) => {
          if (protocols.has(ADMIN_PROTOCOL)) {
            return ADMIN_PROTOCOL;
          }
          return BRACKET_PROTOCOL;
        },
      });
      websocketServer.on('connection', (newWebSocket, request) => {
        allWebsockets.add(newWebSocket);
        newWebSocket.on('close', () => {
          newWebSocket.removeAllListeners();
          allWebsockets.delete(newWebSocket);
        });

        if (newWebSocket.protocol === ADMIN_PROTOCOL) {
          const { salt, challenge } = getSaltChallenge();
          const authentication = getAuthentication(
            websocketPassword,
            salt,
            challenge,
          );
          const authHello: AuthHello = {
            op: 'auth-hello',
            salt,
            challenge,
          };

          const timeout = setTimeout(() => {
            newWebSocket.close(UNAUTH_CODE);
          }, 2000);
          const identifyCb = (data: RawData, isBinary: boolean) => {
            if (isBinary) {
              newWebSocket.close(UNAUTH_CODE);
              return;
            }

            try {
              const json = JSON.parse(data.toString()) as AuthIdentify;
              if (json.op === 'auth-identify') {
                if (json.authentication === authentication) {
                  clearTimeout(timeout);
                  newWebSocket.removeListener('message', identifyCb);
                  afterAdminAuthentication(newWebSocket, request.socket);
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

        if (newWebSocket.protocol === REPORTER_PROTOCOL) {
          const { salt, challenge } = getSaltChallenge();
          const authenticationToDbReporter = new Map(
            getTournamentReporters().map((dbReporter) => [
              getAuthentication(dbReporter.id, salt, challenge),
              dbReporter,
            ]),
          );
          const authHello: AuthHello = {
            op: 'auth-hello',
            salt,
            challenge,
          };

          const timeout = setTimeout(() => {
            newWebSocket.close(UNAUTH_CODE);
          }, 2000);
          const identifyCb = (data: RawData, isBinary: boolean) => {
            if (isBinary) {
              newWebSocket.close(UNAUTH_CODE);
              return;
            }

            try {
              const json = JSON.parse(data.toString()) as AuthIdentify;
              if (json.op === 'auth-identify') {
                const dbReporter = authenticationToDbReporter.get(
                  json.authentication,
                );
                if (dbReporter) {
                  clearTimeout(timeout);
                  newWebSocket.removeListener('message', identifyCb);
                  afterReporterAuthentication(
                    newWebSocket,
                    request.socket,
                    dbReporter,
                  );
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

        fullyConnectedWebSockets.set(newWebSocket, {
          protocol: Protocol.PUBLIC,
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
          fullyConnectedWebSockets.delete(newWebSocket);
          sendStatus();
        });
        sendStatus();
        sendTournamentUpdateEvent(newWebSocket, getLastSubscriberTournament());
      });
    }

    if (DnsSd.getBackendInfo() === 'mdns-sd') {
      if (!responder) {
        responder = getResponder();
      }
      if (!ciaoService) {
        ciaoService = responder.createService({
          name: 'offlinemode',
          type: 'http',
          port: 80,
          subtypes: ['offlinemode'],
          txt: { offlinemode: 1 },
        });
        (async () => {
          try {
            await ciaoService.advertise();
            host = ciaoService.getHostname().slice(0, -1);
            sendStatus();
          } catch {
            ciaoService.end();
            ciaoService = null;
          }
        })();
      }
    } else {
      advertisement = DnsSd.advertise({
        name: 'offlinemode',
        type: '_http._tcp',
        port: 80,
        txt: { offlinemode: '1' },
      })
        .on('error', () => {
          advertisement?.stop();
          advertisement = null;
        })
        .on('registered', () => {
          host = hostname();
          sendStatus();
        });
    }

    sendStatus();
    release();
  });
}

async function stopCiao() {
  if (advertisement) {
    advertisement.stop();
    advertisement = null;
  }
  if (ciaoService) {
    await ciaoService.end();
    await ciaoService.destroy();
    ciaoService = null;
  }
  if (responder) {
    await responder.shutdown();
    responder = null;
  }
}

export function stopWebsocketServer() {
  return lock.acquire(KEY, async (release) => {
    const ciaoPromise = stopCiao();
    await new Promise<void>((resolve) => {
      if (!websocketServer) {
        resolve();
        return;
      }

      websocketServer.removeAllListeners();
      Array.from(allWebsockets).forEach((webSocket) => {
        webSocket.removeAllListeners();
        webSocket.terminate();
      });

      websocketServer.close(() => {
        websocketServer?.removeAllListeners();
        websocketServer = null;
        resolve();
      });
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
    await ciaoPromise;

    fullyConnectedWebSockets.clear();
    fullyConnectedReporterWebSockets.clear();
    allWebsockets.clear();
    err = '';
    host = '';
    v4Address = '';
    v6Address = '';
    port = 0;
    release();
  });
}

export async function stopWebsocketServerAndSendStatus() {
  await stopWebsocketServer();
  sendStatus();
}

export function initWebsocket(
  initMainWindow: BrowserWindow,
  initResourcesPath: string,
) {
  mainWindow = initMainWindow;
  resourcesPath = initResourcesPath;
}

export function updateSubscribers(
  subscriberTournament: SubscriberTournament | undefined,
) {
  if (subscriberTournament) {
    Array.from(fullyConnectedWebSockets.keys()).forEach((connection) => {
      sendTournamentUpdateEvent(connection, subscriberTournament);
    });

    const reporterIdToPoolIds = new Map<string, Set<number>>();
    getTournamentReporterPools().forEach((dbReporterPool) => {
      let poolIds = reporterIdToPoolIds.get(dbReporterPool.reporterId);
      if (poolIds === undefined) {
        poolIds = new Set();
        reporterIdToPoolIds.set(dbReporterPool.reporterId, poolIds);
      }
      poolIds.add(dbReporterPool.poolId);
    });
    Array.from(fullyConnectedReporterWebSockets).forEach(
      ([connection, { reporterId }]) => {
        const poolIds = reporterIdToPoolIds.get(reporterId);
        if (!poolIds) {
          connection.close(UNAUTH_CODE);
          return;
        }

        const events: RendererEvent[] = subscriberTournament.events
          .map((event) => ({
            ...event,
            phases: event.phases
              .map((phase) => ({
                ...phase,
                pools: phase.pools.filter((pool) => poolIds.has(pool.id)),
              }))
              .filter((phase) => phase.pools.length > 0),
          }))
          .filter((event) => event.phases.length > 0);
        sendTournamentUpdateEvent(connection, {
          ...subscriberTournament,
          events,
        });
      },
    );
  }
}

export function isBroadcasting() {
  return Boolean(advertisement || ciaoService || responder);
}
