import { isValidObjectId } from "mongoose";
import { Message } from "../model/message.model.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../model/user.model.js";
import {ApiResponse} from '../utils/ApiResponse.js'
import { asyncHandler } from "../utils/asyncHandler.js";
const createMessage = asyncHandler(async(req,res)=>{
    
    const {message,recieverId}= req.body

    if(!message?.trim()==="" || !recieverId ){
        throw new ApiError(404,"Message and reciever id are required");
    }

    if(!isValidObjectId(recieverId)){
        throw new ApiError(400,"reciever id is not valid");
    }

    const reciever = await User.findById(recieverId);
    if(!reciever){
        throw new ApiError(404,"Reciever not exist");
    }
    
    const createdMessage = await Message.create({
        senderId:req.user._id,
        recieverId:recieverId,
        content:message
    });

    if(!createdMessage){
        throw new ApiError(404,"Message not created");
    }

    return res.status(200).json(new ApiResponse(200,createMessage,"Message created successfully"))
})

const getMessages = asyncHandler(async(req,res)=>{
    const {recieverUsername} = req.body;

    if(!recieverUsername?.trim()===""){
        throw new ApiError(404,"reciever Username is required")
    }
    const reciever = await User.findOne({username:recieverUsername})
    const messages = await Message.find({
        $or:[{recieverId:reciever._id,senderId:req.user._id},{recieverId:req.user._id,senderId:reciever._id}]
    }).sort({createdAt:1});

    if(!messages?.length===0){
        throw new ApiError(404,"Message not exist with this username")
    }
    return res.status(200).json(new ApiResponse(200,messages,"Messages fetched successfully successfully"))

})

const getRecentChats = async (socket) => {
    try {
        const currentUserId = socket.user._id;

        const recentChats = await Message.aggregate([
            // 1. Get only messages involving the logged-in user
            {
                $match: {
                    $or: [
                        { senderId: currentUserId },
                        { recieverId: currentUserId }
                    ]
                }
            },

            // 2. Latest messages first
            {
                $sort: {
                    createdAt: -1
                }
            },

            // 3. Find the other user in each message
            {
                $addFields: {
                    otherUserId: {
                        $cond: [
                            { $eq: ["$senderId", currentUserId] },
                            "$recieverId",
                            "$senderId"
                        ]
                    }
                }
            },

            // 4. One conversation per user
            // Since we sorted newest first,
            // $first gives us the latest message
            {
                $group: {
                    _id: "$otherUserId",
                    lastMessage: { $first: "$content" },
                    lastMessageTime: { $first: "$createdAt" }
                }
            },

            // 5. Latest conversations first
            {
                $sort: {
                    lastMessageTime: -1
                }
            },

            // 6. Get user information
            {
                $lookup: {
                    from: "users",
                    localField: "_id",
                    foreignField: "_id",
                    as: "user"
                }
            },

            // 7. Convert user array into object
            {
                $unwind: "$user"
            },

            // 8. Return only what frontend needs
            {
                $project: {
                    _id: 0,

                    user: {
                        _id: "$user._id",
                        username: "$user.username",
                        fullName: "$user.fullName",
                        avatar: "$user.avatar"
                    },

                    lastMessage: 1,
                    lastMessageTime: 1
                }
            }
        ]);

        // Add online status
        // const chatsWithStatus = recentChats.map(chat => ({
        //     ...chat,
        //     online: onlineUsers.has(
        //         chat.user._id.toString()
        //     )
        // }));

        socket.emit("recent_chats", recentChats);

    } catch (error) {
        console.log("Error fetching recent chats:", error);
    }
};

export {createMessage,getMessages,getRecentChats}