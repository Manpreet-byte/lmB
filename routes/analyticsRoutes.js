const express = require('express');
const router = express.Router();
const { getDashboardAnalytics, getStudentAnalytics } = require('../controllers/analyticsController');
const { protect, admin } = require('../middleware/authMiddleware');

router.route('/dashboard').get(protect, admin, getDashboardAnalytics);
router.route('/student').get(protect, getStudentAnalytics);

module.exports = router;
