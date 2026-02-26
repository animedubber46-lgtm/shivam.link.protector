const validUrl = require('valid-url');

/**
 * Validate a URL
 * @param {string} url - URL to validate
 * @returns {Object} - { valid: boolean, error: string, normalizedUrl: string }
 */
const validateUrl = (url) => {
  if (!url) {
    return { 
      valid: false, 
      error: 'URL is required' 
    };
  }

  // Trim whitespace
  let normalizedUrl = url.trim();

  // Add protocol if missing
  if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
    normalizedUrl = 'https://' + normalizedUrl;
  }

  // Check if it's a valid URL
  if (!validUrl.isWebUri(normalizedUrl)) {
    return { 
      valid: false, 
      error: 'Please enter a valid URL' 
    };
  }

  // Check URL length
  if (normalizedUrl.length > 2048) {
    return { 
      valid: false, 
      error: 'URL is too long (max 2048 characters)' 
    };
  }

  // Parse URL and check for valid hostname
  try {
    const urlObj = new URL(normalizedUrl);
    
    // Check for valid hostname
    if (!urlObj.hostname || !urlObj.hostname.includes('.')) {
      return { 
        valid: false, 
        error: 'Please enter a valid URL with a proper domain' 
      };
    }

    // Prevent shortening of our own URLs (recursive shortening)
    const baseUrl = process.env.BASE_URL;
    if (normalizedUrl.startsWith(baseUrl)) {
      return { 
        valid: false, 
        error: 'Cannot shorten URLs from this service' 
      };
    }

    return { 
      valid: true, 
      normalizedUrl 
    };
  } catch (error) {
    return { 
      valid: false, 
      error: 'Please enter a valid URL' 
    };
  }
};

/**
 * Check if a string looks like a URL (for frontend validation)
 * @param {string} str - String to check
 * @returns {boolean}
 */
const looksLikeUrl = (str) => {
  if (!str) return false;
  
  const urlPattern = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/i;
  return urlPattern.test(str.trim());
};

module.exports = {
  validateUrl,
  looksLikeUrl
};