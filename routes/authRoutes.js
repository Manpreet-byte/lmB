const express = require('express');
const passport = require('passport');
const generateToken = require('../utils/generateToken');
const User = require('../models/userModel');
const { auth: firebaseAuth } = require('../config/firebaseAdmin');
const router = express.Router();

// @desc    Auth with Google
// @route   GET /api/auth/google
// @access  Public
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
  })
);

// @desc    Google auth callback
// @route   GET /api/auth/google/callback
// @access  Public
router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  (req, res) => {
    // Generate JWT token
    const token = generateToken(req.user._id);
    
    // Set cookie
    res.cookie('jwt', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    // Redirect to frontend with token in URL (frontend will extract and store it)
    const frontendURL = process.env.FRONTEND_URL || 'http://localhost:5176';
    const userData = encodeURIComponent(JSON.stringify({
      _id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      profilePicture: req.user.profilePicture || '',
      token: token,
    }));
    
    res.redirect(`${frontendURL}/oauth-callback?user=${userData}`);
  }
);

// @desc    Firebase signup - Create user in MongoDB
// @route   POST /api/auth/firebase-signup
// @access  Public
router.post('/firebase-signup', async (req, res) => {
  try {
    const { firebaseUid, email, displayName, photoURL, idToken, role, fullName, department, studentId } = req.body;

    // Verify Firebase ID token
    if (!firebaseAuth) {
      return res.status(500).json({ message: 'Firebase Admin not initialized' });
    }

    const decodedToken = await firebaseAuth.verifyIdToken(idToken);
    
    if (decodedToken.uid !== firebaseUid) {
      return res.status(401).json({ message: 'Invalid Firebase token' });
    }

    // Check if user already exists
    let user = await User.findOne({ email });
    
    if (user) {
      // Update Firebase UID if not set
      if (!user.firebaseUid) {
        user.firebaseUid = firebaseUid;
        await user.save();
      }
      
      return res.status(200).json({
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          profilePicture: user.profilePicture,
          firebaseUid: user.firebaseUid,
        }
      });
    }

    // Create new user
    user = await User.create({
      name: fullName || displayName || email.split('@')[0],
      email,
      password: 'FIREBASE_AUTH_' + Math.random().toString(36), // Random password (won't be used)
      role: role || 'student',
      firebaseUid,
      profilePicture: photoURL || '',
      department: department || '',
      studentId: studentId || '',
    });

    res.status(201).json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profilePicture: user.profilePicture,
        firebaseUid: user.firebaseUid,
      }
    });
  } catch (error) {
    console.error('Firebase signup error:', error);
    res.status(500).json({ message: error.message || 'Server error during signup' });
  }
});

// @desc    Firebase login - Sync user with MongoDB
// @route   POST /api/auth/firebase-login
// @access  Public
router.post('/firebase-login', async (req, res) => {
  try {
    const { firebaseUid, email, displayName, photoURL, idToken } = req.body;

    // Verify Firebase ID token
    if (!firebaseAuth) {
      return res.status(500).json({ message: 'Firebase Admin not initialized' });
    }

    const decodedToken = await firebaseAuth.verifyIdToken(idToken);
    
    if (decodedToken.uid !== firebaseUid) {
      return res.status(401).json({ message: 'Invalid Firebase token' });
    }

    // Find or create user
    let user = await User.findOne({ email });
    
    if (!user) {
      // Create new user if doesn't exist
      user = await User.create({
        name: displayName || email.split('@')[0],
        email,
        password: 'FIREBASE_AUTH_' + Math.random().toString(36),
        role: 'student', // Default role
        firebaseUid,
        profilePicture: photoURL || '',
      });
    } else if (!user.firebaseUid) {
      // Update existing user with Firebase UID
      user.firebaseUid = firebaseUid;
      if (photoURL) user.profilePicture = photoURL;
      await user.save();
    }

    res.status(200).json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profilePicture: user.profilePicture,
        firebaseUid: user.firebaseUid,
      }
    });
  } catch (error) {
    console.error('Firebase login error:', error);
    res.status(500).json({ message: error.message || 'Server error during login' });
  }
});

module.exports = router;
