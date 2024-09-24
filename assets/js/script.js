  var firebaseConfig = {
    apiKey: "AIzaSyAjR6XezCEP-xW59vZw9t7NqnOFyPCExcs",
    authDomain: "vote-f0ad8.firebaseapp.com",
    databaseURL: "https://vote-f0ad8.firebaseio.com",
    projectId: "vote-f0ad8",
    storageBucket: "vote-f0ad8.appspot.com",
    messagingSenderId: "748516822805",
    appId: "1:748516822805:web:6ac2f07d616298eeea631c"
  };
// Initialize Firebase
firebase.initializeApp(firebaseConfig);
gapi.load("client");
let user = null;
let electionId = null;
let electionName = null;

var provider = new firebase.auth.GoogleAuthProvider();
provider.setCustomParameters({
   prompt: 'select_account'
});

firebase.auth().onAuthStateChanged(function(u) {
  if (u) {
    user = u;
    if(u.email.indexOf("@packer.edu") == -1) {
      alert("Please login with your Packer account.")
      return logout();
    }
    $('.container').hide();
    firebase.database().ref("admin").once('value', snapshot => {
      loadClient(snapshot.val().api);
      electionId = snapshot.val().electionId;
      // console.log("FOUND THE ELECTION ID! IT IS: " + electionId);

      firebase.database().ref(electionId + "/hasVoted/" + user.uid).once('value', snapshot => {
        if(snapshot.val() == null) {
          $('#address').show();
        } else {
          $('#voted').show();
          $('#stopVoting').show();
        }
      }, err => {
        if(err) {
          console.log(err);
        }
      })
    });
  } else {
    user = null;
    $('.container').hide();
    $('#login').show();
  }
});

function login() {
  firebase.auth().signInWithPopup(provider).then(result => {
  }, err => {
  });
}

function logout() {
  firebase.auth().signOut().then(function() {
  }); 
}

function loadClient(key) {
  gapi.client.setApiKey(key);
  return gapi.client.load("https://civicinfo.googleapis.com/$discovery/rest?version=v2")
      .then(function() { 
        // console.log("GAPI client loaded for API"); 
      },
            function(err) { console.error("Error loading GAPI client for API", err); });
}

function getAddress() {
  let address = {};
  let inputs = $('input');
  inputs.each((i, v) => {
    address[$(v).attr("aria-label")] = $(v).val();
  });
  let addressString = "";
  for(let i in address) {
    if(address[i] == "") {
      return alert("Please fill out both fields.");
    }
    addressString += address[i] + " ";
  }
  addressString = addressString.trim();
  getBallot(addressString);
  inputs.each((i, v) => {
    $(v).val("");
  })
}
// Make sure the client is loaded before calling this method.
function getBallot(address) {
  if(gapi.client.civicinfo == null) {
    alert("Please make sure you're logged in with your Packer email");
    return logout();
  }
  return gapi.client.civicinfo.elections.voterInfoQuery({
    "address": address,
    "electionId": electionId
  })
      .then(function(response) {
              let data = response.result;
              // Handle the results here (response.result has the parsed body).
              $('.container').hide();
              let ballot = $('#ballot');
              ballot.empty();
              ballot.show();

              // console.log("Response", response);
              electionName = data.election.name
              $("#ballot").append($("<div class='row'><h1>" + electionName + "</h1></div>"));
              for(let r in data.contests) {
                let race = data.contests[r];
                let row = $("<div><h3>" + race.ballotTitle + "</h3></div>");
                row.append($("<div><h6>" + race.district.name + "</h6></div>"));

                for(let candidate of race.candidates) {
                  let div = $('<div class="form-check"></div>');
                  let input = $('<input class="form-check-input"  race="' + race.district.name + '" name="' + race.ballotTitle + '" type="radio" value="' + candidate.name + '">');
                  let label = $('<label class="form-check-label">' + candidate.name + ' (' + candidate.party + ') </label><br>');
                  div.append(input, label);
                  row.append(div);
                }
                ballot.append(row, $("<br>"));
              }
              ballot.append($('<button type="button" class="btn btn-dark" onclick="vote()">Vote</button>'));

              let votingInfo = $('#realVoting');
              let earlyVoting = $('#earlyVoting');
              let electionDay = $('#electionDay');
              if(data.earlyVoteSites != null) {
                let evs = data.earlyVoteSites[0];
                earlyVoting.append($("<br><h3>Early Voting</h3>"));
                earlyVoting.append($("<p>Your early voting site is:</p>"));
                earlyVoting.append($("<p>" + evs.address.locationName + "<br>" + evs.address.line1 + "<br>" + evs.address.city + ", " + evs.address.state + "<br>" + evs.address.zip + "</p>"));
                earlyVoting.append($("<p>" + evs.pollingHours.replace(/\n/g, "<br>") + "</p>"));
              }
              if(data.pollingLocations != null) {
                let pl = data.pollingLocations[0];
                electionDay.append($("<br><h3>Election Day</h3>"));
                electionDay.append($("<p>Your election day pollsite is:</p>"));
                electionDay.append($("<p>" + pl.address.locationName + "<br>" + pl.address.line1 + "<br>" + pl.address.city + ", " + pl.address.state + "<br>" + pl.address.zip + "</p>"));
                electionDay.append($("<p>" + pl.pollingHours.replace(/\n/g, "<br>") + "</p>"));
              }
              votingInfo.show();
            },
            function(err) { console.error("Execute error", err); });
}

function vote() {
  let electionName = $("h1").text().replace(/\./g, "");
  let races = [];
  let checked = $("input[type=radio]:checked");
  checked.each((i, v) => {
    v = $(v);
    let name = v.attr("name").replace(/\./g, "");
    let race = v.attr("race").replace(/\./g, "");
    let candidate = v.attr("value").replace(/\./g, "").replace(/\//g, " and ");
    let path = electionId + "/" + electionName + "/races/" + name + "/" + race + "/" + candidate;
    firebase.database().ref(path).once("value", snapshot => {
      let current = snapshot.val();
      if(current == null) current = 0;
      firebase.database().ref(path).set(current + 1, err => {
        if(err) {
          console.log(err);
          return false;
        } else {
          if(i == checked.length - 1) {
            firebase.database().ref(electionId + "/" + "/hasVoted/" + user.uid).set(firebase.database.ServerValue.TIMESTAMP);
          }
        }
      });
    })
  });
  $('#ballot').empty();
  $('.container').hide();
  $('#voted').show();
}
