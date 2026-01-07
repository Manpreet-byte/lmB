const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');

dotenv.config();

// Import models
const User = require('./models/userModel');
const Question = require('./models/questionModel');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected');
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

const seedData = async () => {
  try {
    await connectDB();

    // Clear existing questions to refresh with new ones
    await Question.deleteMany({});
    console.log('Cleared existing questions');

    // Create Admin User
    const adminExists = await User.findOne({ email: 'admin@example.com' });
    if (!adminExists) {
      await User.create({
        name: 'Admin User',
        email: 'admin@example.com',
        password: 'admin123',
        role: 'admin',
      });
      console.log('Admin user created: admin@example.com / admin123');
    } else {
      console.log('Admin user already exists');
    }

    // Create Student User
    const studentExists = await User.findOne({ email: 'student@example.com' });
    if (!studentExists) {
      await User.create({
        name: 'Test Student',
        email: 'student@example.com',
        password: 'student123',
        role: 'student',
      });
      console.log('Student user created: student@example.com / student123');
    } else {
      console.log('Student user already exists');
    }

    // ========== REACT & VITE MCQ QUESTIONS ==========
    const reactViteMCQs = [
      // Easy React Questions
      {
        questionType: 'MCQ',
        difficulty: 'easy',
        questionText: 'What is the correct way to create a functional component in React?',
        options: [
          'function MyComponent() { return <div>Hello</div>; }',
          'class MyComponent { render() { return <div>Hello</div>; } }',
          'const MyComponent = <div>Hello</div>;',
          'MyComponent => <div>Hello</div>'
        ],
        correctAnswer: 'function MyComponent() { return <div>Hello</div>; }',
      },
      {
        questionType: 'MCQ',
        difficulty: 'easy',
        questionText: 'Which hook is used to manage state in a functional React component?',
        options: ['useEffect', 'useState', 'useContext', 'useReducer'],
        correctAnswer: 'useState',
      },
      {
        questionType: 'MCQ',
        difficulty: 'easy',
        questionText: 'What is JSX in React?',
        options: [
          'A JavaScript XML syntax extension',
          'A new programming language',
          'A CSS framework',
          'A database query language'
        ],
        correctAnswer: 'A JavaScript XML syntax extension',
      },
      {
        questionType: 'MCQ',
        difficulty: 'easy',
        questionText: 'What is the default port number for a Vite development server?',
        options: ['3000', '5173', '8080', '4200'],
        correctAnswer: '5173',
      },
      {
        questionType: 'MCQ',
        difficulty: 'easy',
        questionText: 'What command is used to create a new Vite React project?',
        options: [
          'npm create vite@latest',
          'npx create-react-app',
          'npm init vite',
          'vite create app'
        ],
        correctAnswer: 'npm create vite@latest',
      },
      // Medium React Questions
      {
        questionType: 'MCQ',
        difficulty: 'medium',
        questionText: 'What is the purpose of useEffect hook in React?',
        options: [
          'To handle side effects like data fetching and subscriptions',
          'To create state variables',
          'To define component props',
          'To style components'
        ],
        correctAnswer: 'To handle side effects like data fetching and subscriptions',
      },
      {
        questionType: 'MCQ',
        difficulty: 'medium',
        questionText: 'What is the correct dependency array to run useEffect only once on mount?',
        options: [
          'useEffect(() => {}, [])',
          'useEffect(() => {})',
          'useEffect(() => {}, [true])',
          'useEffect(() => {}, null)'
        ],
        correctAnswer: 'useEffect(() => {}, [])',
      },
      {
        questionType: 'MCQ',
        difficulty: 'medium',
        questionText: 'In Vite, what file extension is used for environment variables?',
        options: ['.env', '.config', '.vars', '.settings'],
        correctAnswer: '.env',
      },
      {
        questionType: 'MCQ',
        difficulty: 'medium',
        questionText: 'What is the purpose of React.memo()?',
        options: [
          'To memoize a component and prevent unnecessary re-renders',
          'To store data in memory',
          'To create a new component',
          'To delete component from memory'
        ],
        correctAnswer: 'To memoize a component and prevent unnecessary re-renders',
      },
      {
        questionType: 'MCQ',
        difficulty: 'medium',
        questionText: 'Which Vite plugin is required for React projects?',
        options: ['@vitejs/plugin-react', '@vite/react', 'vite-react', 'react-vite-plugin'],
        correctAnswer: '@vitejs/plugin-react',
      },
      {
        questionType: 'MCQ',
        difficulty: 'medium',
        questionText: 'What is the correct way to pass props to a child component in React?',
        options: [
          '<ChildComponent name="John" />',
          '<ChildComponent props={name: "John"} />',
          '<ChildComponent>{name: "John"}</ChildComponent>',
          'ChildComponent.props = {name: "John"}'
        ],
        correctAnswer: '<ChildComponent name="John" />',
      },
      // Hard React Questions
      {
        questionType: 'MCQ',
        difficulty: 'hard',
        questionText: 'What is the purpose of useMemo hook in React?',
        options: [
          'To memoize expensive calculations and return cached value',
          'To create a new state variable',
          'To handle component lifecycle',
          'To create a reference to DOM element'
        ],
        correctAnswer: 'To memoize expensive calculations and return cached value',
      },
      {
        questionType: 'MCQ',
        difficulty: 'hard',
        questionText: 'In React, what is the difference between useCallback and useMemo?',
        options: [
          'useCallback returns a memoized function, useMemo returns a memoized value',
          'useCallback is for async operations, useMemo is for sync',
          'They are exactly the same',
          'useCallback is deprecated'
        ],
        correctAnswer: 'useCallback returns a memoized function, useMemo returns a memoized value',
      },
      {
        questionType: 'MCQ',
        difficulty: 'hard',
        questionText: 'What is code splitting in Vite/React and how is it achieved?',
        options: [
          'Lazy loading components using React.lazy() and dynamic imports',
          'Splitting CSS files into multiple parts',
          'Breaking HTML into fragments',
          'Dividing the server into microservices'
        ],
        correctAnswer: 'Lazy loading components using React.lazy() and dynamic imports',
      },
      {
        questionType: 'MCQ',
        difficulty: 'hard',
        questionText: 'What is the Virtual DOM in React?',
        options: [
          'A lightweight copy of the actual DOM for efficient updates',
          'A new type of HTML element',
          'A database for storing DOM elements',
          'A CSS rendering engine'
        ],
        correctAnswer: 'A lightweight copy of the actual DOM for efficient updates',
      },
      {
        questionType: 'MCQ',
        difficulty: 'hard',
        questionText: 'What is HMR (Hot Module Replacement) in Vite?',
        options: [
          'A feature that updates modules in the browser without full page reload',
          'A security feature',
          'A database optimization',
          'A CSS preprocessor'
        ],
        correctAnswer: 'A feature that updates modules in the browser without full page reload',
      },
    ];

    // ========== PYTHON DSA MCQ QUESTIONS ==========
    const pythonDSAMCQs = [
      // Easy Python DSA Questions
      {
        questionType: 'MCQ',
        difficulty: 'easy',
        questionText: 'What is the time complexity of accessing an element in a Python list by index?',
        options: ['O(1)', 'O(n)', 'O(log n)', 'O(n^2)'],
        correctAnswer: 'O(1)',
      },
      {
        questionType: 'MCQ',
        difficulty: 'easy',
        questionText: 'Which Python data structure uses key-value pairs?',
        options: ['List', 'Tuple', 'Dictionary', 'Set'],
        correctAnswer: 'Dictionary',
      },
      {
        questionType: 'MCQ',
        difficulty: 'easy',
        questionText: 'What is the output of len([1, 2, [3, 4]]) in Python?',
        options: ['4', '3', '2', 'Error'],
        correctAnswer: '3',
      },
      {
        questionType: 'MCQ',
        difficulty: 'easy',
        questionText: 'Which data structure follows FIFO (First In First Out)?',
        options: ['Stack', 'Queue', 'Tree', 'Graph'],
        correctAnswer: 'Queue',
      },
      {
        questionType: 'MCQ',
        difficulty: 'easy',
        questionText: 'What is the time complexity of appending an element to a Python list?',
        options: ['O(1) amortized', 'O(n)', 'O(log n)', 'O(n^2)'],
        correctAnswer: 'O(1) amortized',
      },
      // Medium Python DSA Questions
      {
        questionType: 'MCQ',
        difficulty: 'medium',
        questionText: 'What is the time complexity of the Python built-in sort() function?',
        options: ['O(n)', 'O(n log n)', 'O(n^2)', 'O(log n)'],
        correctAnswer: 'O(n log n)',
      },
      {
        questionType: 'MCQ',
        difficulty: 'medium',
        questionText: 'Which Python module provides deque (double-ended queue)?',
        options: ['queue', 'collections', 'itertools', 'functools'],
        correctAnswer: 'collections',
      },
      {
        questionType: 'MCQ',
        difficulty: 'medium',
        questionText: 'What is the space complexity of a recursive binary search?',
        options: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'],
        correctAnswer: 'O(log n)',
      },
      {
        questionType: 'MCQ',
        difficulty: 'medium',
        questionText: 'In Python, what is the average time complexity of checking if an element exists in a set?',
        options: ['O(1)', 'O(n)', 'O(log n)', 'O(n^2)'],
        correctAnswer: 'O(1)',
      },
      {
        questionType: 'MCQ',
        difficulty: 'medium',
        questionText: 'Which algorithm is used by Python\'s heapq module?',
        options: ['Min Heap', 'Max Heap', 'Binary Search Tree', 'AVL Tree'],
        correctAnswer: 'Min Heap',
      },
      // Hard Python DSA Questions
      {
        questionType: 'MCQ',
        difficulty: 'hard',
        questionText: 'What is the time complexity of finding the shortest path in an unweighted graph using BFS?',
        options: ['O(V + E)', 'O(V * E)', 'O(V^2)', 'O(E log V)'],
        correctAnswer: 'O(V + E)',
      },
      {
        questionType: 'MCQ',
        difficulty: 'hard',
        questionText: 'Which data structure is most efficient for implementing a priority queue in Python?',
        options: ['List', 'Dictionary', 'Heap (heapq)', 'Set'],
        correctAnswer: 'Heap (heapq)',
      },
      {
        questionType: 'MCQ',
        difficulty: 'hard',
        questionText: 'What is the time complexity of Dijkstra\'s algorithm using a binary heap?',
        options: ['O(V^2)', 'O((V + E) log V)', 'O(V * E)', 'O(E)'],
        correctAnswer: 'O((V + E) log V)',
      },
      {
        questionType: 'MCQ',
        difficulty: 'hard',
        questionText: 'In dynamic programming, what is memoization?',
        options: [
          'Storing computed results to avoid redundant calculations',
          'Writing code from memory',
          'Deleting unused variables',
          'Compressing data structures'
        ],
        correctAnswer: 'Storing computed results to avoid redundant calculations',
      },
      {
        questionType: 'MCQ',
        difficulty: 'hard',
        questionText: 'What is the time complexity of the KMP string matching algorithm?',
        options: ['O(n + m)', 'O(n * m)', 'O(n^2)', 'O(m^2)'],
        correctAnswer: 'O(n + m)',
      },
    ];

    // Combine all MCQ questions
    const mcqQuestions = [...reactViteMCQs, ...pythonDSAMCQs];

    // ========== PYTHON DSA CODING QUESTIONS ==========
    const codingQuestions = [
      // Easy Python DSA Coding
      {
        questionType: 'Coding',
        difficulty: 'easy',
        questionText: 'Write a function called "solution" that takes an array of numbers and returns the sum of all elements. Example: solution([1, 2, 3, 4]) should return 10.',
        sampleInput: '[1, 2, 3, 4]',
        sampleOutput: '10',
        testCases: [
          { input: '[1, 2, 3, 4]', output: '10' },
          { input: '[5, 5, 5]', output: '15' },
          { input: '[]', output: '0' },
        ],
      },
      {
        questionType: 'Coding',
        difficulty: 'easy',
        questionText: 'Write a function called "solution" that takes an array and returns the maximum element. Example: solution([3, 1, 4, 1, 5]) should return 5.',
        sampleInput: '[3, 1, 4, 1, 5]',
        sampleOutput: '5',
        testCases: [
          { input: '[3, 1, 4, 1, 5]', output: '5' },
          { input: '[10, 20, 30]', output: '30' },
          { input: '[-1, -5, -2]', output: '-1' },
        ],
      },
      {
        questionType: 'Coding',
        difficulty: 'easy',
        questionText: 'Write a function called "solution" that takes a string and returns it reversed. Example: solution("hello") should return "olleh".',
        sampleInput: '"hello"',
        sampleOutput: '"olleh"',
        testCases: [
          { input: '"hello"', output: '"olleh"' },
          { input: '"React"', output: '"tcaeR"' },
          { input: '""', output: '""' },
        ],
      },
      {
        questionType: 'Coding',
        difficulty: 'easy',
        questionText: 'Write a function called "solution" that takes a number n and returns true if n is a palindrome, false otherwise. Example: solution(121) should return true.',
        sampleInput: '121',
        sampleOutput: 'true',
        testCases: [
          { input: '121', output: 'true' },
          { input: '123', output: 'false' },
          { input: '1', output: 'true' },
        ],
      },
      // Medium Python DSA Coding
      {
        questionType: 'Coding',
        difficulty: 'medium',
        questionText: 'Write a function called "solution" that takes an array of numbers and returns a new array with duplicates removed. Example: solution([1, 2, 2, 3, 3, 3]) should return [1, 2, 3].',
        sampleInput: '[1, 2, 2, 3, 3, 3]',
        sampleOutput: '[1, 2, 3]',
        testCases: [
          { input: '[1, 2, 2, 3, 3, 3]', output: '[1,2,3]' },
          { input: '[1, 1, 1]', output: '[1]' },
          { input: '[5, 4, 3, 2, 1]', output: '[5,4,3,2,1]' },
        ],
      },
      {
        questionType: 'Coding',
        difficulty: 'medium',
        questionText: 'Write a function called "solution" that takes a number n and returns the factorial of n using recursion. Example: solution(5) should return 120.',
        sampleInput: '5',
        sampleOutput: '120',
        testCases: [
          { input: '5', output: '120' },
          { input: '0', output: '1' },
          { input: '7', output: '5040' },
        ],
      },
      {
        questionType: 'Coding',
        difficulty: 'medium',
        questionText: 'Write a function called "solution" that takes two sorted arrays and returns a single merged sorted array. Example: solution([1,3,5], [2,4,6]) should return [1,2,3,4,5,6].',
        sampleInput: '[1,3,5], [2,4,6]',
        sampleOutput: '[1,2,3,4,5,6]',
        testCases: [
          { input: '[1,3,5], [2,4,6]', output: '[1,2,3,4,5,6]' },
          { input: '[1,2], [3,4]', output: '[1,2,3,4]' },
          { input: '[], [1,2]', output: '[1,2]' },
        ],
      },
      {
        questionType: 'Coding',
        difficulty: 'medium',
        questionText: 'Write a function called "solution" that checks if a string has balanced parentheses. Example: solution("(())") should return true, solution("(()") should return false.',
        sampleInput: '"(())"',
        sampleOutput: 'true',
        testCases: [
          { input: '"(())"', output: 'true' },
          { input: '"(()"', output: 'false' },
          { input: '"()()()"', output: 'true' },
        ],
      },
      // Hard Python DSA Coding
      {
        questionType: 'Coding',
        difficulty: 'hard',
        questionText: 'Write a function called "solution" that takes a number n and returns the nth Fibonacci number using dynamic programming (memoization). Example: solution(10) should return 55.',
        sampleInput: '10',
        sampleOutput: '55',
        testCases: [
          { input: '10', output: '55' },
          { input: '1', output: '1' },
          { input: '20', output: '6765' },
        ],
      },
      {
        questionType: 'Coding',
        difficulty: 'hard',
        questionText: 'Write a function called "solution" that implements binary search and returns the index of a target in a sorted array, or -1 if not found. Example: solution([1,2,3,4,5], 3) should return 2.',
        sampleInput: '[1,2,3,4,5], 3',
        sampleOutput: '2',
        testCases: [
          { input: '[1,2,3,4,5], 3', output: '2' },
          { input: '[1,2,3,4,5], 6', output: '-1' },
          { input: '[10,20,30,40], 10', output: '0' },
        ],
      },
      {
        questionType: 'Coding',
        difficulty: 'hard',
        questionText: 'Write a function called "solution" that finds the longest increasing subsequence length in an array. Example: solution([10, 9, 2, 5, 3, 7, 101, 18]) should return 4.',
        sampleInput: '[10, 9, 2, 5, 3, 7, 101, 18]',
        sampleOutput: '4',
        testCases: [
          { input: '[10, 9, 2, 5, 3, 7, 101, 18]', output: '4' },
          { input: '[0, 1, 0, 3, 2, 3]', output: '4' },
          { input: '[7, 7, 7, 7]', output: '1' },
        ],
      },
      {
        questionType: 'Coding',
        difficulty: 'hard',
        questionText: 'Write a function called "solution" that finds all pairs in an array that sum to a target value. Example: solution([1, 2, 3, 4, 5], 5) should return [[1,4], [2,3]].',
        sampleInput: '[1, 2, 3, 4, 5], 5',
        sampleOutput: '[[1,4],[2,3]]',
        testCases: [
          { input: '[1, 2, 3, 4, 5], 5', output: '[[1,4],[2,3]]' },
          { input: '[1, 2, 3], 10', output: '[]' },
          { input: '[2, 2, 2], 4', output: '[[2,2]]' },
        ],
      },
    ];

    // Insert all questions
    for (const q of [...mcqQuestions, ...codingQuestions]) {
      await Question.create(q);
      console.log(`Created question: ${q.questionText.substring(0, 50)}...`);
    }

    console.log('\n--- Seed Data Complete ---');
    console.log('\nLogin Credentials:');
    console.log('Admin: admin@example.com / admin123');
    console.log('Student: student@example.com / student123');
    console.log('\nYou can now:');
    console.log('1. Login as admin to manage questions');
    console.log('2. Login as student to submit leave requests and take tests');

    process.exit(0);
  } catch (error) {
    console.error(`Error seeding data: ${error.message}`);
    process.exit(1);
  }
};

seedData();
