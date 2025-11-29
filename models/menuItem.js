const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema({
  restaurant: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Restaurant', 
    required: true 
  },
  cuisine: { 
    type: String, 
    required: true,
    trim: true
  },
  date: String,
  time: String,
  type: { 
    type: String, 
    enum: ['veg', 'non-veg', 'vegan'], 
    required: true 
  },
  dishName: { 
    type: String, 
    required: true,
    trim: true,     
  },
  price: { 
    type: Number, 
    required: true,
    min: 0
  },
  image: { 
    type: String 
  },
  isAvailable: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

menuItemSchema.index({ restaurant: 1, cuisine: 1 });
menuItemSchema.index({ restaurant: 1, isAvailable: 1 });

module.exports = mongoose.model('MenuItem', menuItemSchema);