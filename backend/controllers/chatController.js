const Chat = require('../models/Chat');
const User = require('../models/User');

const toSafeUser = (user) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  role: user.role,
  isOnline: user.isOnline
});

exports.createChat = async (req, res) => {
  try {
    const { isGroupChat = false, users = [], groupName } = req.body;
    const uniqueUsers = Array.from(new Set([...users.map(String), req.userId]));
    if (!isGroupChat && uniqueUsers.length !== 2) {
      return res.status(400).json({ message: 'Personal chat requires exactly two users.' });
    }
    if (isGroupChat && uniqueUsers.length < 2) {
      return res.status(400).json({ message: 'Group chat requires at least two members.' });
    }

    const chat = await Chat.create({
      isGroupChat,
      users: uniqueUsers,
      groupName: isGroupChat ? groupName || 'Group' : undefined,
      admin: isGroupChat ? req.userId : undefined
    });

    const populated = await chat.populate('users', 'name email role isOnline').populate('admin', 'name email');
    return res.status(201).json(populated);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to create chat', detail: err.message });
  }
};

exports.getChats = async (req, res) => {
  try {
    const me = await User.findById(req.userId).select('name email role isOnline');

    // Ensure a default group chat with all active users exists
    let defaultGroup = await Chat.findOne({ isGroupChat: true, groupName: 'All Hands' });
    if (!defaultGroup) {
      const allUsers = await User.find({ status: 'active' }, '_id');
      const userIds = allUsers.map((u) => u._id.toString());
      defaultGroup = await Chat.create({
        isGroupChat: true,
        users: userIds,
        groupName: 'All Hands',
        admin: req.userId
      });
    }

    const chats = await Chat.find({ users: req.userId })
      .sort({ updatedAt: -1 })
      .populate('users', 'name email role isOnline')
      .populate('admin', 'name email');
    return res.json({
      me: me ? toSafeUser(me) : null,
      chats: chats.map((chat) => ({
        id: chat._id.toString(),
        isGroupChat: chat.isGroupChat,
        groupName: chat.groupName || null,
        admin: chat.admin ? toSafeUser(chat.admin) : null,
        users: chat.users.map(toSafeUser),
        updatedAt: chat.updatedAt
      }))
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to load chats' });
  }
};
