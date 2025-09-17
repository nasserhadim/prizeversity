//new file added 9/16 retaj 
const mongoose = require('mongoose'); 
const ShopItemSchema = new mongoose.Schema({
    shopId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Shop',
        required: true, 
        index: true
    },

    name: {
        type: String, 
        required: true, 
        minlength: 2,
        maxlength: 120, 
        trim: true
    },

    description: { type: String, default: '' },    //optuional text 
    price: {type: Number, required: true, min: 0},  //this is a requiered number thats not negative 
    imageUrl: {type: String, default: ''}   //image is optionl

}, 

{
  timestamps: true,                                            // adds created and updated at 
  collection: 'shop_items'                                     // force collection name to 'shop_items' w
});

ShopItemSchema.index({ shopId: 1, name: 1 }, { unique: true }); // 1one shop cannot have two items with the same name

module.exports = mongoose.model('ShopItem', ShopItemSchema);    
