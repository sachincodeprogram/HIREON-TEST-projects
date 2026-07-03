const { auth } = require('../config/firebase');
const User     = require('../models/User');

// Map: firebaseUid → socketId
const onlineRiders = new Map();

const registerSocketHandlers = (io) => {
  io.use(async (socket, next) => {
    try {
      const token   = socket.handshake.auth.token;

      // Dev mode bypass: token "dev:<phone>" — same as REST middleware
      if (process.env.NODE_ENV === 'development' && token && token.startsWith('dev:')) {
        const phone = token.slice(4);
        const user  = await User.findOne({ phone });
        if (!user) return next(new Error('User not found'));
        socket.user = user;
        return next();
      }

      const decoded = await auth().verifyIdToken(token);
      const user    = await User.findOne({ firebaseUid: decoded.uid });
      if (!user) return next(new Error('User not found'));
      socket.user = user;
      next();
    } catch {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.user;

    if (user.role === 'rider') {
      onlineRiders.set(user._id.toString(), socket.id);
    }

    // Customer starts tracking an order
    socket.on('track_order', (orderId) => {
      socket.join(orderId);
    });

    // Rider joins the order room (when they accept it)
    socket.on('join_order', (orderId) => {
      socket.join(orderId);
    });

    // Rider broadcasts location
    socket.on('rider_location', ({ orderId, lat, lng, heading }) => {
      socket.to(orderId).emit('rider_location', { lat, lng, heading });
    });

    socket.on('disconnect', () => {
      // Sirf tabhi offline karo jab YEHI socket map me ho — rider ke naye
      // connection (reconnect) ke baad purane socket ka late disconnect
      // rider ko galti se offline kar deta tha, phir order ping nahi milte.
      if (user.role === 'rider' && onlineRiders.get(user._id.toString()) === socket.id) {
        onlineRiders.delete(user._id.toString());
      }
    });
  });

  return { onlineRiders };
};

module.exports = { registerSocketHandlers, onlineRiders };
