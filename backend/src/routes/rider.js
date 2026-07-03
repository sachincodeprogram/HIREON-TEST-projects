const router = require('express').Router();
const ctrl   = require('../controllers/riderController');
const { protect, requireRole } = require('../middleware/auth');

router.put('/status',   protect, requireRole('rider'), ctrl.setOnlineStatus);
router.post('/location', protect, requireRole('rider'), ctrl.updateLocation);
router.post('/fcm-token', protect, requireRole('rider'), ctrl.updateFcmToken);
router.get('/earnings', protect, requireRole('rider'), ctrl.getEarnings);

module.exports = router;
