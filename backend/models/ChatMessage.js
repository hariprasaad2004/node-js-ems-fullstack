const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema(
  {
    threadKey: { type: String, required: true, index: true },
    type: { type: String, enum: ['group', 'direct'], required: true },
    text: { type: String, required: true, trim: true, maxlength: 2000 },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    participants: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      default: []
    }
  },
  { timestamps: true }
);

chatMessageSchema.index({ threadKey: 1, createdAt: -1 });
chatMessageSchema.index({ participants: 1, createdAt: -1 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
