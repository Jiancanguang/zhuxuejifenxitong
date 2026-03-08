import { randomUUID } from 'node:crypto';

const HEARTBEAT_MS = 15000;
const clientsByUserId = new Map();

export const registerSyncClient = (userId, res) => {
  const clientId = randomUUID();
  const keepAliveTimer = setInterval(() => {
    if (!res.writableEnded) {
      res.write(': heartbeat\n\n');
    }
  }, HEARTBEAT_MS);

  const clients = clientsByUserId.get(userId) || new Map();
  clients.set(clientId, { res, keepAliveTimer });
  clientsByUserId.set(userId, clients);

  res.write('retry: 2000\n\n');

  return () => {
    clearInterval(keepAliveTimer);
    const currentClients = clientsByUserId.get(userId);
    if (!currentClients) return;
    currentClients.delete(clientId);
    if (currentClients.size === 0) {
      clientsByUserId.delete(userId);
    }
  };
};

export const broadcastSyncEvent = ({
  userId,
  classId,
  scope,
  reason,
  sourceSessionId,
}) => {
  const clients = clientsByUserId.get(userId);
  if (!clients || clients.size === 0) {
    return;
  }

  const payload = JSON.stringify({
    id: randomUUID(),
    userId,
    classId,
    scope,
    reason,
    sourceSessionId,
    timestamp: Date.now(),
  });

  for (const [clientId, client] of clients.entries()) {
    try {
      client.res.write(`event: sync\ndata: ${payload}\n\n`);
    } catch {
      clearInterval(client.keepAliveTimer);
      clients.delete(clientId);
    }
  }

  if (clients.size === 0) {
    clientsByUserId.delete(userId);
  }
};
