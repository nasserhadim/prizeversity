const Notification = require('../models/Notification');

const populateNotification = async (notificationId) => {
  return await Notification.findById(notificationId)
    .populate('user', 'email')
    .populate('actionBy', 'email firstName lastName')
    .populate('classroom', 'name')
    .populate('groupSet', 'name')
    .populate('group', 'name');
};

module.exports = { populateNotification };