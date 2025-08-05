import http from 'http';
import { AddressInfo } from 'net';
import type { connection } from 'websocket';
import websocket from 'websocket';
import { getLastTournament } from './db';
import {
  assignSetStationTransaction,
  assignSetStreamTransaction,
  reportSetTransaction,
  resetSetTransaction,
  startSetTransaction,
} from './transaction';
import { RendererSet } from '../common/types';

type Response = {
  op:
    | 'start-set-response'
    | 'assign-set-station-response'
    | 'assign-set-stream-response'
    | 'reset-set-response'
    | 'report-set-response';
  err?: string;
  data?: {
    set: RendererSet;
  };
};

const BRACKET_PROTOCOL = 'bracket-protocol';

let httpServer: http.Server | null;
let websocketServer: websocket.server | null;
const connections = new Set<connection>();

function sendTournamentUpdateEvent(connection: connection) {
  connection.sendUTF(
    JSON.stringify({
      op: 'tournament-update-event',
      tournament: getLastTournament(),
    }),
  );
}

export async function startWebsocketServer(port: number) {
  if (httpServer && websocketServer) {
    return (<AddressInfo>httpServer.address()).port === port
      ? { success: true }
      : { success: false, err: `server already started on port ${port}` };
  }

  try {
    httpServer = http.createServer();
    await new Promise<void>((resolve, reject) => {
      httpServer!.once('error', (e) => {
        httpServer = null;
        reject(e);
      });
      httpServer!.listen(
        port,
        '127.0.0.1', // allow only local conenctions
        511, // default backlog queue length
        () => {
          httpServer!.removeAllListeners('error');
          resolve();
        },
      );
    });
  } catch (e: any) {
    if (e.code === 'EADDRINUSE') {
      return { success: false, err: 'Port in use' };
    }
    return {
      success: false,
      err: e instanceof Error ? e.message : (e as string),
    };
  }

  // eslint-disable-next-line new-cap
  websocketServer = new websocket.server({ httpServer });
  websocketServer.on('request', async (request) => {
    if (request.requestedProtocols.length === 1) {
      if (request.requestedProtocols[0] === BRACKET_PROTOCOL) {
        const newConnection = request.accept(BRACKET_PROTOCOL, request.origin);
        connections.add(newConnection);
        sendTournamentUpdateEvent(newConnection);
        newConnection.on('message', async (data) => {
          if (data.type === 'binary') {
            return;
          }

          const json = JSON.parse(data.utf8Data);
          if (json.op === 'reset-set-request') {
            const response: Response = {
              op: 'reset-set-response',
            };
            if (!Number.isInteger(json.id)) {
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
          } else if (json.op === 'start-set-request') {
            const response: Response = {
              op: 'start-set-response',
            };
            if (!Number.isInteger(json.id)) {
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
              op: 'assign-set-station-response',
            };
            if (!Number.isInteger(json.id)) {
              response.err = 'id must be integer';
              newConnection.sendUTF(JSON.stringify(response));
              return;
            }
            if (!Number.isInteger(json.stationId)) {
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
              op: 'assign-set-stream-response',
            };
            if (!Number.isInteger(json.id)) {
              response.err = 'id must be integer';
              newConnection.sendUTF(JSON.stringify(response));
              return;
            }
            if (!Number.isInteger(json.streamId)) {
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
              op: 'report-set-response',
            };
            if (!Number.isInteger(json.id)) {
              response.err = 'id must be integer';
              newConnection.sendUTF(JSON.stringify(response));
              return;
            }
            if (!Number.isInteger(json.winnerId)) {
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
          } else {
            newConnection.sendUTF(
              JSON.stringify({
                op: 'error',
                err: `invalid request: ${json.op}`,
              }),
            );
          }
        });
        newConnection.on('close', () => {
          connections.delete(newConnection);
        });
        return;
      }
    }
    request.reject(
      400,
      `invalid requested protocol(s): ${request.requestedProtocols}`,
    );
  });
  return { success: true };
}

export function stopWebsocketServer() {
  if (httpServer && websocketServer) {
    websocketServer.shutDown();
    websocketServer = null;
    httpServer.close();
    httpServer = null;
    connections.clear();
  }
}

export function updateSubscribers() {
  Array.from(connections.keys()).forEach(sendTournamentUpdateEvent);
}
