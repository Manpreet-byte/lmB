const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  admin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  action: {
    type: String,
    enum: ['APPROVED', 'REJECTED'],
    required: true,
  },
  leaveRequest: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LeaveRequest',
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
}, { timestamps: true });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

module.exports = AuditLog;
