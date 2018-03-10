// Initialize Firebase
var config = {
    apiKey: "AIzaSyAgFSXyfrZ8Di_V_9ors0VgedYqnurb9u0",
    authDomain: "socialratingsapp.firebaseapp.com",
    databaseURL: "https://socialratingsapp.firebaseio.com",
    projectId: "socialratingsapp",
    storageBucket: "socialratingsapp.appspot.com",
    messagingSenderId: "8228083925"
};
firebase.initializeApp(config);



// FirebaseUI config.
var uiConfig = {
    signInSuccessUrl: ('#index-page'),
    //signInSuccessUrl: ('http://localhost:63342/Mobile%20App%20Assessment/mobile-app-project/Application/public/index.html?_ijt=97i8ujlbrs4kji67jr8aqlssm6&mode=select#feed-page'),

    signInOptions: [
        // Leave the lines as is for the providers you want to offer your users.

        firebase.auth.EmailAuthProvider.PROVIDER_ID
    ],
    // Terms of service url.
    tosUrl: '<your-tos-url>'
};

// Load the Firebase UI
function loadFirebaseUI() {

    // Initialize the FirebaseUI Widget using Firebase.
    var ui = new firebaseui.auth.AuthUI(firebase.auth());
// The start method will wait until the DOM is loaded.
    ui.start('#firebaseui-auth-container', uiConfig);
}

var nearby = [];
var databaseUserSnapshot;
var nearbyUserDistanceThreshold = 0.1;
var locationWatch;
var locationWatchOptions;




$(document).ready(function () {

    // Called on the client when the state of any user is changed (e.g if they log in or log out).
    // If firebaseUser is null, this means no user is signed in.
    firebase.auth().onAuthStateChanged(firebaseUser => {
        if(firebaseUser)
        {

            // If we have a user logged in, store their UID and show the Feed page.
            sessionStorage.setItem('userUID', firebaseUser.uid);

            // We will need to parse the displayName string and split it into two different strings, one for the first and one for the last name
            /*sessionStorage.setItem('firstName', firebaseUser.displayName);
            sessionStorage.setItem('lastName', firebaseUser.displayName);
            //$.mobile.changePage('#feed-page', {transition : "pop", reverse : true});*/ //removed this line as the auth automatically takes you there in th ternary statement
            var fullName = firebaseUser.displayName;                                    // set variable fullname to current display name
            var space = fullName.lastIndexOf(' ');                                      // space set to help substring determine second name from fullName
            var firstName = fullName.split(' ').slice(0, -1).join(' ');                 // use split() to extract firstName from fullName
            var lastName = fullName.substring(space+1);                                 // use substring to extract lastName from fullName
            sessionStorage.setItem('firstName', firstName);
            sessionStorage.setItem('lastName', lastName);
            $.mobile.changePage('#myprofile', {transition : "pop", reverse : true});

            // Perform checks on the current user
            LoadOrCreate(firebaseUser);

            // Update the snapshot of the database user
            getDatabaseUserSnap();
            calculateUsersRating();

            // Update the welcome message
            firebase.database().ref("users/" + sessionStorage.getItem('userUID')).once('value').then(function (snapshot) {
                $('#welcome-message').html("<b>Welcome,</b> " + firstName + " " + lastName + "!");

                console.log("User Logged In " + snapshot.val().email)
            });

            // Initialize the location fetch for the user
            getLocation();

            // If the user has a photoURL, display it on the feed page.
            if(firebaseUser.photoURL !== null)
                document.getElementById('profile-picture').src = firebaseUser.photoURL;

            //DEBUG_SendLocation(lat, lon);
            //findNearby()
        }
        else
        {
            // No user is logged in, return to the initial index page
            $.mobile.changePage('#index-page', {transition: "pop", reverse: true});

            console.log("User logged out");
            // Load the firebase UI so that the user can login
            loadFirebaseUI();
        }
    });

    // Firebase Callback function which listens to the ratings of this users database entry. Whenever their database entries change then we will update their rating
    var ratingListener = firebase.database().ref('users/' + sessionStorage.getItem('userUID'));
    ratingListener.on('value', function(snapshot) {
        calculateUsersRating();
    });

    var uploader = document.getElementById("profilePictureUploader");
    var fileButton = document.getElementById("profilePictureUploadBtn");

    // Configure the button which allows the user to upload an image
    fileButton.addEventListener('change', function (e) {
        // Get the file
        var file = e.target.files[0];

        //document.getElementById("ProfilePicBtnDiv").style.display = "none";

        // Create a storage reference
        var storageReference = firebase.storage().ref('images/profiles_pictures/' + sessionStorage.getItem('userUID'));

        // Upload the file
        var task = storageReference.put(file).then(function (snapshot) {
            console.log(snapshot.downloadURL);
            document.getElementById('profile-picture').src = snapshot.downloadURL;

            // Upload the photo url to the current users profile
            firebase.auth().currentUser.updateProfile({
                photoURL: snapshot.downloadURL
            }).then(function () {

            }).catch(function (error) {
                console.log(error);
            })

        });
        // hide profile pic button div on change
        document.getElementById("ProfilePicBtnDiv").style.display = "none";
        //getDatabaseUserSnap();
    });
});

// Check if we currently have the logged in user registered in the real-time database. If not, we create them.
function LoadOrCreate(firebaseUser)
{
    var accountFound = false;
    firebase.database().ref("users").once("value").then(function (snapshot) {
        snapshot.forEach(function (child) {
            var newItemValue = child.val();

            // We found the user, so we do nothing
            if(newItemValue.uid === firebaseUser.uid) {
                accountFound = true;

                // Hide "load profile Picture div"
                if(firebaseUser.photoURL !== null) {
                    document.getElementById("ProfilePicBtnDiv").style.display = "none";
                    document.getElementById("profile-picture").addEventListener("click", ShowProfilePicButton);
                }
            }
        });


        // We didnt find this user, so we need to create an entry in the real-time database
        if(!accountFound)
        {
            firebase.database().ref("users/" + sessionStorage.getItem('userUID')).set({
                email: firebaseUser.email,
                firstName: sessionStorage.getItem('firstName'),
                lastName: sessionStorage.getItem('lastName'),
                rating: 2.5,
                uid: firebaseUser.uid
            });

            // Create the initial rating arrays to store the users data
            var initialRating = [];
            var initialUID = [];
            var initialMessage = [];

            initialRating.push(2.5);
            initialUID.push(firebaseUser.uid);
            initialMessage.push("You rated yourself! Well done!");

            // Push this data to the real-time database
            firebase.database().ref("ratings/" + sessionStorage.getItem('userUID')).set({
                ratings: initialRating,
                uids: initialUID,
                messages: initialMessage
            });
        }
    });
}

function ShowProfilePicButton()
{
    // Show "load profile Picture div" onclick of profile pic
    var x = document.getElementById("ProfilePicBtnDiv");
    if (x.style.display === "none") {
        x.style.display = "block";
    } else {
        x.style.display = "none";
    }
}


// Logs in the user with the given email & password
function userLogin(email, password) {
    const auth = firebase.auth();
    var promise = auth.signInWithEmailAndPassword(email, password);
    promise.catch(e => console.log(e.message));
}

// Attempts to create a new user account with the given details
function userSignup(email, password, confirmPassword, firstName, lastName) {

    if(password !== confirmPassword )
    {
        console.log("Passwords do not match");
        return;
    }

    if(!email.toString().includes('@') || email === "")
    {
        console.log("Email is bad format");
        return;
    }

    if(firstName === "")
    {
        console.log("First name required");
        return;
    }

    if(lastName === "")
    {
        console.log("Last name required");
        return;
    }

    const auth = firebase.auth();
    var promise = auth.createUserWithEmailAndPassword(email, password);

    // Store the first and last name in session storage.
    sessionStorage.setItem('firstName', firstName);
    sessionStorage.setItem('lastName', lastName);

    promise.catch(e => console.log(e.message));
}

// Logs out the current user accounts
function userLogout()
{
    firebase.auth().signOut();
}

// Attempts to gain a snap shot of the current logged in user account from the real-time database.
function getDatabaseUserSnap()
{
    firebase.database().ref("users/" + sessionStorage.getItem('userUID')).once('value').then(function (snapshot) {
        databaseUserSnapshot = snapshot.val();
        return snapshot.val();
    });
}

function DEBUG_SendLocation(lat, lon)
{
    firebase.database().ref("locations/" + sessionStorage.getItem('userUID')).set({
        latitude: lat,
        longitude: lon,
        uid: sessionStorage.getItem('userUID')
    });
    findNearby(lat, lon);
}

// Initializes the location fetching for the user.
function getLocation()
{
    if(navigator.geolocation)
    {
        locationWatchOptions = {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0
        };

        // Listen for the user to change position, and when they do, update the real-time database
        locationWatch = navigator.geolocation.watchPosition(watchPositionSucess, watchPositionError, locationWatchOptions);
        console.log("initializing geolocation");
    }
}

// Finds all users accounts within a distance threshold to the given lat & lon
function findNearby(lat, lon)
{
    nearby = [];
    firebase.database().ref("locations").once("value").then(function (snapshot) {
        snapshot.forEach(function (child) {
            var newItemValue = child.val();

            var dist = calculateDistance(newItemValue.latitude, newItemValue.longitude, lat, lon)
            if(dist<= nearbyUserDistanceThreshold)
            {
                if(newItemValue.uid !== sessionStorage.getItem('userUID'))
                    nearby.push(newItemValue);
            }
        });

        console.log(nearby.length + " Users Nearby");
        for (var i = 0, len = nearby.length; i < len; i++) {
            console.log(calculateDistance(nearby[i].latitude, nearby[i].longitude, lat, lon) + " distance away");
        }
    });
}

// Calculates the distance between two coordinate points.
function calculateDistance(lat1, lon1, lat2, lon2)
{
    //Radius of the earth in:  1.609344 miles,  6371 km  | var R = (6371 / 1.609344);
    var R = 3958.7558657440545; // Radius of earth in Miles
    var dLat = toRad(lat2-lat1);
    var dLon = toRad(lon2-lon1);
    var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon/2) * Math.sin(dLon/2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    var d = R * c;
    return d;
}

// Converts degress to radians
function toRad(Value)
{
    return Value * Math.PI / 180;
}

// Rates the target user (targetUID) with the given rating, and leaves a message if provided
function rateUser(targetUID, rating, message)
{
    // First we find the ratings entry from the target users database
    firebase.database().ref("ratings/" + targetUID).once('value').then(function (snapshot) {

        // Collate the data
        var ratings = snapshot.val().ratings;
        var uids = snapshot.val().uids;
        var messages = snapshot.val().messages;

        if(message === "")
            message = "no message";

        ratings.push(rating);
        uids.push(sessionStorage.getItem('userUID'));
        messages.push(message);

        // Push this new data to the target users database
        firebase.database().ref("ratings/" + targetUID).set({
            ratings: ratings,
            uids: uids,
            messages: messages
        });

        var overall = 0;
        for (var i = 0, len = ratings.length; i < len; i++) {
            overall+= parseFloat(ratings[i]);
        }

        var userRating = overall / ratings.length;

        firebase.database().ref("users/" + targetUID).once('value').then(function (snapshot) {
            var user = snapshot.val();

            firebase.database().ref("users/" + targetUID).set({
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                rating: userRating,
                uid: user.uid
            });
        });
    });
}

function calculateUsersRating() {
    firebase.database().ref("ratings/" + sessionStorage.getItem('userUID')).once('value').then(function (snapshot) {
        var overall = 0;
        var ratings = 0;
        var ratingsArray = snapshot.val().ratings;
        console.log("ratingsArray " + ratingsArray.length);
        var uidsArray = snapshot.val().uids;

        for (var i = 0, len = ratingsArray.length; i < len; i++) {
            overall+= parseFloat(ratingsArray[i]);
            ratings++;
        }

        console.log("overall " + overall);
        var userRating = 2.5;
        userRating = overall / ratingsArray.length;

        console.log("Calculated user rating " + userRating);

        firebase.database().ref("users/" + sessionStorage.getItem('userUID')).once('value').then(function (snapshot) {
            var user = snapshot.val();

            firebase.database().ref("users/" + sessionStorage.getItem('userUID')).set({
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                rating: userRating,
                uid: user.uid
            });
        });

        $('#your-rating').html(userRating);
    });
}

// When called, this updates the users location
function watchPositionSucess(position) {
    firebase.database().ref("locations/" + sessionStorage.getItem('userUID')).set({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        uid: sessionStorage.getItem('userUID')
    });

    // Update nearby users as location has changed
    findNearby(position.coords.latitude, position.coords.longitude);
    console.log("Position Watch Returned");
}

function watchPositionError(err) {
    console.warn('ERROR(' + err.code + '): ' + err.message);
}


// The following is a debug snippet to delete all user accounts
var intervalId;

var clearFunction = function() {
    if ($('[aria-label="Delete account"]').size() == 0) {
        console.log("interval cleared")
        clearInterval(intervalId)
        return
    }
    $('[aria-label="Delete account"]')[0].click();
    setTimeout(function () {
        $(".md-raised:contains(Delete)").click()
    }, 1000);
};

intervalId = setInterval(clearFunction, 3000)