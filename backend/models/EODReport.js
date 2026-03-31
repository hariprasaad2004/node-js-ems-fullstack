const mongoose = require('mongoose');

const eodReportSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, required: true },
    dateKey: { type: String, required: true },
    session1: { type: String, trim: true },
    session2: { type: String, trim: true },
    status: {
      type: String,
      enum: ['completed', 'in_progress'],
      default: 'completed'
    }
  },
  { timestamps: true }
);

eodReportSchema.index({ employee: 1, dateKey: 1 }, { unique: true });

module.exports = mongoose.model('EODReport', eodReportSchema);
