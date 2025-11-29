const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const tableSchema = new Schema({
  tableNumber: {
    type: String,
    required: true
  },
  capacity: {
    type: Number,
    required: true
  },
  position: {
    x: { type: Number, required: true },
    y: { type: Number, required: true }
  },
  size: {
    width: { type: Number, default: 100 },
    height: { type: Number, default: 100 }
  },
  rotation: {
    type: Number,
    default: 0 // degrees
  },
  shape: {
    type: String,
    enum: ['circle', 'square', 'rectangle'],
    default: 'square'
  },
  status: {
    type: String,
    enum: ['available', 'reserved', 'occupied'],
    default: 'available'
  }
});

const floorPlanSchema = new Schema({
  restaurant: {
    type: Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: true
  },
  floorName: {
    type: String,
    required: true
  },
  tables: [tableSchema]
}, {
  timestamps: true
});

module.exports = mongoose.model('FloorPlan', floorPlanSchema);