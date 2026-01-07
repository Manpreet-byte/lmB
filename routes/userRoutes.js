const express = require('express');
const { 
  registerUser, 
  authUser, 
  logoutUser, 
  getUserProfile, 
  updateUserProfile, 
  changePassword,
  getAllUsers,
  toggleUserStatus,
  updateUserRole,
  deleteUser
} = require('../controllers/userController');
const { protect, admin } = require('../middleware/authMiddleware');
const router = express.Router();

router.route('/').post(registerUser).get(protect, admin, getAllUsers);
router.post('/login', authUser);
router.post('/logout', logoutUser);
router.route('/profile').get(protect, getUserProfile).put(protect, updateUserProfile);
router.put('/password', protect, changePassword);
router.put('/:id/toggle', protect, admin, toggleUserStatus);
router.put('/:id/role', protect, admin, updateUserRole);
router.delete('/:id', protect, admin, deleteUser);

module.exports = router;
