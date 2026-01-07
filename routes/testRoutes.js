const express = require('express');
const router = express.Router();
const { getTestById, submitTest, getMySubmissions, runCode, getTestConfigOptions } = require('../controllers/testController');
const { protect, student, admin } = require('../middleware/authMiddleware');

// This must come before /:id routes to avoid matching as an id
router.route('/my-submissions').get(protect, student, getMySubmissions);
router.route('/run-code').post(protect, student, runCode);
router.route('/config-options').get(protect, admin, getTestConfigOptions);
router.route('/:id').get(protect, student, getTestById);
router.route('/:id/submit').post(protect, student, submitTest);

module.exports = router;
