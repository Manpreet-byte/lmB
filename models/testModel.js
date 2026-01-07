const mongoose = require('mongoose');

const testSchema = new mongoose.Schema({
  leaveRequest: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'LeaveRequest',
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  questions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question',
  }],
  // Test Configuration
  config: {
    totalTimeLimit: {
      type: Number,
      default: 1800, // 30 minutes default
    },
    passingPercentage: {
      type: Number,
      default: 60,
    },
    shuffleQuestions: {
      type: Boolean,
      default: true,
    },
    shuffleOptions: {
      type: Boolean,
      default: true,
    },
    showResultImmediately: {
      type: Boolean,
      default: true,
    },
    allowReview: {
      type: Boolean,
      default: false,
    },
    maxTabSwitches: {
      type: Number,
      default: 3,
    },
    requireFullscreen: {
      type: Boolean,
      default: true,
    },
    preventCopyPaste: {
      type: Boolean,
      default: true,
    },
    webcamProctoring: {
      type: Boolean,
      default: false,
    },
  },
  score: {
    type: Number,
    default: 0,
  },
  totalPoints: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: ['Assigned', 'In Progress', 'Completed', 'Expired', 'Terminated'],
    default: 'Assigned',
  },
  startTime: {
    type: Date,
  },
  endTime: {
    type: Date,
  },
  // Analytics
  analytics: {
    timePerQuestion: [{
      questionId: mongoose.Schema.Types.ObjectId,
      timeSpent: Number, // in seconds
    }],
    tabSwitches: {
      type: Number,
      default: 0,
    },
    copyPasteAttempts: {
      type: Number,
      default: 0,
    },
    fullscreenExits: {
      type: Number,
      default: 0,
    },
    browserInfo: {
      type: String,
    },
    ipAddress: {
      type: String,
    },
  },
  // Expiry time for the test link
  expiresAt: {
    type: Date,
  },
}, {
  timestamps: true,
});

// Index for faster queries
testSchema.index({ student: 1, status: 1 });
testSchema.index({ leaveRequest: 1 });

const Test = mongoose.model('Test', testSchema);

module.exports = Test;
