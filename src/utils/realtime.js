const WebSocket = require('ws');

let wss = null;

function initRealtime(server) {
  wss = new WebSocket.Server({ server });

  wss.on('connection', (ws) => {
    console.log('🔌 Realtime Client Connected');

    ws.on('close', () => {
      console.log('🔌 Realtime Client Disconnected');
    });
  });

  console.log('⚡ Realtime WebSocket Server Initialized');
}

function broadcastEvent(type, data) {
  if (!wss) return;
  const message = JSON.stringify({ type, data });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

module.exports = {
  initRealtime,
  broadcastEvent,
};
