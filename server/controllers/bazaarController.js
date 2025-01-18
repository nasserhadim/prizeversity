// server/controllers/bazaarController.js
import Bazaar from '../models/Bazaar.js';
import BazaarItem from '../models/BazaarItem.js';

// CREATE Bazaar
export const createBazaar = async (req, res, next) => {
  try {
    const { classroomId } = req.params;
    const { name, description, image } = req.body;
    const bazaar = await Bazaar.create({
      classroomId,
      name,
      description,
      image: image || ''
    });
    res.json(bazaar);
  } catch (err) {
    next(err);
  }
};

// GET Bazaars by Classroom
export const getBazaarsByClassroom = async (req, res, next) => {
  try {
    const { classroomId } = req.params;
    const bazaars = await Bazaar.find({ classroomId });
    res.json(bazaars);
  } catch (err) {
    next(err);
  }
};

// UPDATE Bazaar
export const updateBazaar = async (req, res, next) => {
  try {
    const { bazaarId } = req.params;
    const { name, description, image } = req.body;
    const updated = await Bazaar.findByIdAndUpdate(bazaarId,
      { name, description, image },
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    next(err);
  }
};

// DELETE Bazaar (and cascade items)
export const deleteBazaar = async (req, res, next) => {
  try {
    const { bazaarId } = req.params;
    await Bazaar.findByIdAndDelete(bazaarId);
    await BazaarItem.deleteMany({ bazaarId });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

// CREATE Item
export const createItem = async (req, res, next) => {
  try {
    const { bazaarId } = req.params;
    const { name, description, price, image } = req.body;
    const item = await BazaarItem.create({
      bazaarId,
      name,
      description,
      price,
      image: image || ''
    });
    res.json(item);
  } catch (err) {
    next(err);
  }
};

// GET Items
export const getItemsByBazaar = async (req, res, next) => {
  try {
    const { bazaarId } = req.params;
    const items = await BazaarItem.find({ bazaarId });
    res.json(items);
  } catch (err) {
    next(err);
  }
};

// UPDATE Item
export const updateItem = async (req, res, next) => {
  try {
    const { itemId } = req.params;
    const { name, description, price, image } = req.body;
    const updated = await BazaarItem.findByIdAndUpdate(itemId,
      { name, description, price, image },
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    next(err);
  }
};

// DELETE Item
export const deleteItem = async (req, res, next) => {
  try {
    const { itemId } = req.params;
    await BazaarItem.findByIdAndDelete(itemId);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};
