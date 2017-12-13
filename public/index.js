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
  var captionRef = firebase.database().ref("/captions/" + transcriptKey).push({
    time: caption.time,
    endTime: caption.endTime,
    original: caption.text
  });
  /*captionRef.set({
    time: caption.time,
    endTime: caption.endTime,
    original: caption.text
  });*/


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
    //Doesn't work because we need to get the time from the caption object,
    //not the firepad one! Need to wrap this all in a promise...
    divElement.setAttribute("timestamp", snapshot.val().time);
    console.log("Adding timstamp attribute: " + snapshot.val().time);
    console.log("snapshot found: " + snapshot.hasChild("time"));
    divElement.classList.add("section");
    container.appendChild(divElement);
    divElement.appendChild(spanElement);

    var diff =  snapshot.val().endTime - player.getCurrentTime();

    if(currentID == null && diff >= 0) {
      var firepadRef = firebase.database().ref("/firepads/" + transcriptKey + "/" + snapshot.key);

      if(currentFirepad) {
        currentFirepad.dispose();
        editor.setValue("");
        editor.clearHistory();
        var cmelement = document.getElementsByClassName('CodeMirror')[0];
        var ccelement = document.getElementById("current-caption");
        ccelement.removeChild(cmelement);
        initializeCodeMirror();
      }

      currentFirepad = Firepad.fromCodeMirror(firepadRef, editor, {richTextToolbar:false, richTextShortcuts:false});
      currentID = snapshot.key;
    }

    else if(currentID != null && diff >= 0) {
      var oldDiff = documents.getElementById(currentID).getAttribute("timestamp") - player.getCurrentTime();
      if(diff <= oldDiff) {
        var firepadRef = firebase.database().ref("/firepads/" + transcriptKey + "/" + snapshot.key);
        if(currentFirepad) {
          currentFirepad.dispose();
          editor.setValue("");
          editor.clearHistory();
          var cmelement = document.getElementsByClassName('CodeMirror')[0];
          var ccelement = document.getElementById("current-caption");
          ccelement.removeChild(cmelement);
          initializeCodeMirror();
        }

        currentFirepad = Firepad.fromCodeMirror(firepadRef, editor, {richTextToolbar:false, richTextShortcuts:false});
        currentID = snapshot.key;
      }
    }

    console.log("div element added with id: " + snapshot.key);

    snapshot.ref.child("history").on("child_added", function(history) {
      var headless = Firepad.Headless(snapshot.ref);
      headless.getText(function(text) {
        spanElement.innerHTML = text;
      });
    });
  });
}

//Need to make sure elements are loaded before
function listenToPlayTime() {
  player.addHandler("currenttimechanged", function (event) {

      var container = document.getElementById("firepad-container");
      var childs = container.childNodes;
      var len = childs.length;
      var i = -1;
      var id;
      var bestDiff;

      if(++i < len) do {
          var currentChild = childs[i];
          var diff = event.currentTime - currentChild.getAttribute("timestamp");
          console.log("In loop at " + i);
          console.log("ID is currently: " + currentChild.id);
          console.log("Time stamp is: " + currentChild.getAttribute("timestamp"));
          if(bestDiff == null && diff >= 0) {
            console.log("Found new id");
            id = currentChild.id;
          }
          else {
            if (bestDiff != null && diff >= 0 && diff < bestDiff) {
              console.log("replaced id");
              bestDiff = diff;
              id = currentChild.id;
            }
          }
        } while(++i < len);

        if(id != null && currentID == null) {
          currentID = id;
          var firepadRef = firebase.database().ref("/firepads/" + transcriptKey + "/" + id);
          currentFirepad = Firepad.fromCodeMirror(firepadRef, editor, {richTextToolbar:false, richTextShortcuts:false});
        }

        if (id != null && currentID !== id) {
          var firepadRef = firebase.database().ref("/firepads/" + transcriptKey + "/" + id);

          if(currentFirepad) {
            currentFirepad.dispose();
            editor.setValue("");
            editor.clearHistory();
            var cmelement = document.getElementsByClassName('CodeMirror')[0];
            var ccelement = document.getElementById("current-caption");
            ccelement.removeChild(cmelement);
            initializeCodeMirror();
          }

          currentFirepad = Firepad.fromCodeMirror(firepadRef, editor, {richTextToolbar:false, richTextShortcuts:false});
          currentID = id;
        }

        else {
          console.log("No ID was found");
        }
      });
}

//TODO: Ensure that element has been added to DOM, if getElementByID is null, maybe
//try the next best option and whether an element is loaded in check if it is a better option?
//or add a time attribute to each dom element and search those instead??
function scrollToSection(key) {
  var firepadContainer = document.getElementById("firepad-container");
  var textBox = document.getElementById(key);

  //
  textBox = document.getElementById(key);

  console.log("Element found for scrolling: " + textBox);
  var offset = textBox.offsetTop;
  firepadContainer.scrollTop = offset;
}
