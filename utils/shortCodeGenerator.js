const { nanoid } = require('nanoid');
const Url = require('../models/Url');
const { isUsingMongoDB, inMemoryUrlOps } = require('../config/database');

// Default length for short codes
const DEFAULT_LENGTH = 7;

// Custom alphabet excluding similar looking characters
const ALPHABET = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz';

/**
 * Generate a unique short code
 * @param {number} length - Length of the short code
 * @returns {Promise<string>} - Unique short code
 */
const generateShortCode = async (length = DEFAULT_LENGTH) => {
  let shortCode;
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 10;

  while (!isUnique && attempts < maxAttempts) {
    shortCode = nanoid(length, ALPHABET);
    
    // Check if the short code already exists
    let existingUrl;
    if (isUsingMongoDB()) {
      existingUrl = await Url.findOne({ shortCode });
    } else {
      existingUrl = await inMemoryUrlOps.findOne({ shortCode });
    }
    
    if (!existingUrl) {
      isUnique = true;
    } else {
      attempts++;
      // If collision occurs, increase length for next attempt
      if (attempts >= 3) {
        length += 1;
      }
    }
  }

  if (!isUnique) {
    throw new Error('Failed to generate unique short code after multiple attempts');
  }

  return shortCode;
};

/**
 * Validate if a custom alias is valid
 * @param {string} alias - Custom alias to validate
 * @returns {Object} - { valid: boolean, error: string }
 */
const validateCustomAlias = (alias) => {
  if (!alias) {
    return { valid: true };
  }

  // Check length
  if (alias.length < 3 || alias.length > 30) {
    return { 
      valid: false, 
      error: 'Custom alias must be between 3 and 30 characters' 
    };
  }

  // Check format (alphanumeric, hyphens, underscores only)
  const validFormat = /^[a-zA-Z0-9_-]+$/;
  if (!validFormat.test(alias)) {
    return { 
      valid: false, 
      error: 'Custom alias can only contain letters, numbers, hyphens, and underscores' 
    };
  }

  // Check for reserved words
  const reservedWords = ['api', 'admin', 'url', 'shorten', 'stats', 'health', 'login', 'logout', 'register'];
  if (reservedWords.includes(alias.toLowerCase())) {
    return { 
      valid: false, 
      error: 'This alias is reserved and cannot be used' 
    };
  }

  return { valid: true };
};

/**
 * Check if custom alias is available
 * @param {string} alias - Custom alias to check
 * @returns {Promise<boolean>} - True if available
 */
const isAliasAvailable = async (alias) => {
  let existingUrl;
  if (isUsingMongoDB()) {
    existingUrl = await Url.findOne({ 
      $or: [
        { customAlias: alias },
        { shortCode: alias }
      ]
    });
  } else {
    existingUrl = await inMemoryUrlOps.findOne({ 
      $or: [
        { customAlias: alias },
        { shortCode: alias }
      ]
    });
  }
  return !existingUrl;
};

module.exports = {
  generateShortCode,
  validateCustomAlias,
  isAliasAvailable
};