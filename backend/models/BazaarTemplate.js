const mongoose = require('mongoose');

{/* This is the schema for the bazaar template itself, which has multiple item templates */}
const BazaarTemplateSchema = new mongoose.Schema({
    name: { //the title the instructor gives the bazaar template
        type: String,
        required: true,
        trim: true,
        maxLength: 100
    },
    description: { //the description the instructor gives the bazaar template
        type: String,
        trim: true,
        maxLength: 100
    },
    //This is the classroom that this bazaar template belongs to 
    classroomId: {
        type: mongoose.Types.ObjectId,
        ref: 'Classroom',
        required: true
    },
    //This is the bazaar template belongs to if it has been already made
    bazaarId: {
        type: mongoose.Types.ObjectId,
        ref: 'Bazaar',
        default: {},
    },
    //This is the person who made this bazaar template
    madeBy: {
        type: mongoose.Types.ObjectId,
        ref: 'User',
        required: true
    },
    isPublic: { //this is for if this bazaar template is public for other instructors to use
        type: Boolean,
        default: false
    },
    tags: { //this is short labels to help with searching
        type: [String],
        trim: true,
    },
    
});
//these indexes with help when searching for bazaar templates
BazaarTemplateSchema.index({name: 'text', tags: 'text'}); //search by the name or tags
BazaarTemplateSchema.index({isPublic: 1, madeBy: -1}); //search by public templates first, then by the person who made it
BazaarTemplateSchema.index({classroomId: 1, madeBy: -1}); //search by the classroom it belongs to, then by the person who made it


module.exports = mongoose.model('BazaarTemplate', BazaarTemplateSchema);
