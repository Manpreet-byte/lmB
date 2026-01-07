const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  description: {
    type: String,
    default: '',
  },
  category: {
    type: String,
    enum: ['test', 'leave', 'notification', 'system'],
    default: 'system',
  },
}, {
  timestamps: true,
});

// Static method to get setting by key
settingsSchema.statics.getSetting = async function(key, defaultValue = null) {
  const setting = await this.findOne({ key });
  return setting ? setting.value : defaultValue;
};

// Static method to set setting
settingsSchema.statics.setSetting = async function(key, value, description = '', category = 'system') {
  return await this.findOneAndUpdate(
    { key },
    { value, description, category },
    { upsert: true, new: true }
  );
};

const Settings = mongoose.model('Settings', settingsSchema);

module.exports = Settings;
