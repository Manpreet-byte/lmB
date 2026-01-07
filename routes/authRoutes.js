const express = require('express');
const passport = require('passport');
const generateToken = require('../utils/generateToken');
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

module.exports = router;
