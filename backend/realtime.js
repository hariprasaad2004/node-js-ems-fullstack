const { Server } = require('socket.io');
const Message = require('./models/Message');
const Chat = require('./models/Chat');
const User = require('./models/User');

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

    socket.on('chat:register', async (userId) => {
      if (!userId) return;
      socket.data.userId = userId.toString();
      socket.join(socket.data.userId);
      try {
        await User.findByIdAndUpdate(socket.data.userId, { isOnline: true });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('socket register user update failed', err.message);
      }
    });

    socket.on('chat:join', (chatId) => {
      if (!chatId) return;
      socket.join(chatId.toString());
    });

    socket.on('chat:typing', (chatId) => {
      if (!chatId) return;
      socket.to(chatId.toString()).emit('chat:typing', { chatId, userId: socket.data.userId });
    });

    socket.on('chat:stopTyping', (chatId) => {
      if (!chatId) return;
      socket.to(chatId.toString()).emit('chat:stopTyping', { chatId, userId: socket.data.userId });
    });

    socket.on('chat:send', async ({ chatId, content }) => {
      try {
        if (!chatId || !content || !socket.data.userId) return;
        const msg = await Message.create({
          senderId: socket.data.userId,
          chatId,
          content: String(content).trim(),
          readBy: [socket.data.userId]
        });
        await Chat.findByIdAndUpdate(chatId, { updatedAt: new Date() });
        const populated = await msg.populate('senderId', 'name email role');
        ioInstance.to(chatId.toString()).emit('chat:message', populated);
        socket.to(chatId.toString()).emit('chat:notification', { chatId, message: populated });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('chat:send failed', err);
      }
    });

    socket.on('disconnect', () => {
      // eslint-disable-next-line no-console
      console.log('Socket disconnected', socket.id);
      if (socket.data?.userId) {
        User.findByIdAndUpdate(socket.data.userId, { isOnline: false }).catch(() => {});
      }
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
