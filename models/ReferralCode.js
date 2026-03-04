const mongoose = require('mongoose');
const crypto = require('crypto');

const referralCodeSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true
  },
  used: {
    type: Boolean,
    default: false
  },
  usedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  usedAt: {
    type: Date,
    default: null
  }
});

// Generate a random 4-word code
referralCodeSchema.statics.generateCode = function() {
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
  for (let i = 0; i < 4; i++) {
    const randomIndex = Math.floor(Math.random() * words.length);
    selectedWords.push(words[randomIndex]);
    words.splice(randomIndex, 1);
  }
  
  return selectedWords.join('-');
};

module.exports = mongoose.model('ReferralCode', referralCodeSchema);
