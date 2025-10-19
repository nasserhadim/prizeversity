const mongoose = require('mongoose');

{/* This is the schema for the bazaar template itself, which has multiple item templates */}
const BazaarTemplateSchema = new mongoose.Schema({
    name: { //the title the instructor gives the bazaar template
        type: String,
        required: true,
        trim: true,
        maxLength: 100,
    },
    description: { //the description the instructor gives the bazaar template
        type: String,
        trim: true,
        maxLength: 100,
    },
    //This is the classroom that this bazaar template belongs to 
    classroomId: {
        type: mongoose.Types.ObjectId,
        ref: 'Classroom',
        required: true,
        index: true,
    },
    //This is the bazaar template belongs to if it has been already made
    bazaarId: {
        type: mongoose.Types.ObjectId,
        ref: 'Bazaar',
        default: null,
    },
    //This is the person who made this bazaar template
    madeBy: {
        type: mongoose.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    isPublic: { //this is for if this bazaar template is public for other instructors to use
        type: Boolean,
        default: false,
        index: true,
    },
    tags: { //this is short labels to help with searching
        type: [String],
        deafault: [],
    },
}, 
{ timestamps: true}
    
);
//these indexes with help when searching for bazaar templates
BazaarTemplateSchema.index({name: 'text', tags: 'text'}); //search by the name or tags

module.exports = mongoose.model('BazaarTemplate', BazaarTemplateSchema);
