const asyncHandler = require('express-async-handler');
const AuditLog = require('../models/auditLogModel');

// @desc    Get all audit logs (admin only)
// @route   GET /api/audit-logs
// @access  Private/Admin
const getAuditLogs = asyncHandler(async (req, res) => {
  const logs = await AuditLog.find()
    .populate('admin', 'name email')
    .populate('leaveRequest', 'student subject status')
    .sort({ createdAt: -1 });
  res.json(logs);
});

module.exports = { getAuditLogs };
