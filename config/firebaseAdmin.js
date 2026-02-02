// Firebase Admin SDK initialization
const admin = require('firebase-admin');

// Initialize Firebase Admin
// For production: Use service account JSON file
// For development: Can use environment variables
let firebaseAdmin = null;

try {
  // Method 1: Using service account file (recommended for production)
  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    const serviceAccount = require(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
    firebaseAdmin = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }
  // Method 2: Using environment variables
  else if (process.env.FIREBASE_PROJECT_ID) {
    firebaseAdmin = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
      })
    });
  }
  // Method 3: Default credentials (for Google Cloud environments)
  else {
    firebaseAdmin = admin.initializeApp({
      credential: admin.credential.applicationDefault()
    });
  }
  
  console.log('Firebase Admin initialized successfully');
} catch (error) {
  console.warn('Firebase Admin initialization warning:', error.message);
  console.warn('Firebase authentication will not work until properly configured');
}

// Export auth and admin instance
const auth = firebaseAdmin ? admin.auth() : null;

module.exports = { admin, auth, firebaseAdmin };
