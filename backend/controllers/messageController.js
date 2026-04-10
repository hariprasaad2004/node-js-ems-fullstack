const Message = require('../models/Message');
const Chat = require('../models/Chat');

exports.getMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const messages = await Message.find({ chatId })
      .sort({ createdAt: 1 })
      .populate('senderId', 'name email role');
    return res.json(messages);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to load messages' });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const { chatId, content } = req.body;
    if (!chatId || !content) return res.status(400).json({ message: 'chatId and content are required.' });

    const message = await Message.create({
      senderId: req.userId,
      chatId,
      content,
      readBy: [req.userId]
    });

    await Chat.findByIdAndUpdate(chatId, { updatedAt: new Date() });

    const populated = await message.populate('senderId', 'name email role');
    return res.status(201).json(populated);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to send message', detail: err.message });
  }
};
