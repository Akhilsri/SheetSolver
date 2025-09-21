const admin = require('firebase-admin');

// You need to point this to the file you just downloaded
const serviceAccount = require('../../firebase-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

console.log('Firebase Admin SDK initialized.');

module.exports = admin;