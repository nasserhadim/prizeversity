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
app.use(cors());
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

// Root Route
app.get('/', (req, res) => {
  res.redirect('http://localhost:5173'); // Redirect to the frontend
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-classroom', (classroomId) => {
    socket.join(`classroom-${classroomId}`);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Make io accessible to routes
app.set('io', io);

// Start Server
httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));