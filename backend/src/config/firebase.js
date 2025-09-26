const admin = require('firebase-admin');

// Load service account from environment variable
const firebaseServiceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;

if (!firebaseServiceAccountBase64) {
  console.error("FIREBASE_SERVICE_ACCOUNT_BASE64 environment variable is not set.");
  process.exit(1); // Exit if critical config is missing
}

let serviceAccount;
try {
  const decodedServiceAccount = Buffer.from(firebaseServiceAccountBase64, 'base64').toString('utf8');
  serviceAccount = JSON.parse(decodedServiceAccount);
} catch (error) {
  console.error("Failed to parse Firebase service account JSON from environment variable:", error);
  process.exit(1); // Exit if parsing fails
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

module.exports = admin;