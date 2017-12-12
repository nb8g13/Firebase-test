var url = "https://sofo.mediasite.com/Mediasite/Play/d64d7806bcc14f95a3c57633bcfd30c31d";
var player;
var controls;
var transcriptKey;
var editor;
var currentFirepad;
var currentID;


function startFirebase() {
  var config = {
    apiKey: "AIzaSyC_PcyEemJampMIHiefh94vw9eMpoaYDGI",
    authDomain: "test-project-96190.firebaseapp.com",
    databaseURL: "https://test-project-96190.firebaseio.com",
    projectId: "test-project-96190",
    storageBucket: "test-project-96190.appspot.com",
    messagingSenderId: "807025189838"
  };

  firebase.initializeApp(config);

  var uiConfig = {
    signInSuccessUrl: '/',
    signInOptions: [
      firebase.auth.GoogleAuthProvider.PROVIDER_ID,
    ],
    tosUrl: 'google.com'
  };

  //change callback here
  var ui = new firebaseui.auth.AuthUI(firebase.auth());
  ui.start('#auth-container', uiConfig);
  initializeCodeMirror();
  getPlayerReference(startDatabase);
}

function initializeCodeMirror() {
  editor = CodeMirror(document.getElementById("current-caption"), {linewrapping: true});
}

function getPlayerReference(callback) {
  player = new Mediasite.Player( "player",
    {
      url: url + (url.indexOf("?") == -1 ? "?" : "&") + "player=MediasiteIntegration",
      events: {
                    "ready":   callback
              }
    });

  controls = new Mediasite.PlayerControls(player, "controls",
    {
      imageSprite: "url(MediasitePlayerControls.png)"
    });
}

function startDatabase() {
  var hash = window.location.hash.replace(/#/g, '');

  if(hash) {
    var ref = firebase.database().ref("/captions/");
    checkExistence(dataRef.child(hash)).then(function(exists) {
      if (exists) {
        transcriptKey = hash;
        loadTranscript();
      }

      else {
        transcriptKey = ref.push().key;
        window.location = window.location + '#' + transcriptKey;
        initializeTranscript();
      }
    });
  }

  else {
    transcriptKey = firebase.database().ref("/captions/").push().key;
    window.location = window.location + '#' + transcriptKey;
    initializeTranscript();
  }
}

//Returns a promise to check the existence of a given transcript
function checkExistence(dataRef) {
  return dataRef.once('value').then(function(snapshot) {
    return (snapshot.val() !== null);
  });
}

function initializeTranscript() {
  var captions = player.getCaptions();
  captions = captions.slice(0,5);

  for(var i = 0; i < captions.length; i++) {
    var caption = captions[i];
    createCaption(caption);
  }

  loadTranscript();
}

function loadTranscript() {
  listenForCaptions();
  listenForFirepads();
  listenToPlayTime();
}

function createCaption(caption) {
  var captionRef = firebase.database().ref("/captions/" + transcriptKey).push();
  captionRef.set({
    time: caption.time,
    endTime: caption.endTime,
    original: caption.text
  });


  /*var padRef = firebase.database().ref("/firepads/" + transcriptKey + "/" + captionRef.key);
  var headless = Firebase.Headless(padRef);
  headless.setText(caption.text);*/
}

//Need to initialize caption text
function listenForCaptions() {
  var transcriptRef = firebase.database().ref("/captions/"+ transcriptKey);
  transcriptRef.on("child_added", function(snapshot) {
    var firepadRef = firebase.database().ref(
      "/firepads/"+ transcriptKey + "/" + snapshot.key);
    var headless = Firepad.Headless(firepadRef);
    headless.setText(snapshot.val().original);
    headless.dispose();
  });
}

function listenForFirepads() {
  var transcriptRef = firebase.database().ref("/firepads/" + transcriptKey);
  transcriptRef.on("child_added", function(snapshot) {
    var container = document.getElementById("firepad-container");
    var divElement = document.createElement('div');
    var spanElement = document.createElement('span');
    divElement.id = snapshot.key;
    divElement.classList.add("section");
    container.appendChild(divElement);
    divElement.appendChild(spanElement);
    console.log("div element added with id: " + snapshot.key);

    snapshot.ref.child("history").on("child_added", function(history) {
      var headless = Firepad.Headless(snapshot.ref);
      headless.getText(function(text) {
        spanElement.innerHTML = text;
      });
    });
  });


  /*
  //Need to move this to only check history!!
  transcriptRef.on("child_changed", function(snapshot) {
    var divElement = document.getElementById(snapshot.key);
    var spanElement = divElement.firstChild;
    var headless = Firebase.Headless(snapshot.ref);
    spanElement.innerHTML = headless.getText();
  });*/
}

//Need to make sure elements are loaded before
function listenToPlayTime() {
  player.addHandler("currenttimechanged", function (event) {
      var ref = firebase.database().ref("/captions/" + transcriptKey);
      //May need to store this promise somewhere to then() off it, but I hope not...
      ref.orderByChild("endTime").endAt(event.currentTime).limitToLast(1).once("value").then(function (snapshot) {
        var id;
        for(key in snapshot.val()) {
          id = key;
        }
        console.log("Key: " + id);
        if(id != null && currentID !== id) {
          scrollToSection(id);
          if(currentFirepad) {
            currentFirepad.dispose();
            editor.setValue("");
            editor.clearHistory();
          }
          currentID = id;
          currentFirepad = Firepad.fromCodeMirror(snapshot.ref.child(id), editor, {richTextToolbar:false, richTextShortcuts:false});
        }

        else {
          console.log("No ID was found");
          console.log(snapshot.val());
        }
      });
  });
}

//TODO: Ensure that element has been added to DOM, either need to keep track of
//loaded elements somehow in firebase (seems like a pain) 
function scrollToSection(key) {
  var firepadContainer = document.getElementById("firepad-container");
  var textBox = document.getElementById(key);

  //Wait for element to be appended
  //Will cause issues if the div element is deleted in the meantime,
  //Need a better fix...
  textBox = document.getElementById(key);

  console.log("Element found for scrolling: " + textBox);
  var offset = textBox.offsetTop;
  firepadContainer.scrollTop = offset;
}
