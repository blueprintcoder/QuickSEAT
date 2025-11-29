// routes/tables.js

const express = require('express');
const router = express.Router();
const Table = require('../models/Table');

// GET - Fetch all tables for a restaurant
router.get('/by-restaurant/:restaurantId', async (req, res) => {
  try {
    console.log('📡 Fetching tables for:', req.params.restaurantId);
    const tables = await Table.find({ restaurantId: req.params.restaurantId });
    console.log('✅ Found', tables.length, 'tables');
    res.json(tables);
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST - Create a new table
router.post('/', async (req, res) => {
  try {
    console.log('💾 Creating table with data:', req.body);
    
    const { tableNumber, capacity, area, restaurantId, tableShape, tableStatus, assignedServer, wheelchairAccessible } = req.body;
    
    if (!tableNumber || !capacity || !area || !restaurantId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const newTable = new Table({
      tableNumber: tableNumber.toString(),
      capacity: parseInt(capacity),
      area: area,
      restaurantId: restaurantId,
      tableShape: tableShape || 'round',  // SAVE SHAPE
      tableStatus: tableStatus || 'available',  // SAVE STATUS
      assignedServer: assignedServer || '',
      wheelchairAccessible: wheelchairAccessible || false,
      positionX: 0,
      positionY: 0
    });

    await newTable.save();
    console.log('✅ Table created:', newTable);
    res.json(newTable);
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(400).json({ error: error.message });
  }
});

// PUT - Update a table (ALL FIELDS)
router.put('/:id', async (req, res) => {
  try {
    console.log('✏️ Updating table:', req.params.id);
    console.log('📝 Update data:', req.body);
    
    const updatedTable = await Table.findByIdAndUpdate(
      req.params.id, 
      {
        tableNumber: req.body.tableNumber,
        capacity: req.body.capacity,
        area: req.body.area,
        tableShape: req.body.tableShape,  // UPDATE SHAPE
        tableStatus: req.body.tableStatus,  // UPDATE STATUS
        assignedServer: req.body.assignedServer,
        wheelchairAccessible: req.body.wheelchairAccessible
      },
      { new: true }
    );
    
    console.log('✅ Table updated:', updatedTable);
    res.json(updatedTable);
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(400).json({ error: error.message });
  }
});

// PATCH - Update position only
router.patch('/:id/position', async (req, res) => {
  try {
    const { positionX, positionY } = req.body;
    console.log('📍 Updating position:', { positionX, positionY });
    
    const updatedTable = await Table.findByIdAndUpdate(
      req.params.id,
      { positionX, positionY },
      { new: true }
    );
    
    console.log('✅ Position updated:', updatedTable);
    res.json(updatedTable);
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(400).json({ error: error.message });
  }
});

// PATCH - Update Table Status Only
router.patch('/:id/status', async (req, res) => {
    try {
        const tableId = req.params.id;
        const { tableStatus } = req.body;
        
        const updatedTable = await Table.findByIdAndUpdate(
            tableId,
            { tableStatus: tableStatus },
            { new: true } 
        );

        if (!updatedTable) {
            return res.status(404).json({ error: 'Table not found.' });
        }
        
        // Broadcast the change via Socket.IO for real-time updates on all dashboards
        // Assuming your Socket.IO logic is available via req.app.get('socketio')
        const io = req.app.get('socketio'); 
        if (io) {
            io.emit('tableStatusChanged', {
                tableId: updatedTable._id,
                newStatus: updatedTable.tableStatus,
                areaId: updatedTable.area,
                restaurantId: updatedTable.restaurantId
            });
        }

        res.json(updatedTable);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update table status due to server error.' });
    }
});

// DELETE - Delete a table
router.delete('/:id', async (req, res) => {
  try {
    console.log('🗑️ Deleting table:', req.params.id);
    await Table.findByIdAndDelete(req.params.id);
    console.log('✅ Table deleted');
    res.json({ message: 'Table deleted' });
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;