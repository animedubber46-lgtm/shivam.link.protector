const express = require('express');
const router = express.Router();
const Url = require('../models/Url');
const { isUsingMongoDB, inMemoryUrlOps, inMemoryUserOps } = require('../config/database');
const { generateShortCode, validateCustomAlias, isAliasAvailable } = require('../utils/shortCodeGenerator');
const { validateUrl } = require('../utils/urlValidator');

// Helper function to get the appropriate model/methods
const getDb = () => isUsingMongoDB() ? Url : inMemoryUrlOps;
const getUserDb = () => isUsingMongoDB() ? require('../models/User') : inMemoryUserOps;

// Middleware to check authentication
const requireAuth = async (req, res, next) => {
  const userId = req.cookies.userId;
  const rememberToken = req.cookies.rememberToken;
  const isAdminCookie = req.cookies.isAdmin;

  // Check for admin cookie
  if (isAdminCookie === 'true' && userId === 'admin') {
    req.user = {
      _id: 'admin',
      email: 'admin@shivam.link',
      isAdmin: true
    };
    return next();
  }

  if (!userId && !rememberToken) {
    return res.status(401).json({
      success: false,
      error: 'Please login to continue'
    });
  }

  try {
    let user;
    if (userId) {
      user = await getUserDb().findById(userId);
    } else if (rememberToken) {
      user = await getUserDb().findOne({ rememberToken });
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User not found. Please login again.'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'Authentication failed. Please login again.'
    });
  }
};

/**
 * @route   POST /api/shorten
 * @desc    Create a shortened URL
 * @access  Private (requires authentication)
 */
router.post('/shorten', requireAuth, async (req, res) => {
  try {
    const { url, customAlias, expiresIn } = req.body;
    const userId = req.user._id;

    // Validate URL
    const urlValidation = validateUrl(url);
    if (!urlValidation.valid) {
      return res.status(400).json({ 
        success: false, 
        error: urlValidation.error 
      });
    }

    // Validate custom alias if provided
    if (customAlias) {
      const aliasValidation = validateCustomAlias(customAlias);
      if (!aliasValidation.valid) {
        return res.status(400).json({ 
          success: false, 
          error: aliasValidation.error 
        });
      }

      // Check if alias is available
      const db = getDb();
      const existingUrl = await db.findOne({
        $or: [
          { shortCode: customAlias },
          { customAlias: customAlias }
        ]
      });
      
      if (existingUrl) {
        return res.status(400).json({ 
          success: false, 
          error: 'This custom alias is already taken' 
        });
      }
    }

    // Calculate expiration date if provided
    let expiresAt = null;
    if (expiresIn) {
      const expiresInMs = parseExpirationTime(expiresIn);
      if (expiresInMs) {
        expiresAt = new Date(Date.now() + expiresInMs);
      }
    }

    // Generate short code
    const shortCode = customAlias || await generateShortCode();

    // Create new URL entry
    const db = getDb();
    let newUrl;
    
    if (isUsingMongoDB()) {
      const urlData = {
        originalUrl: urlValidation.normalizedUrl,
        shortCode,
        userId,
        expiresAt
      };
      // Only include customAlias if provided
      if (customAlias) {
        urlData.customAlias = customAlias;
      }
      newUrl = new Url(urlData);
      await newUrl.save();
    } else {
      newUrl = await inMemoryUrlOps.create({
        originalUrl: urlValidation.normalizedUrl,
        shortCode,
        customAlias: customAlias || null,
        userId,
        expiresAt
      });
    }

    // Return the shortened URL
    const shortUrl = `${process.env.BASE_URL}/${shortCode}`;
    
    res.json({
      success: true,
      data: {
        originalUrl: urlValidation.normalizedUrl,
        shortUrl,
        shortCode,
        customAlias: customAlias || null,
        expiresAt,
        createdAt: newUrl.createdAt
      }
    });
  } catch (error) {
    console.error('Error shortening URL:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error. Please try again.' 
    });
  }
});

/**
 * @route   GET /api/stats/:code
 * @desc    Get analytics for a short URL
 * @access  Public
 */
router.get('/stats/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const db = getDb();

    const url = await db.findOne({
      $or: [
        { shortCode: code },
        { customAlias: code }
      ]
    });

    if (!url) {
      return res.status(404).json({ 
        success: false, 
        error: 'URL not found' 
      });
    }

    // Check if expired
    if (url.isExpired && url.isExpired()) {
      return res.status(410).json({ 
        success: false, 
        error: 'This short URL has expired' 
      });
    }

    res.json({
      success: true,
      data: {
        originalUrl: url.originalUrl,
        shortCode: url.shortCode,
        customAlias: url.customAlias,
        clicks: url.clicks,
        createdAt: url.createdAt,
        lastAccessedAt: url.lastAccessedAt,
        expiresAt: url.expiresAt
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
 * @route   GET /api/urls
 * @desc    Get all URLs for the authenticated user
 * @access  Private (requires authentication)
 */
router.get('/urls', requireAuth, async (req, res) => {
  try {
    const { page = 1, limit = 10, sort = '-createdAt' } = req.query;
    const userId = req.user._id;
    const db = getDb();

    let urls, count;
    
    if (isUsingMongoDB()) {
      // Admin user has special string ID, need to handle differently
      if (userId === 'admin') {
        urls = await Url.find({})
          .sort(sort)
          .limit(limit * 1)
          .skip((page - 1) * limit)
          .exec();
        count = await Url.countDocuments({});
      } else {
        urls = await Url.find({ userId })
          .sort(sort)
          .limit(limit * 1)
          .skip((page - 1) * limit)
          .exec();
        count = await Url.countDocuments({ userId });
      }
    } else {
      urls = await db.findByUserId(userId);
      count = await db.countByUserId(userId);
      const start = (page - 1) * limit;
      urls = urls.slice(start, start + limit);
    }

    res.json({
      success: true,
      data: urls,
      pagination: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching URLs:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error' 
    });
  }
});

/**
 * @route   DELETE /api/urls/:id
 * @desc    Delete a URL (only if owned by user)
 * @access  Private (requires authentication)
 */
router.delete('/urls/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const db = getDb();

    let url;
    if (isUsingMongoDB()) {
      // Admin can delete any URL
      if (userId === 'admin') {
        url = await Url.findById(id);
        if (!url) {
          return res.status(404).json({ 
            success: false, 
            error: 'URL not found' 
          });
        }
        await Url.findByIdAndDelete(id);
      } else {
        url = await Url.findOne({ _id: id, userId });
        if (!url) {
          return res.status(404).json({ 
            success: false, 
            error: 'URL not found or you do not have permission to delete it' 
          });
        }
        await Url.findByIdAndDelete(id);
      }
    } else {
      url = await db.findByIdAndDelete(id);
      if (!url || (url.userId !== userId && userId !== 'admin')) {
        return res.status(404).json({ 
          success: false, 
          error: 'URL not found or you do not have permission to delete it' 
        });
      }
    }

    res.json({
      success: true,
      message: 'URL deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting URL:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error' 
    });
  }
});

/**
 * @route   GET /api/health
 * @desc    Health check endpoint
 * @access  Public
 */
router.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'URL Shortener API is running',
    storage: isUsingMongoDB() ? 'MongoDB' : 'In-Memory'
  });
});

/**
 * Parse expiration time string
 * @param {string} expiresIn - Expiration time (e.g., '1h', '1d', '1w')
 * @returns {number} - Time in milliseconds
 */
function parseExpirationTime(expiresIn) {
  const units = {
    'm': 60 * 1000,           // minutes
    'h': 60 * 60 * 1000,      // hours
    'd': 24 * 60 * 60 * 1000, // days
    'w': 7 * 24 * 60 * 60 * 1000 // weeks
  };

  const match = expiresIn.match(/^(\d+)([mhdw])$/);
  if (!match) return null;

  const [, amount, unit] = match;
  return parseInt(amount) * units[unit];
}

module.exports = router;