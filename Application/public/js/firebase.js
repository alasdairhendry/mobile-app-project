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
    //signInSuccessUrl: ('#index-page'),
    //signInSuccessUrl: ('http://localhost:63342/Mobile%20App%20Assessment/mobile-app-project/Application/public/index.html?_ijt=97i8ujlbrs4kji67jr8aqlssm6&mode=select#feed-page'),
    // signInSuccessUrl: ('http://localhost:63342/Mobile App Assessment/mobile-app-project/Application/public/index.html?_ijt=l3fi3pemeps04paur9vduqm18g'),
    signInSuccessUrl: ('http://localhost:63342/Application/public/index.html?_ijt=hq0mqu2ucj276dji5ei8pddi21'),
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
var nearbyUserDistanceThreshold = 1000.1;
var locationWatch;
var locationWatchOptions;
//var lat;
//var lon;




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

            // DEBUG_SendLocation(lat, lon);
            findNearby();
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
                uploadPhotoToDatabase();
            }).catch(function (error) {
                console.log(error);
            })

        });
        // hide profile pic button div on change
        document.getElementById("ProfilePicBtnDiv").style.display = "none";
        //getDatabaseUserSnap();
    });
});

function uploadPhotoToDatabase() {
    firebase.database().ref("users/" + sessionStorage.getItem('userUID')).update({
        imageURL: firebaseUser.photoURL
    });
}

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

                if(firebaseUser.photoURL !== null)
                {
                    console.log("FOUND PHOTO IN AUTH PROFILE");
                    firebase.database().ref("users/" + sessionStorage.getItem('userUID')).update({
                        imageURL: firebaseUser.photoURL
                    });
                }
                else
                {
                    console.log("DID NOT FOUND PHOTO IN AUTH PROFILE");
                    console.log(firebaseUser);
                }

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
            console.log("Account not found, creating database entry");
            firebase.database().ref("users/" + sessionStorage.getItem('userUID')).set({
                email: firebaseUser.email,
                firstName: sessionStorage.getItem('firstName'),
                lastName: sessionStorage.getItem('lastName'),
                rating: 2.5,
                imageURL: "placeholder",
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
    var nearbyUID = [];
    nearby = [];

    // Pull the location entries
    firebase.database().ref("locations").once("value").then(function (snapshot) {

        // Loop through the location entries
        snapshot.forEach(function (t) {
            var snapValue = t.val();

            // Calculate the distance between the location entry and the given lat, lon ( the current users lat, lon)
            var dist = calculateDistance(snapValue.latitude, snapValue.longitude, lat, lon);

            // Check if the distance is less than the pre-set threshold
            if(dist <= nearbyUserDistanceThreshold)
            {
                // Check to see that it isnt the current user in the entry
                if(sessionStorage.getItem("userUID") != snapValue.uid)
                {
                    // Add the UID to the the nearbyUID array
                    nearbyUID.push(snapValue.uid);
                }
            }

        });

        // Pull the users entries
        firebase.database().ref("users").once("value").then(function(snapshot){

            // Look through each of the users
            snapshot.forEach(function (t) {

                // Store the user information in a new variable
                var userDatabaseSnapshot = t.val();

                // Look through each of the nearby UID's
                nearbyUID.forEach(function (t2) {

                    // Store the nearby UID in a new variable
                    var nearbyUIDEntry = t2;

                    // Check if the nearby UID matches the current user entry we are looking at
                    if(userDatabaseSnapshot.uid.toString() === nearbyUIDEntry.toString())
                    {
                        // If the two are a match, store the user's information in the Nearby array
                        nearby.push(userDatabaseSnapshot);
                        console.log(userDatabaseSnapshot);
                        console.log("FOUND MATCH");
                    }
                });

            });

            // Display the nearby users
            displayNearby();
        });

    });

    /*
    console.log("Finding nearby");
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

        console.log(nearby);
        //function to display nearby users
        function displayNearby()
        {

        }
        // Create div to hold "nearby users" image and rate button
        var block  = document.createElement('div');


        // Append the newly created  "nearby users" div to "nearbyUserList" div in html
        document.getElementById('nearbyUserList').appendChild(block);

        // Broken code to get user profiles related to uid of "nearby user"
        //const rootRef = firebase.database().ref("users");

        console.log(nearby.length + " Users Nearby");
        for (var i = 0, len = nearby.length; i < len; i++) {
            // Broken code to get user profiles related to uid of "nearby user"
            //var name = rootRef.child(nearby[i].uid).child('firstName').val();


            var elem = document.createElement("img");               // Create placeholder for "nearby user" image
            var SelectUserBtn = document.createElement("button");   // Create rate user button for "nearby user"
            SelectUserBtn.innerHTML = nearby[i].uid;                // Set text for "nearby user" rate user button

            // Append "nearby user" image to div and set attributes
            block.appendChild(elem);
            elem.setAttribute("src", "http://bootdey.com/img/Content/avatar/avatar5.png");
            elem.setAttribute("class", "img-rounded");
            elem.setAttribute("style", "width: 60%; height:auto; border-radius: 50%; padding-top: 10px;");

            // Append "nearby user" rate user button to div and set attributes
            block.appendChild(SelectUserBtn);
            SelectUserBtn.addEventListener("click", function(){
                $.mobile.changePage('#profile', {transition: "pop", reverse: true});
            });
            
            console.log(name);
            console.log(nearby[i].uid);
            console.log(calculateDistance(nearby[i].latitude, nearby[i].longitude, lat, lon) + " distance away");
        }

    });
    */
}

//function to display nearby users
function displayNearby()
{
    console.log("displayNearby() " + nearby.length + " users nearby");
    var output = "<ul data-role='listview' data-inset='true' id='nearbyUserListView'>";

    for (var i = 0; i < nearby.length; i++)
    {
        console.log ("Nearby UI " + nearby[i].firstName);
        output += "<li> <a href='#' onclick='' name='nearbyUserProfileButton'>";
        if(nearby[i].imageURL.toString() === "placeholder")
        {
            console.log("No ppppppp");
            output += "<img src='http://bootdey.com/img/Content/avatar/avatar5.png' width='100%' height='100%'>";
        }
        else
        {
            output += "<img src=' " +  nearby[i].imageURL  + "' width='100%' height='100%'>";
        }
        output += "<h2>" + nearby[i].firstName + " " + nearby[i].lastName + "</h2>";
        output += "<p>Rating " + nearby[i].rating.toFixed(2) + "</p>";
        output += "</a> </li>";
    }

    output += "</ul>";

    $('#nearbyUserList').html(output);
    $('#nearbyUserList').trigger('create');

    var buttons = document.getElementsByName("nearbyUserProfileButton");

    for (var i = 0; i < buttons.length; i++)
    {
        console.log("boooaowadp");
        buttons[i].onclick = function (num) {
            return function () {
                $.mobile.changePage('#profile', {transition: "pop", reverse: true});
                displayOtherProfile(nearby[num]);
                console.log(nearby[num]);
            }
        }(i);
    }

}

var otherUserProfileTargetUID;
var otherUserRatingListener;
// Displays another users profile
function displayOtherProfile(user) {
    otherUserProfileTargetUID = user.uid;
    $('#otherProfileDisplayName').html(user.firstName + " " + user.lastName);
    $('#otherProfileUserRating').html(user.rating.toFixed(2));

    if(user.imageURL.toString() === "placeholder")
    {
        $('#otherProfilePhoto').attr("src", "http://bootdey.com/img/Content/avatar/avatar5.png");
    }
    else
    {
        $('#otherProfilePhoto').attr("src", user.imageURL);
    }

    $('#Star1').unbind("click");
    $('#Star2').unbind("click");
    $('#Star3').unbind("click");
    $('#Star4').unbind("click");
    $('#Star5').unbind("click");

    $('#Star1').click(function () {
        rateUser(user.uid, 1.0, "");
    })

    $('#Star2').click(function () {
        rateUser(user.uid, 2.0, "");
    })

    $('#Star3').click(function () {
        rateUser(user.uid, 3.0, "");
    })

    $('#Star4').click(function () {
        rateUser(user.uid, 4.0, "");
    })

    $('#Star5').click(function () {
        rateUser(user.uid, 5.0, "");
    })

    // Firebase Callback function which listens to the ratings of this users database entry. Whenever their database entries change then we will update their rating
    otherUserRatingListener = firebase.database().ref('users/' + user.uid);
    otherUserRatingListener.on('value', function(snapshot) {
        calculateOtherUsersRating(user);
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
                imageURL: user.imageURL,
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
                imageURL: user.imageURL,
                uid: user.uid
            });
        });

        $('#your-rating').html(userRating.toFixed(2));
    });
}

function calculateOtherUsersRating(user) {

    console.log(user.uid.toString() + " ---- " + "Target User - " + otherUserProfileTargetUID.toString());
    if(user.uid.toString() === otherUserProfileTargetUID.toString()) {

        firebase.database().ref("ratings/" + user.uid).once('value').then(function (snapshot) {
            var overall = 0;
            var ratings = 0;
            var ratingsArray = snapshot.val().ratings;
            var uidsArray = snapshot.val().uids;

            for (var i = 0, len = ratingsArray.length; i < len; i++) {
                overall += parseFloat(ratingsArray[i]);
                ratings++;
            }

            var userRating = 2.5;
            userRating = overall / ratingsArray.length;

            firebase.database().ref("users/" + user.uid).set({
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                rating: userRating,
                imageURL: user.imageURL,
                uid: user.uid
            });

            $('#otherProfileUserRating').html(userRating.toFixed(2));
        });
    }
}

function ratingsRecieved()
{
    /*var ratingsRecieved = firebase.database().ref("ratings/"
        + sessionStorage.getItem('userUID')).get(ratings.length);
    $('#ratings-recieved').html(ratingsRecieved);*/

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

function ProfilePageMenuFunction() {
    document.getElementById("myDropdown").classList.toggle("show");
}

window.onclick = function(event) {
    if (!event.target.matches('.dropbtn')) {

        var dropdowns = document.getElementsByClassName("dropdown-content");
        var i;
        for (i = 0; i < dropdowns.length; i++) {
            var openDropdown = dropdowns[i];
            if (openDropdown.classList.contains('show')) {
                openDropdown.classList.remove('show');
            }
        }
    }
}

function OthersProfilePageMenuFunction() {
    document.getElementById("profileDropdown").classList.toggle("show");
}

window.onclick = function(event) {
    if (!event.target.matches('.dropbtn')) {

        var dropdowns = document.getElementsByClassName("dropdown-content");
        var i;
        for (i = 0; i < dropdowns.length; i++) {
            var openDropdown = dropdowns[i];
            if (openDropdown.classList.contains('show')) {
                openDropdown.classList.remove('show');
            }
        }
    }
}

function NearbyUsersMenuFunction() {
    document.getElementById("NearbyDropdown").classList.toggle("show");
}

window.onclick = function(event) {
    if (!event.target.matches('.dropbtn')) {

        var dropdowns = document.getElementsByClassName("dropdown-content");
        var i;
        for (i = 0; i < dropdowns.length; i++) {
            var openDropdown = dropdowns[i];
            if (openDropdown.classList.contains('show')) {
                openDropdown.classList.remove('show');
            }
        }
    }
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