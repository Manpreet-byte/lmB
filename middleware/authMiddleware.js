const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const User = require('../models/userModel');
const { auth: firebaseAuth } = require('../config/firebaseAdmin');

const protect = asyncHandler(async (req, res, next) => {
  let token;
  let useFirebaseAuth = false;

  // Try to get token from cookie first (JWT)
  if (req.cookies && req.cookies.jwt) {
    token = req.cookies.jwt;
  } else if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
    // Check if it looks like a Firebase token (longer than typical JWT)
    if (token.length > 500) {
      useFirebaseAuth = true;
    }
  }

  if (!token) {
    console.log('Auth failed: No token found in cookies or headers');
    res.status(401);
    throw new Error('Not authorized, no token');
  }
  
  // Check if token is the string "undefined" or empty
  if (token === 'undefined' || token === 'null' || token === '') {
    console.log('Auth failed: Token is invalid string:', token);
    res.status(401);
    throw new Error('Not authorized, invalid token');
  }
  
  try {
    if (useFirebaseAuth && firebaseAuth) {
      // Verify Firebase ID token
      const decodedToken = await firebaseAuth.verifyIdToken(token);
      
      // Find user by Firebase UID or email
      req.user = await User.findOne({
        $or: [
          { firebaseUid: decodedToken.uid },
          { email: decodedToken.email }
        ]
      }).select('-password');
      
      if (!req.user) {
        console.log('Auth failed: User not found for Firebase token');
        res.status(401);
        throw new Error('Not authorized, user not found');
      }
      
      // Store Firebase UID for reference
      req.firebaseUid = decodedToken.uid;
    } else {
      // Verify JWT token (traditional MongoDB + JWT auth)
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');
      
      if (!req.user) {
        console.log('Auth failed: User not found for JWT token');
        res.status(401);
        throw new Error('Not authorized, user not found');
      }
    }
    
    next();
  } catch (error) {
    console.error('Auth error:', error.message);
    res.status(401);
    throw new Error('Not authorized, token failed');
  }
});

const admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(401);
    throw new Error('Not authorized as an admin');
  }
};

const student = (req, res, next) => {
  if (req.user && req.user.role === 'student') {
    next();
  } else {
    res.status(401);
    throw new Error('Not authorized as a student');
  }
};

module.exports = { protect, admin, student };
