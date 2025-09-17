//new file added 9/16 retaj 

const express = require('express');   //were mporting express to make a router 

const router = express.Router();  //creating a new roter 
const { ensureTeacher } = require('../middleware/auth');  //brings teacher only middleare
const Shop = require('../models/Shop'); // loads the shop mode 
const ShopItem = require('../models/ShopItem'); // will be able to delete items when a shop is delted 


// listing shops, can search 

router.get('/', async (req, res, next) => {              
  try {                                                  
    const page = Number(req.query.page || 1);            
    const limit = Number(req.query.limit || 20);         
    const search = req.query.search || '';               
    const q = search ? { name: { $regex: search, $options: 'i' } } : {}; 
    const [data, total] = await Promise.all([           
      Shop.find(q)                                      
        .sort({ updatedAt: -1 })             
        .skip((page - 1) * limit)                       
        .limit(limit),                                 
      Shop.countDocuments(q)                             
    ]);

    res.json({ data, total, page, limit });             
  } catch (e) { next(e); }                              
});

//GET fetch single shops. 

router.get('/:id', async (req, res, next) => {
  try {
    const shop = await Shop.findById(req.params.id);
    if (!shop) return res.status(404).json({ error: 'Shop not found' });
    res.json(shop);
  } catch (err) {
    next(err);
  }
});


//create a shop for TEACHERS 
router.post('/', ensureTeacher, async (req, res) => {
  try {
    const shop = await Shop.create(req.body);   // make a new shop from request body
    res.status(201).json(shop);                 // send it back with 201 Created
  } catch (err) {
    res.status(400).json({ error: err.message }); // basic error response
  }
});


//teachers only update shops 
router.put('/:id', ensureTeacher, async (req, res) => {
  try {
    const shop = await Shop.findByIdAndUpdate(
      req.params.id,           // which shop to update
      req.body,                // new data
      { new: true, runValidators: true } // return updated doc, check schema rules
    );

    if (!shop) {
      return res.status(404).json({ error: 'Shop not found' });
    }

    res.json(shop);             // send back updated shop
  } catch (err) {
    res.status(400).json({ error: err.message }); // catch validation or cast errors
  }
});

//Teacher ONLYYY delete a shop and its items 

router.delete('/:id', ensureTeacher, async (req, res) => {
  try {
    // delete the shop
    const shop = await Shop.findByIdAndDelete(req.params.id);
    if (!shop) return res.status(404).json({ error: 'Shop not found' });

    // cascade: delete that shop's items
    await ShopItem.deleteMany({ shopId: shop._id });

    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
module.exports = router; //shows file avaiable. 

