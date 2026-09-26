import "dotenv/config"
import dns from "node:dns"
import http from "http"
import {app,allowedOrigins} from './app.js'

import {connectDB} from './db/index.js'
import {Server} from "socket.io"
import { User } from "./model/user.model.js"
import { ApiError } from "./utils/ApiError.js"
import jwt from "jsonwebtoken"
import { Message } from "./model/message.model.js"
import {createClient} from "redis"

dns.setServers(['1.1.1.1','8.8.8.8'])

const server = http.createServer(app)

const io = new Server(server,{
    cors:{
        origin:allowedOrigins,
        credentials:true
    }
})

const client=createClient({
    url:process.env.REDIS_URL
})

client.on("error",(err)=>{
    console.log("Redis error: ",err);
})

await client.connect();


//const onlineUsers = new Map()

const port = process.env.PORT || 8000;
connectDB()
.then(()=>{
    io.use(async (socket,next)=>{
        try{
            const cookieHeader = socket.handshake.headers.cookie || ""
            const accessTokenCookie = cookieHeader
                .split(";")
                .map((cookie) => cookie.trim())
                .find((cookie) => cookie.startsWith("accessToken="))

            const token = socket.handshake.auth?.accessToken || accessTokenCookie?.slice("accessToken=".length)
            if(!token){
                throw new ApiError(404,"Token not exist")
            }
            const decodedToken = await jwt.verify(token,process.env.ACCESS_TOKEN_SECRET_KEY)
            const user = await User.findById(decodedToken?._id).select("-password -refreshToken");
            
            if(!user){
                throw new ApiError(404,"User not exist with that token")
            }
            
            socket.user=user

            next()

        }catch(error){
            next(new Error("Authentication Failed"))
        }
    })
    io.on("connection",async (socket)=>{
   
    //console.log("User Connected",socket.id);
        
        const userId = socket.user._id.toString();

        await client.set(`online:${userId}`,
            JSON.stringify({
            socketId:socket.id,
            username:socket.user.username

        }));

      //  console.log("\nCurrent online users:");

        // for (const [id, user] of client) {
        //     console.log(id, user);
        // }
        

        // socket.on("chat message", (message) => {
        //         console.log(
        //         `${socket.user.username}:`,
        //         message
        //     );

        // });
        socket.on("get_all_users",async()=>{
            try{
                const allUsers = await User.find().select("-password -refreshToken");
                
                if(!allUsers){
                    return null;
                }

                const all_users = await Promise.all(
                    allUsers.map(async(user)=>{
                    
                    const userId = user._id.toString()

                    const isOnline = await client.exists(`online:${userId}`);

                    if(isOnline){

                        return {
                            _id:user._id,username:user.username,status:true
                        }

                    }
                    else{
                        return {
                            username:user.username,status:false
                        }
                    }

                })
            )

                socket.emit("get_all",all_users);

            }catch(error){
                console.log("Error in fetching users ",error);
        
            }
        });
        socket.on("send_message",async (data)=>{

            try {
                const {recieverUsername,message} = data;
                if(!recieverUsername?.trim() || !message?.trim()){
                    return;
                }
                const reciever = await User.findOne({username:recieverUsername})
                
                if(!reciever){
                    return socket.emit("message_error",{
                        message:"Reciever does not exist"
                    })
                }

                const recieverData = await client.get(
                    `online:${reciever._id.toString()}`
                );
               
                const recieverSocket =recieverData?JSON.parse(recieverData):null;

                const response = await Message.create({
                    senderId:socket.user._id,
                    recieverId:reciever?._id,
                    content:message,
                    status:recieverSocket?"delivered":"sent"
                })
                
                console.log("Response: ",response)

                if(recieverSocket){

                    io.to(recieverSocket.socketId).emit(
                        "receive_message",
                        response
                    )

                    console.log("Message sent to",reciever.username)
                }
                else{
                    console.log(reciever.username,"Is currently offline")
                }

                socket.emit("message_sent", response);
               
            } catch (error) {
                console.error("Error saving message:",error)
                socket.emit("message_error",{
                    message:"Message could not be saved. Please try again."
                })
            }
        })

        socket.on("message_seen",async({senderId})=>{
            try{
                await Message.updateMany(
                    {
                        senderId:senderId,
                        recieverId:socket.user._id,
                        status:{$ne:"seen"}
                    },
                    {
                        $set:{status:"seen"}
                    }
                )
            }catch(error){
                console.log("error")
            }
        })
        socket.on("message_delivered",async({senderId})=>{
            try {
                await Message.updateMany({
                    senderId,
                    recieverId:socket.user._id,
                    status:"sent",
                },
                    {
                        $set:{status:"delivered"}
                    }
                

                )
            } catch (error) {
                console.log("error: ",error)
            }
        })
        socket.on("get_History",async(data)=>{
            try {
                const recieverUsername = data?.recieverUsername?.trim();
                if(!recieverUsername){
                    return;
                }

                const reciever = await User.findOne({username:recieverUsername})
                if(!reciever){
                    return socket.emit("history_error",{
                        message:"User not found"
                    })
                }
                const messages = await Message.find({
                    $or:[
                        {senderId:socket.user._id,recieverId:reciever._id},
                        {senderId:reciever._id,recieverId:socket.user._id}
                    ]
                }).sort({createdAt:1})
                
                socket.emit("history_sent",messages);

            } catch (error) {
                console.log("Error:",error)
            }
        })
        socket.on("get_recent_users", async () => {
            try {

            const currentUserId = socket.user._id;

            const messages = await Message.find({
                $or: [
                    { senderId: currentUserId },
                    { recieverId: currentUserId }
                ]
            }).sort({ createdAt: -1 });


            const recentUsers = new Map();

            for (const message of messages) {

                const otherUserId =
                    message.senderId.toString() === currentUserId.toString()
                        ? message.recieverId.toString()
                        : message.senderId.toString();

                // Since messages are sorted newest first,
                // only store the first message for each user
                if (!recentUsers.has(otherUserId)) {
                    recentUsers.set(otherUserId, message);
                }
            }


        const userIds = [...recentUsers.keys()];

        const users = await User.find({
            _id: { $in: userIds }
        }).select("-password -refreshToken");


        const result = await Promise.all(
            users.map(async (user) => {

                const message = recentUsers.get(
                    user._id.toString()
                );

                const isOnline = await client.exists(
                    `online:${user._id.toString()}`
                );

                return {
                    user: {
                        _id: user._id,
                        username: user.username,
                        fullName: user.fullName,
                        avatar: user.avatar
                    },

                    lastMessage: message.content,
                    lastMessageTime: message.createdAt,

                    online: isOnline === 1
                };
            })
        );


        // Sort according to latest message
        result.sort(
            (a, b) =>
                new Date(b.lastMessageTime) -
                new Date(a.lastMessageTime)
        );


        socket.emit("recent_users", result);

    } catch (error) {

        console.log("Error fetching recent users:", error);

    }
});
    
        socket.on("disconnect",()=>{
            client.del(`online:${userId}`)
            console.log("User Disconnected:",socket.user.username);
        })
    })
})
.then(()=>{server.listen(port,()=>{
    console.log(`Server is running on PORT ${port}`)
})}).catch((error)=>[
    console.log("MongoDb connection connection failed ",error)
])

