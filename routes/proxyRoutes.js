const express = require('express');
const router = express.Router();
const https = require('https');
const http = require('http');
const { URL } = require('url');
const Url = require('../models/Url');
const { isUsingMongoDB, inMemoryUrlOps } = require('../config/database');

// Helper function to get the appropriate model/methods
const getDb = () => isUsingMongoDB() ? Url : inMemoryUrlOps;

/**
 * @route   GET /proxy/:code
 * @desc    Proxy content from original URL - keeps short URL in address bar
 * @access  Public
 */
router.get('/proxy/:code', async (req, res) => {
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

    // Parse the target URL
    const targetUrl = url.originalUrl;
    const parsedUrl = new URL(targetUrl);
    
    // Choose http or https module based on protocol
    const protocol = parsedUrl.protocol === 'https:' ? https : http;

    // Set up request options
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'identity', // Don't request compressed content
        'Connection': 'keep-alive',
      }
    };

    // Make the request to the target server
    const proxyReq = protocol.request(options, (proxyRes) => {
      let data = [];

      proxyRes.on('data', (chunk) => {
        data.push(chunk);
      });

      proxyRes.on('end', () => {
        const buffer = Buffer.concat(data);
        let content = buffer.toString('utf8');
        const contentType = proxyRes.headers['content-type'] || 'text/html';
        
        // Rewrite URLs in HTML content to go through our proxy
        if (contentType.includes('text/html')) {
          const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;
          
          // Rewrite absolute URLs
          content = content.replace(/href=["'](https?:\/\/[^"']+)["']/gi, (match, url) => {
            return `href="/proxy/content?url=${encodeURIComponent(url)}"`;
          });
          
          content = content.replace(/src=["'](https?:\/\/[^"']+)["']/gi, (match, url) => {
            return `src="/proxy/content?url=${encodeURIComponent(url)}"`;
          });
          
          // Rewrite relative URLs
          content = content.replace(/href=["'](\/[^"']*)["']/gi, (match, path) => {
            return `href="/proxy/content?url=${encodeURIComponent(baseUrl + path)}"`;
          });
          
          content = content.replace(/src=["'](\/[^"']*)["']/gi, (match, path) => {
            return `src="/proxy/content?url=${encodeURIComponent(baseUrl + path)}"`;
          });
          
          // Rewrite relative URLs without leading slash
          content = content.replace(/href=["']([^"':]+)["']/gi, (match, path) => {
            if (path.startsWith('//') || path.startsWith('data:') || path.startsWith('javascript:')) {
              return match;
            }
            return `href="/proxy/content?url=${encodeURIComponent(parsedUrl.protocol + '//' + parsedUrl.hostname + '/' + path)}"`;
          });
          
          // Add base tag for remaining relative resources
          content = content.replace(/<head>/i, `<head><base href="${baseUrl}/">`);
          
          // Inject security script to prevent URL exposure
          const securityScript = `
            <script>
              (function() {
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
                
                // Prevent drag and drop
                document.addEventListener('dragstart', function(e) {
                  e.preventDefault();
                  return false;
                });
                
                // Clear history
                try {
                  history.replaceState({}, '', window.location.href);
                } catch(e) {}
              })();
            </script>
          `;
          
          content = content.replace(/<head>/i, '<head>' + securityScript);
        }
        
        // Set headers and send response
        res.setHeader('Content-Type', contentType);
        res.setHeader('X-Frame-Options', 'SAMEORIGIN');
        res.setHeader('Content-Security-Policy', "frame-ancestors 'self';");
        res.send(content);
      });
    });

    proxyReq.on('error', (error) => {
      console.error('Proxy error:', error);
      res.status(500).send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Error Loading Content</title>
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
            <h2>Unable to Load Content</h2>
            <p>The target website could not be loaded. It may be blocking proxy access.</p>
            <a href="/">Go Home</a>
          </div>
        </body>
        </html>
      `);
    });

    proxyReq.end();
  } catch (error) {
    console.error('Error proxying:', error);
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

/**
 * @route   GET /proxy/content
 * @desc    Proxy static content (images, CSS, JS, etc.)
 * @access  Public
 */
router.get('/proxy/content', async (req, res) => {
  try {
    const targetUrl = req.query.url;
    
    if (!targetUrl) {
      return res.status(400).send('Missing URL parameter');
    }

    const parsedUrl = new URL(targetUrl);
    const protocol = parsedUrl.protocol === 'https:' ? https : http;

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'identity',
        'Referer': `${parsedUrl.protocol}//${parsedUrl.host}/`,
        'Connection': 'keep-alive',
      }
    };

    const proxyReq = protocol.request(options, (proxyRes) => {
      // Forward the content type
      const contentType = proxyRes.headers['content-type'];
      if (contentType) {
        res.setHeader('Content-Type', contentType);
      }
      
      // Set CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      
      // Pipe the response directly
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (error) => {
      console.error('Content proxy error:', error);
      res.status(500).send('Error fetching content');
    });

    proxyReq.end();
  } catch (error) {
    console.error('Error proxying content:', error);
    res.status(500).send('Error fetching content');
  }
});

module.exports = router;
