require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');
const { connectDB } = require('./config/database');
const urlRoutes = require('./routes/urlRoutes');
const redirectRoutes = require('./routes/redirectRoutes');
const proxyRoutes = require('./routes/proxyRoutes');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', urlRoutes);

// Proxy routes (for hiding original URL)
app.use('/', proxyRoutes);

// Redirect route (must be after API routes and proxy routes)
app.use('/', redirectRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: 'Something went wrong!'
  });
});

const PORT = process.env.PORT || 3000;

// Start server first, then try to connect to database
const server = app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════════════════════════╗
  ║                                                           ║
  ║   🛡️ Shivam Link Protector Server Running                 ║
  ║                                                           ║
  ║   Port: ${PORT}                                              ║
  ║   Base URL: ${process.env.BASE_URL}                          ║
  ║                                                           ║
  ║   API Endpoints:                                          ║
  ║   POST /api/shorten - Create protected link               ║
  ║   GET  /api/stats/:code - Get URL analytics               ║
  ║   GET  /api/urls - Get all URLs (admin)                   ║
  ║   GET  /:code - Redirect to protected content             ║
  ║   GET  /proxy/:code - Proxy content (URL hidden)          ║
  ║                                                           ║
  ╚═══════════════════════════════════════════════════════════╝
  `);
  
  // Try to connect to MongoDB (will fall back to in-memory if not available)
  connectDB();
});

module.exports = app;