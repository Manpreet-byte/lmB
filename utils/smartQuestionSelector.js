const Question = require('../models/questionModel');
const QuestionPool = require('../models/questionPoolModel');
const StudentQuestionHistory = require('../models/studentQuestionHistoryModel');
const aiQuestionGenerator = require('./aiQuestionGenerator');

class SmartQuestionSelector {
  
  // Main method: Select questions for a test
  async selectQuestionsForTest(studentId, config = {}) {
    const {
      poolId = null,
      totalQuestions = 7,
      difficultyDistribution = { easy: 30, medium: 50, hard: 20 },
      categories = null,
      questionTypes = { MCQ: 70, Coding: 20, TrueFalse: 10 },
      avoidRecentQuestions = true,
      recentQuestionDays = 30, // Don't repeat questions seen in last 30 days
      generateIfNeeded = true, // Generate AI questions if pool is insufficient
    } = config;

    // Get student's question history
    const history = await this.getStudentHistory(studentId);
    const recentlySeenIds = avoidRecentQuestions 
      ? this.getRecentlySeenQuestionIds(history, recentQuestionDays)
      : [];

    // Get question pool
    let pool;
    if (poolId) {
      pool = await QuestionPool.findById(poolId);
    } else {
      pool = await QuestionPool.findOne({ isDefault: true, isActive: true });
    }

    // Calculate how many questions of each type/difficulty we need
    const questionBreakdown = this.calculateQuestionBreakdown(
      totalQuestions,
      difficultyDistribution,
      questionTypes
    );

    // Select questions
    const selectedQuestions = await this.selectQuestions(
      questionBreakdown,
      recentlySeenIds,
      categories,
      pool
    );

    // If we don't have enough questions and AI generation is enabled
    if (selectedQuestions.length < totalQuestions && generateIfNeeded) {
      const needed = totalQuestions - selectedQuestions.length;
      const additionalQuestions = await this.generateAdditionalQuestions(
        needed,
        questionBreakdown,
        selectedQuestions,
        categories
      );
      selectedQuestions.push(...additionalQuestions);
    }

    // Shuffle the final selection
    return this.shuffleArray(selectedQuestions);
  }

  // Get student's question history
  async getStudentHistory(studentId) {
    let history = await StudentQuestionHistory.findOne({ student: studentId });
    if (!history) {
      history = new StudentQuestionHistory({ student: studentId });
      await history.save();
    }
    return history;
  }

  // Get IDs of questions seen recently
  getRecentlySeenQuestionIds(history, days) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return history.seenQuestions
      .filter(sq => new Date(sq.seenAt) > cutoffDate)
      .map(sq => sq.question.toString());
  }

  // Calculate breakdown of questions needed
  calculateQuestionBreakdown(total, difficultyDist, typeDist) {
    const breakdown = [];

    // Calculate by difficulty
    const easyCount = Math.round(total * (difficultyDist.easy / 100));
    const mediumCount = Math.round(total * (difficultyDist.medium / 100));
    const hardCount = total - easyCount - mediumCount;

    // Calculate by type within each difficulty
    const difficulties = [
      { difficulty: 'easy', count: easyCount },
      { difficulty: 'medium', count: mediumCount },
      { difficulty: 'hard', count: hardCount },
    ];

    for (const d of difficulties) {
      if (d.count <= 0) continue;

      // Distribute by question type
      const mcqCount = Math.round(d.count * (typeDist.MCQ / 100));
      const codingCount = Math.round(d.count * ((typeDist.Coding || 0) / 100));
      const tfCount = d.count - mcqCount - codingCount;

      if (mcqCount > 0) {
        breakdown.push({ difficulty: d.difficulty, type: 'MCQ', count: mcqCount });
      }
      if (codingCount > 0) {
        breakdown.push({ difficulty: d.difficulty, type: 'Coding', count: codingCount });
      }
      if (tfCount > 0) {
        breakdown.push({ difficulty: d.difficulty, type: 'TrueFalse', count: tfCount });
      }
    }

    return breakdown;
  }

  // Select questions from database
  async selectQuestions(breakdown, excludeIds, categories, pool) {
    const selected = [];

    for (const req of breakdown) {
      const query = {
        difficulty: req.difficulty,
        questionType: req.type,
        isActive: true,
        _id: { $nin: excludeIds.map(id => id) },
      };

      // Filter by categories if specified
      if (categories && categories.length > 0) {
        query.category = { $in: categories };
      }

      // If using a pool, filter by pool questions
      if (pool && pool.questions && pool.questions.length > 0) {
        query._id.$in = pool.questions;
      }

      // Use aggregation for random selection
      const questions = await Question.aggregate([
        { $match: query },
        { $sample: { size: req.count } },
      ]);

      selected.push(...questions);
      
      // Add selected question IDs to exclude list for next iteration
      questions.forEach(q => excludeIds.push(q._id.toString()));
    }

    return selected;
  }

  // Generate additional questions using AI
  async generateAdditionalQuestions(count, breakdown, existing, categories) {
    const generated = [];
    
    // Determine what's missing
    const existingByType = {};
    existing.forEach(q => {
      const key = `${q.difficulty}-${q.questionType}`;
      existingByType[key] = (existingByType[key] || 0) + 1;
    });

    for (const req of breakdown) {
      const key = `${req.difficulty}-${req.type}`;
      const have = existingByType[key] || 0;
      const need = req.count - have;

      if (need > 0) {
        const category = categories && categories.length > 0 
          ? categories[Math.floor(Math.random() * categories.length)]
          : 'General';

        const questions = await aiQuestionGenerator.generateQuestions({
          category,
          difficulty: req.difficulty,
          questionType: req.type,
          count: need,
        });

        // Save to database
        const saved = await aiQuestionGenerator.saveGeneratedQuestions(questions);
        generated.push(...saved);
      }
    }

    return generated.slice(0, count);
  }

  // Update student history after test
  async updateStudentHistory(studentId, testId, questions, answers) {
    const history = await this.getStudentHistory(studentId);
    
    for (const q of questions) {
      const answer = answers.find(a => a.questionId === q._id.toString());
      const isCorrect = answer ? this.checkAnswer(q, answer.answer) : false;

      history.seenQuestions.push({
        question: q._id,
        test: testId,
        seenAt: new Date(),
        answeredCorrectly: isCorrect,
      });

      // Update category performance
      const catPerf = history.categoryPerformance.get(q.category) || { attempted: 0, correct: 0 };
      catPerf.attempted++;
      if (isCorrect) catPerf.correct++;
      history.categoryPerformance.set(q.category, catPerf);

      // Update difficulty performance
      const diffPerf = history.difficultyPerformance.get(q.difficulty) || { attempted: 0, correct: 0 };
      diffPerf.attempted++;
      if (isCorrect) diffPerf.correct++;
      history.difficultyPerformance.set(q.difficulty, diffPerf);
    }

    history.totalQuestionsAttempted += questions.length;
    history.correctAnswers += answers.filter((a, i) => 
      this.checkAnswer(questions[i], a.answer)
    ).length;

    await history.save();
    return history;
  }

  // Check if answer is correct
  checkAnswer(question, answer) {
    if (question.questionType === 'MCQ' || question.questionType === 'TrueFalse') {
      return question.correctAnswer === answer;
    }
    // For coding questions, would need to run tests
    return false;
  }

  // Get adaptive difficulty based on student performance
  async getAdaptiveDifficulty(studentId) {
    const history = await this.getStudentHistory(studentId);
    
    if (history.totalQuestionsAttempted < 10) {
      // Not enough data, use default distribution
      return { easy: 30, medium: 50, hard: 20 };
    }

    const overallAccuracy = history.correctAnswers / history.totalQuestionsAttempted;

    // Adjust difficulty based on performance
    if (overallAccuracy >= 0.8) {
      // High performer - more hard questions
      return { easy: 10, medium: 40, hard: 50 };
    } else if (overallAccuracy >= 0.6) {
      // Medium performer - balanced
      return { easy: 25, medium: 50, hard: 25 };
    } else {
      // Struggling - more easy questions
      return { easy: 50, medium: 40, hard: 10 };
    }
  }

  // Get weak categories for a student
  async getWeakCategories(studentId) {
    const history = await this.getStudentHistory(studentId);
    const weakCategories = [];

    for (const [category, perf] of history.categoryPerformance) {
      if (perf.attempted >= 3) {
        const accuracy = perf.correct / perf.attempted;
        if (accuracy < 0.5) {
          weakCategories.push(category);
        }
      }
    }

    return weakCategories;
  }

  // Shuffle array (Fisher-Yates)
  shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}

module.exports = new SmartQuestionSelector();
