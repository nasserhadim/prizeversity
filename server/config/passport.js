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

async function findOrCreateUser(profile) {
  // Example:
  let user = await User.findOne({ provider: 'microsoft', providerId: profile.oid });
  if (!user) {
    user = await User.create({
      name: profile.displayName || 'MS User',
      email: profile._json.preferred_username,
      provider: 'microsoft',
      providerId: profile.oid
    });
  }
  return user;
}

// Microsoft OAuth
passport.use('azure_ad_openidconnect', new MicrosoftStrategy({
  // identityMetadata: 'https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration', // 'common' endpoint  for Multi-Tenant login, e.g. Organizational/Work/School/Personal Accounts; Requires Publisher verification; see .env for more info.
  identityMetadata: 'https://login.microsoftonline.com/consumers/v2.0/.well-known/openid-configuration', // 'consumers' endpoint for personal accounts (like @outlook, @hotmail)
  clientID: process.env.MICROSOFT_CLIENT_ID,
  clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
  redirectUrl: `${process.env.BASE_URL}/api/auth/microsoft/callback`,
  allowHttpForRedirectUrl: true,

  responseType: 'code',
  responseMode: 'form_post',
  scope: ['openid','profile','email'],

  // This is critical for multi-tenant usage with /common:
  validateIssuer: false,

  // optional debugging
  loggingLevel: 'info',

}, async (iss, sub, profile, accessToken, refreshToken, done) => {
  try {
    const user = await findOrCreateUser(profile);
    done(null, user);
  } catch (err) {
    done(err);
  }
}));

