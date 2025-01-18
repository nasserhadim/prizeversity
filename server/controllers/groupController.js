// server/controllers/groupController.js
import Group from '../models/Group.js';
import Classroom from '../models/Classroom.js';
import { getUserRoleInClass } from '../utils/helpers.js';
import mongoose from 'mongoose';

/**
 * Create Group(s).
 * If `numberOfGroups` > 1, we do bulk creation.
 * Uses concurrency logic if needed, but typically concurrency is most relevant for join requests.
 */
export const createGroups = async (req, res, next) => {
  try {
    const { classroomId } = req.params;
    const {
      name,
      image,
      numberOfGroups,
      maxStudents,
      selfSignUp,
      joinApprovalRequired,
      multiplier
    } = req.body;

    // We already have a role check via roleMiddleware in the routes for admin/teacher
    // But if needed, we can manually verify user role:
    // const classroom = await Classroom.findById(classroomId);

    let groupsCreated = [];
    const num = numberOfGroups && numberOfGroups > 1 ? numberOfGroups : 1;

    for (let i = 1; i <= num; i++) {
      const groupName = num > 1 ? `${name} ${i}` : name;
      const g = await Group.create({
        classroomId,
        name: groupName,
        image: image || '',
        maxStudents: maxStudents || 5,
        selfSignUp: !!selfSignUp,
        joinApprovalRequired: !!joinApprovalRequired,
        multiplier: multiplier || 0
      });
      groupsCreated.push(g);
    }

    res.json(groupsCreated);
  } catch (err) {
    next(err);
  }
};

/**
 * List all groups in a classroom
 */
export const listGroups = async (req, res, next) => {
  try {
    const { classroomId } = req.params;
    const groups = await Group.find({ classroomId });
    res.json(groups);
  } catch (err) {
    next(err);
  }
};

/**
 * Update a group's info
 */
export const updateGroup = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { name, image, maxStudents, selfSignUp, joinApprovalRequired, multiplier } = req.body;

    const updated = await Group.findByIdAndUpdate(
      groupId,
      {
        name,
        image,
        maxStudents,
        selfSignUp,
        joinApprovalRequired,
        multiplier
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: 'Group not found' });
    }
    res.json(updated);
  } catch (err) {
    next(err);
  }
};

/**
 * Delete a group
 */
export const deleteGroup = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    await Group.findByIdAndDelete(groupId);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

/**
 * Join a group (selfSignUp must be true).
 * Demonstrates concurrency logic in a transaction if you want to ensure capacity isn't overrun.
 */
export const joinGroup = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { groupId } = req.params;
    const group = await Group.findById(groupId).session(session);
    if (!group) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Group not found' });
    }

    if (!group.selfSignUp) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({ message: 'Self sign-up not allowed for this group' });
    }

    // Check if user is already a member
    const alreadyMember = group.members.some(
      m => m.userId.toString() === req.user._id.toString()
    );
    if (alreadyMember) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: 'Already in group' });
    }

    // If joinApprovalRequired, we add a pending request
    if (group.joinApprovalRequired) {
      // Check if there's already a pending request
      const existingReq = group.joinRequests.find(
        r => r.userId.toString() === req.user._id.toString() && r.status === 'pending'
      );
      if (existingReq) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ message: 'You already have a pending request' });
      }

      group.joinRequests.push({ userId: req.user._id });
      await group.save({ session });
      await session.commitTransaction();
      session.endSession();
      return res.json({ message: 'Join request submitted', group });
    } else {
      // No approval required => directly join
      if (group.members.length >= group.maxStudents) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ message: 'Group is already at capacity' });
      }

      group.members.push({ userId: req.user._id });
      await group.save({ session });

      await session.commitTransaction();
      session.endSession();
      return res.json({ message: 'Joined group successfully', group });
    }
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    next(err);
  }
};

/**
 * Leave a group
 */
export const leaveGroup = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Remove user from members
    group.members = group.members.filter(
      m => m.userId.toString() !== req.user._id.toString()
    );
    await group.save();

    res.json({ success: true, group });
  } catch (err) {
    next(err);
  }
};

/**
 * Show join requests (pending approvals) for a group
 */
export const getGroupApprovals = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const pending = group.joinRequests.filter(r => r.status === 'pending');
    res.json(pending);
  } catch (err) {
    next(err);
  }
};

/**
 * Approve or reject requests in bulk
 */
export const approveOrRejectRequests = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { groupId } = req.params;
    const { approvals } = req.body; // array of { userId, decision: 'approved'|'rejected' }

    const group = await Group.findById(groupId).session(session);
    if (!group) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Group not found' });
    }

    // For each item in approvals
    for (let ap of approvals) {
      const reqIndex = group.joinRequests.findIndex(
        r => r.userId.toString() === ap.userId && r.status === 'pending'
      );
      if (reqIndex >= 0) {
        group.joinRequests[reqIndex].status = ap.decision;
        if (ap.decision === 'approved') {
          // Check capacity
          if (group.members.length < group.maxStudents) {
            group.members.push({ userId: ap.userId });
          } else {
            // Group is full -> override decision
            group.joinRequests[reqIndex].status = 'rejected';
          }
        }
      }
    }

    await group.save({ session });
    await session.commitTransaction();
    session.endSession();

    res.json({ success: true, group });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    next(err);
  }
};

/**
 * Suspend (remove) a specific member
 */
export const suspendMember = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { studentId } = req.body;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    group.members = group.members.filter(
      m => m.userId.toString() !== studentId
    );
    await group.save();

    res.json({ success: true, group });
  } catch (err) {
    next(err);
  }
};
