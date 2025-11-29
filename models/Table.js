// models/Table.js

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const tableSchema = new Schema({
  tableNumber: {
    type: String,
    required: true
  },
  capacity: {
    type: Number,
    required: true,
    min: 1,
    max: 12
  },
  area: {
    type: String,  // Store as string (area ID)
    required: true
  },
  restaurantId: {
    type: String,
    required: true
  },
  tableShape: {
    type: String,
    enum: ['round', 'square', 'rect', 'booth'],
    default: 'round'
  },
  tableStatus: {
    type: String,
    enum: ['available', 'occupied', 'reserved', 'cleaning', 'unavailable'],
    default: 'available'
  },
  assignedServer: {
    type: String,
    default: ''
  },
  wheelchairAccessible: {
    type: Boolean,
    default: false
  },
  positionX: {
    type: Number,
    default: 0
  },
  positionY: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Table', tableSchema);