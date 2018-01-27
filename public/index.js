angular.module('app').controller("MainController", function($scope, $rootScope, $location) {


  $scope.$on('$viewContentLoaded', function() {
      console.log("starting firebase");
      startFirebase();
  });

var url = "https://sofo.mediasite.com/Mediasite/Play/d64d7806bcc14f95a3c57633bcfd30c31d";
var player;
var controls;
var transcriptKey;
var editor;
var currentFirepad;
var currentID;
var playKeyDown = false;
var playing = false;
var noUsers;
var scheduledStop = false;
var scheduledTime;
var startBarrier;
var stopMade = false;
var stopTime;

// Needs to be set to true as event triggers when the player first loads
// Could be more lightweight maybe?
function updatePlayingState(eventData) {
    console.log("PLAY STATE CHANGED");
    state = eventData.playState;
    if (state == "playing") {
      console.log("Changed to playing");
      playing = true;
      stopMade = false;
    }
    else {
      console.log("Changed to paused");
      playing = false;
    }
}

function startFirebase() {
  var config = {
    apiKey: "AIzaSyC_PcyEemJampMIHiefh94vw9eMpoaYDGI",
    authDomain: "test-project-96190.firebaseapp.com",
    databaseURL: "https://test-project-96190.firebaseio.com",
    projectId: "test-project-96190",
    storageBucket: "test-project-96190.appspot.com",
    messagingSenderId: "807025189838"
  };

  try {
      firebase.initializeApp(config);
    } catch (err) {
      // we skip the "already exists" message which is
      // not an actual error when we're hot-reloading
      if (!/already exists/.test(err.message)) {
        console.error('Firebase initialization error', err.stack)
      }
    }
  var uiConfig = {
    signInSuccessUrl: '/',
    signInOptions: [
      firebase.auth.GoogleAuthProvider.PROVIDER_ID,
    ],
    tosUrl: 'google.com'
  };

  //change callback here
  //var ui = new firebaseui.auth.AuthUI(firebase.auth());
  //ui.start('#auth-container', uiConfig);
  //ui.delete(); //delete ui or it will cause an error
  //initializeCodeMirror();
  getPlayerReference(startDatabase);
}

function initializeCodeMirror() {
  editor = CodeMirror(document.getElementById("current-caption"), {linewrapping: true});
}

function getPlayerReference(callback) {
  console.log("Getting player reference");
  player = new Mediasite.Player( "player",
    {
      url: url + (url.indexOf("?") == -1 ? "?" : "&") + "player=MediasiteIntegration",
      events: {
                    "ready":   callback,
                    "playstatechanged": function(e) {updatePlayingState(e);}
              }
      }
  );

  controls = new Mediasite.PlayerControls(player, "controls",
    {
      imageSprite: "url(MediasitePlayerControls.png)"
    });
}

function startDatabase() {
  var hash = window.location.hash.replace(/#/g, '');
  console.log("hash: " + hash);
  //angular router has hash in url  already so add this check instaed
  if(hash !== "/") {
    var ref = firebase.database().ref("/captions/");
    checkExistence(ref.child(hash.replace(/\//g, ""))).then(function(exists) {
      if (exists) {
        transcriptKey = hash.replace(/\//g, "");
        loadScript();
      }

      else {
        conole.log("in first else");
        transcriptKey = ref.push().key;
        window.location.hash = window.location.hash + '#' + transcriptKey;
        //console.log("new window location: " + window.location.split('#')[0] + '#' + transcriptKey);
        initTranscript();
      }
    });
  }

  else {
    transcriptKey = firebase.database().ref("/captions/").push().key;
    window.location.hash = window.location.hash + "#" + transcriptKey;
    //console.log("hash is: " + window.location.hash);
    //history.replaceState(undefined, undefined, '#' + transcriptKey);
    //console.log("hash is " + window.location.hash);
    initTranscript();
  }
}

//Returns a promise to check the existence of a given transcript
function checkExistence(dataRef) {
  return dataRef.once('value').then(function(snapshot) {
    return (snapshot.val() !== null);
  });
}


function scrollToSection(key) {
  //var firepadContainer = document.getElementById("firepad-container");
  //var textBox = document.getElementById(key);
  //console.log("scrolling");
  //textBox = document.getElementById(key);
  //console.log("Caption key we are looking for: " + key);
  //console.log("Element found for scrolling: " + textBox);
  //var offset = textBox.offsetTop;
  //firepadContainer.scrollTop = offset;

  $('#firepad-container').scrollTop(
    $('#'+key).offset().top - $('#firepad-container').offset().top + $('#firepad-container').scrollTop()
  );
}

function initTranscript() {
  console.log("init transcript called");
  //Returns a promise
  var createCaption = function(caption) {
    //console.log("in creating caption");
    var ref = firebase.database().ref("/captions/" + transcriptKey).push()

    return ref.set(
      {
        time: caption.time,
        endTime: caption.endTime,
        original: caption.text
      }
    ).then(function() {
      return {
        original: caption.text,
        captionKey: ref.key,
        time: caption.time
      }
    });
  };

  var addFireRef = function(values) {
    //console.log("Adding firepad reference");
    var ref = firebase.database().ref("/firepads/" + transcriptKey + "/" + values.captionKey);
    var headless = Firepad.Headless(ref);
    headless.setText(values.original, function(err, committed) {
      headless.dispose();
      //makeElements(values);
    });
  };

  var promiseArr = [];
  var captions = player.getCaptions();
  captions = captions.slice(1);

  for(var i = 0; i < captions.length; i++) {
    var caption = captions[i];
    var promise = createCaption(caption).then(addFireRef);

    //console.log("Not Pushing promise")
    promiseArr.push(promise);
  }

  Promise.all(promiseArr)
  .then(setUpCounter)
}

function loadScript() {
  console.log("Load script called");
  firebase.database().ref("/captions/" + transcriptKey).once("value")
    .then(function (snapshot) {
      return snapshot.val();
    })
    .then(function(transcript) {
      for (caption in transcript) {
        var current = transcript[caption];
        var ctime = current.time;
        makeElements({
          captionKey: caption,
          time: ctime
        });
      }
    })
    .then(timeChangedListener)
    .then(addTranscriptUser)
    .then(addTranscriptListener)
    .then(addDocumentListeners);
}

function makeElements(values) {
  //console.log("making element");
  var container = $("#firepad-container");
  var sectionElement = createSectionElement(values);
  container.append(sectionElement);
}

function timeChangedListener() {
  player.addHandler("currenttimechanged", function(event) {
    //console.log("time changed event");

    // SHIFT + BACKSPACE LOGIC
    epsilon = 0.5;
    if (scheduledStop) {
      //console.log("A stop is scheduled");
      if (event.currentTime >= scheduledTime && event.currentTime <= scheduledTime + epsilon) {
        //console.log("Stop triggered");
        scheduledStop = false;
        stopMade = true;
        //setPlayerTime(scheduledTime);
        if (playing) {
          togglePlayPause();
          console.log("has playing updated?");
          console.log(playing);
          console.log("has play state updated?");
          console.log(player.getPlayState());
        }

        stopTime = getPlayerTime();

        console.log("Stopped at: ");
        console.log(stopTime);

        console.log("Pausing test...");
        console.log(getPlayerTime());
        console.log(getPlayerTime());
      }

      //The user has moved outside the caption time slot before the scheduled stop time
      else if(event.currentTime > scheduledTime + epsilon) {
        scheduledStop = false;
      }

      else if(event.currentTime < startBarrier) {
        scheduledStop = false;
      }
    }

    //If the player time has moved since the last stop then unlock the firepad caption box
    if (stopTime + epsilon < getPlayerTime() && stopMade) {
      stopMade = false;
      console.log("Undoing stop at: ");
      console.log(getPlayerTime());
    }

    else if(stopTime > getPlayerTime() && stopMade) {
      stopMade = false;
      console.log("Undoing stop at: ");
      console.log(getPlayerTime());
    }

    if (!stopMade) {
      var id;
      firebase.database().ref("/captions/" + transcriptKey).orderByChild("time").endAt(event.currentTime).limitToLast(1).once("value")
        .then(function(snapshot) {
          for (keys in snapshot.val()) {
            id = keys;
          }
          if(id != null && id != currentID) {
            var firepadRef = firebase.database().ref("/firepads/" + transcriptKey + "/" + id);

            if(currentFirepad) {
              currentFirepad.dispose();
              editor.setValue("");
              editor.clearHistory();
              var cmelement = document.getElementsByClassName('CodeMirror')[0];
              var ccelement = document.getElementById("current-caption");
              ccelement.removeChild(cmelement);
            }

            initializeCodeMirror();
            currentFirepad = Firepad.fromCodeMirror(firepadRef, editor, {richTextToolbar:false, richTextShortcuts:false});
            //poweredBy = document.getElementsByClassName('powered-by-firepad')
            //poweredBy[0].style.display = 'none';
            currentID = id;
            scrollToSection(id);
          }
        });
    }
  });
}

//Not used as can't pass transcript to onDisconnect
function incrementUserCount(number) {
  var ref = firebase.database().ref("/transcripts/" + transcriptKey + "/counter");
  ref.transaction(function(count) {
    count = count + number;
    return count;
  });
}

function setUpCounter() {
  return firebase.database().ref("/transcripts/" + transcriptKey + "/counter").set(0);
}

function addTranscriptUser() {
  //console.log("Adding transcript user");

  var ref = firebase.database().ref("/transcripts/" + transcriptKey + "/users").push();
  ref.onDisconnect().remove();
  ref.set({
    id: "placeholder"
  });


  //Local test
  //var testDummy = firebase.database().ref("/transcripts/" + transcriptKey + "/dummy").set({
    //id: "placeholder"
  //});
}

//Need to be aware that the serial creation of listeners may cause distributed
//issues with a removal being completed before the removal listener is added
//although SO seems to think this is a non-issue - tested for local changes and does not work
function addTranscriptListener() {
  //console.log("adding transcript listener");
  var ref = firebase.database().ref("/transcripts/" + transcriptKey + "/counter");
  //console.log("at on operations");
  //Test removal...
  //firebase.database().ref("/transcripts" + transcriptKey + "/dummy").remove();
  ref.on("value", function(count) {
    console.log("Current number of users: " + count.val());
    noUsers = count.val();
    $('.collabno').text(noUsers);
  });
}


/**
 * Given a section object create the section header element
 * @param section A section object
 */
function createSectionHeaderElement(values) {
    var sectionHeaderElement = $('<div class="section-header"></div>');
    var timestamp = createSectionTimeStampElement(values.time)
    sectionHeaderElement.append(timestamp);
    //sectionHeaderElement.append(createSectionSpeakerElement(section)); - NOT VALUD
    return sectionHeaderElement;
    //return timestamp;
}

function formatStartTime(startTime) {
    return secondsToHms(startTime);
}

/**
 * Create the start time label
 * @param section a section object
 */
function createSectionTimeStampElement(time) {
    //var sectionTimestampElement = $('<input type="text" size="12" maxlength="16" class="section-timestamp" value="' + formatStartTime(section.startTime) + '" />'); - to enable editing remove the disabled property HERE
    var sectionTimestampElement = $('<div class="ui top left attached label"><input class="label-formatting" placeholder="Speaker" type="text" size="10" maxlength="16" class="section-timestamp" value="' + formatStartTime(time) + '" disabled /></div>');
    sectionTimestampElement.click(function() {
      setPlayerTime(time);
      console.logs("click");
    });
    //var sectionTimestampElement = $("<div class='ui top left attached label'>"+time+"</div>");
    return sectionTimestampElement;
}

/**
 * Given a section object create the word elements, add to the editor
 * @param section a section object
 */
function createSectionEditorElement(values) {
    //var sectionEditorElement = $('<div contentEditable="true" class="section-editor our-form-control"></div>');

    var sectionEditorElement = $('<div class="description" contentEditable="false"></div>');
    //var sectionEditorElement = $('<div class="description" contentEditable="false"></div>');
    var spanElement = $('<p style="margin-top: 1%;margin-left: 2%;"></p>');
    sectionEditorElement.append(spanElement);

    firebase.database().ref("/firepads/" + transcriptKey + "/" + values.captionKey + "/history").on(
      "child_added", function(history) {
        //console.log("caption key " +  values.captionKey);
        var headless = Firepad.Headless(firebase.database().ref("/firepads/" + transcriptKey + "/" + values.captionKey));
        headless.getText(function(text) {
          //Need to UPDATE different element here
          spanElement.text(text);
        });
      });

    return sectionEditorElement;
}

/**
 * Add a section element with all the words and the editor etc. our main function
 * @param section A real time section object
 */
function createSectionElement(values){

    // create a section element for this section object
    //var sectionElement = $('<div class="section"></div>');
    var sectionElement = $('<div class="ui card"><div class="content"></div></div>');
    //var sectionElement = $('<div class="content"></div>');

    sectionElement.attr('id', values.captionKey);
    sectionElement.attr('time', values.time);
    sectionElement.append(createSectionHeaderElement(values));
    sectionElement.append(createSectionEditorElement(values));

    // add the listeners for adding new words
    //addListenersForNewWord(section);

    return sectionElement;
}


function togglePlayPause() {
    if(playing) {
        player.pause();
    } else {
        stopMade = false;
        player.play();
    }
}


/**
 * Get the current player time in seconds
 *
 * @returns {double} SS.sssssss
 */
function getPlayerTime() {
    return player.getCurrentTime();
}

/**
* Get the length of the current video
*
* @returns {double} SS.sssssss
*/
function getDuration() {
  return player.getDuration();
}

/**
 * Set the player to the provided time in seconds
 *
 * @param time start-time in seconds
 */
function setPlayerTime(time) {
    //player.currentTime = time;
    player.seekTo(time);
}

/**
 * Format SS.sss to HH:MM:SS, sss
 *
 * @param d time in seconds
 * @returns {string} formatted time stamp string
 */
function secondsToHms(d) {
    d = Number(d);
    //console.log(d);

    var h = Math.floor(d / 3600);
    var m = Math.floor(d % 3600 / 60);
    var s = Math.floor(d % 3600 % 60);
    var ms = d - Math.floor(d);
    ms = Math.floor(ms*1000);

    h = ('00' + h).slice(-2);
    m = ('00' + m).slice(-2);
    s = ('00' + s).slice(-2);

    return (h+':'+m+':'+s);
}

/**
 * Convert a timestamp string to milliseconds
 * @param timestamp A string containing at least HH:MM:SS, SSS
 */
function hmsToSeconds(timestamp) {
    var dateRegex = /\d\d\s*:\s*\d\d\s*:\s*\d\d\s*,\s*\d\d\d/;
    var timestamp = _.head(timestamp.match(dateRegex));

    if (timestamp) {
        var parts = timestamp.split(',');

        var hms = parts[0].split(':');
        var ms = +parts[1] / 1000;
        var hours = +hms[0] * 3600;
        var minutes = +hms[1] * 60;
        var seconds = +hms[2];

        return hours + minutes + seconds + ms;
    }
}

function addDocumentListeners() {
  document.addEventListener("keydown", function (event) {
      if (event.keyCode == 37 && event.shiftKey) {
          event.preventDefault();

          if(stopMade) {
            console.log("stop made");
            console.log(currentID);
            firebase.database().ref("/captions/" + transcriptKey + "/" + currentID).once("value")
              .then(function(snapshot) {
                value = snapshot.val();
                return value.time;
              })
              .then(function(time) {
                return firebase.database().ref("/captions/" + transcriptKey).orderByChild("time").endAt(time)
                  .limitToLast(2).once("value").then(function(snapshot) {
                    var value2 = snapshot.val();
                    var i = 0;
                    for (key in value2) {
                      return value2[key].time;
                    }
                  });
              }).then(function (time) {
                setPlayerTime(time);
              });
          }

          else {
            firebase.database().ref("/captions/" + transcriptKey).orderByChild("time").endAt(getPlayerTime())
            .limitToLast(2).once("value").then(function (snapshot) {
              var value = snapshot.val();
              var i = 0;
              for (key in value) {
                return value[key].time;
              }
            }).then(function(time) {
                setPlayerTime(time);
            });
          }
      }

      if (event.keyCode == 39 && event.shiftKey) {
        event.preventDefault();
        firebase.database().ref("/captions/" + transcriptKey).orderByChild("time").startAt(getPlayerTime())
        .limitToFirst(2).once("value").then(function(snapshot) {
          var value = snapshot.val();
          var numKeys = Object.keys(value).length;
          var count = 1;
          if(numKeys == 2) {
            for (key in value) {
              if(count == 2) {
                return value[key].time;
              }

              else {
                count++;
              }
            }
          }

          else {
            for (key in value) {
              return value[key].time;
            }
          }
        }).then(function (time) {
          setPlayerTime(time);
        });
      }

      //
      if (event.keyCode == 8 && event.shiftKey) {
        event.preventDefault();
        /*firebase.database().ref("/captions/" + transcriptKey).orderByChild("time").endAt(getPlayerTime()).limitToLast(1)
        .once("value").then(function(snapshot) {
          var value = snapshot.val();
          for(key in value) {
            return {
              time: value[key].time,
              endTime: value[key].endTime
            };
          }
        })*/
        firebase.database().ref("/captions/" + transcriptKey + "/" + currentID).once("value").then(function(snapshot) {
          var value = snapshot.val();
          return {
            time: value.time,
            endTime: value.endTime
          };
        })
        .then(function(info) {
          setPlayerTime(info.time);
          scheduledStop = true;
          scheduledTime = info.endTime;
          startBarrier = info.time;

          if(!playing) {
            togglePlayPause();
          }
          console.log("Scheduled time set:");
          console.log(scheduledTime);
        });
      }

      if(event.keyCode == 32 && event.shiftKey) {
        event.preventDefault();
        togglePlayPause();
      }

      //F7 rewind 10 seconds
      if(event.keyCode === 118 && event.ctrlKey) {
        stopMade = false;
        var time = getPlayerTime();
        var cor = time < 10? 0 : time - 10;
        setPlayerTime(cor);
      }

      //F8 forward 10 seconds
      if(event.keyCode === 119 && event.ctrlKey) {
        stopMade = false;
        var time = getPlayerTime();
        var duration = getDuration();
        var cor = duration - time < 10? duration : time + 10;
        setPlayerTime(cor);
      }

      //F9 key held down will play
      if(event.keyCode === 120 && !playKeyDown) {
        playKeyDown = true;

        if (!playing) {
          togglePlayPause();
        }
      }
  }, false);

  document.addEventListener('keyup', function(event) {
    //f9 key released will pause audio
    if(event.keyCode === 120 && playKeyDown) {
        playKeyDown = false;
        togglePlayPause();
    }
  }, false);

  $('.collabno').text(noUsers);
  $('.unhide.icon')
    .popup({
      popup: '.special.popup'
    });

}

/*
function updatePlayingState(eventData) {
    //playing = !playing;
    console.log("playing state updated");
    state = eventData.playState;
    if (state == "playing") {
      playing = true;
    }
    else {
      playing = false;
    }
}*/

});
