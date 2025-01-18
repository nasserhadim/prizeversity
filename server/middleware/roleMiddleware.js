import Classroom from '../models/Classroom.js';
import { getUserRoleInClass } from '../utils/helpers.js';

/**
 * Checks if user has at least one of the roles allowed in the given classroom.
 * e.g. rolesAllowed = ['admin', 'teacher'] 
 *    -> means the user must be admin or teacher in that classroom
 */
export const requireRole = (rolesAllowed) => {
  return async (req, res, next) => {
    try {
      const { id: classroomId } = req.params;
      if (!classroomId) {
        return res.status(400).json({ message: 'Classroom ID is required in the route' });
      }
      const classroom = await Classroom.findById(classroomId);
      if (!classroom) {
        return res.status(404).json({ message: 'Classroom not found' });
      }

      const userRole = getUserRoleInClass(req.user._id, classroom);
      if (!userRole) {
        return res.status(403).json({ message: 'User not in classroom' });
      }
      if (!rolesAllowed.includes(userRole)) {
        return res.status(403).json({ message: 'Insufficient permissions' });
      }

      // Attach classroom to req for convenience
      req.classroom = classroom;
      return next();
    } catch (err) {
      next(err);
    }
  };
};
