const router = require('express').Router();

router.get('/health', (req, res) => {
  res.json({ success: true, message: 'HIREON API is running', version: '2.0.0' });
});

router.use('/auth',     require('./auth'));
router.use('/orders',   require('./orders'));
router.use('/rider',    require('./rider'));
router.use('/admin',    require('./admin'));
router.use('/wallet',   require('./wallet'));
router.use('/payments', require('./payments'));

module.exports = router;
