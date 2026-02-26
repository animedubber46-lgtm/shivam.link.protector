const mongoose = require('mongoose');

// In-memory storage fallback
const inMemoryDB = {
  urls: new Map(),
  connected: false
};

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    inMemoryDB.connected = true;
    return true;
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    console.log('Falling back to in-memory storage (data will not persist)');
    inMemoryDB.connected = false;
    return false;
  }
};

// Check if using MongoDB or in-memory
const isUsingMongoDB = () => inMemoryDB.connected;

// In-memory URL operations
const inMemoryUrlOps = {
  create: async (data) => {
    const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
    const url = {
      _id: id,
      ...data,
      clicks: 0,
      createdAt: new Date(),
      lastAccessedAt: null,
      save: async function() {
        inMemoryDB.urls.set(this.shortCode, this);
        if (this.customAlias) {
          inMemoryDB.urls.set(this.customAlias, this);
        }
        return this;
      },
      isExpired: function() {
        if (!this.expiresAt) return false;
        return new Date() > this.expiresAt;
      }
    };
    inMemoryDB.urls.set(data.shortCode, url);
    if (data.customAlias) {
      inMemoryDB.urls.set(data.customAlias, url);
    }
    return url;
  },
  
  findOne: async (query) => {
    const code = query.shortCode || query.customAlias || 
                 (query.$or && (query.$or[0]?.shortCode || query.$or[1]?.customAlias));
    if (code) {
      return inMemoryDB.urls.get(code) || null;
    }
    return null;
  },
  
  find: async () => {
    const seen = new Set();
    const urls = [];
    for (const url of inMemoryDB.urls.values()) {
      if (!seen.has(url._id)) {
        seen.add(url._id);
        urls.push(url);
      }
    }
    return urls;
  },
  
  countDocuments: async () => {
    const seen = new Set();
    for (const url of inMemoryDB.urls.values()) {
      seen.add(url._id);
    }
    return seen.size;
  },
  
  findByIdAndDelete: async (id) => {
    for (const [key, url] of inMemoryDB.urls.entries()) {
      if (url._id === id) {
        inMemoryDB.urls.delete(url.shortCode);
        if (url.customAlias) {
          inMemoryDB.urls.delete(url.customAlias);
        }
        return url;
      }
    }
    return null;
  }
};

module.exports = { 
  connectDB, 
  isUsingMongoDB,
  inMemoryDB,
  inMemoryUrlOps
};
