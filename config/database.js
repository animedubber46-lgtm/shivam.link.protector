const mongoose = require('mongoose');

// In-memory storage fallback
const inMemoryDB = {
  urls: new Map(),
  users: new Map(),
  referralCodes: new Map(),
  sessions: new Map(),
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
  },
  
  findByUserId: async (userId) => {
    const seen = new Set();
    const urls = [];
    for (const url of inMemoryDB.urls.values()) {
      if (!seen.has(url._id) && url.userId === userId) {
        seen.add(url._id);
        urls.push(url);
      }
    }
    return urls;
  },
  
  countByUserId: async (userId) => {
    let count = 0;
    const seen = new Set();
    for (const url of inMemoryDB.urls.values()) {
      if (!seen.has(url._id) && url.userId === userId) {
        seen.add(url._id);
        count++;
      }
    }
    return count;
  }
};

// In-memory User operations
const crypto = require('crypto');

const inMemoryUserOps = {
  create: async (data) => {
    const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
    const hashedPassword = crypto.createHash('sha256').update(data.password).digest('hex');
    const user = {
      _id: id,
      email: data.email.toLowerCase(),
      password: hashedPassword,
      isAdmin: data.isAdmin || false,
      referralCode: data.referralCode || null,
      createdAt: new Date(),
      lastLogin: null,
      rememberToken: null,
      save: async function() {
        inMemoryDB.users.set(this._id, this);
        inMemoryDB.users.set(this.email, this);
        return this;
      },
      comparePassword: function(candidatePassword) {
        const hashedCandidate = crypto.createHash('sha256').update(candidatePassword).digest('hex');
        return this.password === hashedCandidate;
      },
      generateRememberToken: function() {
        this.rememberToken = crypto.randomBytes(32).toString('hex');
        return this.rememberToken;
      }
    };
    inMemoryDB.users.set(id, user);
    inMemoryDB.users.set(data.email.toLowerCase(), user);
    return user;
  },
  
  findOne: async (query) => {
    if (query.email) {
      return inMemoryDB.users.get(query.email.toLowerCase()) || null;
    }
    if (query._id) {
      return inMemoryDB.users.get(query._id) || null;
    }
    if (query.rememberToken) {
      for (const user of inMemoryDB.users.values()) {
        if (user.rememberToken === query.rememberToken) {
          return user;
        }
      }
    }
    return null;
  },
  
  findById: async (id) => {
    return inMemoryDB.users.get(id) || null;
  }
};

// In-memory ReferralCode operations
const inMemoryReferralCodeOps = {
  create: async (data) => {
    const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
    const code = {
      _id: id,
      code: data.code,
      used: false,
      usedBy: null,
      createdAt: new Date(),
      usedAt: null,
      save: async function() {
        inMemoryDB.referralCodes.set(this._id, this);
        inMemoryDB.referralCodes.set(this.code, this);
        return this;
      }
    };
    inMemoryDB.referralCodes.set(id, code);
    inMemoryDB.referralCodes.set(data.code, code);
    return code;
  },
  
  findOne: async (query) => {
    if (query.code) {
      return inMemoryDB.referralCodes.get(query.code) || null;
    }
    if (query._id) {
      return inMemoryDB.referralCodes.get(query._id) || null;
    }
    return null;
  },
  
  find: async (query = {}) => {
    const codes = [];
    for (const code of inMemoryDB.referralCodes.values()) {
      // Skip duplicate entries (we store by id and code)
      if (code._id && !codes.find(c => c._id === code._id)) {
        if (query.used !== undefined && code.used !== query.used) continue;
        codes.push(code);
      }
    }
    return codes;
  },
  
  countDocuments: async (query = {}) => {
    let count = 0;
    const seen = new Set();
    for (const code of inMemoryDB.referralCodes.values()) {
      if (!seen.has(code._id)) {
        seen.add(code._id);
        if (query.used !== undefined && code.used !== query.used) continue;
        count++;
      }
    }
    return count;
  }
};

// Generate referral code words
const generateReferralCode = () => {
  const words = [
    'alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel',
    'india', 'juliet', 'kilo', 'lima', 'mike', 'november', 'oscar', 'papa',
    'quebec', 'romeo', 'sierra', 'tango', 'uniform', 'victor', 'whiskey',
    'xray', 'yankee', 'zulu', 'ace', 'bolt', 'cloud', 'dawn', 'earth',
    'fire', 'glow', 'haze', 'ice', 'jade', 'king', 'leaf', 'moon', 'nest',
    'ocean', 'peak', 'queen', 'rain', 'star', 'tree', 'unity', 'vast',
    'wave', 'zen', 'blue', 'gold', 'pink', 'red', 'silver', 'white'
  ];
  
  const selectedWords = [];
  const availableWords = [...words];
  for (let i = 0; i < 4; i++) {
    const randomIndex = Math.floor(Math.random() * availableWords.length);
    selectedWords.push(availableWords[randomIndex]);
    availableWords.splice(randomIndex, 1);
  }
  
  return selectedWords.join('-');
};

module.exports = { 
  connectDB, 
  isUsingMongoDB,
  inMemoryDB,
  inMemoryUrlOps,
  inMemoryUserOps,
  inMemoryReferralCodeOps,
  generateReferralCode
};
