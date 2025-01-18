// The "buy" functionality is typically in the same file or separate itemController.js
import Wallet from '../models/Wallet.js';
import mongoose from 'mongoose';

export const buyItem = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { itemId } = req.params;
    const { quantity, classroomId } = req.body;

    // find item
    const item = await BazaarItem.findById(itemId).session(session);
    if (!item) {
      throw new Error('Item not found');
    }

    const totalCost = item.price * quantity;

    let wallet = await Wallet.findOne({ userId: req.user._id, classroomId }).session(session);
    if (!wallet) {
      return res.status(400).json({ message: 'No wallet found for user in this classroom' });
    }
    if (wallet.balance < totalCost) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    wallet.balance -= totalCost;
    wallet.transactions.push({
      type: 'debit',
      amount: totalCost,
      description: `Bought ${quantity} x ${item.name}`,
      performedBy: req.user._id
    });
    await wallet.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.json({ success: true, wallet });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    next(err);
  }
};
