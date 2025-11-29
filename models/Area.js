// models/Area.js

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const areaSchema = new Schema({
  restaurantId: {
    type: String,
    required: true
  },
  areaName: {
    type: String,
    required: true
  },
  areaDescription: {
    type: String,
    default: ''
  },
  areaIcon: {
    type: String,
    default: '🏢'
  },
  color: {
    type: String,
    default: '#667eea'
  },
  capacity: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Area', areaSchema);