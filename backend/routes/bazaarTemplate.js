const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const BazaarTemplate = require('../models/BazaarTemplate');
const Bazaar = require('../models/Bazaar');
const Item = require('../models/Item');

// GET /api/bazaarTemplates - Get all templates for the associated classroom
router.get('/import', async (req, res) => { //will update this once the apiBazaarTemplate is done
  try {
    const classroomId = req.user._id;
    const templateId = await BazaarTemplate.find({ classroomId })
      .sort({ createdAt: -1 })
      .select('name descriptiom price');

    res.json({ templateId });
  } catch (error) {
    console.error('Error fetching bazaar templates:', error);
    res.status(500).json({ message: 'Failed to fetch templates' });
  }
});


//when an instructor wants to make a new bazaar template in their classroom, they wull click "Import Template"
//then it will copy all the items from the selected bazaar into the new one the instructor created
// POST /api/bazaarTemplates - Create a new template
router.post('/import', async (req, res) => { //will update this once the apiBazaarTemplate is done
    try {
        const {
            sourceClassroomId, //this is for which classroom the template belongs to
            bazaarTemplateId, //this is for which template to import from
            newBazaarName //this is if the user wants to rename the bazaar when importing
        } = req.body;

        //this will find the saved template to figure out which original bazaar it references
        const lookUpTemplate = await BazaarTemplate.findById(bazaarTemplateId);
        if(!lookUpTemplate){
            return res.status(404).json({message: "The bazaar template requested does not exist"});
        }

        //this will get the original bazaar’s details like the name, description and the price to copy into the new one
        const selectedBazaar = await Bazaar.findById(lookUpTemplate.bazaarId).lean();
        if(!selectedBazaar){
            return res.status(404).json({message: "The bazaar that the template is from on does not exist"});
        }

        //this will create a new bazaar for the classroom that the user selected
        const newBazaar = await Bazaar.create({
            name: (newBazaarName && newBazaarName.trim()) || lookUpTemplate.name,
            classroom: sourceClassroomId,
            description: lookqUpTemplate.description || selectedBazaar.description || ''
        });

        //this would pull all the of the items from the selected bazaar and copy them over to the new bazaar
        const selectedItems = await Item.find({bazaar: lookUpTemplate.bazaarId}).lean();

        //this is making a list of the selected items to copy over into the new bazaar
        const itemsToCopy = selectedItems.map((item) => ({
            name: item.name, //will copy the name over
            description: item.description, //will copy the description over
            category: item.category, //will copy the category over
            price: item.price, //will copy the price over
            primaryEffect: item.primaryEffect, //will copy the primary effect over
            secondaryEffect: item.secondaryEffect, //will copy the secondary effect over
            bazaar: newBazaar._id, //will set the bazaar to the new bazaar
            imageLink: item.imageUrl ?? {} //will copy the image over if there is one

        }));

        if(itemsToCopy.length > 0){ //only add the items if there are any
            await Item.insertMany(itemsToCopy);
        }
        //this will return the new bazaar that was created
        return res.json(newBazaar);
    }   catch (error) { //if anything that went wrong it will return a error message
        console.error(error);
        return res.status(500).json({message: "There was an error when attempting to import the bazaar template"});
    }

});
module.exports = router;