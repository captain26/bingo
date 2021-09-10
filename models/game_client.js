var mongoose = require("mongoose");
var passportLocalMongoose = require("passport-local-mongoose");

var gameClientSchema = new mongoose.Schema({
		game_id : {
            type : String,
            required : true
        },
        user_id : {
            type : String,
            required : true
        },
        payment : {
            type : Boolean,
            default : false
        },
        ticket : [[{
            type : Number
        }]],
        payment_id : {
            type : String
        },
        created_at : {
            type : Date,
            default : new Date()
        }
})


gameClientSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model("GameClient", gameClientSchema);