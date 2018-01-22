var distanceThreshold = 1;
var account;

$(document).ready(function(){
    $('#loginBtn').click(function(){
        let email = $('#emailText').val();
        let password = $('#passwordText').val();
        userLogin(email, password);
    });

    $('#signupBtn').click(function(){
        let email = $('#emailText').val();
        let password = $('#passwordText').val();
        userSignup(email, password);
    });

    $('#logoutBtn').click(function () {
       firebase.auth().signOut();
    });

    $('#locationBtn').click(function () {
       getLocation();
    });

    $('#confirmDisplayNameBtn').click(function () {
        var user = firebase.auth().currentUser;

        console.log(user.uid);
        user.updateProfile({
            displayName: $('#displayNameText').val()
        }).then(function () {
            // Update Successful
            $.mobile.changePage('#main', {transition : "pop", reverse : false});
        }).catch(function (error) {
            console.log(error);
        })

        firebase.database().ref("users/" + user.uid).once("value").then(function (snapshot) {
            var data = (snapshot.val());

            firebase.database().ref("users/" + user.uid).set({
               displayName: $('#displayNameText').val(),
               email: data.email,
               rating: data.rating,
               ratings: data.ratings,
               uid: data.uid
            });
        });
    });

    $('#cancelDisplayNameBtn').click(function () {
        $.mobile.changePage('#main', {transition : "pop", reverse : false});
    });

    firebase.auth().onAuthStateChanged(firebaseUser => {
    if(firebaseUser)
    {
        sessionStorage.setItem('user', firebaseUser.uid);
        LoadOrCreate(firebaseUser);
        if(firebaseUser.displayName === null)
        {
            $.mobile.changePage('#addDisplayNameDialog', {transition : "pop", reverse : true});
        }
        else
        {
            console.log(firebase.auth().currentUser);
            $.mobile.changePage('#main', {transition : "slide", reverse : true});

        }

        firebase.database().ref("users/" + firebaseUser.uid).once("value").then(function (snapshot) {
            account = snapshot.val();
            $('#profileDataRating').html("Rating " + account.rating + "/5.0");
        });
    }
    else
    {
        if($.mobile.activePage.attr("id") !== "index")
            $.mobile.changePage('#index');
        // $('#index').css("display", "block");
    }
    });

    $('#main').on("pagebeforeshow", function(){
        var user = firebase.auth().currentUser;

        if(user === null)
            $.mobile.changePage('#index');
        else {
            if (user.displayName === null)
                $('#welcome-user').html("<b>Welcome</b>, User " + sessionStorage.getItem('user'));
            else
                $('#welcome-user').html("<b>Hello " + user.displayName + ",<br/>Welcome To Social.</b>");
            getLocation();

        }



        console.log("Boop");
    });
});

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
            firebase.database().ref("users/" + sessionStorage.getItem('user')).set({
                displayName: "",
                email: firebaseUser.email,
                rating: 2.5,
                ratings: 0,
                uid: firebaseUser.uid
            });
        }
    });

}

function userLogin(email, password) {
    const auth = firebase.auth();
    var promise = auth.signInWithEmailAndPassword(email, password);
    promise.catch(e => console.log(e.message));
}

function userSignup(email, password) {
    const auth = firebase.auth();
    var promise = auth.createUserWithEmailAndPassword(email, password);
    promise.catch(e => console.log(e.message));
}

function getLocation()
{
    if(navigator.geolocation)
    {
        navigator.geolocation.getCurrentPosition(function (position) {
            let output = "";
            output += "<b>Latitude</b>: " + position.coords.latitude;
            output += "<br/><b>Longitude</b>: " + position.coords.longitude;

            $('#locationText').html(output);
            firebase.database().ref("locations/" + sessionStorage.getItem('user')).set({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                uid: sessionStorage.getItem('user')
            });
            findNearby(position.coords.latitude, position.coords.longitude);
        });
    }
}

function findNearby(lat, lon)
{
    var nearby = [];
	firebase.database().ref("locations").once("value").then(function (snapshot) {
        snapshot.forEach(function (child) {
            var newItemValue = child.val();

            var dist = calculateDistance(newItemValue.latitude, newItemValue.longitude, lat, lon)
            if(dist<= distanceThreshold)
            {
                if(newItemValue.uid !== sessionStorage.getItem('user'))
                nearby.push(newItemValue);
            }
        });

        fillNearby(nearby);
    });
}

function fillNearby(nearby) {

    var output = '';
    $.each(nearby, function (index, near) {
        var data;
        firebase.database().ref("users/" + near.uid).once("value").then(function (snapshot) {
            data = (snapshot.val());


            output += `
            <li>
                <a onclick="showUser('${data.uid}')" href="#">
                <h3>'${data.displayName}'</h3>
                </a>
            </li>
        `;
            $('#nearbyList').html(output).listview('refresh');
        });
    });


}

function showUser(id) {
    firebase.database().ref("users/" + id).once("value").then(function (snapshot) {
        var data = snapshot.val();
        $.mobile.changePage('#viewNearbyDialog', {transition: "pop", reverse: true});
        $('#viewNearbyDisplayName').html(data.displayName + " - " + data.email);
    });
}

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

function toRad(Value) {
    /** Converts numeric degrees to radians */
    return Value * Math.PI / 180;
}
