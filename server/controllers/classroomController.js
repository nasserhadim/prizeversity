import Classroom from '../models/Classroom.js';
import Wallet from '../models/Wallet.js';
import Group from '../models/Group.js';
import { generateClassCode, getUserRoleInClass } from '../utils/helpers.js';
import mongoose from 'mongoose';

// createClassroom
export const createClassroom = async (req, res, next) => {
  try {
    const { className } = req.body;
    const classCode = generateClassCode(5);

    const newClassroom = await Classroom.create({
      className,
      classCode,
      createdBy: req.user._id,
      users: [{
        userId: req.user._id,
        role: 'admin',
        joinedAt: new Date()
      }]
    });
    res.json(newClassroom);
  } catch (err) {
    next(err);
  }
};

// getClassroomsForUser
export const getClassroomsForUser = async (req, res, next) => {
  try {
    const classrooms = await Classroom.find({ 'users.userId': req.user._id });
    res.json(classrooms);
  } catch (err) {
    next(err);
  }
};

// joinClassroom
export const joinClassroom = async (req, res, next) => {
  try {
    const { id } = req.params; // classroom ID
    const classroom = await Classroom.findById(id);
    if (!classroom) {
      return res.status(404).json({ message: 'Classroom not found' });
    }

    // Check if user already in
    const alreadyIn = classroom.users.some(u => u.userId.toString() === req.user._id.toString());
    if (!alreadyIn) {
      classroom.users.push({
        userId: req.user._id,
        role: 'student',
        joinedAt: new Date()
      });
      await classroom.save();

      // Ensure wallet
      let wallet = await Wallet.findOne({ userId: req.user._id, classroomId: id });
      if (!wallet) {
        wallet = await Wallet.create({
          userId: req.user._id,
          classroomId: id,
          balance: 0
        });
      }
    }
    res.json(classroom);
  } catch (err) {
    next(err);
  }
};

// leaveClassroom
export const leaveClassroom = async (req, res, next) => {
  try {
    const { id } = req.params; 
    const classroom = await Classroom.findById(id);
    if (!classroom) {
      return res.status(404).json({ message: 'Classroom not found' });
    }
    // Remove user
    classroom.users = classroom.users.filter(u => u.userId.toString() !== req.user._id.toString());
    await classroom.save();
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

// deleteClassroom
export const deleteClassroom = async (req, res, next) => {
  try {
    const { id } = req.params;
    const classroom = await Classroom.findById(id);
    if (!classroom) {
      return res.status(404).json({ message: 'Classroom not found' });
    }
    // Only admin can delete (we can also rely on roleMiddleware)
    const role = getUserRoleInClass(req.user._id, classroom);
    if (role !== 'admin') {
      return res.status(403).json({ message: 'Only admin can delete classroom' });
    }

    await Classroom.findByIdAndDelete(id);
    // Optionally, delete or mark child documents (bazaar, wallet, groups, etc.)

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

// assignBalance with concurrency (MongoDB transaction)
export const assignBalance = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { id } = req.params; // classroom ID
    const { studentId, amount, description, includeMultiplier } = req.body;

    // Check if teacher/admin usage is enforced by roleMiddleware or you can do:
    // const classroom = await Classroom.findById(id); // we might already have in req.classroom
    // const userRole = getUserRoleInClass(req.user._id, classroom);
    // if (userRole !== 'admin' && userRole !== 'teacher') { ... }

    let wallet = await Wallet.findOne({ userId: studentId, classroomId: id }).session(session);
    if (!wallet) {
      // create wallet if not exist
      wallet = await Wallet.create([{
        userId: studentId,
        classroomId: id,
        balance: 0
      }], { session });
      wallet = wallet[0];
    }

    let finalAmount = amount;

    if (includeMultiplier) {
      // check group membership
      const group = await Group.findOne({
        classroomId: id,
        'members.userId': studentId
      }).session(session);
      if (group) {
        const count = group.members.length;
        finalAmount = amount + (amount * count * group.multiplier);
      }
    }

    // finalAmount >= 0 => credit, else => debit
    if (finalAmount >= 0) {
      wallet.balance += finalAmount;
      wallet.transactions.push({
        type: 'credit',
        amount: finalAmount,
        description,
        performedBy: req.user._id
      });
    } else {
      const absAmt = Math.abs(finalAmount);
      wallet.balance -= absAmt;
      wallet.transactions.push({
        type: 'debit',
        amount: absAmt,
        description,
        performedBy: req.user._id
      });
    }

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
