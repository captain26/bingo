var user = null;
var socket = io();
var original_ticket = null;
var ticket           = null,
    ticket2          = null;
    disclosedNumbers = [];
var game_time      = null;
var game_end_time  = null;
var game           = null;
var counter        = 0;

var words = ['', 'positive', 'joy', 'happy', 'zeal', 'smile', 'gain', 'nice', 'beautiful', 'profit', 'cheer', 'wonderful', 'good',
'better', 'best', 'bright', 'optimistic', 'strong', 'will', 'hope', 'certain', 'sure', 'accept', 'warm', 'appreciate', 'friendly', 'adore', 'support', 'respect', 'sympathy', 'advice', 'recommend', 'clear', 'confident',
'assure', 'accomplish', 'content', 'jolly', 'carefree', 'elated', 'blessed', 'worship', 'glad', 'benefit',
'fortunate', 'laugh', 'love', 'win', 'comfort', 'safe', 'merry', 'success', 'healthy', 'mind', 'matters', 'body', 'paradise', 'okay', 'glory', 'enjoy', 'amazing', 'joke', 'cute', 'hug', 'tasty', 'achieve', 'praise', 'optimist', 'smart', 'pleasant', 'awesome', 'peace', 
'delight', 'kind', 'honest', 'trust', 'polite', 'generous', 'helping', 'guide', 'consistent', 'celebrate', 'faith', 'truth', 'firm', 'sunshine', 'light', 'promise', 'calm', 'asha', 'ease', 'mental', 'well-being', 'bliss', 'courage', 'pledge', 'cool', 'brave']
 words = words.sort();

var modal = document.getElementById("myModal");
var span = document.getElementsByClassName("closem")[0];
span.onclick = function () {
    modal.style.display = "none";
};

var firebaseConfig = {
    apiKey: "AIzaSyBMtJWyBxZ4kVlqbAAHCFuBspdxbRW0dOM",
    authDomain: "bingo-35ce9.firebaseapp.com",
    databaseURL: "https://bingo-35ce9.firebaseio.com",
    projectId: "bingo-35ce9",
    storageBucket: "bingo-35ce9.appspot.com",
    messagingSenderId: "564607526074",
    appId: "1:564607526074:web:8753262a2aac9036ad8e83",
    measurementId: "G-YDYDGBBZ9L"
};
  // Initialize Firebase
firebase.initializeApp(firebaseConfig);

firebase.auth().onAuthStateChanged(function(userDetail) {
    if (userDetail) {
        user = userDetail;
        socket.emit('initialize-data', user);
    }
    else{
        window.location = "/end";
    }
});

socket.on('unauthorized-usage', (message) => {
    alert(message);
    window.location = "/end";
});

socket.on('game-initialized', (t1, t2, current_game) => {
    game_time = t1;
    game_end_time = t2;
    game = current_game;
    if(new Date() > new Date(game_end_time)){
        $('.toast-message').text("Todays game has ended")
        $('.toast').toast('show');
        $('.game-ended').show();
    }
    else if(new Date() < new Date(game_time)){
        showTimer(new Date(game_time).getTime());
        var eta_ms = new Date(game_time).getTime() - new Date().getTime();
        var timeout = setTimeout(function(){
            $('.wait').hide();
            gamestart();
        }, eta_ms);
        $('.toast-message').text("Game has not started yet.")
        $('.toast').toast('show');
        $('.wait').show();
    }
    else if(new Date() > new Date(game_time) && new Date() < new Date(game_end_time)){
        $('.toast-message').text("Game Started")
        $('.toast').toast('show');
        if(screen.width <= 600 && screen.orientation.type == "portrait-primary"){
            modal.style.display = "block";
        }
        gamestart();
    }
    else{
        console.log("Unknown error");
    }
});

socket.on('loadGameData', function(tic, usedSequence){
    var audio = document.getElementById("myAudio");
    audio.volume = 0.2;
    audio.play();
    ticket = tic;
    setClaimButtonState();
    $('.ticket td').addClass('not-clickable');
    if(screen.width <= 600 && screen.orientation.type == "portrait-primary");
    else{
        createTicket(tic);
    }
    showEmittedNumbers(usedSequence);
    $('.claim-btn').show();
    $('.nextnumber').text(words[disclosedNumbers[disclosedNumbers.length - 1]]);
    $('.timer').text("0");    

});

socket.on('nextNumber', function( data, number, count){
    disclosedNumbers.push(number);
    $('.nextnumber').text(words[number]);
    if($('.news-message p').length == 6)
    $('.news-message').css('animation-duration', '50s')
    if($('.news-message p').length >= 12){
        $('.news-message p:first-child').remove();
        $('.news-message').append("<p>" + words[number] + ",</p>");
    }
    else{
        $('.news-message').append("<p>" + words[number] + ",</p>");
    }

    var msg = new SpeechSynthesisUtterance(words[number]);
    window.speechSynthesis.speak(msg);
    console.log( count +" - " + words[number]);
}); 

// Game Control 
socket.on('wrong-claim', function(id){
    alert('Your id will be disconnected because of wrong claim, you wont be able to continue this game anymore');
    socket.disconnect();
    window.location = "/end";
});

socket.on('timer', function(data){
    $('.timer').text(data);
}) 

// Claim Controls
socket.on('first-five-winner', function(message){
    $('.toast-message').text(message)
    $('.toast').toast('show');
    $('.first-five').attr('disabled', true);
});

socket.on('top-row-winner', function(message){
    $('.toast-message').text(message)
    $('.toast').toast('show');
    $('.top-row').attr('disabled', true);
});

socket.on('middle-row-winner', function(message){
    $('.toast-message').text(message)
    $('.toast').toast('show');
    $('.middle-row').attr('disabled', true);
});

socket.on('bottom-row-winner', function(message){
    $('.toast-message').text(message)
    $('.toast').toast('show');
    $('.bottom-row').attr('disabled', true);
});

socket.on('full-house-winner', function(message, game){
    game_end_time = new Date();
    $('.full-house').attr('disabled', true);
    alert(message);
    socket.close();
    window.location = "/winners/" + user.uid + '/'  + game._id;
});

socket.on('full-house-winner-you', function(message, game){
    game_end_time = new Date();
    $('.full-house').attr('disabled', true);
    alert(message);
    socket.close();
    window.location = "/winners/" + user.uid + '/' + game._id;
});



$('.ticket td').click(function(){
    var ticket_id = null;
    $(this).toggleClass('clicked-cell');
    words.forEach((x,i) => {
        if(x == $(this).text()){
            ticket_id = i;
        }
    });
    for (let i = 0; i < ticket.length; i++) {
        for (let j = 0; j < ticket[0].length; j++) {
            var value = ticket[i][j];
            if(ticket_id == Math.abs(value)){
                ticket[i][j] = ticket[i][j] * -1;
            }
        }    
    }
});

$('.claim').click(function(){
    if($(this).hasClass('full-house'))emit = 'full-house';
    if($(this).hasClass('top-row'))emit = 'top-row';
    if($(this).hasClass('middle-row'))emit = 'middle-row';
    if($(this).hasClass('bottom-row'))emit = 'bottom-row';
    if($(this).hasClass('first-five'))emit = 'first-five';
    socket.emit(emit, ticket, user, game);
    socket.emit('save-game-checkpoint', ticket, user, game);
});

function showEmittedNumbers(data){
    disclosedNumbers = data;
    var count = ( data.length >12)? data.length - 12 : 0;
    $('.news-message').html('');
    for (let i = count; i < data.length; i++) {
        var x = data[i];
        $('.news-message').append("<p>" + words[x] + ",</p>");
    }
}

function setClaimButtonState(){
    if(game.top_row)$('.top-row').attr('disabled', true);
    if(game.middle_row)$('.middle-row').attr('disabled', true);
    if(game.bottom_row)$('.bottom-row').attr('disabled', true);
    if(game.full_house)$('.full-house').attr('disabled', true);
    if(game.first_five)$('.first-five').attr('disabled', true);
}

function createTicket(data) {
    $('.ticket td').removeClass('not-clickable');
    original_ticket = data;
    ticket = data;
    var c = 0;
    var r = 0;
    $("td").each(function() {
        if(c%9 == 0) c = 0;
        var value = data[r][c];
        if(value == 0){
            $(this).text();
            $(this).addClass('not-clickable');
        }
        else if(value != Math.abs(value)){
            $(this).addClass('clicked-cell');
            $(this).text(words[value *-1]);
        }
        else $(this).text(words[value]);
        
        if(c == 8) r++;
        c++;
    });
}

function gamestart() {
    socket.emit('game-start', user, game);
    $('.play').show();
}

function showTimer(time){
    var x = setInterval(function() {
        var now = new Date().getTime();

        var distance = time - now;
        
        // Time calculations for days, hours, minutes and seconds
        var hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        var minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        var seconds = Math.floor((distance % (1000 * 60)) / 1000);
        var day = Math.floor(distance/(1000*60*60*24));
        // Output the result in an element with id="demo"
        var d = day + "D " + hours + "H " + minutes + "M " + seconds + "S ";
        $("#timer").html(d);
        
        // If the count down is over, write some text 
        if (distance < 0) {
        clearInterval(x);
        $("#timer").innerHTML = "EXPIRED";
        }
    }, 1000);
}

socket.on('emit-used-sequence', function(data, number){
    showEmittedNumbers(data);
    $('.nextnumber').text(words[number]);
});

socket.on('last-word-shown', function (){
    $('.toast-message').text("Last word shown - you have 20s for the game to end");
    $('.toast').toast('show');
})



function fullScreenCheck() {
    if (document.fullscreenElement) return;
    return document.documentElement.requestFullscreen();
}

function updateDetails(lockButton) {
    const buttonOrientation = getOppositeOrientation();
}

function getOppositeOrientation() {
    const { type } = screen.orientation;
    return type.startsWith("portrait") ? "landscape" : "portrait";
}

async function rotate(lockButton) {
    modal.style.display = "none";
    try {
        await fullScreenCheck();
    } catch (err) {
        console.error(err);
}
const newOrientation = getOppositeOrientation();
    await screen.orientation.lock(newOrientation);
    updateDetails(lockButton);
}

function show() {
    const { type, angle } = screen.orientation;
/*     console.log(`Orientation type is ${type} & angle is ${angle}.`);
 */}

screen.orientation.addEventListener("change", () => {
    show();
    updateDetails(document.getElementById("button"));
});

window.addEventListener("load", () => {
    show();
    updateDetails(document.getElementById("button"));
});

socket.on('game-finished', function(id) {
    alert('Game has finished, you will be redirected to result page.');
    window.location = "/winners/"  + user.uid + '/' + id;
});


$( window ).on( "orientationchange", function( event ) {
   
    if(screen.width <= 600 && (screen.orientation.type == "portrait-primary" || screen.orientation.type == "portrait-secondary" )){
        $('.ticket td').removeClass('clicked-cell');
        $('.ticket td').addClass('not-clickable')
        $('.ticket td').text('');
    }
    else{
        createTicket(ticket);
    }
  });


socket.on('reconnect', (attemptNumber) => {
    $('.toast-message').text("Game reconnected.")
    $('.toast').toast('show');
    socket.emit('get-showed-sequence');
});

socket.on('disconnect', (error) => {
    $('.toast-message').text("Network issue...");
    $('.toast').toast('show');
});



socket.on('reconnecting', (error) => {
    $('.toast-message').text("Game reconnecting...");
    $('.toast').toast('show');
});

socket.on('reconnect_error', (error) => {
    $('.toast-message').text("For any missed word check the last 12 words section, when connection resumes.");
    $('.toast').toast('show');
});






  socket.on('connect', () => {
    console.log(socket.disconnected); // false
  });