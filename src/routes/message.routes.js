import {Router} from "express";
import { createMessage,getMessages, getRecentChats } from "../controller/message.controller.js";
import { verifyJWT } from "../middleware/auth.middleware.js";
const messageRouter = Router();

messageRouter.route("/create-message").post(verifyJWT,createMessage)
messageRouter.route("/get-messages").post(verifyJWT,getMessages)
messageRouter.route("/get-recent-chats").get(verifyJWT,getRecentChats)
export {messageRouter}