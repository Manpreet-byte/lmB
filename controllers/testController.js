const asyncHandler = require('express-async-handler');
const Test = require('../models/testModel');
const Question = require('../models/questionModel');
const Submission = require('../models/submissionModel');
const LeaveRequest = require('../models/leaveRequestModel');
const Notification = require('../models/notificationModel');
const User = require('../models/userModel');
const { VM } = require('vm2');
const { sendTestCompletedEmail } = require('../utils/emailService');
const smartQuestionSelector = require('../utils/smartQuestionSelector');

// @desc    Get a test by its ID
// @route   GET /api/tests/:id
// @access  Private (Student)
const getTestById = asyncHandler(async (req, res) => {
  const test = await Test.findById(req.params.id).populate('questions');
  if (test) {
    // Prevent sending correct answers to the client
    const questions = test.questions.map(q => {
      const { correctAnswer, testCases, ...question } = q.toObject();
      return question;
    });
    res.json({ ...test.toObject(), questions });
  } else {
    res.status(404);
    throw new Error('Test not found');
  }
});

// @desc    Submit a test
// @route   POST /api/tests/:id/submit
// @access  Private (Student)
const submitTest = asyncHandler(async (req, res) => {
  const test = await Test.findById(req.params.id).populate('questions');
  if (!test) {
    res.status(404);
    throw new Error('Test not found');
  }

  const { answers } = req.body;
  let score = 0;

  for (const submittedAnswer of answers) {
    const question = test.questions.find(q => q._id.toString() === submittedAnswer.questionId);
    if (!question) continue;

    if (question.questionType === 'MCQ') {
      if (question.correctAnswer === submittedAnswer.answer) {
        score++;
      }
    } else if (question.questionType === 'Coding') {
      let passedAllCases = true;
      for (const testCase of question.testCases) {
        const vm = new VM({
          timeout: 1000,
          sandbox: {},
        });
        try {
          const result = vm.run(submittedAnswer.answer + `\n; solution(${testCase.input});`);
          if (String(result) !== String(testCase.output)) {
            passedAllCases = false;
            break;
          }
        } catch (e) {
          passedAllCases = false;
          break;
        }
      }
      if (passedAllCases) {
        score++;
      }
    }
  }

  test.score = score;
  test.status = 'Completed';
  await test.save();

  const totalQuestions = test.questions.length;
  const passingScore = Math.ceil(totalQuestions * 0.6); // 60% passing threshold
  const isPassed = score >= passingScore;

  const { tabSwitchCount } = req.body;

  const submission = new Submission({
    test: test._id,
    leaveRequest: test.leaveRequest,
    student: req.user._id,
    answers: answers.map(a => ({ question: a.questionId, answer: a.answer })),
    score,
    totalQuestions,
    isPassed,
    tabSwitchCount: tabSwitchCount || 0,
  });
  await submission.save();

  // Update student's question history for adaptive learning
  try {
    await smartQuestionSelector.updateStudentHistory(
      req.user._id,
      test._id,
      test.questions,
      answers
    );
  } catch (historyError) {
    console.error('Failed to update question history:', historyError);
    // Don't fail the submission if history update fails
  }

  const leaveRequest = await LeaveRequest.findById(test.leaveRequest);
  leaveRequest.status = 'Test Completed';
  await leaveRequest.save();

  // Notify all admins about the test completion with student details
  const admins = await User.find({ role: 'admin' });
  const studentName = req.user.name;
  const studentEmail = req.user.email;
  const resultText = isPassed ? 'PASSED' : 'FAILED';
  
  for (const admin of admins) {
    // Create in-app notification
    await Notification.create({
      user: admin._id,
      title: 'Test Completed',
      message: `Student ${studentName} (${studentEmail}) has completed their test and ${resultText} with a score of ${score}/${totalQuestions}.`,
      type: 'test_result',
      link: `/leave/${leaveRequest._id}`,
    });

    // Send email notification to admin
    await sendTestCompletedEmail(
      admin.email,
      admin.name,
      studentName,
      studentEmail,
      leaveRequest.subject,
      score,
      totalQuestions,
      isPassed
    );
  }

  res.status(200).json({ message: 'Test submitted successfully', score, isPassed, totalQuestions });
});

// @desc    Get student's own submissions
// @route   GET /api/tests/my-submissions
// @access  Private (Student)
const getMySubmissions = asyncHandler(async (req, res) => {
  const submissions = await Submission.find({ student: req.user._id })
    .populate('leaveRequest')
    .sort({ submittedAt: -1 });
  
  // Format the response
  const formattedSubmissions = submissions.map(sub => ({
    _id: sub._id,
    score: sub.score,
    totalQuestions: sub.totalQuestions || sub.answers?.length || 0,
    isPassed: sub.isPassed,
    submittedAt: sub.submittedAt || sub.createdAt,
    tabSwitchCount: sub.tabSwitchCount || 0,
    leaveRequest: sub.leaveRequest ? {
      _id: sub.leaveRequest._id,
      subject: sub.leaveRequest.subject,
      status: sub.leaveRequest.status,
    } : null
  }));
  
  res.json(formattedSubmissions);
});

// @desc    Run code in sandbox (for coding questions)
// @route   POST /api/tests/run-code
// @access  Private (Student)
const runCode = asyncHandler(async (req, res) => {
  const { code, language, testCases, sampleInput, sampleOutput } = req.body;
  
  if (!code) {
    res.status(400);
    throw new Error('No code provided');
  }
  
  try {
    let output = '';
    
    if (language === 'javascript') {
      // Run JavaScript code in VM2 sandbox
      const vm = new VM({
        timeout: 5000,
        sandbox: {
          console: {
            log: (...args) => {
              output += args.join(' ') + '\n';
            }
          }
        }
      });
      
      try {
        // If there's sample input, try to pass it to the solution function
        if (sampleInput) {
          const wrappedCode = `
            ${code}
            if (typeof solution === 'function') {
              console.log(solution(${JSON.stringify(sampleInput)}));
            }
          `;
          vm.run(wrappedCode);
        } else {
          vm.run(code);
        }
        
        // Run test cases
        if (testCases && testCases.length > 0) {
          output += '\n--- Test Results ---\n';
          testCases.forEach((tc, idx) => {
            try {
              const testCode = `
                ${code}
                if (typeof solution === 'function') {
                  solution(${JSON.stringify(tc.input)});
                }
              `;
              const testVm = new VM({ timeout: 3000 });
              let testOutput = '';
              testVm.sandbox.console = {
                log: (...args) => { testOutput += args.join(' '); }
              };
              testVm.run(testCode);
              
              const passed = testOutput.trim() === tc.output.trim();
              output += `Test ${idx + 1}: ${passed ? '✓ PASSED' : '✗ FAILED'}\n`;
              if (!passed) {
                output += `  Expected: ${tc.output}\n  Got: ${testOutput}\n`;
              }
            } catch (err) {
              output += `Test ${idx + 1}: ✗ ERROR - ${err.message}\n`;
            }
          });
        }
      } catch (err) {
        output = `Error: ${err.message}`;
      }
    } else if (language === 'python') {
      // For Python, we'll just validate syntax and return a message
      // In a real scenario, you'd use a Python sandbox service
      output = 'Python code received. In production, this would execute in a secure Python sandbox.\n\n';
      output += 'Your code:\n' + code.substring(0, 500) + (code.length > 500 ? '...' : '');
      output += '\n\n(Note: Python execution requires a backend Python runtime)';
    } else {
      output = `Language '${language}' is not supported for live execution.`;
    }
    
    res.json({ output: output.trim() || 'Code executed successfully (no output)' });
  } catch (error) {
    res.status(500);
    throw new Error('Code execution failed: ' + error.message);
  }
});

// @desc    Get test configuration options
// @route   GET /api/tests/config-options
// @access  Private (Admin)
const getTestConfigOptions = asyncHandler(async (req, res) => {
  res.json({
    difficulties: ['easy', 'medium', 'hard'],
    categories: ['React', 'Python', 'JavaScript', 'DSA', 'General', 'Database', 'System Design'],
    questionTypes: ['MCQ', 'Coding', 'TrueFalse', 'FillInBlank'],
    defaultConfig: {
      totalTimeLimit: 1800,
      passingPercentage: 60,
      shuffleQuestions: true,
      shuffleOptions: true,
      showResultImmediately: true,
      allowReview: false,
      maxTabSwitches: 3,
      requireFullscreen: true,
      preventCopyPaste: true,
    }
  });
});

module.exports = { getTestById, submitTest, getMySubmissions, runCode, getTestConfigOptions };
