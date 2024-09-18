import http from 'http';
import { AddressInfo } from 'net';
import type { connection } from 'websocket';
import websocket from 'websocket';
import { getLastEvent, getLastTournament } from './db';
import {
  reportSetTransaction,
  resetSetTransaction,
  startSetTransaction,
} from './transaction';

const BRACKET_PROTOCOL = 'bracket-protocol';

let httpServer: http.Server | null;
let websocketServer: websocket.server | null;
const connections = new Set<connection>();

type Subscription = {
  eventId?: number;
};
const connectionToSubscription = new Map<connection, Subscription>();

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
        newConnection.on('message', async (data) => {
          if (data.type === 'binary') {
            return;
          }

          const json = JSON.parse(data.utf8Data);
          if (json.op === 'get-tournament-and-events-request') {
            const tournament = getLastTournament();
            newConnection.sendUTF(
              JSON.stringify({
                op: 'get-tournament-and-events-response',
                tournament: tournament
                  ? {
                      slug: tournament.slug,
                      events: tournament.events.map((event) => ({
                        id: event.id,
                        name: event.name,
                      })),
                    }
                  : undefined,
              }),
            );
          } else if (json.op === 'subscribe-to-tournament-request') {
            connectionToSubscription.set(newConnection, {});
            newConnection.sendUTF(
              JSON.stringify({
                op: 'subscribe-to-tournament-response',
                tournament: getLastTournament(),
              }),
            );
          } else if (json.op === 'subscribe-to-event-request') {
            const eventId = json.id as number;
            const event = getLastEvent(eventId);
            if (event) {
              connectionToSubscription.set(newConnection, {
                eventId,
              });
              newConnection.sendUTF(
                JSON.stringify({
                  op: 'subscribe-to-event-response',
                  event,
                }),
              );
            } else {
              newConnection.sendUTF(
                JSON.stringify({
                  op: 'subscribe-to-event-response',
                  err: `event not found: ${eventId}`,
                }),
              );
            }
          } else if (json.op === 'start-set-request') {
            try {
              startSetTransaction(json.id);
            } catch (e: any) {
              newConnection.sendUTF(
                JSON.stringify({
                  op: 'start-set-response',
                  err: e instanceof Error ? e.message : e,
                }),
              );
            }
          } else if (json.op === 'report-set-request') {
            try {
              reportSetTransaction(
                json.id,
                json.winnerId,
                json.isDQ,
                json.gameData,
              );
            } catch (e: any) {
              newConnection.sendUTF(
                JSON.stringify({
                  op: 'report-set-response',
                  err: e instanceof Error ? e.message : e,
                }),
              );
            }
          } else if (json.op === 'reset-set-request') {
            try {
              resetSetTransaction(json.id);
            } catch (e: any) {
              newConnection.sendUTF(
                JSON.stringify({
                  op: 'reset-set-response',
                  err: e instanceof Error ? e.message : e,
                }),
              );
            }
          }
        });
        newConnection.on('close', () => {
          connections.delete(newConnection);
          connectionToSubscription.delete(newConnection);
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
    connectionToSubscription.clear();
    websocketServer.shutDown();
    websocketServer = null;
    httpServer.close();
    httpServer = null;
  }
}

export function updateSubscribers() {
  Array.from(connectionToSubscription.entries()).forEach(
    ([connection, subscription]) => {
      if (subscription.eventId) {
        connection.sendUTF(
          JSON.stringify({
            op: 'event-update-event',
            event: getLastEvent(subscription.eventId),
          }),
        );
      } else {
        connection.sendUTF(
          JSON.stringify({
            op: 'tournament-update-event',
            tournament: getLastTournament(),
          }),
        );
      }
    },
  );
}

export function tournamentChanged() {
  connectionToSubscription.clear();
  Array.from(connections.keys()).forEach((connection) => {
    const tournament = getLastTournament();
    connection.sendUTF(
      JSON.stringify({
        op: 'tournament-changed-event',
        tournament: {
          slug: tournament!.slug,
          events: tournament!.events.map((event) => ({
            id: event.id,
            name: event.name,
          })),
        },
      }),
    );
  });
}
