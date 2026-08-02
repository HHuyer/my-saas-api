/**
 * Passport Configuration
 * Sets up Google OAuth strategy or dummy strategy for testing
 */

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github').Strategy;
const { logger } = require('./utils/logger');

// Only configure Google OAuth if credentials are provided
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback'
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // In a real app, you would check if the user exists in your database
          // or create a new user. For now, we'll create a user with basic info.
          const user = {
            id: profile.id,
            email: profile.emails[0].value,
            name: profile.displayName,
            avatar: profile.photos[0]?.value || null
          };

          logger.info(`User authenticated via Google: ${user.email}`);
          done(null, user);
        } catch (error) {
          logger.error('Error in Google OAuth callback:', error);
          done(error, null);
        }
      }
    )
  );
} else {
  // Use dummy strategy for testing when OAuth is not configured
  logger.info('Using dummy authentication for testing mode');
  passport.use('dummy', new (require('passport-strategy').Strategy)(
    function (req, cb) {
      const dummyUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User'
      };
      cb(null, dummyUser);
    }
  ));
}

// Only configure GitHub OAuth if credentials are provided
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  passport.use(
    new GitHubStrategy(
      {
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: process.env.GITHUB_CALLBACK_URL || 'http://localhost:3000/api/auth/github/callback'
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Some GitHub accounts have no public email - fall back to username
          const user = {
            id: profile.id,
            email: profile.emails?.[0]?.value || `${profile.username}@github`,
            name: profile.displayName || profile.username,
            avatar: profile.photos?.[0]?.value || null
          };

          logger.info(`User authenticated via GitHub: ${user.email}`);
          done(null, user);
        } catch (error) {
          logger.error('Error in GitHub OAuth callback:', error);
          done(error, null);
        }
      }
    )
  );
}

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user);
});

// Deserialize user from session
passport.deserializeUser((user, done) => {
  done(null, user);
});

module.exports = passport;
