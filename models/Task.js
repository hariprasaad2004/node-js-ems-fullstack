const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    details: { type: String, required: true, trim: true },
    status: { type: String, enum: ['assigned', 'completed'], default: 'assigned' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Task', taskSchema);
