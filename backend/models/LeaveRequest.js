const mongoose = require('mongoose');

const leaveRequestSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    fromDate: { type: Date, required: true },
    toDate: { type: Date, required: true },
    category: {
      type: String,
      enum: ['sick', 'casual', 'emergency'],
      default: 'casual'
    },
    roleAtRequest: {
      type: String,
      enum: ['employee', 'teamlead', 'manager', 'admin'],
      default: 'employee'
    },
    reason: { type: String, trim: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date }
  },
  { timestamps: true }
);

module.exports = mongoose.model('LeaveRequest', leaveRequestSchema);
