const mongoose = require('mongoose');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  referralCode: {
    type: String,
    required: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date,
    default: null
  },
  rememberToken: {
    type: String,
    default: null
  }
}, { 
  collection: 'users',
  autoIndex: true 
});

// Hash password before saving
userSchema.pre('save', function(next) {
  if (!this.isModified('password')) return next();
  this.password = hashPassword(this.password);
  next();
});

// Compare password
userSchema.methods.comparePassword = function(candidatePassword) {
  return this.password === hashPassword(candidatePassword);
};

// Generate remember token
userSchema.methods.generateRememberToken = function() {
  this.rememberToken = crypto.randomBytes(32).toString('hex');
  return this.rememberToken;
};

// Hash password helper
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

module.exports = mongoose.model('User', userSchema);
