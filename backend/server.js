const express = require('express');
const mongoose = require('mongoose');
const passport = require('passport');
const session = require('express-session');
const cors = require('cors');
const { createServer } = require('http');
const { Server } = require('socket.io');
const authRoutes = require('./routes/auth');
const classroomRoutes = require('./routes/classroom');
const bazaarRoutes = require('./routes/bazaar');
const walletRoutes = require('./routes/wallet');
const groupRoutes = require('./routes/group');
const notificationsRoutes = require('./routes/notifications');
// Importing admin route
const adminRoutes = require('./routes/admin'); 
const usersRoutes =  require('./routes/users');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors({
  origin: 'http://localhost5173',
  credentials: true,
}));
app.use(express.json());

// Session Middleware
app.use(
  session({
    secret: process.env.JWT_SECRET, // Use a strong secret key
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }, // Set to true if using HTTPS
  })
);

// Passport Initialization
require('./config/passport')(passport);
app.use(passport.initialize());
app.use(passport.session());

// Database Connection
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.log(err));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/classroom', classroomRoutes);
app.use('/api/bazaar', bazaarRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/group', groupRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', usersRoutes);

// Root Route
app.get('/', (req, res) => {
  res.redirect('http://localhost:5173'); // Redirect to the frontend
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