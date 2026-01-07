const mongoose = require('mongoose');

const analyticsSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    unique: true,
  },
  totalLeaveRequests: {
    type: Number,
    default: 0,
  },
  approvedLeaves: {
    type: Number,
    default: 0,
  },
  rejectedLeaves: {
    type: Number,
    default: 0,
  },
  pendingLeaves: {
    type: Number,
    default: 0,
  },
  testsCompleted: {
    type: Number,
    default: 0,
  },
  testsPassed: {
    type: Number,
    default: 0,
  },
  testsFailed: {
    type: Number,
    default: 0,
  },
  averageTestScore: {
    type: Number,
    default: 0,
  },
  activeUsers: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});

const Analytics = mongoose.model('Analytics', analyticsSchema);

module.exports = Analytics;
