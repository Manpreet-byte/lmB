const mongoose = require('mongoose');

const leaveRequestSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User',
  },
  reason: {
    type: String,
    required: true,
  },
  leaveDates: {
    from: {
      type: Date,
      required: true,
    },
    to: {
      type: Date,
      required: true,
    },
  },
  subject: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['Pending', 'Test Assigned', 'Test Completed', 'Approved', 'Rejected'],
    default: 'Pending',
  },
  rejectionReason: {
    type: String,
    default: '',
  },
  test: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Test',
  },
}, {
  timestamps: true,
});

const LeaveRequest = mongoose.model('LeaveRequest', leaveRequestSchema);

module.exports = LeaveRequest;
