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

    socket.on('chat:register', (userId) => {
      if (!userId) return;
      socket.data.userId = userId;
      socket.join(`user:${userId}`);
    });

    socket.on('chat:join', (threadKeys = []) => {
      const rooms = Array.isArray(threadKeys) ? threadKeys : [threadKeys];
      rooms
        .filter((room) => typeof room === 'string' && room.trim())
        .forEach((room) => socket.join(room.trim()));
    });

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

function emitChatToUsers(userIds = [], event, payload) {
  if (!ioInstance || !event) return;
  const ids = Array.isArray(userIds) ? userIds : [userIds];
  ids
    .filter(Boolean)
    .map((id) => id.toString())
    .forEach((id) => {
      ioInstance.to(`user:${id}`).emit(event, payload);
    });
}

function emitChatToThread(threadKey, event, payload) {
  if (!ioInstance || !threadKey || !event) return;
  ioInstance.to(threadKey).emit(event, payload);
}

module.exports = { initSocket, emitEvent, emitChatToUsers, emitChatToThread };
