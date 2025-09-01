const Notification = require('../models/Notification');

const populateNotification = async (notificationId) => {
  return await Notification.findById(notificationId)
    .populate('user', 'email')
    .populate('actionBy', 'email firstName lastName')
    // include classroom.code so frontend can show class ID/code in notifications
    .populate('classroom', 'name code')
    .populate('groupSet', 'name')
    .populate('group', 'name');
};

module.exports = { populateNotification };