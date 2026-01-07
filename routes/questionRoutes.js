const express = require('express');
const router = express.Router();
const { 
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
} = require('../controllers/questionController');
const { protect, admin } = require('../middleware/authMiddleware');

// Question CRUD - base routes
router.route('/')
  .post(protect, admin, createQuestion)
  .get(protect, admin, getQuestions);

// Static routes MUST come before dynamic /:id routes
router.route('/stats').get(protect, admin, getQuestionStats);
router.route('/generate').post(protect, admin, generateAIQuestions);
router.route('/bulk').post(protect, admin, bulkImportQuestions);
router.route('/preview-selection').post(protect, admin, previewQuestionSelection);

// Question Pools
router.route('/pools')
  .get(protect, admin, getQuestionPools)
  .post(protect, admin, createQuestionPool);

router.route('/pools/:id')
  .put(protect, admin, updateQuestionPool)
  .delete(protect, admin, deleteQuestionPool);

// Student Analytics
router.route('/student-history/:studentId').get(protect, admin, getStudentQuestionHistory);
router.route('/adaptive-difficulty/:studentId').get(protect, getAdaptiveDifficulty);
router.route('/adaptive-difficulty').get(protect, getAdaptiveDifficulty);

// Dynamic ID routes MUST come LAST
router.route('/:id')
  .put(protect, admin, updateQuestion)
  .delete(protect, admin, deleteQuestion);

module.exports = router;
