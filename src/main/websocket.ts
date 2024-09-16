import http from 'http';
import { AddressInfo } from 'net';
import type { connection } from 'websocket';
import websocket from 'websocket';
import { getLastEvent, getLastTournament, getTournamentId } from './db';

const BRACKET_PROTOCOL = 'bracket-protocol';

let httpServer: http.Server | null;
let websocketServer: websocket.server | null;

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
    const tournamentFound = getTournamentId() > 0;
    if (tournamentFound && request.requestedProtocols.length === 1) {
      if (request.requestedProtocols[0] === BRACKET_PROTOCOL) {
        const newConnection = request.accept(BRACKET_PROTOCOL, request.origin);
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
            const eventId = json.eventId as number;
            if (Number.isInteger(eventId) && eventId > 0) {
              connectionToSubscription.set(newConnection, {
                eventId,
              });
              newConnection.sendUTF(
                JSON.stringify({
                  op: 'subscribe-to-event-response',
                  event: getLastEvent(eventId),
                }),
              );
            }
          } else if (json.op === 'start-set-request') {
            // todo
          } else if (json.op === 'report-set-request') {
            // todo
          } else if (json.op === 'reset-set-request') {
            // todo
          }
        });
        return;
      }
    }
    request.reject(
      tournamentFound ? 400 : 404,
      tournamentFound
        ? `invalid requested protocol(s): ${request.requestedProtocols}`
        : 'Tournament not found',
    );
  });
  return { success: true };
}

export async function stopWebsocketServer() {
  if (httpServer && websocketServer) {
    connectionToSubscription.clear();
    websocketServer.shutDown();
    websocketServer = null;
    httpServer.close();
    httpServer = null;
  }
}

export async function updateSubscribers() {
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
