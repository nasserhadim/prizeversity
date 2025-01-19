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

  // Use "redirectUrl" instead of "callbackURL"
  redirectUrl: `${process.env.BASE_URL}/api/auth/microsoft/callback`,

  // Because you're on localhost (HTTP), this allows it
  allowHttpForRedirectUrl: true,

  // Must specify one of: 'code', 'id_token', 'code id_token', 'id_token code'
  responseType: 'code',
  responseMode: 'form_post',
  scope: ['openid', 'profile', 'email']

}, async (iss, sub, profile, accessToken, refreshToken, done) => {
  try {
    const user = await findOrCreateUser(profile);
    done(null, user);
  } catch (err) {
    done(err);
  }
}));

