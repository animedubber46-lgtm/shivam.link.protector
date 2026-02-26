const express = require('express');
const router = express.Router();
const Url = require('../models/Url');
const { isUsingMongoDB, inMemoryUrlOps } = require('../config/database');

// Helper function to get the appropriate model/methods
const getDb = () => isUsingMongoDB() ? Url : inMemoryUrlOps;

/**
 * @route   GET /:code
 * @desc    Redirect to proxy page that hides the original URL
 * @access  Public
 */
router.get('/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const db = getDb();

    // Find URL by short code or custom alias
    const url = await db.findOne({
      $or: [
        { shortCode: code },
        { customAlias: code }
      ]
    });

    if (!url) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Link Not Found</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
            }
            .container { text-align: center; padding: 2rem; }
            h1 { font-size: 6rem; margin-bottom: 1rem; }
            h2 { font-size: 1.5rem; margin-bottom: 1rem; }
            p { opacity: 0.8; margin-bottom: 2rem; }
            a {
              display: inline-block;
              padding: 12px 30px;
              background: white;
              color: #667eea;
              text-decoration: none;
              border-radius: 50px;
              font-weight: 600;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>404</h1>
            <h2>Link Not Found</h2>
            <p>The short URL you're looking for doesn't exist or has been removed.</p>
            <a href="/">Create a New Short Link</a>
          </div>
        </body>
        </html>
      `);
    }

    // Check if URL has expired
    if (url.isExpired && url.isExpired()) {
      return res.status(410).send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Link Expired</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
            }
            .container { text-align: center; padding: 2rem; }
            h1 { font-size: 4rem; margin-bottom: 1rem; }
            h2 { font-size: 1.5rem; margin-bottom: 1rem; }
            p { opacity: 0.8; margin-bottom: 2rem; }
            a {
              display: inline-block;
              padding: 12px 30px;
              background: white;
              color: #f5576c;
              text-decoration: none;
              border-radius: 50px;
              font-weight: 600;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>⏰</h1>
            <h2>Link Expired</h2>
            <p>This short URL has expired and is no longer available.</p>
            <a href="/">Create a New Short Link</a>
          </div>
        </body>
        </html>
      `);
    }

    // Increment click count and update last accessed time
    url.clicks += 1;
    url.lastAccessedAt = new Date();
    
    if (isUsingMongoDB()) {
      await url.save();
    }

    // Show loading page that redirects to proxy - URL stays hidden
    const shortCode = url.shortCode || url.customAlias;
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Loading...</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body {
            width: 100%;
            height: 100%;
            overflow: hidden;
            background: #1a1a2e;
          }
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
          }
          .container { text-align: center; padding: 2rem; }
          .loader {
            width: 60px;
            height: 60px;
            border: 4px solid rgba(255,255,255,0.1);
            border-top-color: #667eea;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 1.5rem;
          }
          @keyframes spin { to { transform: rotate(360deg); } }
          h1 { font-size: 1.3rem; font-weight: 400; margin-bottom: 0.5rem; }
          p { opacity: 0.6; font-size: 0.9rem; }
          .progress-bar {
            width: 200px;
            height: 4px;
            background: rgba(255,255,255,0.1);
            border-radius: 2px;
            margin: 1rem auto;
            overflow: hidden;
          }
          .progress-fill {
            width: 0%;
            height: 100%;
            background: #667eea;
            transition: width 0.3s ease;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="loader"></div>
          <h1 id="statusText">Preparing your content...</h1>
          <p id="subText">Please wait</p>
          <div class="progress-bar">
            <div class="progress-fill" id="progressFill"></div>
          </div>
        </div>
        
        <script>
          (function() {
            var statusText = document.getElementById('statusText');
            var subText = document.getElementById('subText');
            var progressFill = document.getElementById('progressFill');
            
            // Prevent right-click
            document.addEventListener('contextmenu', function(e) {
              e.preventDefault();
              return false;
            });
            
            // Prevent keyboard shortcuts
            document.addEventListener('keydown', function(e) {
              if (e.key === 'F11' || e.key === 'F12' || 
                  (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
                  (e.ctrlKey && (e.key === 'U' || e.key === 'S' || e.key === 'C')) ||
                  e.key === 'Escape') {
                e.preventDefault();
                return false;
              }
            });
            
            // Simulate progress
            var progress = 0;
            var progressInterval = setInterval(function() {
              progress += Math.random() * 15;
              if (progress > 100) progress = 100;
              progressFill.style.width = progress + '%';
              
              if (progress >= 100) {
                clearInterval(progressInterval);
              }
            }, 200);
            
            // Redirect to proxy after delay
            setTimeout(function() {
              statusText.textContent = 'Loading content...';
              subText.textContent = 'Almost there...';
              progress = 100;
              progressFill.style.width = '100%';
              
              // Redirect to proxy route - this keeps the short URL in address bar
              window.location.href = '/proxy/${shortCode}';
            }, 1500);
          })();
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Error redirecting:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Error</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
          }
          .container { text-align: center; padding: 2rem; }
          h1 { font-size: 4rem; margin-bottom: 1rem; }
          h2 { font-size: 1.5rem; margin-bottom: 1rem; }
          p { opacity: 0.8; margin-bottom: 2rem; }
          a {
            display: inline-block;
            padding: 12px 30px;
            background: white;
            color: #ee5a24;
            text-decoration: none;
            border-radius: 50px;
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>⚠️</h1>
          <h2>Something Went Wrong</h2>
          <p>An error occurred while processing your request.</p>
          <a href="/">Go Home</a>
        </div>
      </body>
      </html>
    `);
  }
});

module.exports = router;
