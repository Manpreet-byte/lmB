const express = require('express');
const router = express.Router();
const { 
  submitLeaveRequest, 
  getLeaveRequests, 
  getLeaveRequestById, 
  updateLeaveStatus,
  getLeaveStats 
} = require('../controllers/leaveController');
const { protect, student, admin } = require('../middleware/authMiddleware');

router.route('/').post(protect, student, submitLeaveRequest).get(protect, getLeaveRequests);
router.route('/stats').get(protect, getLeaveStats);
router.route('/:id').get(protect, getLeaveRequestById);
router.route('/:id/status').put(protect, admin, updateLeaveStatus);

module.exports = router;
