const asyncHandler = require('express-async-handler');
const LeaveRequest = require('../models/leaveRequestModel');
const Test = require('../models/testModel');
const Submission = require('../models/submissionModel');
const User = require('../models/userModel');
const Question = require('../models/questionModel');

// @desc    Get dashboard analytics
// @route   GET /api/analytics/dashboard
// @access  Private (Admin)
const getDashboardAnalytics = asyncHandler(async (req, res) => {
  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Leave Statistics
  const totalLeaves = await LeaveRequest.countDocuments();
  const pendingLeaves = await LeaveRequest.countDocuments({ status: 'Pending' });
  const testAssignedLeaves = await LeaveRequest.countDocuments({ status: 'Test Assigned' });
  const testCompletedLeaves = await LeaveRequest.countDocuments({ status: 'Test Completed' });
  const approvedLeaves = await LeaveRequest.countDocuments({ status: 'Approved' });
  const rejectedLeaves = await LeaveRequest.countDocuments({ status: 'Rejected' });

  // User Statistics
  const totalStudents = await User.countDocuments({ role: 'student' });
  const totalAdmins = await User.countDocuments({ role: 'admin' });

  // Test Statistics
  const totalSubmissions = await Submission.countDocuments();
  const passedTests = await Submission.countDocuments({ isPassed: true });
  const failedTests = await Submission.countDocuments({ isPassed: false });
  
  // Calculate average score
  const scoreAggregation = await Submission.aggregate([
    {
      $group: {
        _id: null,
        avgScore: { $avg: { $multiply: [{ $divide: ['$score', '$totalQuestions'] }, 100] } },
        totalTabSwitches: { $sum: '$tabSwitchCount' }
      }
    }
  ]);
  const averageScore = scoreAggregation[0]?.avgScore || 0;
  const totalTabSwitches = scoreAggregation[0]?.totalTabSwitches || 0;

  // Question Statistics
  const totalQuestions = await Question.countDocuments();
  const mcqQuestions = await Question.countDocuments({ questionType: 'MCQ' });
  const codingQuestions = await Question.countDocuments({ questionType: 'Coding' });

  // Recent Activity (last 7 days)
  const recentLeaves = await LeaveRequest.countDocuments({
    createdAt: { $gte: sevenDaysAgo }
  });
  const recentSubmissions = await Submission.countDocuments({
    createdAt: { $gte: sevenDaysAgo }
  });

  // Leave trends (last 30 days)
  const leaveTrends = await LeaveRequest.aggregate([
    {
      $match: { createdAt: { $gte: thirtyDaysAgo } }
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  // Test performance trends
  const testTrends = await Submission.aggregate([
    {
      $match: { createdAt: { $gte: thirtyDaysAgo } }
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        avgScore: { $avg: { $multiply: [{ $divide: ['$score', '$totalQuestions'] }, 100] } },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  // Top performing students
  const topStudents = await Submission.aggregate([
    {
      $group: {
        _id: '$student',
        avgScore: { $avg: { $multiply: [{ $divide: ['$score', '$totalQuestions'] }, 100] } },
        totalTests: { $sum: 1 },
        passedTests: { $sum: { $cond: ['$isPassed', 1, 0] } }
      }
    },
    { $sort: { avgScore: -1 } },
    { $limit: 5 }
  ]);

  // Populate top students
  const populatedTopStudents = await User.populate(topStudents, {
    path: '_id',
    select: 'name email'
  });

  res.json({
    leaves: {
      total: totalLeaves,
      pending: pendingLeaves,
      testAssigned: testAssignedLeaves,
      testCompleted: testCompletedLeaves,
      approved: approvedLeaves,
      rejected: rejectedLeaves,
      approvalRate: totalLeaves > 0 ? ((approvedLeaves / totalLeaves) * 100).toFixed(1) : 0,
    },
    users: {
      totalStudents,
      totalAdmins,
      total: totalStudents + totalAdmins,
    },
    tests: {
      totalSubmissions,
      passed: passedTests,
      failed: failedTests,
      passRate: totalSubmissions > 0 ? ((passedTests / totalSubmissions) * 100).toFixed(1) : 0,
      averageScore: averageScore.toFixed(1),
      totalTabSwitches,
    },
    questions: {
      total: totalQuestions,
      mcq: mcqQuestions,
      coding: codingQuestions,
    },
    recentActivity: {
      leaves: recentLeaves,
      submissions: recentSubmissions,
    },
    trends: {
      leaves: leaveTrends,
      tests: testTrends,
    },
    topStudents: populatedTopStudents.map(s => ({
      name: s._id?.name || 'Unknown',
      email: s._id?.email || 'N/A',
      avgScore: s.avgScore.toFixed(1),
      totalTests: s.totalTests,
      passedTests: s.passedTests,
    })),
  });
});

// @desc    Get student's personal analytics
// @route   GET /api/analytics/student
// @access  Private (Student)
const getStudentAnalytics = asyncHandler(async (req, res) => {
  const studentId = req.user._id;

  // Leave Statistics
  const totalLeaves = await LeaveRequest.countDocuments({ student: studentId });
  const approvedLeaves = await LeaveRequest.countDocuments({ student: studentId, status: 'Approved' });
  const rejectedLeaves = await LeaveRequest.countDocuments({ student: studentId, status: 'Rejected' });
  const pendingLeaves = await LeaveRequest.countDocuments({ 
    student: studentId, 
    status: { $in: ['Pending', 'Test Assigned', 'Test Completed'] } 
  });

  // Test Statistics
  const submissions = await Submission.find({ student: studentId });
  const totalTests = submissions.length;
  const passedTests = submissions.filter(s => s.isPassed).length;
  const failedTests = submissions.filter(s => !s.isPassed).length;
  
  const totalScore = submissions.reduce((acc, s) => acc + (s.score / s.totalQuestions) * 100, 0);
  const averageScore = totalTests > 0 ? totalScore / totalTests : 0;
  const totalTabSwitches = submissions.reduce((acc, s) => acc + (s.tabSwitchCount || 0), 0);

  // Recent submissions
  const recentSubmissions = await Submission.find({ student: studentId })
    .populate('leaveRequest', 'subject')
    .sort({ createdAt: -1 })
    .limit(5);

  // Performance over time
  const performanceTrend = submissions
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .map(s => ({
      date: s.createdAt,
      score: ((s.score / s.totalQuestions) * 100).toFixed(1),
      passed: s.isPassed,
    }));

  res.json({
    leaves: {
      total: totalLeaves,
      approved: approvedLeaves,
      rejected: rejectedLeaves,
      pending: pendingLeaves,
      approvalRate: totalLeaves > 0 ? ((approvedLeaves / totalLeaves) * 100).toFixed(1) : 0,
    },
    tests: {
      total: totalTests,
      passed: passedTests,
      failed: failedTests,
      passRate: totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(1) : 0,
      averageScore: averageScore.toFixed(1),
      totalTabSwitches,
    },
    recentSubmissions: recentSubmissions.map(s => ({
      subject: s.leaveRequest?.subject || 'N/A',
      score: s.score,
      totalQuestions: s.totalQuestions,
      percentage: ((s.score / s.totalQuestions) * 100).toFixed(1),
      passed: s.isPassed,
      date: s.createdAt,
    })),
    performanceTrend,
  });
});

module.exports = { getDashboardAnalytics, getStudentAnalytics };
