const asyncHandler = require('express-async-handler');
const Question = require('../models/questionModel');
const QuestionPool = require('../models/questionPoolModel');
const StudentQuestionHistory = require('../models/studentQuestionHistoryModel');
const aiQuestionGenerator = require('../utils/aiQuestionGenerator');
const smartQuestionSelector = require('../utils/smartQuestionSelector');

// @desc    Create a new question
// @route   POST /api/questions
// @access  Private (Admin)
const createQuestion = asyncHandler(async (req, res) => {
  const { questionType, questionText, options, correctAnswer, testCases, difficulty, category, explanation, points, tags } = req.body;

  if (!questionType || !questionText || !difficulty) {
    res.status(400);
    throw new Error('Please provide all required fields');
  }

  const question = new Question({
    questionType,
    questionText,
    options,
    correctAnswer,
    testCases,
    difficulty,
    category: category || 'General',
    explanation,
    points: points || (difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 3),
    tags,
  });

  const createdQuestion = await question.save();
  res.status(201).json(createdQuestion);
});

// @desc    Get all questions
// @route   GET /api/questions
// @access  Private (Admin)
const getQuestions = asyncHandler(async (req, res) => {
  const { category, difficulty, questionType, search } = req.query;
  
  const query = {};
  
  if (category) query.category = category;
  if (difficulty) query.difficulty = difficulty;
  if (questionType) query.questionType = questionType;
  if (search) {
    query.questionText = { $regex: search, $options: 'i' };
  }
  
  const questions = await Question.find(query).sort({ createdAt: -1 });
  res.json(questions);
});

// @desc    Delete a question
// @route   DELETE /api/questions/:id
// @access  Private (Admin)
const deleteQuestion = asyncHandler(async (req, res) => {
  const question = await Question.findById(req.params.id);

  if (!question) {
    res.status(404);
    throw new Error('Question not found');
  }

  await question.deleteOne();
  res.json({ message: 'Question removed' });
});

// @desc    Update a question
// @route   PUT /api/questions/:id
// @access  Private (Admin)
const updateQuestion = asyncHandler(async (req, res) => {
  const question = await Question.findById(req.params.id);

  if (!question) {
    res.status(404);
    throw new Error('Question not found');
  }

  const updatedQuestion = await Question.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true }
  );

  res.json(updatedQuestion);
});

// @desc    Generate AI questions
// @route   POST /api/questions/generate
// @access  Private (Admin)
const generateAIQuestions = asyncHandler(async (req, res) => {
  const { category, difficulty, questionType, count, topic, saveToDatabase } = req.body;

  console.log('Generating questions with config:', { category, difficulty, questionType, count, topic });

  const questions = await aiQuestionGenerator.generateQuestions({
    category: category || 'General',
    difficulty: difficulty || 'medium',
    questionType: questionType || 'MCQ',
    count: count || 5,
    topic,
  });

  console.log('Generated questions count:', questions?.length || 0);

  if (saveToDatabase) {
    const saved = await aiQuestionGenerator.saveGeneratedQuestions(questions);
    res.status(201).json({
      message: `Generated and saved ${saved.length} questions`,
      questions: saved,
    });
  } else {
    res.json({
      message: `Generated ${questions.length} questions (not saved)`,
      questions,
    });
  }
});

// @desc    Bulk import questions
// @route   POST /api/questions/bulk
// @access  Private (Admin)
const bulkImportQuestions = asyncHandler(async (req, res) => {
  const { questions } = req.body;

  if (!questions || !Array.isArray(questions) || questions.length === 0) {
    res.status(400);
    throw new Error('Please provide an array of questions');
  }

  const created = await Question.insertMany(questions);
  res.status(201).json({
    message: `Successfully imported ${created.length} questions`,
    count: created.length,
  });
});

// @desc    Get question statistics
// @route   GET /api/questions/stats
// @access  Private (Admin)
const getQuestionStats = asyncHandler(async (req, res) => {
  const stats = await Question.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        byCategory: { 
          $push: { category: '$category', difficulty: '$difficulty', type: '$questionType' } 
        },
      },
    },
  ]);

  const categoryStats = await Question.aggregate([
    { $group: { _id: '$category', count: { $sum: 1 } } },
  ]);

  const difficultyStats = await Question.aggregate([
    { $group: { _id: '$difficulty', count: { $sum: 1 } } },
  ]);

  const typeStats = await Question.aggregate([
    { $group: { _id: '$questionType', count: { $sum: 1 } } },
  ]);

  res.json({
    total: stats[0]?.total || 0,
    byCategory: categoryStats,
    byDifficulty: difficultyStats,
    byType: typeStats,
  });
});

// ==================== Question Pool Management ====================

// @desc    Create a question pool
// @route   POST /api/questions/pools
// @access  Private (Admin)
const createQuestionPool = asyncHandler(async (req, res) => {
  const { name, description, config, questions, isDefault } = req.body;

  if (!name) {
    res.status(400);
    throw new Error('Please provide a pool name');
  }

  // If this is default, unset other defaults
  if (isDefault) {
    await QuestionPool.updateMany({}, { isDefault: false });
  }

  const pool = new QuestionPool({
    name,
    description,
    config,
    questions,
    isDefault,
    createdBy: req.user._id,
  });

  const createdPool = await pool.save();
  res.status(201).json(createdPool);
});

// @desc    Get all question pools
// @route   GET /api/questions/pools
// @access  Private (Admin)
const getQuestionPools = asyncHandler(async (req, res) => {
  const pools = await QuestionPool.find({})
    .populate('questions', 'questionText difficulty category')
    .populate('createdBy', 'name');
  res.json(pools);
});

// @desc    Update a question pool
// @route   PUT /api/questions/pools/:id
// @access  Private (Admin)
const updateQuestionPool = asyncHandler(async (req, res) => {
  const pool = await QuestionPool.findById(req.params.id);

  if (!pool) {
    res.status(404);
    throw new Error('Question pool not found');
  }

  if (req.body.isDefault) {
    await QuestionPool.updateMany({}, { isDefault: false });
  }

  const updatedPool = await QuestionPool.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true }
  );

  res.json(updatedPool);
});

// @desc    Delete a question pool
// @route   DELETE /api/questions/pools/:id
// @access  Private (Admin)
const deleteQuestionPool = asyncHandler(async (req, res) => {
  const pool = await QuestionPool.findById(req.params.id);

  if (!pool) {
    res.status(404);
    throw new Error('Question pool not found');
  }

  await pool.deleteOne();
  res.json({ message: 'Question pool removed' });
});

// ==================== Student Analytics ====================

// @desc    Get student question history
// @route   GET /api/questions/student-history/:studentId
// @access  Private (Admin)
const getStudentQuestionHistory = asyncHandler(async (req, res) => {
  const history = await StudentQuestionHistory.findOne({ student: req.params.studentId })
    .populate('seenQuestions.question', 'questionText category difficulty');

  if (!history) {
    res.json({
      totalQuestionsAttempted: 0,
      correctAnswers: 0,
      categoryPerformance: {},
      difficultyPerformance: {},
    });
    return;
  }

  res.json(history);
});

// @desc    Get adaptive difficulty for a student
// @route   GET /api/questions/adaptive-difficulty/:studentId
// @access  Private (Admin/Student)
const getAdaptiveDifficulty = asyncHandler(async (req, res) => {
  const studentId = req.params.studentId || req.user._id;
  const difficulty = await smartQuestionSelector.getAdaptiveDifficulty(studentId);
  const weakCategories = await smartQuestionSelector.getWeakCategories(studentId);

  res.json({
    recommendedDifficulty: difficulty,
    weakCategories,
  });
});

// @desc    Preview question selection (for testing)
// @route   POST /api/questions/preview-selection
// @access  Private (Admin)
const previewQuestionSelection = asyncHandler(async (req, res) => {
  const { studentId, config } = req.body;

  const questions = await smartQuestionSelector.selectQuestionsForTest(
    studentId,
    {
      ...config,
      generateIfNeeded: false, // Don't generate for preview
    }
  );

  res.json({
    count: questions.length,
    questions: questions.map(q => ({
      _id: q._id,
      questionText: q.questionText,
      category: q.category,
      difficulty: q.difficulty,
      questionType: q.questionType,
      points: q.points,
    })),
  });
});

module.exports = { 
  createQuestion, 
  getQuestions, 
  deleteQuestion,
  updateQuestion,
  generateAIQuestions,
  bulkImportQuestions,
  getQuestionStats,
  createQuestionPool,
  getQuestionPools,
  updateQuestionPool,
  deleteQuestionPool,
  getStudentQuestionHistory,
  getAdaptiveDifficulty,
  previewQuestionSelection,
};
