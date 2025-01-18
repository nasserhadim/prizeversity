import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { OIDCStrategy as MicrosoftStrategy } from 'passport-azure-ad';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

// Serialize / Deserialize
passport.serializeUser((user, done) => {
  done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

// Google OAuth
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: `${process.env.BASE_URL}/api/auth/google/callback`
},
async (accessToken, refreshToken, profile, done) => {
  try {
    let existingUser = await User.findOne({ provider: 'google', providerId: profile.id });
    if (!existingUser) {
      existingUser = await User.create({
        name: profile.displayName,
        email: profile.emails[0].value,
        provider: 'google',
        providerId: profile.id
      });
    }
    return done(null, existingUser);
  } catch (err) {
    return done(err, null);
  }
}));

// Microsoft OAuth
passport.use(new MicrosoftStrategy({
  identityMetadata: 'https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration',
  clientID: process.env.MICROSOFT_CLIENT_ID,
  clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
  callbackURL: `${process.env.BASE_URL}/api/auth/microsoft/callback`,
  scope: ['profile', 'email']
},
async (iss, sub, profile, accessToken, refreshToken, done) => {
  try {
    // For MS Azure, profile.oid is typically the unique ID
    let existingUser = await User.findOne({ provider: 'microsoft', providerId: profile.oid });
    if (!existingUser) {
      existingUser = await User.create({
        name: profile.displayName || 'No Name',
        email: profile._json.preferred_username, 
        provider: 'microsoft',
        providerId: profile.oid
      });
    }
    return done(null, existingUser);
  } catch (err) {
    return done(err, null);
  }
}));
