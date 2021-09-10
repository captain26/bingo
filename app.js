var   express       = require('express'),
      app           = express(),
      bodyParser    = require('body-parser'),
      http          = require('http').Server(app),
      io            = require('socket.io')(http),
      tambola       = require('tambola-generator'),
      mongoose      = require('mongoose'),
/*    Razorpay      = require('razorpay'),
      request       = require('request'), */   
      middleware    = require('./middleware/index'),
      vault         = require('./middleware/vault'),
      Game          = require("./models/game"),
      GameClient    = require("./models/game_client");

var   refreshIntervalId = null,
      dibarred_user     = [],
      game_players      = [], 
      usedSequence      = [],
      game_next         = null,
      sequence          = [],
      players           = 0,
      timerID           = null,
      time              = null,
      i                 = null;

/* var   instance = new Razorpay({
   key_id: vault.razorpay.key_id,
   key_secret: vault.razorpay.key_secret
}); */


mongoose.connect(vault.mlab, { useNewUrlParser: true, useUnifiedTopology: true, useCreateIndex : true }).then( response => {
   console.log("MongoDB Connected");
});

/* Set the Public folder to server*/
app.use(express.static(__dirname + "/public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine","ejs");
app.use(bodyParser.json());


app.get('/', function(req, res) {
   Game.findOne({played : false}).sort({game_time : 1}).limit(1).then(nextGame => {
      if(nextGame){
         var game_started = new Date(nextGame.game_time) < new Date();
         res.render('landing', {game_time : nextGame.game_time, game_started});
      }
      else{
         res.render('landing', {game_time : null, game_started : false});
      }
   });
});

app.get('/get-game-time', function(req, res) {
   Game.findOne({played : false}).sort({game_time : 1}).limit(1).then(nextGame => {
      if(nextGame){
         res.send( {game_time : nextGame.game_time});
      }
      else{
         res.send( {game_time : null});
      }
   });
});

app.get('/end', (req, res) => {
   res.render('end');
});

app.get('/mygame-list/:user_id', [middleware.ensureGameAvailable, middleware.ensureUserAuthentication], (req, res) => {
   var nextGameOnline = null;
   /* GameClient.findOne({user_id : req.params.user_id, game_id : res.locals.nextGame._id, payment : true}, (err, game_c) => {
      console.log(game_c)
      if(game_c){
         nextGameOnline = { payment : true, game : res.locals.nextGame };
      }
      else{
         nextGameOnline = { payment : false, game : res.locals.nextGame };
      }
      res.render('gamelist', { nextGameOnline, user_id : req.params.user_id });
   }); */
   nextGameOnline = {game : res.locals.nextGame };
   res.render('gamelist', { nextGameOnline, user_id : req.params.user_id });
});

app.get('/winners/:user_id/:game_id', middleware.ensureUserAuthentication, (req, res) => {
   var first_five = null;
   var top_row = null;
   var middle_row = null;
   var bottom_row = null;
   var full_house = null;
   Game.findOne({_id : req.params.game_id}).then(nextGame => {
      if(nextGame && nextGame.played){
         let promise1 = new Promise( (resolve, reject) => {
            if(nextGame.first_five){
               middleware.admin.auth().getUser(nextGame.first_five).then(function(userRecord) {
                  first_five = {user_id : userRecord.uid, name : userRecord.displayName};
                  resolve();
               });
            }
            else{
               first_five = {user_id : "None", name : "None"};
               resolve();
            }
         });
   
         let promise2 = new Promise( (resolve, reject) => {
            if(nextGame.top_row){
               middleware.admin.auth().getUser(nextGame.top_row).then(function(userRecord) {
                  top_row = {user_id : userRecord.uid, name : userRecord.displayName};
                  resolve();
               });
            }
            else{
               top_row = {user_id : "None", name : "None"};
               resolve();
            }
            
         });
   
         let promise3 = new Promise( (resolve, reject) => {
            if(nextGame.middle_row){
               middleware.admin.auth().getUser(nextGame.middle_row).then(function(userRecord) {
                  middle_row = {user_id : userRecord.uid, name : userRecord.displayName};
                  resolve();
               });
            }
            else{
               middle_row = {user_id : "None", name : "None"};
               resolve();
            }
         });
   
         let promise4 = new Promise( (resolve, reject) => {
            if(nextGame.bottom_row){
               middleware.admin.auth().getUser(nextGame.bottom_row).then(function(userRecord) {
                  bottom_row = {user_id : userRecord.uid, name : userRecord.displayName};
                  resolve();
               });
            }
            else{
               bottom_row = {user_id : "None", name : "None"};
               resolve();
            }
         });
   
         let promise5 = new Promise( (resolve, reject) => {
            if(nextGame.full_house){
               middleware.admin.auth().getUser(nextGame.full_house).then(function(userRecord) {
                  full_house = {user_id : userRecord.uid, name : userRecord.displayName};
                  resolve();
               });
            }
            else{
               full_house = {user_id : "None", name : "None"};
               resolve();
            }
         });
   
         Promise.all([promise1, promise2, promise3, promise4, promise5]).then(data => {
            res.render('winner', {status : 1, first_five, top_row, middle_row, bottom_row, full_house});
         });
      }
      else{
         res.render('winner', {status : 0, first_five, top_row, middle_row, bottom_row, full_house});
      }
   });  
})

app.get('/game-start/:user_id/:game_id', [middleware.ensureGameAuth, middleware.ensureUserAuthentication, middleware.ensurePaymentDone],  (req, res) => {
  res.render('game', {game : res.locals.nextGame, user_id : req.user.uid}); 
});


app.post('/add-game/:user_id', middleware.ensureAdminPriveledge, function(req, res) {
   Game.create({ game_time : (req.body.time1), game_end_time : (req.body.time2) }, (err, redd) =>{
      res.redirect('/admin/' + req.params.user_id);
   })
});

app.get('/admin/:user_id', middleware.ensureAdminPriveledge, (req, res) => {
   var gameusers = [];  
   var nextGame = null;
   Game.find({played : false}).sort({game_time : 1}).then(nextGames => {
      nextGame = nextGames[0];
      console.log(nextGames)
      Game.find({played: true}).sort({game_time : -1}).limit(15).then(pastGames => {
         if(nextGame){
            GameClient.find({game_id : nextGame._id}).then(nextGamePlayers => {
               var user = [];  
               nextGamePlayers.forEach(x => {
                  user.push({uid : x.user_id});
               });
               middleware.admin.auth().getUsers(user).then(function(getUsersResult) {
                  getUsersResult.users.forEach((userRecord) => {
                    gameusers.push({uid : userRecord.uid, name : userRecord.displayName, phone : userRecord.phoneNumber})
                  });
                  res.render('admin', {user_id: req.params.user_id, nextGame, pastGames, nextGamePlayers, gameusers, nextGames});
               });
            });
         }
         else{
            res.render('admin', {user_id: req.params.user_id, nextGame : null, pastGames, nextGamePlayers : null, gameusers, nextGames});
         }
      })
   });
});

app.get('/fetch-users-game/:id/:user_id', middleware.ensureAdminPriveledge, (req, res) => {
   var gameusers = [];
   GameClient.find({game_id : req.params.id}).then(gamePlayers => {
      var user = [];  
      gamePlayers.forEach(x => {
         user.push({uid : x.user_id});
      });
      middleware.admin.auth().getUsers(user).then(function(getUsersResult) {
         getUsersResult.users.forEach((userRecord) => {
            gameusers.push({uid : userRecord.uid, name : userRecord.displayName, phone : userRecord.phoneNumber})
         });
         res.send({gameusers});
      });
   });
})

app.get('/fetch-winners-game/:id/:user_id', middleware.ensureAdminPriveledge, (req, res) => {
   var gameusers = [];
   Game.findOne({_id : req.params.id}).then(gameWinner => {
      var user = [];  
      if(gameWinner.full_house != null)user.push({uid : gameWinner.full_house});
      if(gameWinner.first_five != null)user.push({uid : gameWinner.first_five});
      if(gameWinner.top_row != null)user.push({uid : gameWinner.top_row});
      if(gameWinner.middle_row != null)user.push({uid : gameWinner.middle_row});
      if(gameWinner.bottom_row != null)user.push({uid : gameWinner.bottom_row});
      middleware.admin.auth().getUsers(user).then(function(getUsersResult) {
         getUsersResult.users.forEach((userRecord) => {
            gameusers.push({uid : userRecord.uid, name : userRecord.displayName, phone : userRecord.phoneNumber})
         });

        winners = [];
         gameusers.forEach(y => {
            if(y.uid == gameWinner.full_house)
               winners.push({game : "Full House", user : y});
            if(y.uid == gameWinner.first_five)
               winners.push({game : "First five", user : y});
            if(y.uid == gameWinner.top_row)
               winners.push({game : "Top Row", user : y});
            if(y.uid == gameWinner.middle_row)
               winners.push({game : "Middle Row", user : y});
            if(y.uid == gameWinner.bottom_row)
               winners.push({game : "Bottom Row", user : y});
         });

         res.send({winners});
      });
   });
})

app.post('/delete-game/:id/:user_id', middleware.ensureAdminPriveledge, (req, res) => {
   Game.deleteOne({_id : req.params.id}).then(gameWinner => {
      res.redirect('/admin/' + req.params.user_id + '?id=upcoming');
   }).catch(err => {
      res.send({message : err});
   });
});

app.post('/update-game/:id/:user_id', middleware.ensureAdminPriveledge, (req, res) => {
   Game.updateOne({_id : req.params.id}, {$set : { game_time : req.body.time }}).then(gameWinner => {
      res.redirect('/admin/' + req.params.user_id + '?id=next');
   }).catch(err => {
      res.send({message : err});
   });
})

io.on('connection', function(socket) {
   players++;
   console.log(players + " connected. This one is " + socket.id);
   var current_user = null;
   console.log("Disbarred user");
   console.log(dibarred_user);

   socket.on('initialize-data', function(user){
      Game.find({played : false}).sort({game_time : 1}).limit(1).then(game => {
         var current_game = game[0];
         var game_time = new Date(current_game.game_time);
         var game_end_time = new Date(current_game.game_end_time);
         var flag = 0;
         game_players.forEach(x => {
            if(x == user.uid){
               console.log("User playing already");
               socket.emit("unauthorized-usage", "User has already playing in another device/tab");
               flag = 1;
            }
         });
         if(flag == 0){
            dibarred_user.forEach(x => {
               if(x == user.uid){
                  console.log("Debarred User");
                  socket.emit("unauthorized-usage", "User has been debbared from the current game");
                  flag = 1;
               }
            });
            if(flag == 0){
               console.log("Game Initiated for player");
               current_user = user;
               game_players.push(user.uid);
               socket.emit("game-initialized", game_time, game_end_time, current_game);
            }
         }
      });
   });

    // Send user game data
   socket.on('game-start', function(user, game){
      if(game){
         GameClient.find({user_id : user.uid, game_id : game._id}, (err, client) => {
            if(client[0].ticket != null && client[0].ticket.length!=0){
               console.log("Old ticket retrieved");
               var ticket = client[0].ticket;
               socket.emit('loadGameData', ticket, usedSequence);
            }
            else{
               console.log("New ticker generated");
               var ticket = tambola.getTickets(1)[0];
               GameClient.findOneAndUpdate({user_id : user.uid, game_id : game._id}, {$set : { ticket : ticket}}, (err, result) => {
                  socket.emit('loadGameData', ticket, usedSequence);
               });
            }
         })
      }
      else{
         console.log("Game not present: null");
         socket.emit("unauthorized-usage", "An unauthorised access");
      }
   });

   socket.on('full-house', function(ticket_client, user, game){
      var claim = null;
      for (let i = 0; i < 3; i++) {
         for (let j = 0; j < 9; j++) {
             var value = ticket_client[i][j];
             var flag = 0;
             if(value != 0){
               usedSequence.forEach(x => {
                  if(x == Math.abs(value) && value != Math.abs(value)){
                     flag = 1;
                  }    
               });
               if(flag == 0){
                  claim = false
               }
             }
         }    
     }
     if(claim == null){
        claim = true;
     }
      if(claim){
         Game.findOne({_id : game._id}, (err, game_data) =>{
            if(game_data && !game_data.full_house){
               console.log("FH Won");
               Game.findOneAndUpdate({_id : game._id}, {$set : {full_house :  user.uid, played : true, game_end_time : new Date()}}, (err, result) => {
               socket.broadcast.emit('full-house-winner', user.displayName+ ' has won full house', game_data);
               socket.emit('full-house-winner-you', 'Congrats you won full house', game_data); 
               /* clearAllTimeouts(); */
               })
            }
            else{
               console.log("Wrong Claim FH");
               dibarred_user.push(user.uid);
               socket.emit('wrong-claim', user.phoneNumber);
            }
         })
      }
      else{
         console.log("Wrong Clai FH");
         dibarred_user.push(user.uid);
         socket.emit('wrong-claim', user.phoneNumber);
      }
   });

   socket.on('top-row', function(ticket_client, user, game){
      var claim = null;
      for (let i = 0; i < 9; i++) {
         var value = ticket_client[0][i];
         var flag = 0;
         if(value != 0){
            usedSequence.forEach(x => {
               if(x == Math.abs(value) && value != Math.abs(value)){
                  flag = 1;
               }    
            });
            if(flag == 0){
               claim = false
            }
         } 
      }
      if(claim == null){
         claim = true;
      }
      if(claim){
         Game.findOne({_id : game._id}, (err, game_data) =>{
            if(game_data && !game_data.top_row){
               console.log("TR Won");
               Game.findOneAndUpdate({_id : game._id}, {$set : { top_row : user.uid }}, (err, result) => {
                  socket.broadcast.emit('top-row-winner', user.displayName +' has won top row');
                  socket.emit('top-row-winner', 'Congrats you won top row');
               })
            }
            else{
               console.log("Wrong Claim TR");
               dibarred_user.push(user.uid);
               socket.emit('wrong-claim', user.phoneNumber);
            }
         });
      }
      else{
         console.log("Wrong Claim TR");
         dibarred_user.push(user.uid);
         socket.emit('wrong-claim', user.phoneNumber);
      }
   });

   socket.on('middle-row', function(ticket_client, user, game){
      var claim = null;
      for (let i = 0; i < 9; i++) {
         var value = ticket_client[1][i];
         var flag = 0;
         if(value != 0){
            usedSequence.forEach(x => {
               if(x == Math.abs(value) && value != Math.abs(value)){
                  flag = 1;
               }    
            });
            if(flag == 0){
               claim = false
            }
         } 
      }
      if(claim == null){
         claim = true;
      }
      if(claim){
         Game.findOne({_id : game._id}, (err, game_data) =>{
            if(game_data && !game_data.middle_row){
               console.log("MR Won");
               Game.findOneAndUpdate({_id : game._id}, {$set : { middle_row : user.uid }}, (err, result) => {
               socket.broadcast.emit('middle-row-winner', user.displayName + ' has won middle row');
               socket.emit('middle-row-winner', 'Congrats you won middle row');
               });
            }
            else{
               console.log("Wrong Claim MR");
               dibarred_user.push(user.uid);
               socket.emit('wrong-claim', user.phoneNumber);
            }
         });
      }
      else{
         console.log("Wrong Claim MR");
         dibarred_user.push(user.uid);
         socket.emit('wrong-claim', user.phoneNumber);
      }

      
   });

   socket.on('bottom-row', function(ticket_client, user, game){
      var claim = null;
      for (let i = 0; i < 9; i++) {
         var value = ticket_client[2][i];
         var flag = 0;
         if(value != 0){
            usedSequence.forEach(x => {
               if(x == Math.abs(value) && value != Math.abs(value)){
                  flag = 1;
               }    
            });
            if(flag == 0){
               claim = false
            }
         } 
      }
      if(claim == null){
         claim = true;
      }
      if(claim){
         Game.findOne({_id : game._id}, (err, game_data) =>{
            if(game_data && !game_data.bottom_row){
               console.log("BR Won");
               Game.findOneAndUpdate({_id : game._id}, {$set : { bottom_row : user.uid }}, (err, result) => {
               socket.broadcast.emit('bottom-row-winner', user.displayName +  ' has won bottom row');
               socket.emit('bottom-row-winner', 'Congrats you won bottom row');
               })
            }
            else{
               console.log("Wrong Claim BR");
               dibarred_user.push(user.uid);
               socket.emit('wrong-claim', user.phoneNumber);
            }
         })
      }
      else{
         console.log("Wrong Claim BR");
         dibarred_user.push(user.uid);
         socket.emit('wrong-claim', user.phoneNumber);
      }

      
   });

   socket.on('first-five', function(ticket_client, user, game){
      var flag = 0;
      var claim = null;
      var count = 0;
      for (let i = 0; i < 3; i++) {
         for (let j = 0; j < 9; j++) {
            var value = ticket_client[i][j];
            if(value != Math.abs(value)){
               count ++;
               usedSequence.forEach(x => {
                  if(x == Math.abs(value)){
                     flag = 1;
                  }    
               });
               if(flag == 0){
                  claim = false
               }
            }
         }      
      }     
      if(count == 5 && claim != false){
         claim = true;
      }
      else{
         claim = false;
      }
      if(claim){
         Game.findOne({_id : game._id}, (err, game_data) =>{
            if(game_data && !game_data.first_five){
               console.log("FF Won");
               Game.findOneAndUpdate({_id : game._id}, {$set : { first_five : user.uid }}, (err, result) => {
                  socket.emit('first-five-winner', 'Congrats you won first-five');
                  socket.broadcast.emit('first-five-winner', user.displayName + ' has won first-five');
               });
            }
            else{
               console.log("Wrong Claim FF");
               dibarred_user.push(user.uid);
               socket.emit('wrong-claim', user.phoneNumber);
            }
         });
      }
      else{
         console.log("Wrong Claim FF");
         dibarred_user.push(user.uid);
         socket.emit('wrong-claim', user.phoneNumber);
      }
      
   });

   socket.on('save-game-checkpoint', function(ticket, user, game){
      GameClient.updateOne({user_id : user.uid, game_id : game._id}, {$set : {ticket : ticket}}, (err, result)=> {
         console.log("Game checkpoint saved");
      });
   })

   socket.on('logout-user', function(user){
      console.log("User logged out");
      var index = game_players.indexOf(user.uid);
      if (index > -1) {
         game_players.splice(index, 1);
      }
   });

   socket.on('get-showed-sequence', function(){
      console.log("Reconnecting User");
      socket.emit('emit-used-sequence', usedSequence, sequence[i]);
   })

   socket.on('disconnect', function () {
      players--;   
      if(current_user){
         var index = game_players.indexOf(current_user.uid);
         if (index > -1) {
            game_players.splice(index, 1);
         }
         console.log("User actually disconnected")
         console.log(game_players)
      }
      else{
         console.log("User disconnection error: null");
      }
   });
});


initiationGame();

function initiationGame() {
   console.log("Server game start");
   Game.findOne({played : false}).sort({game_time : 1, game_end_time: 1}).limit(1).then(gg => {
      game_next = gg;
      if(gg && new Date(gg.game_end_time) > new Date()){
         console.log(gg);
         var nextTime = new Date(gg.game_time).getTime() - new Date().getTime();
         console.log(nextTime);
         setTimeout(newGameStart, nextTime);
      }
      else{
         if(!gg){
            console.log("No game available");
         }
         else{
            console.log("Its Over")
            gameFinished();
         }
      }
   });
}

function newGameStart() {
   sequence          = tambola.getDrawSequence(),
   i                 = 0,
   usedSequence      = [],
   time              = 4,
   refreshIntervalId = null,
   timerID           = null,
   game_players      = [],
   dibarred_user     = [];
   console.log("New game start");
   refreshIntervalId = setInterval(doStuff, 5000);
   timerID = setInterval(setTimer, 1000);
}

function setTimer(){
   io.sockets.emit('timer', time--);
}

function doStuff() {
   var words = ['', 'positive', 'joy', 'happy', 'zeal', 'smile', 'gain', 'nice', 'beautiful', 'profit', 'cheer', 'wonderful', 'good',
                  'better', 'best', 'bright', 'optimistic', 'strong', 'will', 'hope', 'certain', 'sure', 'accept', 'warm', 'appreciate', 'friendly', 'adore', 'support', 'respect', 'sympathy', 'advice', 'recommend', 'clear', 'confident',
                  'assure', 'accomplish', 'content', 'jolly', 'carefree', 'elated', 'blessed', 'worship', 'glad', 'benefit',
                  'fortunate', 'laugh', 'love', 'win', 'comfort', 'safe', 'merry', 'success', 'healthy', 'mind', 'matters', 'body', 'paradise', 'okay', 'glory', 'enjoy', 'amazing', 'joke', 'cute', 'hug', 'tasty', 'achieve', 'praise', 'optimist', 'smart', 'pleasant', 'awesome', 'peace', 
                  'delight', 'kind', 'honest', 'trust', 'polite', 'generous', 'helping', 'guide', 'consistent', 'celebrate', 'faith', 'truth', 'firm', 'sunshine', 'light', 'promise', 'calm', 'asha', 'ease', 'mental', 'well-being', 'bliss', 'courage', 'pledge', 'cool', 'brave']
   words = words.sort();
   usedSequence.push(sequence[i]);
   time = 4;
   console.log("Word shwon  " + i + " - " + words[sequence[i]]);
   io.sockets.emit('nextNumber', 'Your next word is '+ sequence[i], sequence[i], i+1);
   i++;
   if(i==90){
      io.sockets.emit('last-word-shown');
      clearInterval(refreshIntervalId);
      clearInterval(timerID);
      console.log("Last peiced shown");
      setTimeout(gameFinished, 22000);
   }
}

function gameFinished() {
   Game.updateOne({_id : game_next._id}, {$set : {played : true, game_end_time : new Date()}}, (err, result) => {
      io.sockets.emit('game-finished', game_next._id);
      console.log("Game ended by time");
      initiationGame();
   });
}

function refreshState() {
   Game.findOne({played : false}).sort({game_time : 1, game_end_time: 1}).limit(1).then(gg => {
      console.log("Checking");
      if((!game_next && gg) || (game_next && gg && !game_next._id.equals(gg._id))){
         console.log("Changed");
         initiationGame();
      }
   });
}

setInterval(refreshState, 1000 * 60 * 1);




http.listen(process.env.PORT || 3000, function() {
   console.log('listening on *:3000');
});



/* 
app.get('/payment/:user_id/:game_id', [middleware.ensureGameAuth, middleware.ensureUserAuthentication, middleware.checkPayment], (req, res) => {
   res.render('payment', {uid : req.params.user_id, game_id : req.params.game_id});
});

app.post('/payment-order-create', [middleware.ensureGameAuthRazorpay, middleware.ensureUserAuthenticationRazorpay, middleware.checkPaymentRazorpay], (req, res) => {
   var options = { amount: 2500, currency: "INR", receipt: "order_rcptid_11", payment_capture: '1' };
   instance.orders.create(options, (err, response) => {
      if(err){
         console.log(err);
         res.send({status : 0, message : err});
      }
      else{
         console.log(response);
         res.send({ status : 1, message : response});
      }
   });
});

app.post('/payment-confirmation', [middleware.ensureGameAuthRazorpay, middleware.ensureUserAuthenticationRazorpay, middleware.checkPaymentRazorpay], (req, res) => {
   var payment_id = req.body.response.razorpay_payment_id;
   instance.payments.fetch(payment_id, (err, response) => {
      if(err){
         console.log(err);
         res.send({status : 3, message:"Fetch payment confirmation."});
      }
      else{
         console.log(response);
         if(response.status == 'authorized'){
            request({
               method: 'POST',
               url: 'https://'+ vault.razorpay.key_id +':'+ vault.razorpay.key_secret +'@api.razorpay.com/v1/payments/'+ payment_id +'/capture',
               form: {
                 amount: 2500,
                 currency: INR
               }
             }, function (error, response, body) {
               console.log('Status:', response.statusCode);
               console.log('Headers:', JSON.stringify(response.headers));
               console.log('Response:', body);
               GameClient.create({ game_id : req.body.game_id, user_id : req.body.user_id, payment : true, payment_id : payment_id}, (err, game_c) => {
                  if(err){
                     console.log(err);
                     res.send({status : 4, message:"Udating payment information error."});
                  }
                  else{
                     console.log(response);
                     res.send({status: 1 , message : "Payment Successfull."})
                  }
               }); 
             });
         }
         else if(response.status == 'failed'){
            res.send({status : 0, message:"Transaction failed"});
         }
         else if(response.status == 'captured'){
            GameClient.create({ game_id : req.body.game_id, user_id : req.body.user_id, payment : true, payment_id : payment_id}, (err, game_c) => {
               if(err){
                  console.log(err);
                  res.send({status : 4, message:"Udating payment information error."});
               }
               else{
                  console.log(response);
                  res.send({status: 1 , message : "Payment Successfull."})
               }
            }); 
         }
         else{
            res.send({status : 2, message:"Some other problem occured for transaction."});
         }
      }
   })
}); */





