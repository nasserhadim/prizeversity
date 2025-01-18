import Wallet from '../models/Wallet.js';
import mongoose from 'mongoose';

export const getWallet = async (req, res, next) => {
  try {
    const { classroomId } = req.params;
    const wallet = await Wallet.findOne({ userId: req.user._id, classroomId });
    if (!wallet) {
      return res.status(404).json({ message: 'No wallet found' });
    }
    res.json(wallet);
  } catch (err) {
    next(err);
  }
};

export const transferBalance = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { classroomId } = req.params;
    const { recipientId, amount } = req.body;

    const senderWallet = await Wallet.findOne({ userId: req.user._id, classroomId }).session(session);
    if (!senderWallet) {
      throw new Error('Sender wallet not found');
    }

    if (senderWallet.balance < amount) {
      throw new Error('Insufficient balance');
    }

    const recipientWallet = await Wallet.findOne({ userId: recipientId, classroomId }).session(session);
    if (!recipientWallet) {
      throw new Error('Recipient wallet not found');
    }

    // Deduct from sender
    senderWallet.balance -= amount;
    senderWallet.transactions.push({
      type: 'transfer',
      amount,
      description: `Transfer to user ${recipientId}`,
      performedBy: req.user._id
    });
    await senderWallet.save({ session });

    // Credit to recipient
    recipientWallet.balance += amount;
    recipientWallet.transactions.push({
      type: 'transfer',
      amount,
      description: `Received from user ${req.user._id}`,
      performedBy: req.user._id
    });
    await recipientWallet.save({ session });

    await session.commitTransaction();
    session.endSession();
    res.json({ success: true });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    next(err);
  }
};

// Advanced search + sort + pagination with aggregation pipeline
export const getTransactions = async (req, res, next) => {
  try {
    const { classroomId } = req.params;
    const { search = '', sort = 'createdAt', order = 'desc', page = 1, limit = 5 } = req.query;

    // We can pipeline on Wallet collection
    const skip = (page - 1) * limit;
    const sortOrder = order === 'asc' ? 1 : -1;

    // If you want to search in multiple fields (description, type)
    const searchRegex = new RegExp(search, 'i');

    const pipeline = [
      { 
        $match: { 
          userId: req.user._id, 
          classroomId: new mongoose.Types.ObjectId(classroomId) 
        } 
      },
      { $unwind: '$transactions' }, // split array
      // Filter by search
      {
        $match: {
          $or: [
            { 'transactions.description': { $regex: searchRegex } },
            { 'transactions.type': { $regex: searchRegex } }
          ]
        }
      },
      // Sort
      { $sort: { [`transactions.${sort}`]: sortOrder } },
      // Facet to get total count + paginated data
      {
        $facet: {
          metadata: [
            { $count: 'total' }
          ],
          data: [
            { $skip: skip },
            { $limit: Number(limit) }
          ]
        }
      }
    ];

    const result = await Wallet.aggregate(pipeline);
    if (!result || !result[0]) {
      return res.json({ total: 0, page, limit, data: [] });
    }

    const total = result[0].metadata[0]?.total || 0;
    const data = result[0].data.map(d => d.transactions); // Because we unwound it

    res.json({
      total,
      page: Number(page),
      limit: Number(limit),
      data
    });
  } catch (err) {
    next(err);
  }
};
