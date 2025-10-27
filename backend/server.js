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
const bazaarTemplatesRoutes = require('./routes/bazaarTemplate');
const walletRoutes = require('./routes/wallet');
const groupRoutes = require('./routes/group');
const siphonRouter = require('./routes/siphon');
const notificationsRoutes = require('./routes/notifications');
const feedbackRoutes = require('./routes/feedback'); // Importing Feedback model for classroom feedback
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
const challengeRoutes = require('./routes/challenge');
const challengeTemplateRoutes = require('./routes/challengeTemplate');
const challengeVerifyRoutes = require('./routes/challengeVerify');
const { redirectBase, isProd } = require('./config/domain');
const { cleanTrash } = require('./utils/cleanupTrash');
// require('./utils/siphonCleanup'); // Add this line

const app = express();
const PORT = process.env.PORT || 5000;
const httpServer = createServer(app);

console.log("✅ Socket.IO CORS origin set to:", redirectBase);
// Initialize Socket.IO with CORS settings
// This allows the frontend to connect to the Socket.IO server from the specified origin

const { setIO } = require('./utils/io'); // <-- new import
//const { default: apiBazaarTemplate } = require('../frontend/src/API/apiBazaarTemplate.js');

const io = new Server(httpServer, {
  cors: {
    origin: redirectBase,
    methods: ["GET", "POST"]
  }
});

// register io for other modules
setIO(io);

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

    // Start siphon janitor now that mongoose is connected
    try {
      const siphonCleanup = require('./utils/siphonCleanup');
      siphonCleanup.startJanitorOnce && siphonCleanup.startJanitorOnce();
    } catch (e) {
      console.error('Failed to start siphonCleanup after DB connect:', e);
    }
  })
  .catch(err => console.log(err));

// Schedule uploads/trash cleanup
const TRASH_RETENTION_DAYS = Number(process.env.TRASH_RETENTION_DAYS || 30); // delete files older than X days
const TRASH_CLEAN_INTERVAL_HOURS = Number(process.env.TRASH_CLEAN_INTERVAL_HOURS || 24); // run every N hours

const uploadsDir = path.join(__dirname, 'uploads');
const trashDir = path.join(uploadsDir, 'trash');

(async () => {
  try {
    // Run once at startup (don't block server startup for long)
    cleanTrash({ trashDir, maxAgeDays: TRASH_RETENTION_DAYS })
      .then(result => {
        console.log(`uploads/trash cleanup at startup: deleted=${result.deleted.length}, errors=${result.errors.length}`);
      })
      .catch(err => {
        console.error('uploads/trash cleanup (startup) failed:', err);
      });

    // Schedule recurring cleanup
    const intervalMs = Math.max(1, TRASH_CLEAN_INTERVAL_HOURS) * 60 * 60 * 1000;
    setInterval(() => {
      cleanTrash({ trashDir, maxAgeDays: TRASH_RETENTION_DAYS })
        .then(result => {
          if (result.deleted.length || result.errors.length) {
            console.log(`uploads/trash cleanup: deleted=${result.deleted.length}, errors=${result.errors.length}`);
          } else {
            console.log('uploads/trash cleanup: nothing to delete');
          }
        })
        .catch(err => {
          console.error('uploads/trash cleanup failed:', err);
        });
    }, intervalMs);
  } catch (err) {
    console.error('Failed to schedule uploads/trash cleanup:', err);
  }
})();

// start siphon expiry janitor and ensure TTL/indexes
try {
  // load the cleanup (this runs the setInterval inside the module)
  require('./utils/siphonCleanup');
} catch (e) {
  console.error('Failed to start siphonCleanup:', e);
}

// ensure SiphonRequest indexes (TTL) are created after mongoose opens
// (use the mongoose already required at top of file)
mongoose.connection.once('open', async () => {
  try {
    const SiphonRequest = require('./models/SiphonRequest');
    await SiphonRequest.init();
    console.log('SiphonRequest indexes ensured');
  } catch (err) {
    console.error('Failed to initialize SiphonRequest indexes:', err);
  }
});

// Routes

app.use('/api/siphon', siphonRouter);
app.use('/api/auth', authRoutes);
app.use('/api/classroom', classroomRoutes);
app.use('/api/classroom/:id/newsfeed', newsfeedRoutes);
app.use('/api/bazaar', bazaarRoutes);
app.use('/api/bazaarTemplate', bazaarTemplatesRoutes);
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
app.use('/api/feedback', feedbackRoutes); // Use the Feedback model for classroom feedback
app.use('/api/pending-assignments', require('./routes/pendingAssignments'));
app.use('/api/challenges', challengeRoutes);
app.use('/api/challenge-templates', challengeTemplateRoutes);
app.use('/api', challengeVerifyRoutes);

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

      // NEW: classroom join
  socket.on('join-classroom', (classId) => {
    socket.join(`classroom-${classId}`);
    console.log(`Socket joined classroom room: classroom-${classId}`);
  });

  // Optional: leave classroom
  socket.on('leave-classroom', (classId) => {
    socket.leave(`classroom-${classId}`);
    console.log(`Socket left classroom room: classroom-${classId}`);
  });


  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Make io accessible to routes (optional / keep for compatibility)
app.set('io', io);

// Start Server
httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = { app, io };