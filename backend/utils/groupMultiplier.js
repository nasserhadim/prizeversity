const Classroom = require('../models/Classroom');
const GroupSet = require('../models/GroupSet');
const Group = require('../models/Group');

/**
 * Get the group multiplier for a user in a classroom
 * This checks if the user belongs to any groups and returns their combined multiplier
 */
async function getUserGroupMultiplier(userId, classroomId) {
  try {
    if (!classroomId || !userId) return 1;

    // Find all GroupSets in this classroom
    const groupSets = await GroupSet.find({ classroom: classroomId }).select('groups');
    if (!groupSets.length) return 1;

    // Get all group IDs from these GroupSets
    const groupIds = groupSets.flatMap(gs => gs.groups || []);
    if (!groupIds.length) return 1;

    // Find groups where user is an approved member
    const groups = await Group.find({
      _id: { $in: groupIds },
      members: {
        $elemMatch: {
          _id: userId,
          status: 'approved'
        }
      }
    }).select('groupMultiplier');

    if (!groups || groups.length === 0) return 1;

    // Sum of multipliers across distinct groups (consistent with wallet/stats logic)
    // Use additive logic: 1 + sum of (groupMult - 1) for each group
    let totalMultiplier = 1;
    for (const group of groups) {
      const mult = group.groupMultiplier || 1;
      if (mult > 1) {
        totalMultiplier += (mult - 1);
      }
    }

    return totalMultiplier;
  } catch (error) {
    console.error('Error getting user group multiplier:', error);
    return 1;
  }
}

module.exports = {
  getUserGroupMultiplier
};