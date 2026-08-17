const router = require('express').Router();
const { register, getMe, updateProfile, deleteAccount } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/register', register);
router.get('/me',        protect, getMe);
router.put('/profile',   protect, updateProfile);
router.delete('/account', protect, deleteAccount);

module.exports = router;
