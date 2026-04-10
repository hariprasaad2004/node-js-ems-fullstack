const express = require('express');
const { Types } = require('mongoose');
const ChatMessage = require('../models/ChatMessage');
const User = require('../models/User');
const { requireAuth, requireRole } = require('../middleware/auth');
const { emitChatToThread, emitChatToUsers } = require('../realtime');

const router = express.Router();
const chatRoles = ['admin', 'manager', 'teamlead', 'employee'];
const defaultGroupThread = { threadKey: 'group:general', name: 'All Hands', type: 'group' };

const toSafeUser = (user) => ({
  id: user._id.toString(),
  name: user.name,
  role: user.role,
  email: user.email,
  department: user.department || ''
});

const toSafeMessage = (message) => {
  const participants = Array.isArray(message.participants)
    ? message.participants
        .map((participant) => {
          if (!participant) return null;
          if (participant._id) {
            return {
              id: participant._id.toString(),
              name: participant.name,
              role: participant.role,
              email: participant.email
            };
          }
          return { id: participant.toString() };
        })
        .filter(Boolean)
    : [];

  const sender = message.sender
    ? {
        id: message.sender._id?.toString?.() || message.sender.toString?.() || String(message.sender),
        name: message.sender.name || '',
        role: message.sender.role || '',
        email: message.sender.email || ''
      }
    : null;

  return {
    id: message._id.toString(),
    threadKey: message.threadKey,
    type: message.type,
    text: message.text,
    sender,
    participants,
    createdAt: message.createdAt
  };
};

const makeDirectKey = (a, b) => `direct:${[a, b].map((id) => id.toString()).sort().join(':')}`;
const getOtherId = (threadKey, userId) => {
  if (!threadKey.startsWith('direct:')) return null;
  const parts = threadKey.replace('direct:', '').split(':');
  const self = userId.toString();
  const other = parts.find((part) => part && part !== self);
  return other || null;
};

router.get('/api/chat/threads', requireAuth, requireRole(chatRoles), async (req, res) => {
  try {
    const currentUser = await User.findById(req.userId).select(
      'name email role department status'
    );
    if (!currentUser) return res.status(404).json({ message: 'User not found.' });

    const groupLast = await ChatMessage.findOne({ threadKey: defaultGroupThread.threadKey })
      .sort({ createdAt: -1 })
      .populate('sender', 'name role email')
      .lean();

    const recent = await ChatMessage.find({ participants: req.userId })
      .sort({ createdAt: -1 })
      .limit(200)
      .populate('sender', 'name role email')
      .lean();

    const threadMap = new Map();
    recent.forEach((msg) => {
      if (!threadMap.has(msg.threadKey)) {
        threadMap.set(msg.threadKey, msg);
      }
    });

    const directThreads = [];
    threadMap.forEach((msg, key) => {
      if (!key.startsWith('direct:')) return;
      const otherId = getOtherId(key, req.userId);
      if (!otherId) return;
      directThreads.push({ threadKey: key, otherId, lastMessage: msg });
    });

    const otherIds = directThreads.map((t) => t.otherId);
    const otherUsers = await User.find({ _id: { $in: otherIds } })
      .select('name role email department status')
      .lean();

    const threads = [];
    threads.push({
      ...defaultGroupThread,
      lastMessage: groupLast ? toSafeMessage({ ...groupLast, participants: [] }) : null
    });

    directThreads.forEach((thread) => {
      const user = otherUsers.find((u) => u._id.toString() === thread.otherId.toString());
      threads.push({
        threadKey: thread.threadKey,
        type: 'direct',
        user: user ? toSafeUser(user) : { id: thread.otherId },
        lastMessage: thread.lastMessage ? toSafeMessage(thread.lastMessage) : null
      });
    });

    const peers = await User.find({ _id: { $ne: req.userId }, status: 'active' })
      .select('name role email department')
      .sort({ name: 1 })
      .lean();

    return res.json({
      me: toSafeUser(currentUser),
      threads,
      peers: peers.map(toSafeUser)
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to load chat threads.' });
  }
});

router.get('/api/chat/messages', requireAuth, requireRole(chatRoles), async (req, res) => {
  try {
    const threadKey = (req.query.threadKey || '').trim();
    if (!threadKey) return res.status(400).json({ message: 'threadKey is required.' });

    if (threadKey.startsWith('direct:')) {
      const parts = threadKey.replace('direct:', '').split(':');
      const hasSelf = parts.some((part) => part === req.userId.toString());
      if (!hasSelf) return res.status(403).json({ message: 'Not allowed to view this chat.' });
    }

    const limit = Math.min(Number(req.query.limit) || 80, 300);
    const query = threadKey.startsWith('direct:')
      ? { threadKey, participants: req.userId }
      : { threadKey };
    const messages = await ChatMessage.find(query)
      .sort({ createdAt: 1 })
      .limit(limit)
      .populate('sender', 'name role email')
      .populate('participants', 'name role email')
      .lean();

    return res.json(messages.map(toSafeMessage));
  } catch (err) {
    if (err?.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid chat identifier.' });
    }
    return res.status(500).json({ message: 'Failed to load messages.' });
  }
});

router.post('/api/chat/messages', requireAuth, requireRole(chatRoles), async (req, res) => {
  try {
    const text = (req.body?.text || '').trim();
    let { threadKey, toUserId, type } = req.body || {};
    const senderId = req.userId;

    if (!senderId) {
      return res.status(401).json({ message: 'Please sign in again to send messages.' });
    }

    if (!text) return res.status(400).json({ message: 'Message text is required.' });

    let resolvedThreadKey = (threadKey || '').trim();
    let participants = [senderId];

    if (!resolvedThreadKey || resolvedThreadKey.startsWith('group:')) {
      resolvedThreadKey = defaultGroupThread.threadKey;
      type = 'group';
    } else {
      const targetId = toUserId || getOtherId(resolvedThreadKey, senderId);
      if (!targetId) {
        return res.status(400).json({ message: 'Missing recipient.' });
      }
      if (!Types.ObjectId.isValid(targetId)) {
        return res.status(400).json({ message: 'Invalid recipient id.' });
      }

      const targetUser = await User.findById(targetId).select('status');
      if (!targetUser) return res.status(404).json({ message: 'Recipient not found.' });

      participants = [senderId, targetId];
      resolvedThreadKey = makeDirectKey(senderId, targetId);
      type = 'direct';
    }

    const cleanParticipants = (participants || [])
      .map((id) => (Types.ObjectId.isValid(id) ? Types.ObjectId(id) : null))
      .filter(Boolean);
    const cleanSender = Types.ObjectId.isValid(senderId) ? Types.ObjectId(senderId) : null;
    if (!cleanSender) return res.status(401).json({ message: 'Invalid session. Please re-login.' });
    if (!cleanParticipants.length) cleanParticipants.push(cleanSender);

    const message = await ChatMessage.create({
      threadKey: resolvedThreadKey,
      type: type || 'group',
      text,
      sender: cleanSender,
      participants: cleanParticipants
    });

    const populated = await message
      .populate('sender', 'name role email')
      .populate('participants', 'name role email');

    const payload = toSafeMessage(populated);
    emitChatToThread(resolvedThreadKey, 'chat:message', payload);
    emitChatToUsers(participants, 'chat:message', payload);

    return res.status(201).json(payload);
  } catch (err) {
    // Surface validation errors as 400; everything else as 500 with basic detail for debugging.
    if (err?.name === 'ValidationError' || err?.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid chat payload.', detail: err.message });
    }
    // Log server-side so platform logs show the root cause.
    // eslint-disable-next-line no-console
    console.error('chat:message failed', err);
    return res.status(500).json({ message: 'Failed to send message.', detail: err.message || 'server_error' });
  }
});

module.exports = router;
