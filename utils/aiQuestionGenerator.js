const axios = require('axios');
const Question = require('../models/questionModel');

// AI Question Generation Service
// Supports multiple AI providers: OpenAI, Google Gemini, or local fallback

class AIQuestionGenerator {
  constructor() {
    this.openaiKey = process.env.OPENAI_API_KEY;
    this.geminiKey = process.env.GEMINI_API_KEY;
  }

  // Generate questions using AI
  async generateQuestions(config) {
    const {
      category = 'General',
      difficulty = 'medium',
      questionType = 'MCQ',
      count = 5,
      topic = null,
    } = config;

    // Try OpenAI first, then Gemini, then fallback to templates
    if (this.openaiKey) {
      return await this.generateWithOpenAI(category, difficulty, questionType, count, topic);
    } else if (this.geminiKey) {
      return await this.generateWithGemini(category, difficulty, questionType, count, topic);
    } else {
      return this.generateFromTemplates(category, difficulty, questionType, count);
    }
  }

  // Generate using OpenAI
  async generateWithOpenAI(category, difficulty, questionType, count, topic) {
    try {
      const prompt = this.buildPrompt(category, difficulty, questionType, count, topic);
      
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are an expert educator creating assessment questions. Always respond with valid JSON array.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.8,
          max_tokens: 2000,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.openaiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const content = response.data.choices[0].message.content;
      return this.parseAIResponse(content, category, difficulty, questionType);
    } catch (error) {
      console.error('OpenAI generation failed:', error.message);
      return this.generateFromTemplates(category, difficulty, questionType, count);
    }
  }

  // Generate using Google Gemini
  async generateWithGemini(category, difficulty, questionType, count, topic) {
    try {
      const prompt = this.buildPrompt(category, difficulty, questionType, count, topic);
      
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${this.geminiKey}`,
        {
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 2000,
          },
        }
      );

      const content = response.data.candidates[0].content.parts[0].text;
      return this.parseAIResponse(content, category, difficulty, questionType);
    } catch (error) {
      console.error('Gemini generation failed:', error.message);
      return this.generateFromTemplates(category, difficulty, questionType, count);
    }
  }

  // Build the prompt for AI
  buildPrompt(category, difficulty, questionType, count, topic) {
    let prompt = `Generate ${count} ${difficulty} difficulty ${questionType} questions about ${category}`;
    
    if (topic) {
      prompt += ` specifically focusing on ${topic}`;
    }

    prompt += `. 

Return a JSON array with the following structure for each question:
{
  "questionText": "The question text",
  "options": ["A) Option 1", "B) Option 2", "C) Option 3", "D) Option 4"], // for MCQ
  "correctAnswer": "A) Option 1", // for MCQ
  "explanation": "Brief explanation of why this is correct"
}

For True/False questions:
{
  "questionText": "Statement to evaluate",
  "options": ["True", "False"],
  "correctAnswer": "True" or "False",
  "explanation": "Brief explanation"
}

Make sure questions are:
1. Clear and unambiguous
2. Educational and relevant
3. Appropriate for ${difficulty} difficulty
4. Have exactly 4 options for MCQ (with one correct answer)

Return ONLY the JSON array, no other text.`;

    return prompt;
  }

  // Parse AI response into question objects
  parseAIResponse(content, category, difficulty, questionType) {
    try {
      // Extract JSON from response (handle markdown code blocks)
      let jsonStr = content;
      if (content.includes('```json')) {
        jsonStr = content.split('```json')[1].split('```')[0];
      } else if (content.includes('```')) {
        jsonStr = content.split('```')[1].split('```')[0];
      }

      const questions = JSON.parse(jsonStr.trim());
      
      return questions.map(q => ({
        questionType,
        questionText: q.questionText,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        category,
        difficulty,
        isActive: true,
        isAIGenerated: true,
        points: difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 3,
      }));
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      return this.generateFromTemplates(category, difficulty, questionType, 5);
    }
  }

  // Fallback: Generate from predefined templates
  generateFromTemplates(category, difficulty, questionType, count) {
    const allTemplates = this.getQuestionTemplates();
    
    // Collect questions matching criteria, with fallbacks
    let pool = [];
    
    // First, try exact match - category and difficulty
    if (allTemplates[category]?.[difficulty]) {
      pool.push(...allTemplates[category][difficulty]);
    }
    
    // Add from same category different difficulty
    if (allTemplates[category]) {
      const difficulties = ['easy', 'medium', 'hard'];
      for (const diff of difficulties) {
        if (diff !== difficulty && allTemplates[category][diff]) {
          pool.push(...allTemplates[category][diff]);
        }
      }
    }
    
    // Add from other categories
    const categories = Object.keys(allTemplates);
    for (const cat of categories) {
      if (cat !== category) {
        for (const diff of ['easy', 'medium', 'hard']) {
          if (allTemplates[cat]?.[diff]) {
            pool.push(...allTemplates[cat][diff]);
          }
        }
      }
    }
    
    // Remove duplicates by questionText
    const seen = new Set();
    pool = pool.filter(q => {
      if (seen.has(q.questionText)) return false;
      seen.add(q.questionText);
      return true;
    });
    
    // Filter by question type FIRST if specified
    if (questionType && questionType !== 'all' && questionType !== 'MCQ') {
      const typeFiltered = pool.filter(q => q.questionType === questionType);
      if (typeFiltered.length > 0) {
        pool = typeFiltered;
      }
    } else if (questionType === 'MCQ') {
      // If MCQ specifically requested, filter to MCQ and TrueFalse
      const mcqFiltered = pool.filter(q => q.questionType === 'MCQ' || q.questionType === 'TrueFalse');
      if (mcqFiltered.length > 0) {
        pool = mcqFiltered;
      }
    }
    
    // Shuffle using Fisher-Yates algorithm for better randomness
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    
    return pool.slice(0, count);
  }

  // Predefined question templates by category - returns ALL templates
  getQuestionTemplates() {
    const templates = {
      JavaScript: {
        easy: [
          {
            questionType: 'MCQ',
            questionText: 'Which of the following is NOT a JavaScript data type?',
            options: ['A) String', 'B) Number', 'C) Float', 'D) Boolean'],
            correctAnswer: 'C) Float',
            explanation: 'JavaScript has Number type which handles both integers and floating-point numbers.',
            category: 'JavaScript',
            difficulty: 'easy',
            points: 1,
          },
          {
            questionType: 'MCQ',
            questionText: 'What does the "===" operator do in JavaScript?',
            options: ['A) Assigns a value', 'B) Compares values only', 'C) Compares both value and type', 'D) None of the above'],
            correctAnswer: 'C) Compares both value and type',
            explanation: 'The strict equality operator (===) checks both value and type without type coercion.',
            category: 'JavaScript',
            difficulty: 'easy',
            points: 1,
          },
          {
            questionType: 'MCQ',
            questionText: 'How do you declare a variable in JavaScript?',
            options: ['A) var, let, const', 'B) int, float, string', 'C) variable, var, let', 'D) declare, define, set'],
            correctAnswer: 'A) var, let, const',
            explanation: 'JavaScript uses var, let, and const keywords to declare variables.',
            category: 'JavaScript',
            difficulty: 'easy',
            points: 1,
          },
          {
            questionType: 'MCQ',
            questionText: 'What is the output of typeof null in JavaScript?',
            options: ['A) null', 'B) undefined', 'C) object', 'D) error'],
            correctAnswer: 'C) object',
            explanation: 'This is a known bug in JavaScript. typeof null returns "object" due to historical reasons.',
            category: 'JavaScript',
            difficulty: 'easy',
            points: 1,
          },
          {
            questionType: 'MCQ',
            questionText: 'Which method adds an element to the end of an array?',
            options: ['A) push()', 'B) pop()', 'C) shift()', 'D) unshift()'],
            correctAnswer: 'A) push()',
            explanation: 'push() adds one or more elements to the end of an array and returns the new length.',
            category: 'JavaScript',
            difficulty: 'easy',
            points: 1,
          },
          {
            questionType: 'MCQ',
            questionText: 'What does NaN stand for in JavaScript?',
            options: ['A) Not a Null', 'B) Not a Number', 'C) Null and None', 'D) Number and Null'],
            correctAnswer: 'B) Not a Number',
            explanation: 'NaN stands for Not a Number and is returned when a mathematical operation fails.',
            category: 'JavaScript',
            difficulty: 'easy',
            points: 1,
          },
          {
            questionType: 'TrueFalse',
            questionText: 'JavaScript is a compiled language.',
            options: ['True', 'False'],
            correctAnswer: 'False',
            explanation: 'JavaScript is an interpreted language, though modern engines use JIT compilation.',
            category: 'JavaScript',
            difficulty: 'easy',
            points: 1,
          },
          {
            questionType: 'TrueFalse',
            questionText: 'In JavaScript, arrays can hold different data types.',
            options: ['True', 'False'],
            correctAnswer: 'True',
            explanation: 'JavaScript arrays are dynamic and can contain elements of different types.',
            category: 'JavaScript',
            difficulty: 'easy',
            points: 1,
          },
        ],
        medium: [
          {
            questionType: 'MCQ',
            questionText: 'What is a closure in JavaScript?',
            options: ['A) A loop structure', 'B) A function with access to outer scope variables', 'C) A way to close the browser', 'D) A type of error'],
            correctAnswer: 'B) A function with access to outer scope variables',
            explanation: 'A closure is a function that retains access to variables from its outer (enclosing) scope even after the outer function has returned.',
            category: 'JavaScript',
            difficulty: 'medium',
            points: 2,
          },
          {
            questionType: 'MCQ',
            questionText: 'What does the "this" keyword refer to in JavaScript?',
            options: ['A) Always the global object', 'B) The current function', 'C) Depends on the execution context', 'D) The DOM element'],
            correctAnswer: 'C) Depends on the execution context',
            explanation: 'The value of "this" depends on how a function is called (regular call, method call, constructor, etc.).',
            category: 'JavaScript',
            difficulty: 'medium',
            points: 2,
          },
          {
            questionType: 'MCQ',
            questionText: 'What is event bubbling in JavaScript?',
            options: ['A) Events only fire once', 'B) Events propagate from child to parent', 'C) Events propagate from parent to child', 'D) Events are cancelled'],
            correctAnswer: 'B) Events propagate from child to parent',
            explanation: 'Event bubbling means events propagate upward from the target element to its ancestors.',
            category: 'JavaScript',
            difficulty: 'medium',
            points: 2,
          },
          {
            questionType: 'MCQ',
            questionText: 'What is the purpose of the "use strict" directive?',
            options: ['A) Makes code run faster', 'B) Enables strict mode with stricter parsing and error handling', 'C) Disables all warnings', 'D) Enables TypeScript'],
            correctAnswer: 'B) Enables strict mode with stricter parsing and error handling',
            explanation: '"use strict" catches common coding mistakes and prevents the use of certain error-prone features.',
            category: 'JavaScript',
            difficulty: 'medium',
            points: 2,
          },
          {
            questionType: 'MCQ',
            questionText: 'What is the difference between let and var?',
            options: ['A) No difference', 'B) let is block-scoped, var is function-scoped', 'C) var is block-scoped, let is function-scoped', 'D) let cannot be reassigned'],
            correctAnswer: 'B) let is block-scoped, var is function-scoped',
            explanation: 'let has block scope while var has function scope. let also prevents redeclaration in the same scope.',
            category: 'JavaScript',
            difficulty: 'medium',
            points: 2,
          },
          {
            questionType: 'MCQ',
            questionText: 'What does the spread operator (...) do?',
            options: ['A) Multiplies numbers', 'B) Expands iterables into individual elements', 'C) Creates a loop', 'D) Defines a function'],
            correctAnswer: 'B) Expands iterables into individual elements',
            explanation: 'The spread operator expands arrays or objects into individual elements or properties.',
            category: 'JavaScript',
            difficulty: 'medium',
            points: 2,
          },
        ],
        hard: [
          {
            questionType: 'MCQ',
            questionText: 'What is the event loop in JavaScript?',
            options: ['A) A for loop for events', 'B) A mechanism that handles async operations', 'C) A type of event handler', 'D) A debugging tool'],
            correctAnswer: 'B) A mechanism that handles async operations',
            explanation: 'The event loop is a mechanism that allows JavaScript to perform non-blocking operations despite being single-threaded.',
            category: 'JavaScript',
            difficulty: 'hard',
            points: 3,
          },
          {
            questionType: 'MCQ',
            questionText: 'What is the difference between call(), apply(), and bind()?',
            options: ['A) They are identical', 'B) call passes args individually, apply as array, bind returns new function', 'C) Only bind works with "this"', 'D) apply is deprecated'],
            correctAnswer: 'B) call passes args individually, apply as array, bind returns new function',
            explanation: 'call() invokes with individual args, apply() with array of args, bind() returns a new function with "this" bound.',
            category: 'JavaScript',
            difficulty: 'hard',
            points: 3,
          },
          {
            questionType: 'MCQ',
            questionText: 'What is prototypal inheritance?',
            options: ['A) Inheritance using classes only', 'B) Objects inheriting directly from other objects', 'C) A deprecated feature', 'D) Same as classical inheritance'],
            correctAnswer: 'B) Objects inheriting directly from other objects',
            explanation: 'Prototypal inheritance allows objects to inherit properties and methods directly from other objects via the prototype chain.',
            category: 'JavaScript',
            difficulty: 'hard',
            points: 3,
          },
          {
            questionType: 'MCQ',
            questionText: 'What is the temporal dead zone (TDZ)?',
            options: ['A) A memory leak', 'B) Time between entering scope and variable initialization for let/const', 'C) A deprecated feature', 'D) A performance issue'],
            correctAnswer: 'B) Time between entering scope and variable initialization for let/const',
            explanation: 'TDZ is the period between entering a scope and the variable being declared, during which accessing let/const throws an error.',
            category: 'JavaScript',
            difficulty: 'hard',
            points: 3,
          },
          // Coding Questions
          {
            questionType: 'Coding',
            questionText: 'Write a function called `reverseString` that takes a string as input and returns the reversed string.',
            sampleInput: 'reverseString("hello")',
            sampleOutput: '"olleh"',
            starterCode: 'function reverseString(str) {\n  // Your code here\n}',
            testCases: [
              { input: '"hello"', output: '"olleh"', isHidden: false },
              { input: '"JavaScript"', output: '"tpircSavaJ"', isHidden: false },
              { input: '""', output: '""', isHidden: true },
            ],
            explanation: 'You can use split(), reverse(), and join() methods or a loop to reverse a string.',
            category: 'JavaScript',
            difficulty: 'easy',
            points: 2,
            timeLimit: 300,
          },
          {
            questionType: 'Coding',
            questionText: 'Write a function called `findMax` that takes an array of numbers and returns the largest number.',
            sampleInput: 'findMax([1, 5, 3, 9, 2])',
            sampleOutput: '9',
            starterCode: 'function findMax(arr) {\n  // Your code here\n}',
            testCases: [
              { input: '[1, 5, 3, 9, 2]', output: '9', isHidden: false },
              { input: '[-1, -5, -3]', output: '-1', isHidden: false },
              { input: '[42]', output: '42', isHidden: true },
            ],
            explanation: 'You can use Math.max() with spread operator or loop through the array.',
            category: 'JavaScript',
            difficulty: 'easy',
            points: 2,
            timeLimit: 300,
          },
          {
            questionType: 'Coding',
            questionText: 'Write a function called `isPalindrome` that checks if a given string is a palindrome (reads the same forwards and backwards).',
            sampleInput: 'isPalindrome("racecar")',
            sampleOutput: 'true',
            starterCode: 'function isPalindrome(str) {\n  // Your code here\n}',
            testCases: [
              { input: '"racecar"', output: 'true', isHidden: false },
              { input: '"hello"', output: 'false', isHidden: false },
              { input: '"A"', output: 'true', isHidden: true },
            ],
            explanation: 'Compare the string with its reversed version.',
            category: 'JavaScript',
            difficulty: 'easy',
            points: 2,
            timeLimit: 300,
          },
          {
            questionType: 'Coding',
            questionText: 'Write a function called `sumArray` that takes an array of numbers and returns their sum.',
            sampleInput: 'sumArray([1, 2, 3, 4, 5])',
            sampleOutput: '15',
            starterCode: 'function sumArray(arr) {\n  // Your code here\n}',
            testCases: [
              { input: '[1, 2, 3, 4, 5]', output: '15', isHidden: false },
              { input: '[]', output: '0', isHidden: false },
              { input: '[10, -5, 3]', output: '8', isHidden: true },
            ],
            explanation: 'Use reduce() method or a loop to sum all elements.',
            category: 'JavaScript',
            difficulty: 'easy',
            points: 2,
            timeLimit: 300,
          },
          {
            questionType: 'Coding',
            questionText: 'Write a function called `removeDuplicates` that takes an array and returns a new array with duplicates removed.',
            sampleInput: 'removeDuplicates([1, 2, 2, 3, 4, 4, 5])',
            sampleOutput: '[1, 2, 3, 4, 5]',
            starterCode: 'function removeDuplicates(arr) {\n  // Your code here\n}',
            testCases: [
              { input: '[1, 2, 2, 3, 4, 4, 5]', output: '[1, 2, 3, 4, 5]', isHidden: false },
              { input: '[1, 1, 1]', output: '[1]', isHidden: false },
              { input: '[]', output: '[]', isHidden: true },
            ],
            explanation: 'Use Set or filter method to remove duplicates.',
            category: 'JavaScript',
            difficulty: 'medium',
            points: 3,
            timeLimit: 300,
          },
          {
            questionType: 'Coding',
            questionText: 'Write a function called `flattenArray` that takes a nested array and returns a flattened array.',
            sampleInput: 'flattenArray([1, [2, 3], [4, [5, 6]]])',
            sampleOutput: '[1, 2, 3, 4, 5, 6]',
            starterCode: 'function flattenArray(arr) {\n  // Your code here\n}',
            testCases: [
              { input: '[1, [2, 3], [4, [5, 6]]]', output: '[1, 2, 3, 4, 5, 6]', isHidden: false },
              { input: '[[1], [2], [3]]', output: '[1, 2, 3]', isHidden: false },
              { input: '[1, 2, 3]', output: '[1, 2, 3]', isHidden: true },
            ],
            explanation: 'Use recursion or the flat() method with Infinity depth.',
            category: 'JavaScript',
            difficulty: 'medium',
            points: 3,
            timeLimit: 300,
          },
          {
            questionType: 'Coding',
            questionText: 'Write a function called `debounce` that takes a function and delay, returning a debounced version.',
            sampleInput: 'const debounced = debounce(fn, 1000)',
            sampleOutput: 'Function that delays execution',
            starterCode: 'function debounce(fn, delay) {\n  // Your code here\n}',
            testCases: [
              { input: 'debounce(() => 1, 100)', output: 'function', isHidden: false },
            ],
            explanation: 'Use setTimeout and clearTimeout to implement debouncing.',
            category: 'JavaScript',
            difficulty: 'hard',
            points: 4,
            timeLimit: 600,
          },
        ],
      },
      React: {
        easy: [
          {
            questionType: 'MCQ',
            questionText: 'What is React?',
            options: ['A) A programming language', 'B) A JavaScript library for building UIs', 'C) A database', 'D) A CSS framework'],
            correctAnswer: 'B) A JavaScript library for building UIs',
            explanation: 'React is a JavaScript library developed by Facebook for building user interfaces.',
            category: 'React',
            difficulty: 'easy',
            points: 1,
          },
          {
            questionType: 'MCQ',
            questionText: 'What is JSX?',
            options: ['A) A new programming language', 'B) JavaScript XML - syntax extension for JavaScript', 'C) A CSS preprocessor', 'D) A testing framework'],
            correctAnswer: 'B) JavaScript XML - syntax extension for JavaScript',
            explanation: 'JSX is a syntax extension that allows writing HTML-like code in JavaScript.',
            category: 'React',
            difficulty: 'easy',
            points: 1,
          },
          {
            questionType: 'MCQ',
            questionText: 'What is a React component?',
            options: ['A) A CSS style', 'B) A reusable piece of UI', 'C) A database table', 'D) A server endpoint'],
            correctAnswer: 'B) A reusable piece of UI',
            explanation: 'Components are independent, reusable pieces of UI that can accept inputs (props) and return React elements.',
            category: 'React',
            difficulty: 'easy',
            points: 1,
          },
          {
            questionType: 'MCQ',
            questionText: 'What are props in React?',
            options: ['A) CSS properties', 'B) Data passed from parent to child components', 'C) Database properties', 'D) HTML attributes only'],
            correctAnswer: 'B) Data passed from parent to child components',
            explanation: 'Props (properties) are read-only data passed from a parent component to a child component.',
            category: 'React',
            difficulty: 'easy',
            points: 1,
          },
          {
            questionType: 'MCQ',
            questionText: 'What is the virtual DOM?',
            options: ['A) A new browser', 'B) A lightweight copy of the actual DOM', 'C) A CSS framework', 'D) A database'],
            correctAnswer: 'B) A lightweight copy of the actual DOM',
            explanation: 'The virtual DOM is an in-memory representation of the real DOM that React uses to optimize updates.',
            category: 'React',
            difficulty: 'easy',
            points: 1,
          },
          {
            questionType: 'TrueFalse',
            questionText: 'React components must return only one root element.',
            options: ['True', 'False'],
            correctAnswer: 'True',
            explanation: 'React components must return a single root element, though you can use fragments (<></>) to group multiple elements.',
            category: 'React',
            difficulty: 'easy',
            points: 1,
          },
        ],
        medium: [
          {
            questionType: 'MCQ',
            questionText: 'What is the useState hook used for?',
            options: ['A) Making API calls', 'B) Adding state to functional components', 'C) Styling components', 'D) Routing'],
            correctAnswer: 'B) Adding state to functional components',
            explanation: 'useState is a Hook that lets you add React state to functional components.',
            category: 'React',
            difficulty: 'medium',
            points: 2,
          },
          {
            questionType: 'MCQ',
            questionText: 'What is the useEffect hook used for?',
            options: ['A) Adding styles', 'B) Performing side effects in functional components', 'C) Creating routes', 'D) Form validation'],
            correctAnswer: 'B) Performing side effects in functional components',
            explanation: 'useEffect lets you perform side effects like data fetching, subscriptions, or DOM manipulation.',
            category: 'React',
            difficulty: 'medium',
            points: 2,
          },
          {
            questionType: 'MCQ',
            questionText: 'What is the purpose of keys in React lists?',
            options: ['A) For styling', 'B) To help React identify which items changed, added, or removed', 'C) For authentication', 'D) For API calls'],
            correctAnswer: 'B) To help React identify which items changed, added, or removed',
            explanation: 'Keys help React identify which items have changed, been added, or been removed for efficient updates.',
            category: 'React',
            difficulty: 'medium',
            points: 2,
          },
          {
            questionType: 'MCQ',
            questionText: 'What is lifting state up in React?',
            options: ['A) Moving state to a higher component', 'B) Deleting state', 'C) Creating new state', 'D) Moving state to Redux'],
            correctAnswer: 'A) Moving state to a higher component',
            explanation: 'Lifting state up means moving state to a common ancestor component so multiple children can share it.',
            category: 'React',
            difficulty: 'medium',
            points: 2,
          },
          {
            questionType: 'MCQ',
            questionText: 'What is a controlled component?',
            options: ['A) A component with no state', 'B) A form element whose value is controlled by React state', 'C) A private component', 'D) A cached component'],
            correctAnswer: 'B) A form element whose value is controlled by React state',
            explanation: 'A controlled component is a form element whose value is controlled by React state, making React the single source of truth.',
            category: 'React',
            difficulty: 'medium',
            points: 2,
          },
        ],
        hard: [
          {
            questionType: 'MCQ',
            questionText: 'What is React.memo() used for?',
            options: ['A) For storing data', 'B) For memoizing components to prevent unnecessary re-renders', 'C) For creating memos', 'D) For error handling'],
            correctAnswer: 'B) For memoizing components to prevent unnecessary re-renders',
            explanation: 'React.memo is a higher-order component that memoizes the rendered output to skip unnecessary re-renders.',
            category: 'React',
            difficulty: 'hard',
            points: 3,
          },
          {
            questionType: 'MCQ',
            questionText: 'What is the useCallback hook used for?',
            options: ['A) Making API calls', 'B) Memoizing callback functions', 'C) Creating callbacks', 'D) Error handling'],
            correctAnswer: 'B) Memoizing callback functions',
            explanation: 'useCallback returns a memoized callback function that only changes if its dependencies change.',
            category: 'React',
            difficulty: 'hard',
            points: 3,
          },
          {
            questionType: 'MCQ',
            questionText: 'What is React Fiber?',
            options: ['A) A CSS framework', 'B) The new reconciliation engine in React 16+', 'C) A routing library', 'D) A testing tool'],
            correctAnswer: 'B) The new reconciliation engine in React 16+',
            explanation: 'React Fiber is the reimplementation of React\'s core algorithm for rendering, enabling features like concurrent mode.',
            category: 'React',
            difficulty: 'hard',
            points: 3,
          },
          {
            questionType: 'MCQ',
            questionText: 'What is the useReducer hook best suited for?',
            options: ['A) Simple state', 'B) Complex state logic with multiple sub-values', 'C) Styling', 'D) API calls'],
            correctAnswer: 'B) Complex state logic with multiple sub-values',
            explanation: 'useReducer is preferable to useState when you have complex state logic involving multiple sub-values or when next state depends on previous.',
            category: 'React',
            difficulty: 'hard',
            points: 3,
          },
          // React Coding Questions
          {
            questionType: 'Coding',
            questionText: 'Create a functional component called `Counter` with a button that increments a count displayed on screen.',
            sampleInput: '<Counter />',
            sampleOutput: 'Button showing count that increments on click',
            starterCode: 'import { useState } from "react";\n\nfunction Counter() {\n  // Your code here\n}\n\nexport default Counter;',
            testCases: [
              { input: 'render', output: 'displays 0 initially', isHidden: false },
              { input: 'click button', output: 'displays 1', isHidden: false },
            ],
            explanation: 'Use useState hook to track count, and onClick handler to increment.',
            category: 'React',
            difficulty: 'easy',
            points: 2,
            timeLimit: 300,
          },
          {
            questionType: 'Coding',
            questionText: 'Create a component called `TodoList` that renders a list of todos and allows adding new ones.',
            sampleInput: '<TodoList />',
            sampleOutput: 'Input field, add button, and list of todos',
            starterCode: 'import { useState } from "react";\n\nfunction TodoList() {\n  // Your code here\n}\n\nexport default TodoList;',
            testCases: [
              { input: 'add "Buy milk"', output: 'shows "Buy milk" in list', isHidden: false },
            ],
            explanation: 'Use useState for todos array and input value, map to render list.',
            category: 'React',
            difficulty: 'medium',
            points: 3,
            timeLimit: 300,
          },
          {
            questionType: 'Coding',
            questionText: 'Create a custom hook called `useLocalStorage` that persists state to localStorage.',
            sampleInput: 'const [value, setValue] = useLocalStorage("key", "default")',
            sampleOutput: 'Value persisted in localStorage',
            starterCode: 'import { useState, useEffect } from "react";\n\nfunction useLocalStorage(key, initialValue) {\n  // Your code here\n}\n\nexport default useLocalStorage;',
            testCases: [
              { input: 'setValue("test")', output: 'localStorage.getItem("key") === "test"', isHidden: false },
            ],
            explanation: 'Use useState with localStorage.getItem for initial value, useEffect to update localStorage.',
            category: 'React',
            difficulty: 'hard',
            points: 4,
            timeLimit: 600,
          },
        ],
      },
      Python: {
        easy: [
          {
            questionType: 'MCQ',
            questionText: 'What is Python?',
            options: ['A) A snake', 'B) A high-level programming language', 'C) A database', 'D) A web browser'],
            correctAnswer: 'B) A high-level programming language',
            explanation: 'Python is a high-level, interpreted programming language known for its readability and simplicity.',
            category: 'Python',
            difficulty: 'easy',
            points: 1,
          },
          {
            questionType: 'MCQ',
            questionText: 'How do you print "Hello World" in Python?',
            options: ['A) console.log("Hello World")', 'B) print("Hello World")', 'C) echo "Hello World"', 'D) System.out.println("Hello World")'],
            correctAnswer: 'B) print("Hello World")',
            explanation: 'Python uses the print() function to output text to the console.',
            category: 'Python',
            difficulty: 'easy',
            points: 1,
          },
          {
            questionType: 'MCQ',
            questionText: 'Which of the following is a valid Python variable name?',
            options: ['A) 2variable', 'B) variable-name', 'C) variable_name', 'D) variable name'],
            correctAnswer: 'C) variable_name',
            explanation: 'Python variable names can contain letters, numbers, and underscores, but cannot start with a number or contain spaces/hyphens.',
            category: 'Python',
            difficulty: 'easy',
            points: 1,
          },
          {
            questionType: 'MCQ',
            questionText: 'What is a list in Python?',
            options: ['A) An immutable sequence', 'B) A mutable ordered collection', 'C) A key-value store', 'D) A single value'],
            correctAnswer: 'B) A mutable ordered collection',
            explanation: 'A list is a mutable, ordered collection of items that can hold different data types.',
            category: 'Python',
            difficulty: 'easy',
            points: 1,
          },
          {
            questionType: 'MCQ',
            questionText: 'What symbol is used for comments in Python?',
            options: ['A) //', 'B) #', 'C) /* */', 'D) --'],
            correctAnswer: 'B) #',
            explanation: 'Python uses the # symbol for single-line comments.',
            category: 'Python',
            difficulty: 'easy',
            points: 1,
          },
          {
            questionType: 'TrueFalse',
            questionText: 'Python uses indentation to define code blocks.',
            options: ['True', 'False'],
            correctAnswer: 'True',
            explanation: 'Python uses indentation (whitespace) instead of braces {} to define code blocks.',
            category: 'Python',
            difficulty: 'easy',
            points: 1,
          },
        ],
        medium: [
          {
            questionType: 'MCQ',
            questionText: 'What is the difference between a list and a tuple in Python?',
            options: ['A) No difference', 'B) Lists are mutable, tuples are immutable', 'C) Tuples are mutable, lists are immutable', 'D) Lists can only hold numbers'],
            correctAnswer: 'B) Lists are mutable, tuples are immutable',
            explanation: 'Lists can be modified after creation, while tuples cannot be changed once created.',
            category: 'Python',
            difficulty: 'medium',
            points: 2,
          },
          {
            questionType: 'MCQ',
            questionText: 'What is a decorator in Python?',
            options: ['A) A design pattern', 'B) A function that modifies other functions', 'C) A CSS property', 'D) A type of loop'],
            correctAnswer: 'B) A function that modifies other functions',
            explanation: 'Decorators are functions that modify the behavior of other functions or methods.',
            category: 'Python',
            difficulty: 'medium',
            points: 2,
          },
          {
            questionType: 'MCQ',
            questionText: 'What does the __init__ method do in a Python class?',
            options: ['A) Destroys the object', 'B) Initializes a new object', 'C) Creates a static method', 'D) Imports modules'],
            correctAnswer: 'B) Initializes a new object',
            explanation: '__init__ is the constructor method that initializes a new instance of a class.',
            category: 'Python',
            difficulty: 'medium',
            points: 2,
          },
          {
            questionType: 'MCQ',
            questionText: 'What is a lambda function in Python?',
            options: ['A) A named function', 'B) An anonymous, single-expression function', 'C) A recursive function', 'D) A generator'],
            correctAnswer: 'B) An anonymous, single-expression function',
            explanation: 'Lambda functions are small anonymous functions that can have any number of arguments but only one expression.',
            category: 'Python',
            difficulty: 'medium',
            points: 2,
          },
          {
            questionType: 'MCQ',
            questionText: 'What does *args do in a Python function?',
            options: ['A) Multiplies arguments', 'B) Allows variable number of positional arguments', 'C) Creates keyword arguments', 'D) Defines default values'],
            correctAnswer: 'B) Allows variable number of positional arguments',
            explanation: '*args allows a function to accept any number of positional arguments as a tuple.',
            category: 'Python',
            difficulty: 'medium',
            points: 2,
          },
        ],
        hard: [
          {
            questionType: 'MCQ',
            questionText: 'What is the Global Interpreter Lock (GIL) in Python?',
            options: ['A) A security feature', 'B) A mutex that protects access to Python objects', 'C) A debugging tool', 'D) A package manager'],
            correctAnswer: 'B) A mutex that protects access to Python objects',
            explanation: 'The GIL is a mutex that allows only one thread to execute Python bytecode at a time, preventing true parallelism.',
            category: 'Python',
            difficulty: 'hard',
            points: 3,
          },
          {
            questionType: 'MCQ',
            questionText: 'What is a generator in Python?',
            options: ['A) A random number function', 'B) A function that yields values lazily', 'C) A class factory', 'D) A testing tool'],
            correctAnswer: 'B) A function that yields values lazily',
            explanation: 'Generators are functions that use yield to produce a sequence of values lazily, one at a time.',
            category: 'Python',
            difficulty: 'hard',
            points: 3,
          },
          {
            questionType: 'MCQ',
            questionText: 'What is metaclass in Python?',
            options: ['A) A subclass', 'B) A class of a class', 'C) A static class', 'D) An abstract class'],
            correctAnswer: 'B) A class of a class',
            explanation: 'A metaclass is the class of a class, defining how a class behaves. Classes are instances of metaclasses.',
            category: 'Python',
            difficulty: 'hard',
            points: 3,
          },
          // Python Coding Questions
          {
            questionType: 'Coding',
            questionText: 'Write a function called `factorial` that calculates the factorial of a number.',
            sampleInput: 'factorial(5)',
            sampleOutput: '120',
            starterCode: 'def factorial(n):\n    # Your code here\n    pass',
            testCases: [
              { input: '5', output: '120', isHidden: false },
              { input: '0', output: '1', isHidden: false },
              { input: '10', output: '3628800', isHidden: true },
            ],
            explanation: 'Use recursion or a loop to multiply numbers from 1 to n.',
            category: 'Python',
            difficulty: 'easy',
            points: 2,
            timeLimit: 300,
            programmingLanguage: 'python',
          },
          {
            questionType: 'Coding',
            questionText: 'Write a function called `is_prime` that checks if a number is prime.',
            sampleInput: 'is_prime(7)',
            sampleOutput: 'True',
            starterCode: 'def is_prime(n):\n    # Your code here\n    pass',
            testCases: [
              { input: '7', output: 'True', isHidden: false },
              { input: '4', output: 'False', isHidden: false },
              { input: '2', output: 'True', isHidden: true },
              { input: '1', output: 'False', isHidden: true },
            ],
            explanation: 'Check if the number is divisible by any number from 2 to sqrt(n).',
            category: 'Python',
            difficulty: 'easy',
            points: 2,
            timeLimit: 300,
            programmingLanguage: 'python',
          },
          {
            questionType: 'Coding',
            questionText: 'Write a function called `fibonacci` that returns the nth Fibonacci number.',
            sampleInput: 'fibonacci(10)',
            sampleOutput: '55',
            starterCode: 'def fibonacci(n):\n    # Your code here\n    pass',
            testCases: [
              { input: '10', output: '55', isHidden: false },
              { input: '1', output: '1', isHidden: false },
              { input: '0', output: '0', isHidden: true },
            ],
            explanation: 'Use iteration or memoization for efficient Fibonacci calculation.',
            category: 'Python',
            difficulty: 'medium',
            points: 3,
            timeLimit: 300,
            programmingLanguage: 'python',
          },
          {
            questionType: 'Coding',
            questionText: 'Write a function called `count_words` that counts the frequency of each word in a string.',
            sampleInput: 'count_words("hello world hello")',
            sampleOutput: '{"hello": 2, "world": 1}',
            starterCode: 'def count_words(text):\n    # Your code here\n    pass',
            testCases: [
              { input: '"hello world hello"', output: '{"hello": 2, "world": 1}', isHidden: false },
              { input: '"a a a b"', output: '{"a": 3, "b": 1}', isHidden: true },
            ],
            explanation: 'Split the string and use a dictionary to count occurrences.',
            category: 'Python',
            difficulty: 'medium',
            points: 3,
            timeLimit: 300,
            programmingLanguage: 'python',
          },
          {
            questionType: 'Coding',
            questionText: 'Write a function called `merge_sorted_lists` that merges two sorted lists into one sorted list.',
            sampleInput: 'merge_sorted_lists([1, 3, 5], [2, 4, 6])',
            sampleOutput: '[1, 2, 3, 4, 5, 6]',
            starterCode: 'def merge_sorted_lists(list1, list2):\n    # Your code here\n    pass',
            testCases: [
              { input: '[1, 3, 5], [2, 4, 6]', output: '[1, 2, 3, 4, 5, 6]', isHidden: false },
              { input: '[], [1, 2]', output: '[1, 2]', isHidden: true },
            ],
            explanation: 'Use two pointers to merge the lists efficiently.',
            category: 'Python',
            difficulty: 'medium',
            points: 3,
            timeLimit: 300,
            programmingLanguage: 'python',
          },
        ],
      },
      DSA: {
        easy: [
          {
            questionType: 'MCQ',
            questionText: 'What is the time complexity of accessing an element in an array by index?',
            options: ['A) O(1)', 'B) O(n)', 'C) O(log n)', 'D) O(n²)'],
            correctAnswer: 'A) O(1)',
            explanation: 'Array access by index is constant time O(1) because elements are stored in contiguous memory.',
            category: 'DSA',
            difficulty: 'easy',
            points: 1,
          },
          {
            questionType: 'MCQ',
            questionText: 'What data structure uses LIFO (Last In First Out)?',
            options: ['A) Queue', 'B) Stack', 'C) Array', 'D) Linked List'],
            correctAnswer: 'B) Stack',
            explanation: 'A Stack follows LIFO - the last element added is the first to be removed.',
            category: 'DSA',
            difficulty: 'easy',
            points: 1,
          },
          {
            questionType: 'MCQ',
            questionText: 'What data structure uses FIFO (First In First Out)?',
            options: ['A) Stack', 'B) Queue', 'C) Tree', 'D) Graph'],
            correctAnswer: 'B) Queue',
            explanation: 'A Queue follows FIFO - the first element added is the first to be removed.',
            category: 'DSA',
            difficulty: 'easy',
            points: 1,
          },
          {
            questionType: 'MCQ',
            questionText: 'What is a linked list?',
            options: ['A) An array', 'B) A sequence of nodes with data and pointers', 'C) A tree structure', 'D) A hash table'],
            correctAnswer: 'B) A sequence of nodes with data and pointers',
            explanation: 'A linked list is a linear data structure where elements are stored in nodes, each containing data and a reference to the next node.',
            category: 'DSA',
            difficulty: 'easy',
            points: 1,
          },
          {
            questionType: 'MCQ',
            questionText: 'What is Big O notation used for?',
            options: ['A) Naming variables', 'B) Describing algorithm time/space complexity', 'C) Writing comments', 'D) Defining functions'],
            correctAnswer: 'B) Describing algorithm time/space complexity',
            explanation: 'Big O notation describes the upper bound of an algorithm\'s time or space complexity.',
            category: 'DSA',
            difficulty: 'easy',
            points: 1,
          },
        ],
        medium: [
          {
            questionType: 'MCQ',
            questionText: 'What is the average time complexity of binary search?',
            options: ['A) O(1)', 'B) O(n)', 'C) O(log n)', 'D) O(n²)'],
            correctAnswer: 'C) O(log n)',
            explanation: 'Binary search halves the search space with each comparison, resulting in O(log n) complexity.',
            category: 'DSA',
            difficulty: 'medium',
            points: 2,
          },
          {
            questionType: 'MCQ',
            questionText: 'What is a hash table?',
            options: ['A) A sorted array', 'B) A data structure with key-value pairs using hash function', 'C) A linked list', 'D) A binary tree'],
            correctAnswer: 'B) A data structure with key-value pairs using hash function',
            explanation: 'A hash table stores key-value pairs and uses a hash function to compute indices for fast access.',
            category: 'DSA',
            difficulty: 'medium',
            points: 2,
          },
          {
            questionType: 'MCQ',
            questionText: 'What is the worst-case time complexity of QuickSort?',
            options: ['A) O(n log n)', 'B) O(n)', 'C) O(n²)', 'D) O(log n)'],
            correctAnswer: 'C) O(n²)',
            explanation: 'QuickSort\'s worst case is O(n²) when the pivot selection consistently results in unbalanced partitions.',
            category: 'DSA',
            difficulty: 'medium',
            points: 2,
          },
          {
            questionType: 'MCQ',
            questionText: 'What is a binary search tree (BST)?',
            options: ['A) A tree with max 2 children per node', 'B) A tree where left < parent < right for all nodes', 'C) A balanced tree', 'D) A tree with binary values'],
            correctAnswer: 'B) A tree where left < parent < right for all nodes',
            explanation: 'In a BST, for each node, all values in the left subtree are smaller and all values in the right subtree are larger.',
            category: 'DSA',
            difficulty: 'medium',
            points: 2,
          },
          {
            questionType: 'MCQ',
            questionText: 'What is depth-first search (DFS)?',
            options: ['A) Search by level', 'B) Search that explores as deep as possible before backtracking', 'C) Binary search', 'D) Linear search'],
            correctAnswer: 'B) Search that explores as deep as possible before backtracking',
            explanation: 'DFS explores a branch as deep as possible before backtracking to explore other branches.',
            category: 'DSA',
            difficulty: 'medium',
            points: 2,
          },
        ],
        hard: [
          {
            questionType: 'MCQ',
            questionText: 'What is the time complexity of Dijkstra\'s algorithm with a binary heap?',
            options: ['A) O(V + E)', 'B) O((V + E) log V)', 'C) O(V²)', 'D) O(E log E)'],
            correctAnswer: 'B) O((V + E) log V)',
            explanation: 'Dijkstra\'s algorithm with a binary heap has O((V + E) log V) complexity where V is vertices and E is edges.',
            category: 'DSA',
            difficulty: 'hard',
            points: 3,
          },
          {
            questionType: 'MCQ',
            questionText: 'What is dynamic programming?',
            options: ['A) Real-time programming', 'B) Breaking problems into overlapping subproblems and storing results', 'C) Object-oriented programming', 'D) Concurrent programming'],
            correctAnswer: 'B) Breaking problems into overlapping subproblems and storing results',
            explanation: 'Dynamic programming solves complex problems by breaking them into simpler overlapping subproblems and storing their solutions.',
            category: 'DSA',
            difficulty: 'hard',
            points: 3,
          },
          {
            questionType: 'MCQ',
            questionText: 'What is the amortized time complexity of inserting into a dynamic array?',
            options: ['A) O(1)', 'B) O(n)', 'C) O(log n)', 'D) O(n²)'],
            correctAnswer: 'A) O(1)',
            explanation: 'Though occasional resizing takes O(n), the amortized cost per insertion is O(1) because resizing happens infrequently.',
            category: 'DSA',
            difficulty: 'hard',
            points: 3,
          },
          // DSA Coding Questions
          {
            questionType: 'Coding',
            questionText: 'Write a function called `binarySearch` that searches for a target value in a sorted array and returns its index, or -1 if not found.',
            sampleInput: 'binarySearch([1, 3, 5, 7, 9], 5)',
            sampleOutput: '2',
            starterCode: 'function binarySearch(arr, target) {\n  // Your code here\n}',
            testCases: [
              { input: '[1, 3, 5, 7, 9], 5', output: '2', isHidden: false },
              { input: '[1, 3, 5, 7, 9], 6', output: '-1', isHidden: false },
              { input: '[2, 4, 6, 8], 2', output: '0', isHidden: true },
            ],
            explanation: 'Use two pointers (left, right) and compare the middle element with target.',
            category: 'DSA',
            difficulty: 'easy',
            points: 2,
            timeLimit: 300,
          },
          {
            questionType: 'Coding',
            questionText: 'Implement a Stack class with push, pop, and peek methods.',
            sampleInput: 'stack.push(1); stack.push(2); stack.pop(); stack.peek()',
            sampleOutput: '2, 1',
            starterCode: 'class Stack {\n  constructor() {\n    // Your code here\n  }\n  \n  push(val) {\n    // Your code here\n  }\n  \n  pop() {\n    // Your code here\n  }\n  \n  peek() {\n    // Your code here\n  }\n}',
            testCases: [
              { input: 'push(1), push(2), pop()', output: '2', isHidden: false },
              { input: 'push(5), peek()', output: '5', isHidden: false },
            ],
            explanation: 'Use an array internally with push/pop operations.',
            category: 'DSA',
            difficulty: 'easy',
            points: 2,
            timeLimit: 300,
          },
          {
            questionType: 'Coding',
            questionText: 'Write a function called `reverseLinkedList` that reverses a singly linked list.',
            sampleInput: 'reverseLinkedList(1 -> 2 -> 3 -> 4)',
            sampleOutput: '4 -> 3 -> 2 -> 1',
            starterCode: 'function reverseLinkedList(head) {\n  // Your code here\n  // head = { val: number, next: Node | null }\n}',
            testCases: [
              { input: '1 -> 2 -> 3', output: '3 -> 2 -> 1', isHidden: false },
              { input: '1', output: '1', isHidden: true },
            ],
            explanation: 'Use three pointers: prev, current, and next to reverse links.',
            category: 'DSA',
            difficulty: 'medium',
            points: 3,
            timeLimit: 300,
          },
          {
            questionType: 'Coding',
            questionText: 'Write a function called `isValidBST` that checks if a binary tree is a valid Binary Search Tree.',
            sampleInput: 'isValidBST(root)',
            sampleOutput: 'true or false',
            starterCode: 'function isValidBST(root) {\n  // Your code here\n  // root = { val: number, left: Node | null, right: Node | null }\n}',
            testCases: [
              { input: '[2,1,3]', output: 'true', isHidden: false },
              { input: '[5,1,4,null,null,3,6]', output: 'false', isHidden: false },
            ],
            explanation: 'Use recursion with min/max bounds to validate BST property.',
            category: 'DSA',
            difficulty: 'medium',
            points: 3,
            timeLimit: 300,
          },
          {
            questionType: 'Coding',
            questionText: 'Write a function called `mergeSort` that implements the merge sort algorithm.',
            sampleInput: 'mergeSort([38, 27, 43, 3, 9, 82, 10])',
            sampleOutput: '[3, 9, 10, 27, 38, 43, 82]',
            starterCode: 'function mergeSort(arr) {\n  // Your code here\n}',
            testCases: [
              { input: '[38, 27, 43, 3, 9, 82, 10]', output: '[3, 9, 10, 27, 38, 43, 82]', isHidden: false },
              { input: '[5, 2, 8, 1]', output: '[1, 2, 5, 8]', isHidden: true },
            ],
            explanation: 'Divide array in half, recursively sort, then merge sorted halves.',
            category: 'DSA',
            difficulty: 'hard',
            points: 4,
            timeLimit: 600,
          },
          {
            questionType: 'Coding',
            questionText: 'Write a function called `findKthLargest` that finds the kth largest element in an unsorted array.',
            sampleInput: 'findKthLargest([3, 2, 1, 5, 6, 4], 2)',
            sampleOutput: '5',
            starterCode: 'function findKthLargest(nums, k) {\n  // Your code here\n}',
            testCases: [
              { input: '[3, 2, 1, 5, 6, 4], 2', output: '5', isHidden: false },
              { input: '[3, 2, 3, 1, 2, 4, 5, 5, 6], 4', output: '4', isHidden: true },
            ],
            explanation: 'Use a min-heap of size k or QuickSelect algorithm.',
            category: 'DSA',
            difficulty: 'hard',
            points: 4,
            timeLimit: 600,
          },
        ],
      },
      General: {
        easy: [
          {
            questionType: 'MCQ',
            questionText: 'What does HTTP stand for?',
            options: ['A) Hyper Text Transfer Protocol', 'B) High Tech Transfer Protocol', 'C) Hyper Text Transport Protocol', 'D) Home Tool Transfer Protocol'],
            correctAnswer: 'A) Hyper Text Transfer Protocol',
            explanation: 'HTTP stands for Hyper Text Transfer Protocol, used for transmitting web pages.',
            category: 'General',
            difficulty: 'easy',
            points: 1,
          },
          {
            questionType: 'MCQ',
            questionText: 'What is an API?',
            options: ['A) A programming language', 'B) Application Programming Interface', 'C) A database', 'D) A web browser'],
            correctAnswer: 'B) Application Programming Interface',
            explanation: 'An API is a set of protocols and tools for building software applications.',
            category: 'General',
            difficulty: 'easy',
            points: 1,
          },
          {
            questionType: 'MCQ',
            questionText: 'What does URL stand for?',
            options: ['A) Uniform Resource Locator', 'B) Universal Reference Link', 'C) Unified Resource Location', 'D) User Reference Locator'],
            correctAnswer: 'A) Uniform Resource Locator',
            explanation: 'URL stands for Uniform Resource Locator, the address of a resource on the internet.',
            category: 'General',
            difficulty: 'easy',
            points: 1,
          },
          {
            questionType: 'MCQ',
            questionText: 'What is version control?',
            options: ['A) A type of database', 'B) A system for tracking changes to code', 'C) A testing framework', 'D) A deployment tool'],
            correctAnswer: 'B) A system for tracking changes to code',
            explanation: 'Version control systems like Git track changes to code over time and enable collaboration.',
            category: 'General',
            difficulty: 'easy',
            points: 1,
          },
          {
            questionType: 'MCQ',
            questionText: 'What is an IDE?',
            options: ['A) Internet Development Engine', 'B) Integrated Development Environment', 'C) Internal Data Exchange', 'D) Interface Design Editor'],
            correctAnswer: 'B) Integrated Development Environment',
            explanation: 'An IDE is a software application that provides comprehensive facilities for software development.',
            category: 'General',
            difficulty: 'easy',
            points: 1,
          },
          {
            questionType: 'TrueFalse',
            questionText: 'Git and GitHub are the same thing.',
            options: ['True', 'False'],
            correctAnswer: 'False',
            explanation: 'Git is a version control system, while GitHub is a cloud-based hosting service for Git repositories.',
            category: 'General',
            difficulty: 'easy',
            points: 1,
          },
          {
            questionType: 'TrueFalse',
            questionText: 'HTML is a programming language.',
            options: ['True', 'False'],
            correctAnswer: 'False',
            explanation: 'HTML is a markup language, not a programming language. It structures content but doesn\'t have logic or algorithms.',
            category: 'General',
            difficulty: 'easy',
            points: 1,
          },
        ],
        medium: [
          {
            questionType: 'MCQ',
            questionText: 'What is the difference between SQL and NoSQL databases?',
            options: ['A) SQL is faster', 'B) SQL is relational, NoSQL is non-relational', 'C) NoSQL cannot store data', 'D) They are the same'],
            correctAnswer: 'B) SQL is relational, NoSQL is non-relational',
            explanation: 'SQL databases are relational with structured schemas, while NoSQL databases are non-relational with flexible schemas.',
            category: 'General',
            difficulty: 'medium',
            points: 2,
          },
          {
            questionType: 'MCQ',
            questionText: 'What is REST in web development?',
            options: ['A) A programming language', 'B) An architectural style for APIs', 'C) A database', 'D) A testing framework'],
            correctAnswer: 'B) An architectural style for APIs',
            explanation: 'REST (Representational State Transfer) is an architectural style for designing networked applications.',
            category: 'General',
            difficulty: 'medium',
            points: 2,
          },
          {
            questionType: 'MCQ',
            questionText: 'What is CI/CD?',
            options: ['A) Code Integration/Code Deployment', 'B) Continuous Integration/Continuous Deployment', 'C) Computer Interface/Computer Design', 'D) Class Inheritance/Class Design'],
            correctAnswer: 'B) Continuous Integration/Continuous Deployment',
            explanation: 'CI/CD automates the integration of code changes and deployment to production environments.',
            category: 'General',
            difficulty: 'medium',
            points: 2,
          },
          {
            questionType: 'MCQ',
            questionText: 'What is Docker used for?',
            options: ['A) Writing code', 'B) Containerizing applications', 'C) Managing databases', 'D) Testing'],
            correctAnswer: 'B) Containerizing applications',
            explanation: 'Docker packages applications with their dependencies into containers for consistent deployment across environments.',
            category: 'General',
            difficulty: 'medium',
            points: 2,
          },
          {
            questionType: 'MCQ',
            questionText: 'What is HTTPS?',
            options: ['A) A faster version of HTTP', 'B) HTTP with encryption (SSL/TLS)', 'C) A new protocol', 'D) A database protocol'],
            correctAnswer: 'B) HTTP with encryption (SSL/TLS)',
            explanation: 'HTTPS is HTTP with encryption using SSL/TLS, providing secure communication over the internet.',
            category: 'General',
            difficulty: 'medium',
            points: 2,
          },
          {
            questionType: 'MCQ',
            questionText: 'What is a microservice architecture?',
            options: ['A) A small application', 'B) Breaking an app into small, independent services', 'C) A testing strategy', 'D) A database design'],
            correctAnswer: 'B) Breaking an app into small, independent services',
            explanation: 'Microservices architecture structures an application as a collection of loosely coupled, independently deployable services.',
            category: 'General',
            difficulty: 'medium',
            points: 2,
          },
        ],
        hard: [
          {
            questionType: 'MCQ',
            questionText: 'What is the CAP theorem in distributed systems?',
            options: ['A) A coding standard', 'B) Consistency, Availability, Partition tolerance trade-off', 'C) A security protocol', 'D) A testing methodology'],
            correctAnswer: 'B) Consistency, Availability, Partition tolerance trade-off',
            explanation: 'CAP theorem states that a distributed system can only guarantee two of three properties: Consistency, Availability, and Partition tolerance.',
            category: 'General',
            difficulty: 'hard',
            points: 3,
          },
          {
            questionType: 'MCQ',
            questionText: 'What is eventual consistency?',
            options: ['A) Immediate consistency', 'B) Data will become consistent over time', 'C) No consistency', 'D) Database locking'],
            correctAnswer: 'B) Data will become consistent over time',
            explanation: 'Eventual consistency means that given enough time, all replicas will converge to the same value.',
            category: 'General',
            difficulty: 'hard',
            points: 3,
          },
          {
            questionType: 'MCQ',
            questionText: 'What is sharding in databases?',
            options: ['A) Backup strategy', 'B) Horizontal partitioning of data across multiple databases', 'C) Data encryption', 'D) Query optimization'],
            correctAnswer: 'B) Horizontal partitioning of data across multiple databases',
            explanation: 'Sharding distributes data across multiple database instances to improve scalability and performance.',
            category: 'General',
            difficulty: 'hard',
            points: 3,
          },
        ],
      },
      Database: {
        easy: [
          {
            questionType: 'MCQ',
            questionText: 'What does SQL stand for?',
            options: ['A) Structured Query Language', 'B) Simple Query Language', 'C) Standard Query Language', 'D) System Query Language'],
            correctAnswer: 'A) Structured Query Language',
            explanation: 'SQL stands for Structured Query Language, used to manage relational databases.',
            category: 'Database',
            difficulty: 'easy',
            points: 1,
          },
          {
            questionType: 'MCQ',
            questionText: 'What is a primary key?',
            options: ['A) Any column', 'B) A unique identifier for each row', 'C) The first column', 'D) A foreign key'],
            correctAnswer: 'B) A unique identifier for each row',
            explanation: 'A primary key uniquely identifies each record in a database table.',
            category: 'Database',
            difficulty: 'easy',
            points: 1,
          },
          {
            questionType: 'MCQ',
            questionText: 'What does CRUD stand for?',
            options: ['A) Create, Read, Update, Delete', 'B) Copy, Restore, Undo, Drop', 'C) Connect, Retrieve, Upload, Download', 'D) Cache, Refresh, Update, Deploy'],
            correctAnswer: 'A) Create, Read, Update, Delete',
            explanation: 'CRUD represents the four basic operations for persistent storage.',
            category: 'Database',
            difficulty: 'easy',
            points: 1,
          },
          {
            questionType: 'MCQ',
            questionText: 'What is a foreign key?',
            options: ['A) A key from another country', 'B) A field that references the primary key of another table', 'C) An encrypted key', 'D) A backup key'],
            correctAnswer: 'B) A field that references the primary key of another table',
            explanation: 'A foreign key creates a link between two tables by referencing the primary key of another table.',
            category: 'Database',
            difficulty: 'easy',
            points: 1,
          },
        ],
        medium: [
          {
            questionType: 'MCQ',
            questionText: 'What is database normalization?',
            options: ['A) Making databases faster', 'B) Organizing data to reduce redundancy', 'C) Backing up data', 'D) Encrypting data'],
            correctAnswer: 'B) Organizing data to reduce redundancy',
            explanation: 'Normalization organizes tables to minimize data redundancy and improve data integrity.',
            category: 'Database',
            difficulty: 'medium',
            points: 2,
          },
          {
            questionType: 'MCQ',
            questionText: 'What is a JOIN in SQL?',
            options: ['A) Combining two databases', 'B) Combining rows from two or more tables', 'C) Splitting a table', 'D) Deleting duplicate rows'],
            correctAnswer: 'B) Combining rows from two or more tables',
            explanation: 'JOIN combines rows from two or more tables based on a related column.',
            category: 'Database',
            difficulty: 'medium',
            points: 2,
          },
          {
            questionType: 'MCQ',
            questionText: 'What is an index in a database?',
            options: ['A) A table of contents', 'B) A data structure to improve query speed', 'C) The first row', 'D) A backup copy'],
            correctAnswer: 'B) A data structure to improve query speed',
            explanation: 'An index is a data structure that improves the speed of data retrieval operations.',
            category: 'Database',
            difficulty: 'medium',
            points: 2,
          },
          {
            questionType: 'MCQ',
            questionText: 'What is a transaction in databases?',
            options: ['A) A financial transfer', 'B) A unit of work that is either fully completed or not at all', 'C) A query', 'D) A table'],
            correctAnswer: 'B) A unit of work that is either fully completed or not at all',
            explanation: 'A transaction is a sequence of operations performed as a single logical unit of work.',
            category: 'Database',
            difficulty: 'medium',
            points: 2,
          },
        ],
        hard: [
          {
            questionType: 'MCQ',
            questionText: 'What is ACID in database transactions?',
            options: ['A) A database type', 'B) Atomicity, Consistency, Isolation, Durability', 'C) A query language', 'D) A security protocol'],
            correctAnswer: 'B) Atomicity, Consistency, Isolation, Durability',
            explanation: 'ACID properties ensure database transactions are processed reliably.',
            category: 'Database',
            difficulty: 'hard',
            points: 3,
          },
          {
            questionType: 'MCQ',
            questionText: 'What is a deadlock in databases?',
            options: ['A) A crashed database', 'B) Two transactions waiting for each other to release locks', 'C) A full database', 'D) A slow query'],
            correctAnswer: 'B) Two transactions waiting for each other to release locks',
            explanation: 'A deadlock occurs when two or more transactions are waiting for each other to release locks, causing all to hang.',
            category: 'Database',
            difficulty: 'hard',
            points: 3,
          },
          {
            questionType: 'MCQ',
            questionText: 'What is database replication?',
            options: ['A) Copying queries', 'B) Keeping copies of data on multiple servers', 'C) Deleting duplicate data', 'D) Creating backups'],
            correctAnswer: 'B) Keeping copies of data on multiple servers',
            explanation: 'Replication maintains copies of data across multiple database servers for availability and redundancy.',
            category: 'Database',
            difficulty: 'hard',
            points: 3,
          },
        ],
      },
    };

    return templates;
  }

  // Save generated questions to database
  async saveGeneratedQuestions(questions) {
    const savedQuestions = [];
    for (const q of questions) {
      const question = new Question({
        ...q,
        isAIGenerated: true,
      });
      const saved = await question.save();
      savedQuestions.push(saved);
    }
    return savedQuestions;
  }
}

module.exports = new AIQuestionGenerator();
