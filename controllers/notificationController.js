const asyncHandler = require('express-async-handler');
const Notification = require('../models/notificationModel');

// @desc    Get user notifications
// @route   GET /api/notifications
// @access  Private
const getNotifications = asyncHandler(async (req, res) => {
  const notifications = await Notification.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .limit(50);
  res.json(notifications);
});

// @desc    Get unread notification count
// @route   GET /api/notifications/unread-count
// @access  Private
const getUnreadCount = asyncHandler(async (req, res) => {
  const count = await Notification.countDocuments({ 
    user: req.user._id, 
    isRead: false 
  });
  res.json({ count });
});

// @desc    Mark notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
const markAsRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findById(req.params.id);
  
  if (!notification) {
    res.status(404);
    throw new Error('Notification not found');
  }
  
  if (notification.user.toString() !== req.user._id.toString()) {
    res.status(401);
    throw new Error('Not authorized');
  }
  
  notification.isRead = true;
  await notification.save();
  res.json({ message: 'Notification marked as read' });
});

// @desc    Mark all notifications as read
// @route   PUT /api/notifications/read-all
// @access  Private
const markAllAsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { user: req.user._id, isRead: false },
    { isRead: true }
  );
  res.json({ message: 'All notifications marked as read' });
});

// @desc    Delete a notification
// @route   DELETE /api/notifications/:id
// @access  Private
const deleteNotification = asyncHandler(async (req, res) => {
  const notification = await Notification.findById(req.params.id);
  
  if (!notification) {
    res.status(404);
    throw new Error('Notification not found');
  }
  
  if (notification.user.toString() !== req.user._id.toString()) {
    res.status(401);
    throw new Error('Not authorized');
  }
  
  await notification.deleteOne();
  res.json({ message: 'Notification deleted' });
});

// @desc    Create notification (internal use)
const createNotification = async (userId, title, message, type = 'info', link = null) => {
  try {
    await Notification.create({
      user: userId,
      title,
      message,
      type,
      link,
    });
  } catch (error) {
    console.error('Failed to create notification:', error);
  }
};

module.exports = { 
  getNotifications, 
  getUnreadCount, 
  markAsRead, 
  markAllAsRead, 
  deleteNotification,
  createNotification 
};
