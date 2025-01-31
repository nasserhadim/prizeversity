const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const MicrosoftStrategy = require('passport-microsoft').Strategy;
const User = require('../models/User');

module.exports = (passport) => {
  // Google OAuth Strategy
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: '/api/auth/google/callback',
      },
      async (accessToken, refreshToken, profile, done) => {
        const newUser = {
          googleId: profile.id,
          email: profile.emails[0].value,
          // Remove the default role assignment
        };
        try {
          let user = await User.findOne({ googleId: profile.id });
          if (user) {
            done(null, user);
          } else {
            user = await User.create(newUser);
            done(null, user);
          }
        } catch (err) {
          done(err, null);
        }
      }
    )
  );

  // Microsoft OAuth Strategy
  passport.use(
    new MicrosoftStrategy(
      {
        clientID: process.env.MICROSOFT_CLIENT_ID,
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
        callbackURL: '/api/auth/microsoft/callback',
        scope: ['user.read'],
      },
      async (accessToken, refreshToken, profile, done) => {
        const newUser = {
          microsoftId: profile.id,
          email: profile.emails[0].value,
          // Remove the default role assignment
        };
        try {
          let user = await User.findOne({ microsoftId: profile.id });
          if (user) {
            done(null, user);
          } else {
            user = await User.create(newUser);
            done(null, user);
          }
        } catch (err) {
          done(err, null);
        }
      }
    )
  );

  // Serialize User
  passport.serializeUser((user, done) => done(null, user.id));

  // Deserialize User
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (err) {
      done(err, null);
    }
  });
};