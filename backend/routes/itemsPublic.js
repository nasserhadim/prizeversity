//9/22 created this file so i dont mess anything with items.js
// backend/routes/itemsPublic.js
/*
const express = require('express');
const router = express.Router();
const Item = require('../models/Item');


// Public route to get all items
router.get('/', async (req, res) => { // define a GET endpoint at /api/items-public
  try {
    const items = await Item.find()// fetch all items from the database
      .sort({ createdAt: -1 }); // sort them by newest first
    res.json(items);  // send the items back as JSON
  } catch (err) {   // if something goes wrong
    res.status(500).json({ error: 'Failed to load items' });  // send error with status 500
  }
});
//getting api for items
router.get('/:itemId', async (req, res) => {
  try {
    const item = await ShopItem.findById(req.params.itemId);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load item' });
  }
});

module.exports = router;

*/
// did not work the way i wanred it, will be using item.js. 
