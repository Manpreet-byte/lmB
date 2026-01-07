const mongoose = require('mongoose');

const questionPoolSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
  },
  // Pool configuration
  config: {
    // Number of questions to select from this pool
    questionsPerTest: {
      type: Number,
      default: 5,
    },
    // Difficulty distribution (percentages should sum to 100)
    difficultyDistribution: {
      easy: { type: Number, default: 30 },
      medium: { type: Number, default: 50 },
      hard: { type: Number, default: 20 },
    },
    // Categories to include
    categories: [{
      type: String,
      enum: ['React', 'Python', 'JavaScript', 'DSA', 'General', 'Database', 'System Design'],
    }],
    // Question types distribution
    questionTypeDistribution: {
      MCQ: { type: Number, default: 70 },
      Coding: { type: Number, default: 20 },
      TrueFalse: { type: Number, default: 10 },
      FillInBlank: { type: Number, default: 0 },
    },
    // Time limit for tests using this pool (in seconds)
    timeLimit: {
      type: Number,
      default: 1800, // 30 minutes
    },
    // Passing percentage
    passingPercentage: {
      type: Number,
      default: 60,
    },
  },
  // Questions in this pool
  questions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question',
  }],
  // Is this pool active?
  isActive: {
    type: Boolean,
    default: true,
  },
  // Is this the default pool?
  isDefault: {
    type: Boolean,
    default: false,
  },
  // Created by
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
});

const QuestionPool = mongoose.model('QuestionPool', questionPoolSchema);

module.exports = QuestionPool;
