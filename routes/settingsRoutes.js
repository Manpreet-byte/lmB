const express = require('express');
const {
  getSettings,
  updateSetting,
  updateMultipleSettings,
  getPublicSettings,
  initializeSettings,
} = require('../controllers/settingsController');
const { protect, admin } = require('../middleware/authMiddleware');
const router = express.Router();

router.route('/')
  .get(protect, admin, getSettings)
  .put(protect, admin, updateMultipleSettings);

router.get('/public', protect, getPublicSettings);
router.post('/init', protect, admin, initializeSettings);
router.put('/:key', protect, admin, updateSetting);

module.exports = router;
