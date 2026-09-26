import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
    senderId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User"
    },
    recieverId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User"
    },
    content:{
        type:String,
        trim:true,
        required:true,
    },
    status:{
        type:String,
        required:true,
        trim:true
    }
},{timestamps:true})

const Message=mongoose.model("Message",messageSchema);

export {Message}