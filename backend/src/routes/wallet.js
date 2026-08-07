const router = require('express').Router();
const ctrl   = require('../controllers/walletController');
const { protect, requireRole } = require('../middleware/auth');

router.get('/',                 protect, requireRole('rider'), ctrl.getWallet);
router.get('/transactions',     protect, requireRole('rider'), ctrl.getTransactions);
router.post('/recharge/order',  protect, requireRole('rider'), ctrl.createRechargeOrder);
router.post('/recharge/verify', protect, requireRole('rider'), ctrl.verifyRecharge);

module.exports = router;
