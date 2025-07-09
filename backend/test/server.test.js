const express = require('express');
const bazaarRoutes = require('../routes/bazaar');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');

// Initialize Express app
const app = express();
app.use(bodyParser.json());
app.use(session({ secret: 'testsecret', resave: false, saveUninitialized: true }));
app.use(passport.initialize());
app.use(passport.session());

// Mock authentication middleware
const mockAuth = (req, res, next) => {
  req.user = { 
    _id: new mongoose.Types.ObjectId(), 
    role: 'teacher', 
    balance: 1000 
  };
  next();
};

// Mock ensureTeacher middleware
const mockEnsureTeacher = (req, res, next) => {
  if (req.user.role !== 'teacher') {
    return res.status(403).json({ error: 'Only teachers can perform this action' });
  }
  next();
};

// Apply mock middlewares
app.use((req, res, next) => mockAuth(req, res, next));
app.use('/api', bazaarRoutes);

// Add a simple test to satisfy Jest
describe('Test Server', () => {
  it('should be defined', () => {
    expect(app).toBeDefined();
  });
});

module.exports = app;