const { Server } = require('socket.io');

let ioInstance = null;

function initSocket(server, allowedOrigins = []) {
  ioInstance = new Server(server, {
    cors: {
      origin: allowedOrigins,
      credentials: true
    }
  });

  ioInstance.on('connection', (socket) => {
    // eslint-disable-next-line no-console
    console.log('Socket connected', socket.id);
    socket.on('disconnect', () => {
      // eslint-disable-next-line no-console
      console.log('Socket disconnected', socket.id);
    });
  });

  return ioInstance;
}

function emitEvent(event, payload) {
  if (ioInstance) {
    ioInstance.emit(event, payload);
  }
}

module.exports = { initSocket, emitEvent };
