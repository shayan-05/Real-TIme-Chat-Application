import express from "express"
import { userRouter } from "./routes/user.routes.js"
import { messageRouter } from "./routes/message.routes.js"
import cors from "cors"
import cookieParser from "cookie-parser"

const app=express()

const allowedOrigins = [
    process.env.CORS_ORIGIN,
    "http://localhost:5173",
    "http://localhost:5174"
].filter(Boolean)

app.use(cors({
    origin:(origin,callback)=>{
        if(!origin || allowedOrigins.includes(origin)){
            return callback(null,true)
        }

        return callback(new Error("Origin not allowed by CORS"))
    },
    credentials:true

}))

app.use(express.json({limits:"16kb"}))
app.use(express.urlencoded({extended:true,limit:"16kb"}))
app.use(express.static("public"))
app.use(cookieParser())

app.use("/api/v1/user",userRouter);
app.use("/api/v1/message",messageRouter)
export {app,allowedOrigins}