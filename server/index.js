import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import session from 'express-session';
import morgan from 'morgan';
import passport from 'passport';
import { globalErrorHandler } from './controllers/errorController.js';
import './config/db.js'; // Connect to Mongo
import './config/passport.js'; // Passport strategies

import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import classroomRoutes from './routes/classroomRoutes.js';
import bazaarRoutes from './routes/bazaarRoutes.js';
import groupRoutes from './routes/groupRoutes.js';
import walletRoutes from './routes/walletRoutes.js';

dotenv.config();

const app = express();
app.use(morgan('dev'));
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json());

// Session for Passport
app.use(session({
  secret: process.env.SESSION_SECRET || 'secret',
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/classrooms', classroomRoutes);
app.use('/api/bazaars', bazaarRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/wallets', walletRoutes);

// Test route
app.get('/', (req, res) => {
  res.send('Prizeversity API up and running!');
});

// Global Error Handler
app.use(globalErrorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}...`);
});
