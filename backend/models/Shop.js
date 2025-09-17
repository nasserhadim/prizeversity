//new file added 9/16 Retaj 
const mongoose = require('mongoose'); //this si pulling in mongoose to defune the model 
const ShopSchema = new mongoose.Schema({ // need to define the shape of the shop doc 
    name: {
        type: String,
        required: true,
        minlength: 2,
        maxlength: 120,
        trim: true
    },
    description: {type: String, default: ''}, // keeping text options, it defaults to empy string
    imageUrl: {type: String, default: ''}       //keeping this optional image ur;, itll be empty if non are set 
},
    {
        timestamps: true,    //this will automaticcaly adds the created at or updated at for autditing
        collection: 'shops'   //force collection name to shops, no mistake. 
    
});


ShopSchema.index({ name: 1}, {unique: true});  // giving it a unique index so no mistake in duplicate shop names
module.exports = mongoose.model('Shop', ShopSchema);   // a way to compile and export the model class "shop"

