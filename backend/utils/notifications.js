const Notification = require('../models/Notification');

const populateNotification = async (notificationId) => {
  // Load main notification and decide whether to include actor details
  const n = await Notification.findById(notificationId)
    .populate('user', 'email')
    .populate('classroom', 'name code')
    .populate('groupSet', 'name')
    .populate('group', 'name');
  if (!n) return null;

  if (n.anonymized) {
    // Explicitly return "System" as the actor for anonymized notifications
    // so sockets and HTTP responses have the same shape.
    const obj = n.toObject();
    obj.actionBy = { _id: null, firstName: 'System', lastName: '', email: null };
    return obj;
  }

  // Modern mongoose: document.populate returns a promise. Use it directly.
  await n.populate('actionBy', 'email firstName lastName');
  return n.toObject();
};

module.exports = { populateNotification };