const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
  test: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Test',
  },
  leaveRequest: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LeaveRequest',
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User',
  },
  answers: [{
    question: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question',
    },
    answer: mongoose.Schema.Types.Mixed, // Can be option index for MCQ or code for coding
  }],
  score: {
    type: Number,
    required: true,
  },
  totalQuestions: {
    type: Number,
    required: true,
  },
  isPassed: {
    type: Boolean,
    default: false,
  },
  tabSwitchCount: {
    type: Number,
    default: 0,
  },
  submittedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

const Submission = mongoose.model('Submission', submissionSchema);

module.exports = Submission;
