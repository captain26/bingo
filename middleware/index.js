var middlewareObj = {};
var Game = require("../models/game");
var GameClient = require("../models/game_client");
var vault = require("./vault");
var admin = require("firebase-admin");

admin.initializeApp({
  credential: admin.credential.cert({
    type: vault.firebase.type,
    project_id: vault.firebase.project_id,
    private_key_id: vault.firebase.private_key_id,
    private_key: vault.firebase.private_key,
    client_email: vault.firebase.client_email,
  }),
});

middlewareObj.ensureGameAvailable = function (req, res, next) {
  Game.findOne({ played: false })
    .sort({ game_time: 1 })
    .limit(1)
    .then((nextGame) => {
      if (nextGame) {
        res.locals.nextGame = nextGame;
        next();
      } else {
        res.render("invalid", { message: "There is no next scheduled game" });
      }
    });
};

middlewareObj.ensureGameAuth = function (req, res, next) {
  Game.findOne({ played: false })
    .sort({ game_time: 1 })
    .limit(1)
    .then((nextGame) => {
      if (nextGame) {
        if (req.params.game_id == nextGame._id) {
          res.locals.nextGame = nextGame;
          next();
        } else {
          res.render("invalid", {
            message: "Invalid game access, this game is not the latest one.",
          });
        }
      } else {
        res.render("invalid", { message: "There is no next scheduled game" });
      }
    });
};

middlewareObj.ensurePaymentDone = function (req, res, next) {
  GameClient.findOne(
    { user_id: req.params.user_id, game_id: req.params.game_id, payment: true },
    (err, game_c) => {
      console.log(game_c);
      if (game_c) {
        next();
      } else {
        GameClient.create(
          {
            game_id: req.params.game_id,
            user_id: req.params.user_id,
            payment: true,
          },
          (err, game_c) => {
            if (err) {
              res.redirect("/");
            } else next();
          }
        );
      }
    }
  );
};

middlewareObj.ensureUserAuthentication = function (req, res, next) {
  admin
    .auth()
    .getUser(req.params.user_id)
    .then(function (userRecord) {
      req.user = userRecord;
      next();
    })
    .catch(function (error) {
      console.log(error);
      res.render("invalid", {
        message: "User data is not present, unauthorized login",
      });
    });
};

middlewareObj.ensureAdminPriveledge = function (req, res, next) {
  //  || userRecord.uid == 'VpHA9D1wwgMrdNF7ikn32lPIq8B3'
  admin
    .auth()
    .getUser(req.params.user_id)
    .then(function (userRecord) {
      if(userRecord.uid == 'DkZYWa3h7gSXr9nhL4IK6Y8nLaV2'){
        req.user = userRecord;
        next();
      }
      else{
        res.send({
          message: "You have no admin priveledge.",
        });
      }
    })
    .catch(function (error) {
      console.log(error);
      res.send({
        message: "You have no admin priveledge.Login ",
      });
    });
};

middlewareObj.checkUser = function (uid, resolve) {
  admin
    .auth()
    .getUser(uid)
    .then(function (userRecord) {
      return resolve;
    });
};

middlewareObj.admin = admin;

module.exports = middlewareObj;

/* middlewareObj.checkPayment = function(req, res, next) {
  console.log(res.locals.nextGame._id)
  GameClient.findOne({user_id : req.params.user_id, game_id : res.locals.nextGame._id, payment : true}, (err, game_c) => {
    console.log(game_c);
    (!game_c) ? next() : res.redirect('/mygame-list/' + req.params.user_id);
  });
} */

/* middlewareObj.ensureGameAuthRazorpay =  function(req, res, next) {
  Game.findOne({played : false}).sort({game_time : 1}).limit(1).then(nextGame => {
    console.log("1")
    if(nextGame){
      if( req.body.game_id == nextGame._id){
        res.locals.nextGame = nextGame;
        next();
      }
      else{
        res.send({status : 0, message : "Invalid game access, this game is not the latest one."})
      }
    }
    else{
      res.send({status : 0, message : "There is no next scheduled game"});
    }
 });
} */

/* middlewareObj.ensureUserAuthenticationRazorpay = function(req, res, next) {
  console.log("2")
  admin.auth().getUser(req.body.user_id).then(function(userRecord) {
    res.locals.users = userRecord;
    next();
  })
  .catch(function(error) {
    console.log(error);
    res.send({stauts : 0, message: "User data is not present, unauthorized login"});
 });
} */

/* middlewareObj.checkPaymentRazorpay = function(req, res, next) {
  console.log("3")
  GameClient.findOne({user_id : req.body.user_id, game_id : res.locals.nextGame._id, payment : true}, (err, game_c) => {
    (!game_c) ? next() : res.send({ status : 0, message : "Payment already done"});
  });
} */
