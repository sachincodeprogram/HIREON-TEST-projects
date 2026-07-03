const router = require('express').Router();
const ctrl   = require('../controllers/orderController');
const { protect, requireRole } = require('../middleware/auth');

router.post('/estimate',         protect, ctrl.estimateFare);
router.post('/',                 protect, requireRole('customer'), ctrl.createOrder);
router.get('/',                  protect, ctrl.getOrders);
router.get('/pending',           protect, requireRole('rider'),    ctrl.getPendingOrders);
router.get('/:id',               protect, ctrl.getOrder);
router.get('/:id/nearby-riders', protect, ctrl.getNearbyRiders);
router.post('/:id/redispatch',   protect, requireRole('customer'), ctrl.redispatchOrder);
router.post('/:id/accept',       protect, requireRole('rider'),    ctrl.acceptOrder);
router.post('/:id/pickup',       protect, requireRole('rider'),    ctrl.confirmPickup);
router.post('/:id/deliver',      protect, requireRole('rider'),    ctrl.confirmDelivery);
router.patch('/:id/delivery-address', protect, requireRole('customer'), ctrl.updateDeliveryAddress);
router.post('/:id/rate',         protect, requireRole('customer'), ctrl.rateOrder);
router.post('/:id/cancel',       protect, ctrl.cancelOrder);

module.exports = router;
