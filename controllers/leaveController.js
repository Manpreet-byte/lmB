const asyncHandler = require('express-async-handler');
const LeaveRequest = require('../models/leaveRequestModel');
const Test = require('../models/testModel');
const Question = require('../models/questionModel');
const AuditLog = require('../models/auditLogModel');
const { createNotification } = require('./notificationController');
const User = require('../models/userModel');
const { sendLeaveApprovedEmail, sendLeaveRejectedEmail } = require('../utils/emailService');
const smartQuestionSelector = require('../utils/smartQuestionSelector');

// @desc    Submit a new leave request
// @route   POST /api/leave
// @access  Private (Student)
const submitLeaveRequest = asyncHandler(async (req, res) => {
  const { reason, leaveDates, subject } = req.body;

  if (!reason || !leaveDates || !subject) {
    res.status(400);
    throw new Error('Please provide all required fields');
  }

  const leaveRequest = new LeaveRequest({
    student: req.user._id,
    reason,
    leaveDates,
    subject,
    status: 'Test Assigned',
  });

  const createdLeaveRequest = await leaveRequest.save();

  // Use smart question selector to get personalized questions
  // Get adaptive difficulty based on student's history
  const adaptiveDifficulty = await smartQuestionSelector.getAdaptiveDifficulty(req.user._id);
  
  // Select questions using the smart selector
  const questions = await smartQuestionSelector.selectQuestionsForTest(req.user._id, {
    totalQuestions: 7, // 7 questions per test
    difficultyDistribution: adaptiveDifficulty,
    categories: null, // All categories
    questionTypes: { MCQ: 70, Coding: 20, TrueFalse: 10 },
    avoidRecentQuestions: true,
    recentQuestionDays: 30,
    generateIfNeeded: true,
  });

  if (questions.length > 0) {
    // Calculate total points
    const totalPoints = questions.reduce((sum, q) => sum + (q.points || 1), 0);
    
    const test = new Test({
      leaveRequest: createdLeaveRequest._id,
      student: req.user._id,
      questions: questions.map(q => q._id),
      totalPoints,
      config: {
        passingPercentage: 60,
        shuffleQuestions: true,
        shuffleOptions: true,
      },
    });
    await test.save();
    createdLeaveRequest.test = test._id;
    await createdLeaveRequest.save();

    // Create notification for student
    await createNotification(
      req.user._id,
      'Test Assigned',
      `A personalized test with ${questions.length} questions has been assigned for your leave request: ${subject}. Complete it to proceed with your application.`,
      'test_assigned',
      `/test/${test._id}`
    );
  }

  // Notify all admins about new leave request
  const admins = await User.find({ role: 'admin' });
  for (const admin of admins) {
    await createNotification(
      admin._id,
      'New Leave Request',
      `${req.user.name} has submitted a leave request for ${subject}.`,
      'info',
      `/leave/${createdLeaveRequest._id}`
    );
  }

  res.status(201).json(createdLeaveRequest);
});

// @desc    Get leave requests
// @route   GET /api/leave
// @access  Private
const getLeaveRequests = asyncHandler(async (req, res) => {
  let requests;
  if (req.user.role === 'admin') {
    requests = await LeaveRequest.find({})
      .populate('student', 'name email')
      .sort({ createdAt: -1 });
  } else {
    requests = await LeaveRequest.find({ student: req.user._id })
      .sort({ createdAt: -1 });
  }
  res.json(requests);
});

// @desc    Get a single leave request by ID
// @route   GET /api/leave/:id
// @access  Private (Admin)
const getLeaveRequestById = asyncHandler(async (req, res) => {
  const leaveRequest = await LeaveRequest.findById(req.params.id)
    .populate('student', 'name email')
    .populate({
      path: 'test',
      select: 'score status questions',
      populate: {
        path: 'questions',
        select: 'questionText questionType'
      }
    });

  if (leaveRequest) {
    res.json(leaveRequest);
  } else {
    res.status(404);
    throw new Error('Leave request not found');
  }
});

// @desc    Update leave request status
// @route   PUT /api/leave/:id/status
// @access  Private (Admin)
const updateLeaveStatus = asyncHandler(async (req, res) => {
  const { status, rejectionReason } = req.body;

  const leaveRequest = await LeaveRequest.findById(req.params.id).populate('student');

  if (leaveRequest) {
    leaveRequest.status = status;
    if (rejectionReason) {
      leaveRequest.rejectionReason = rejectionReason;
    }
    const updatedRequest = await leaveRequest.save();
    
    // Format leave dates for email
    const formatLeaveDates = (dates) => {
      if (!dates) return 'N/A';
      if (Array.isArray(dates)) {
        return dates.map(d => new Date(d).toLocaleDateString()).join(', ');
      }
      if (dates.from && dates.to) {
        return `${new Date(dates.from).toLocaleDateString()} - ${new Date(dates.to).toLocaleDateString()}`;
      }
      return String(dates);
    };

    // Audit log for admin action
    if (status === 'Approved' || status === 'Rejected') {
      await AuditLog.create({
        admin: req.user._id,
        action: status.toUpperCase(),
        leaveRequest: leaveRequest._id,
      });

      // Notify student about decision
      await createNotification(
        leaveRequest.student._id,
        `Leave ${status}`,
        `Your leave request for ${leaveRequest.subject} has been ${status.toLowerCase()} by ${req.user.name} (${req.user.email}).`,
        status === 'Approved' ? 'success' : 'error',
        `/dashboard`
      );

      // Send email notification to student with admin's details
      const studentEmail = leaveRequest.student.email;
      const studentName = leaveRequest.student.name;
      const adminName = req.user.name;
      const adminEmail = req.user.email;
      const leaveDates = formatLeaveDates(leaveRequest.leaveDates);

      if (status === 'Approved') {
        await sendLeaveApprovedEmail(
          studentEmail,
          studentName,
          leaveRequest.subject,
          adminName,
          adminEmail,
          leaveDates
        );
      } else if (status === 'Rejected') {
        await sendLeaveRejectedEmail(
          studentEmail,
          studentName,
          leaveRequest.subject,
          adminName,
          adminEmail,
          leaveDates,
          rejectionReason || ''
        );
      }
    }
    
    res.json(updatedRequest);
  } else {
    res.status(404);
    throw new Error('Leave request not found');
  }
});

// @desc    Get leave statistics
// @route   GET /api/leave/stats
// @access  Private
const getLeaveStats = asyncHandler(async (req, res) => {
  let query = {};
  if (req.user.role !== 'admin') {
    query = { student: req.user._id };
  }

  const total = await LeaveRequest.countDocuments(query);
  const pending = await LeaveRequest.countDocuments({ ...query, status: 'Pending' });
  const testAssigned = await LeaveRequest.countDocuments({ ...query, status: 'Test Assigned' });
  const testCompleted = await LeaveRequest.countDocuments({ ...query, status: 'Test Completed' });
  const approved = await LeaveRequest.countDocuments({ ...query, status: 'Approved' });
  const rejected = await LeaveRequest.countDocuments({ ...query, status: 'Rejected' });

  res.json({
    total,
    pending,
    testAssigned,
    testCompleted,
    approved,
    rejected,
  });
});

module.exports = { 
  submitLeaveRequest, 
  getLeaveRequests, 
  getLeaveRequestById, 
  updateLeaveStatus,
  getLeaveStats 
};
