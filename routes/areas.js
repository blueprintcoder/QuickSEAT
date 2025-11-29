// routes/areas.js

const express = require('express');
const router = express.Router();
const Area = require('../models/Area');

// GET - Fetch all areas for a restaurant
router.get('/by-restaurant/:restaurantId', async (req, res) => {
  try {
    console.log('📡 Fetching areas for:', req.params.restaurantId);
    const areas = await Area.find({ 
      restaurantId: req.params.restaurantId,
      isActive: true 
    }).sort({ createdAt: 1 });
    console.log('✅ Found', areas.length, 'areas');
    res.json(areas);
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST - Create a new area
router.post('/', async (req, res) => {
  try {
    console.log('💾 Creating area with data:', req.body);
    
    const { areaName, restaurantId, areaDescription, areaIcon, color, capacity } = req.body;
    
    if (!areaName || !restaurantId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if area already exists
    const existingArea = await Area.findOne({ restaurantId, areaName });
    if (existingArea) {
      return res.status(400).json({ error: 'Area already exists' });
    }

    const newArea = new Area({
      restaurantId,
      areaName,
      areaDescription: areaDescription || '',
      areaIcon: areaIcon || '🏢',
      color: color || '#667eea',
      capacity: capacity || 0
    });

    await newArea.save();
    console.log('✅ Area created:', newArea);
    res.json(newArea);
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(400).json({ error: error.message });
  }
});

// PUT - Update an area
router.put('/:id', async (req, res) => {
  try {
    console.log('✏️ Updating area:', req.params.id);
    console.log('📝 Update data:', req.body);
    
    const updatedArea = await Area.findByIdAndUpdate(
      req.params.id,
      {
        areaName: req.body.areaName,
        areaDescription: req.body.areaDescription,
        areaIcon: req.body.areaIcon,
        color: req.body.color,
        capacity: req.body.capacity
      },
      { new: true }
    );
    
    console.log('✅ Area updated:', updatedArea);
    res.json(updatedArea);
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(400).json({ error: error.message });
  }
});

// DELETE - Delete an area (soft delete - mark as inactive)
router.delete('/:id', async (req, res) => {
  try {
    console.log('🗑️ Deleting area:', req.params.id);
    await Area.findByIdAndUpdate(req.params.id, { isActive: false });
    console.log('✅ Area deleted');
    res.json({ message: 'Area deleted' });
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;