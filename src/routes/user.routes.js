import {Router} from "express"
import { createUser,getallUsers,getCurrentUser,loginUser,logoutUser } from "../controller/user.controller.js";
import { optionalJWT,verifyJWT } from "../middleware/auth.middleware.js";
import { upload } from "../middleware/multer.middleware.js";
const userRouter = Router();

userRouter.route("/create-user").post(upload.fields([
        {
            name:"avatar",
            maxCount:1
        }
        
    ]),createUser);
userRouter.route("/login").post(loginUser);
userRouter.route("/logout").post(verifyJWT,logoutUser)
userRouter.route("/all-user").get(verifyJWT,getallUsers)
userRouter.route("/current-user").get(optionalJWT,getCurrentUser)
userRouter.route("/user/:userId").get(verifyJWT,getCurrentUser)
export {userRouter}
