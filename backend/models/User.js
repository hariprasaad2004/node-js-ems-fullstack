const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ['admin', 'employee'], required: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    department: { type: String, trim: true },
    title: { type: String, trim: true },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
    salary: { type: Number },
    profileImage: { type: String, trim: true },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
