const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { isUsingMongoDB, inMemoryDB, inMemoryUserOps, inMemoryReferralCodeOps, generateReferralCode } = require('../config/database');

// Admin credentials
const ADMIN_USERNAME = 'ShivamDubber';
const ADMIN_PASSWORD = 'GopGop';

// Hash password helper
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Helper function to get the appropriate model/methods
const getUserDb = () => inMemoryUserOps;
const getReferralDb = () => inMemoryReferralCodeOps;

/**
 * @route   POST /api/auth/signup
 * @desc    Register a new user
 * @access  Public
 */
router.post('/signup', async (req, res) => {
  try {
    const { email, password, referralCode } = req.body;

    // Validate input
    if (!email || !password || !referralCode) {
      return res.status(400).json({
        success: false,
        error: 'Please provide email, password, and referral code'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid email address'
      });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters long'
      });
    }

    const userDb = getUserDb();
    const referralDb = getReferralDb();

    // Check if user already exists
    const existingUser = await userDb.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'User with this email already exists'
      });
    }

    // Verify referral code
    const referral = await referralDb.findOne({ code: referralCode });
    if (!referral) {
      return res.status(400).json({
        success: false,
        error: 'Invalid referral code'
      });
    }

    if (referral.used) {
      return res.status(400).json({
        success: false,
        error: 'This referral code has already been used'
      });
    }

    // Create user
    const newUser = await inMemoryUserOps.create({
      email: email.toLowerCase(),
      password,
      referralCode
    });

    // Mark referral code as used
    referral.used = true;
    referral.usedBy = newUser._id;
    referral.usedAt = new Date();
    if (isUsingMongoDB()) {
      await referral.save();
    } else {
      inMemoryDB.referralCodes.set(referral._id, referral);
      inMemoryDB.referralCodes.set(referral.code, referral);
    }

    res.status(201).json({
      success: true,
      message: 'Account created successfully! Please login.',
      data: {
        email: newUser.email
      }
    });
  } catch (error) {
    console.error('Error during signup:', error);
    res.status(500).json({
      success: false,
      error: 'Server error. Please try again.'
    });
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide email and password'
      });
    }

    const userDb = getUserDb();

    // Find user
    const user = await userDb.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // Check password
    const isMatch = user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // Update last login
    user.lastLogin = new Date();

    // Generate remember token if requested
    if (rememberMe) {
      user.generateRememberToken();
    }

    await user.save();

    // Set cookie with user info
    const cookieOptions = {
      httpOnly: true,
      maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000, // 30 days or 1 day
      sameSite: 'lax'
    };

    res.cookie('userId', user._id, cookieOptions);
    if (user.rememberToken) {
      res.cookie('rememberToken', user.rememberToken, cookieOptions);
    }

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          email: user.email,
          isAdmin: user.isAdmin
        }
      }
    });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({
      success: false,
      error: 'Server error. Please try again.'
    });
  }
});

/**
 * @route   POST /api/auth/admin-login
 * @desc    Login admin
 * @access  Public
 */
router.post('/admin-login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide username and password'
      });
    }

    // Check admin credentials
    if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
      return res.status(401).json({
        success: false,
        error: 'Invalid admin credentials'
      });
    }

    // Set cookie with admin info
    const cookieOptions = {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 1 day
      sameSite: 'lax'
    };

    res.cookie('userId', 'admin', cookieOptions);
    res.cookie('isAdmin', 'true', cookieOptions);

    res.json({
      success: true,
      message: 'Admin login successful',
      data: {
        user: {
          id: 'admin',
          email: 'admin@shivam.link',
          isAdmin: true
        }
      }
    });
  } catch (error) {
    console.error('Error during admin login:', error);
    res.status(500).json({
      success: false,
      error: 'Server error. Please try again.'
    });
  }
});

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Public
 */
router.post('/logout', (req, res) => {
  res.clearCookie('userId');
  res.clearCookie('rememberToken');
  res.clearCookie('isAdmin');
  
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

/**
 * @route   GET /api/auth/me
 * @desc    Get current user
 * @access  Private
 */
router.get('/me', async (req, res) => {
  try {
    const userId = req.cookies.userId;
    const rememberToken = req.cookies.rememberToken;
    const isAdminCookie = req.cookies.isAdmin;

    if (!userId && !rememberToken) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }

    // Check for admin cookie
    if (isAdminCookie === 'true') {
      return res.json({
        success: true,
        data: {
          user: {
            id: 'admin',
            email: 'admin@shivam.link',
            isAdmin: true
          }
        }
      });
    }

    const userDb = getUserDb();
    let user;

    if (userId) {
      user = await userDb.findById(userId);
    } else if (rememberToken) {
      user = await userDb.findOne({ rememberToken });
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          email: user.email,
          isAdmin: user.isAdmin
        }
      }
    });
  } catch (error) {
    console.error('Error getting current user:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

/**
 * @route   GET /api/auth/check
 * @desc    Check if user is authenticated
 * @access  Public
 */
router.get('/check', async (req, res) => {
  const userId = req.cookies.userId;
  const rememberToken = req.cookies.rememberToken;
  const isAdminCookie = req.cookies.isAdmin;

  if (!userId && !rememberToken) {
    return res.json({
      success: true,
      authenticated: false,
      isAdmin: false
    });
  }

  // Check for admin cookie first
  if (isAdminCookie === 'true') {
    return res.json({
      success: true,
      authenticated: true,
      isAdmin: true
    });
  }

  // Verify user exists in database
  const userDb = getUserDb();
  let user;

  if (userId) {
    user = await userDb.findById(userId);
  } else if (rememberToken) {
    user = await userDb.findOne({ rememberToken });
  }

  if (!user) {
    return res.json({
      success: true,
      authenticated: false,
      isAdmin: false
    });
  }

  res.json({
    success: true,
    authenticated: true,
    isAdmin: user.isAdmin === true
  });
});

module.exports = router;
