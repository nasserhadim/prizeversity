const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const MicrosoftStrategy = require('passport-microsoft').Strategy;
const User = require('../models/User');

const { callbackBase } = require('../config/domain'); // adjust path as needed

module.exports = (passport) => {
  // Google OAuth Strategy
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${callbackBase}/api/auth/google/callback`,
      },
      async (accessToken, refreshToken, profile, done) => {
        // Extract names from Google profile
        const displayName = profile.displayName || '';
        const nameParts = displayName.split(' ');
        const oauthFirstName = profile.name?.givenName || nameParts[0] || '';
        const oauthLastName = profile.name?.familyName || nameParts.slice(1).join(' ') || '';

        // Safely extract email with fallback
        const email = profile.emails?.[0]?.value || '';
        
        if (!email) {
          return done(new Error('No email found in Google profile'), null);
        }

        const newUser = {
          googleId: profile.id,
          email: email,
          profileImage: profile.photos?.[0]?.value,
          oauthFirstName,
          oauthLastName,
          // Do not set a default role
        };
        try {
          let user = await User.findOne({ googleId: profile.id });
          if (user) {
            // Update profile image and OAuth names if they're changed
            if (profile.photos?.[0]?.value && user.profileImage !== profile.photos[0].value) {
              user.profileImage = profile.photos[0].value;
            }
            if (!user.firstName && oauthFirstName) user.oauthFirstName = oauthFirstName;
            if (!user.lastName && oauthLastName) user.oauthLastName = oauthLastName;
            await user.save();
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
        callbackURL: `${callbackBase}/api/auth/microsoft/callback`,
        scope: ['user.read'],
      },
      async (accessToken, refreshToken, profile, done) => {
        // Extract names from Microsoft profile
        const displayName = profile.displayName || '';
        const nameParts = displayName.split(' ');
        const oauthFirstName = profile.name?.givenName || nameParts[0] || '';
        const oauthLastName = profile.name?.familyName || nameParts.slice(1).join(' ') || '';

        // Safely extract email with fallback
        const email = profile.emails?.[0]?.value || profile.mail || profile.userPrincipalName || '';
        
        if (!email) {
          return done(new Error('No email found in Microsoft profile'), null);
        }

        const newUser = {
          microsoftId: profile.id,
          email: email,
          profileImage: profile.photos?.[0]?.value,
          oauthFirstName,
          oauthLastName,
          // Do not set a default role
        };
        try {
          let user = await User.findOne({ microsoftId: profile.id });
          if (user) {
            // Update profile image and OAuth names if changed
            if (profile.photos?.[0]?.value && user.profileImage !== profile.photos[0].value) {
              user.profileImage = profile.photos[0].value;
            }
            if (!user.firstName && oauthFirstName) user.oauthFirstName = oauthFirstName;
            if (!user.lastName && oauthLastName) user.oauthLastName = oauthLastName;
            await user.save();
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