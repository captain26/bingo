var mongoose = require("mongoose");
var passportLocalMongoose = require("passport-local-mongoose");

var gameSchema = new mongoose.Schema({

	played : {
		type : Boolean,
		default : false
	},
	first_five : {
		type : String,
		default : null
	},
	top_row : {
		type : String,
		default : null
	},
	middle_row : {
		type : String,
		default : null
	},
	bottom_row : {
		type : String,
		default : null
	},
	full_house : {
		type : String,
		default : null
	},
	game_time : {
		type : String
	},
	game_end_time : {
		type : String
	}
})


gameSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model("Game", gameSchema);