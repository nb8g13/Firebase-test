
// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
// exports.helloWorld = functions.https.onRequest((request, response) => {
//  response.send("Hello from Firebase!");
// });

const functions  = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp(functions.config().firebase);

exports.updateCounter = functions.database.ref('/transcripts/{transcriptKey}/users/{userID}').onWrite(event => {
  const transcriptKey = event.params.transcriptKey;

  if(!event.data.val()) {
    admin.database().ref('/transcripts/' + transcriptKey + '/counter').transaction(function(count) {
      count = count - 1;
      return count;
    });
  }

  else {
    admin.database().ref('/transcripts/' + transcriptKey + '/counter').transaction(function(count) {
      count = count + 1;
      return count;
    });
  }
});
