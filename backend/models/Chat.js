const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema(
  {
    isGroupChat: { type: Boolean, default: false },
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
    groupName: { type: String, trim: true },
    admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

chatSchema.index({ users: 1 });
chatSchema.index({ updatedAt: -1 });

module.exports = mongoose.model('Chat', chatSchema);
