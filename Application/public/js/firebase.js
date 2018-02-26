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
            $.mobile.changePage('#feed-page', {transition : "pop", reverse : true});
            LoadOrCreate(firebaseUser);

            // Update the snapshot of the database user
            getDatabaseUserSnap();

            // Update the welcome message
            firebase.database().ref("users/" + sessionStorage.getItem('userUID')).once('value').then(function (snapshot) {
                $('#welcome-message').html("<b>Welcome,</b> " + snapshot.val().firstName + " " + snapshot.val().lastName + "!");
                console.log("User Logged In " + snapshot.val().email)
            });

            // Initialize the location fetch for the user
            getLocation();
        }
        else
        {
            // No user is logged in, return to the initial index page
            $.mobile.changePage('#index-page', {transition: "pop", reverse: true});
            console.log("User Logged Out");
        }
    });

    var ratingListener = firebase.database().ref('users/' + sessionStorage.getItem('userUID'));
    ratingListener.on('value', function(snapshot) {
        calculateUsersRating();
    });
});

// Check if we currently have the logged in user registers in the real-time database. If not, we create them.
function LoadOrCreate(firebaseUser)
{
    var accountFound = false;
    firebase.database().ref("users").once("value").then(function (snapshot) {
        snapshot.forEach(function (child) {
            var newItemValue = child.val();

            if(newItemValue.uid === firebaseUser.uid)
                accountFound = true;
        });


        if(!accountFound)
        {
            firebase.database().ref("users/" + sessionStorage.getItem('userUID')).set({
                email: firebaseUser.email,
                firstName: sessionStorage.getItem('firstName'),
                lastName: sessionStorage.getItem('lastName'),
                rating: 2.5,
                uid: firebaseUser.uid
            });

            var initialRating = [];
            var initialUID = [];
            initialRating.push(2.5);
            initialUID.push(firebaseUser.uid);
            firebase.database().ref("ratings/" + sessionStorage.getItem('userUID')).set({
                ratings: initialRating,
                uids: initialUID
            });
        }
    });
}

function rating (uid, rating)
{
    this.uid = uid;
    this.rating = rating;
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
        // navigator.geolocation.getCurrentPosition(function (position) {
        //     firebase.database().ref("locations/" + sessionStorage.getItem('userUID')).set({
        //         latitude: position.coords.latitude,
        //         longitude: position.coords.longitude,
        //         uid: sessionStorage.getItem('userUID')
        //     });
        //     findNearby(position.coords.latitude, position.coords.longitude);
        // });

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
        // initMap(lat, lon);
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

function rateUser(targetUID, rating)
{
    firebase.database().ref("ratings/" + targetUID).once('value').then(function (snapshot) {
        var ratings = snapshot.val().ratings;
        var uids = snapshot.val().uids;

        ratings.push(rating);
        uids.push(sessionStorage.getItem('userUID'));

        firebase.database().ref("ratings/" + targetUID).set({
            ratings: ratings,
            uids: uids
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

        $('#your-rating').html("Your rating is " + userRating + "!");
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
    // initMap(position.coords.latitude, position.coords.longitude);
    console.log("Position Watch Returned");
}

function watchPositionError(err) {
    console.warn('ERROR(' + err.code + '): ' + err.message);
}

//
// function initMap(lat, lon) {
//     var position = {lat: lat, lng: lon};
//     var map = new google.maps.Map(document.getElementById('map'), {
//         zoom: 16,
//         center: position
//     });
//     var marker = new google.maps.Marker({
//         position: position,
//         map: map,
//         title: 'You'
//     });
//
//     for (var i = 0, len = nearby.length; i < len; i++) {
//         var mPosition = {lat: nearby[i].latitude, lng: nearby[i].longitude};
//         var mMarker = new google.maps.Marker({
//             position: mPosition,
//             map: map,
//             title: calculateDistance(nearby[i].latitude, nearby[i].longitude, lat, lon).toString()
//         });
//         // console.log(calculateDistance(nearby[i].latitude, nearby[i].longitude, lat, lon) + " distance away");
//     }
//
//     console.log("map made");
//
// }


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