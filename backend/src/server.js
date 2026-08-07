require('dotenv').config();
require('./config/firebase');          // initialize Firebase Admin early

const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const helmet     = require('helmet');
const cors       = require('cors');
const morgan     = require('morgan');

const connectDB  = require('./config/db');
const routes     = require('./routes/index');
const errorHandler = require('./middleware/errorHandler');
const { registerSocketHandlers } = require('./socket/handlers');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

// Register socket handlers first so onlineRiders map is available to controllers
const { onlineRiders } = registerSocketHandlers(io);

// Attach io + onlineRiders to every request so controllers can emit events to correct riders
app.use((req, _res, next) => { req.io = io; req.onlineRiders = onlineRiders; next(); });

app.use(helmet());

// Razorpay webhook signature verify raw request bytes par hoti hai — is route
// ko express.json() se PEHLE raw Buffer body do, taaki JSON parser ise consume
// (aur reshape) na kare. body-parser dono ek hi request par khud ko skip karta
// hai jab body already parsed ho.
app.use('/api/v1/payments/webhook', express.raw({ type: 'application/json' }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

app.use('/api/v1', routes);

app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found' }));
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`HIREON server running on port ${PORT} [${process.env.NODE_ENV}]`);
  });
});
