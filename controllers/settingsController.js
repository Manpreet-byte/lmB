const asyncHandler = require('express-async-handler');
const Settings = require('../models/settingsModel');

// @desc    Get all settings
// @route   GET /api/settings
// @access  Private/Admin
const getSettings = asyncHandler(async (req, res) => {
  const settings = await Settings.find({});
  
  // Convert to key-value object for easier frontend consumption
  const settingsObj = {};
  settings.forEach(setting => {
    settingsObj[setting.key] = {
      value: setting.value,
      description: setting.description,
      category: setting.category,
    };
  });
  
  res.json(settingsObj);
});

// @desc    Update a setting
// @route   PUT /api/settings/:key
// @access  Private/Admin
const updateSetting = asyncHandler(async (req, res) => {
  const { value, description, category } = req.body;
  
  const setting = await Settings.findOneAndUpdate(
    { key: req.params.key },
    { value, description, category },
    { upsert: true, new: true }
  );
  
  res.json(setting);
});

// @desc    Update multiple settings at once
// @route   PUT /api/settings
// @access  Private/Admin
const updateMultipleSettings = asyncHandler(async (req, res) => {
  const settingsToUpdate = req.body;
  
  const results = [];
  for (const [key, data] of Object.entries(settingsToUpdate)) {
    const setting = await Settings.findOneAndUpdate(
      { key },
      { value: data.value, description: data.description || '', category: data.category || 'system' },
      { upsert: true, new: true }
    );
    results.push(setting);
  }
  
  res.json(results);
});

// @desc    Get public settings (for students)
// @route   GET /api/settings/public
// @access  Private
const getPublicSettings = asyncHandler(async (req, res) => {
  const publicKeys = ['testDuration', 'questionsPerTest', 'passMark', 'maxLeaveDays'];
  const settings = await Settings.find({ key: { $in: publicKeys } });
  
  const settingsObj = {};
  settings.forEach(setting => {
    settingsObj[setting.key] = setting.value;
  });
  
  res.json(settingsObj);
});

// @desc    Initialize default settings
// @route   POST /api/settings/init
// @access  Private/Admin
const initializeSettings = asyncHandler(async (req, res) => {
  const defaultSettings = [
    { key: 'testDuration', value: 30, description: 'Test duration in minutes', category: 'test' },
    { key: 'questionsPerTest', value: 10, description: 'Number of questions per test', category: 'test' },
    { key: 'passMark', value: 60, description: 'Pass mark percentage', category: 'test' },
    { key: 'maxLeaveDays', value: 30, description: 'Maximum leave days per year', category: 'leave' },
    { key: 'requireTestForLeave', value: true, description: 'Require test completion for leave', category: 'leave' },
    { key: 'emailNotifications', value: true, description: 'Enable email notifications', category: 'notification' },
    { key: 'systemName', value: 'Student Leave Management System', description: 'System name', category: 'system' },
    { key: 'maintenanceMode', value: false, description: 'Maintenance mode', category: 'system' },
  ];
  
  const results = [];
  for (const setting of defaultSettings) {
    const existing = await Settings.findOne({ key: setting.key });
    if (!existing) {
      const newSetting = await Settings.create(setting);
      results.push(newSetting);
    }
  }
  
  res.json({ message: 'Settings initialized', created: results.length });
});

module.exports = {
  getSettings,
  updateSetting,
  updateMultipleSettings,
  getPublicSettings,
  initializeSettings,
};
