const express = require('express');
const router = express.Router();
const ReferralCode = require('../models/ReferralCode');
const User = require('../models/User');
const Url = require('../models/Url');
const { isUsingMongoDB, inMemoryReferralCodeOps, inMemoryUserOps, inMemoryUrlOps, generateReferralCode } = require('../config/database');

// Helper function to get the appropriate model/methods
const getReferralDb = () => isUsingMongoDB() ? ReferralCode : inMemoryReferralCodeOps;
const getUserDb = () => isUsingMongoDB() ? User : inMemoryUserOps;
const getUrlDb = () => isUsingMongoDB() ? Url : inMemoryUrlOps;

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
  const isAdminCookie = req.cookies.isAdmin === 'true';
  
  if (!isAdminCookie) {
    return res.status(403).json({
      success: false,
      error: 'Access denied. Admin only.'
    });
  }
  
  next();
};

/**
 * @route   POST /api/admin/referral-code
 * @desc    Generate a new referral code
 * @access  Admin only
 */
router.post('/referral-code', isAdmin, async (req, res) => {
  try {
    const referralDb = getReferralDb();
    
    // Generate unique code
    let code;
    let existingCode;
    
    do {
      code = isUsingMongoDB() ? ReferralCode.generateCode() : generateReferralCode();
      existingCode = await referralDb.findOne({ code });
    } while (existingCode);

    // Create referral code
    let newReferralCode;
    if (isUsingMongoDB()) {
      newReferralCode = new ReferralCode({ code });
      await newReferralCode.save();
    } else {
      newReferralCode = await inMemoryReferralCodeOps.create({ code });
    }

    res.status(201).json({
      success: true,
      data: {
        code: newReferralCode.code,
        createdAt: newReferralCode.createdAt
      }
    });
  } catch (error) {
    console.error('Error generating referral code:', error);
    res.status(500).json({
      success: false,
      error: 'Server error. Please try again.'
    });
  }
});

/**
 * @route   GET /api/admin/referral-codes
 * @desc    Get all referral codes
 * @access  Admin only
 */
router.get('/referral-codes', isAdmin, async (req, res) => {
  try {
    const referralDb = getReferralDb();
    
    const codes = await referralDb.find();
    
    res.json({
      success: true,
      data: codes
    });
  } catch (error) {
    console.error('Error fetching referral codes:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

/**
 * @route   GET /api/admin/users
 * @desc    Get all users
 * @access  Admin only
 */
router.get('/users', isAdmin, async (req, res) => {
  try {
    const userDb = getUserDb();
    
    let users;
    if (isUsingMongoDB()) {
      users = await User.find({}, '-password -rememberToken');
    } else {
      // For in-memory, we need to filter out duplicates
      const seen = new Set();
      users = [];
      for (const user of inMemoryUserOps.findOne._isMemory ? [] : []) {
        // This won't work, let's fix it
      }
      // Get all users from the map
      for (const [key, user] of require('../config/database').inMemoryDB.users.entries()) {
        if (!seen.has(user._id) && key === user._id) {
          seen.add(user._id);
          users.push({
            _id: user._id,
            email: user.email,
            isAdmin: user.isAdmin,
            referralCode: user.referralCode,
            createdAt: user.createdAt,
            lastLogin: user.lastLogin
          });
        }
      }
    }

    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

/**
 * @route   GET /api/admin/stats
 * @desc    Get admin dashboard stats
 * @access  Admin only
 */
router.get('/stats', isAdmin, async (req, res) => {
  try {
    const referralDb = getReferralDb();
    const urlDb = getUrlDb();
    
    const totalReferralCodes = await referralDb.countDocuments();
    const usedReferralCodes = await referralDb.countDocuments({ used: true });
    const totalUrls = await urlDb.countDocuments();
    const totalClicks = (await urlDb.find()).reduce((sum, url) => sum + url.clicks, 0);

    res.json({
      success: true,
      data: {
        totalReferralCodes,
        usedReferralCodes,
        availableReferralCodes: totalReferralCodes - usedReferralCodes,
        totalUrls,
        totalClicks
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

/**
 * @route   DELETE /api/admin/referral-code/:id
 * @desc    Delete a referral code
 * @access  Admin only
 */
router.delete('/referral-code/:id', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (isUsingMongoDB()) {
      const code = await ReferralCode.findByIdAndDelete(id);
      if (!code) {
        return res.status(404).json({
          success: false,
          error: 'Referral code not found'
        });
      }
    } else {
      const { inMemoryDB } = require('../config/database');
      const code = inMemoryDB.referralCodes.get(id);
      if (!code) {
        return res.status(404).json({
          success: false,
          error: 'Referral code not found'
        });
      }
      inMemoryDB.referralCodes.delete(id);
      inMemoryDB.referralCodes.delete(code.code);
    }

    res.json({
      success: true,
      message: 'Referral code deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting referral code:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

module.exports = router;
