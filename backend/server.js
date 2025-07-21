require('dotenv').config(); // Load environment variables from .env file; MUST BE FIRST LINE otherwise redirectBase won't be identified!!

const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const passport = require('passport');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const cors = require('cors');
const { createServer } = require('http');
const { Server } = require('socket.io');
const authRoutes = require('./routes/auth');
const classroomRoutes = require('./routes/classroom');
const bazaarRoutes = require('./routes/bazaar');
const walletRoutes = require('./routes/wallet');
const groupRoutes = require('./routes/group');
const siphonRouter = require('./routes/siphon');
const notificationsRoutes = require('./routes/notifications');
// Importing admin route
const adminRoutes = require('./routes/admin');
const usersRoutes = require('./routes/users');
const profileRoutes = require('./routes/profile');
const leaderboardRoutes = require('./routes/leaderboard');
const newsfeedRoutes = require('./routes/newsfeed');
const itemRoutes = require('./routes/items');
const groupBalanceRoutes = require('./routes/groupBalance');
const statsRouter = require('./routes/stats.js');
const attackItems = require('./routes/attackItem.js');
const defendItems = require('./routes/defendItem.js');
const utilityItems = require('./routes/utilityItem.js');
const passiveItems = require('./routes/passiveItem.js');
const { redirectBase, isProd } = require('./config/domain');

const app = express();
const PORT = process.env.PORT || 5000;
const httpServer = createServer(app);

console.log("✅ Socket.IO CORS origin set to:", redirectBase);
// Initialize Socket.IO with CORS settings
// This allows the frontend to connect to the Socket.IO server from the specified origin

const io = new Server(httpServer, {
  cors: {
    origin: redirectBase,
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors({
  origin: redirectBase,
  credentials: true,
}));

console.log("✅ CORS origin set to:", redirectBase);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Session Middleware
app.use(
  session({
    secret: process.env.JWT_SECRET, // Use a strong secret key
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
    cookie: { secure: false }, // Set to true if using HTTPS
  })
);

// Passport Initialization
require('./config/passport')(passport);
app.use(passport.initialize());
app.use(passport.session());

// Database Connection
mongoose.connect(process.env.MONGO_URI, {})
  .then(() => {
    console.log('MongoDB Connected');

    mongoose.connection.db.collection('classrooms').indexes().then(indexes => {
      const hasGlobalCodeIndex = indexes.some(idx => idx.name === 'code_1');
      if (hasGlobalCodeIndex) {
        mongoose.connection.db.collection('classrooms').dropIndex('code_1')
          .then(() => console.log('✅ Dropped old code_1 index'))
          .catch(err => console.error('❌ Failed to drop code_1 index:', err.message));
      }
    }).catch(err => {
      console.error('❌ Error checking indexes:', err.message);
    });

  })
  .catch(err => console.log(err));

// Routes

app.use('/api/siphon', siphonRouter);
app.use('/api/auth', authRoutes);
app.use('/api/classroom', classroomRoutes);
app.use('/api/classroom/:id/newsfeed', newsfeedRoutes);
app.use('/api/bazaar', bazaarRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/group', groupRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
// app.use('/api/items', itemRoutes);
app.use('/api/stats', statsRouter);
app.use('/api', groupBalanceRoutes);
app.use('/api/pending-assignments', require('./routes/pendingAssignments'));

app.use('/api/attack', attackItems);
app.use('/api/defend', defendItems);
app.use('/api/utility', utilityItems);
app.use('/api/passive', passiveItems);
// Root Route
app.get('/', (req, res) => {
  res.redirect(redirectBase);
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('New client connected');

  socket.on('join', async (room) => {
    // Remove existing socket from all rooms before joining new one
    const rooms = [...socket.rooms];
    rooms.forEach(r => {
      if (r !== socket.id) {
        socket.leave(r);
      }
    });

    socket.join(room);

    // Extract user ID from room name (removes 'user-' prefix)
    if (room.startsWith('user-')) {
      const userId = room.replace('user-', '');
      try {
        const User = require('./models/User');
        const user = await User.findById(userId);
        console.log(`Socket joined room: ${room} (${user ? user.email : 'unknown user'})`);
      } catch (err) {
        console.log(`Error fetching user details for ${room}:`, err.message);
      }
    } else {
      console.log(`Socket joined room: ${room}`);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Make io accessible to routes
app.set('io', io);

// Start Server
httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = { app, io };