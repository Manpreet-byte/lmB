const mongoose = require('mongoose');

// Track which questions each student has seen to prevent repetition
const studentQuestionHistorySchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  // Questions the student has seen
  seenQuestions: [{
    question: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question',
    },
    seenAt: {
      type: Date,
      default: Date.now,
    },
    // Which test they saw it in
    test: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Test',
    },
    // Did they answer correctly?
    answeredCorrectly: {
      type: Boolean,
    },
  }],
  // Stats
  totalQuestionsAttempted: {
    type: Number,
    default: 0,
  },
  correctAnswers: {
    type: Number,
    default: 0,
  },
  // Performance by category
  categoryPerformance: {
    type: Map,
    of: {
      attempted: Number,
      correct: Number,
    },
    default: {},
  },
  // Performance by difficulty
  difficultyPerformance: {
    type: Map,
    of: {
      attempted: Number,
      correct: Number,
    },
    default: {},
  },
}, {
  timestamps: true,
});

// Index for faster queries
studentQuestionHistorySchema.index({ student: 1 });
studentQuestionHistorySchema.index({ 'seenQuestions.question': 1 });

const StudentQuestionHistory = mongoose.model('StudentQuestionHistory', studentQuestionHistorySchema);

module.exports = StudentQuestionHistory;
