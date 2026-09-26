import jwt from "jsonwebtoken"
import { User } from "../model/user.model.js"

const verifyJWT= async(req,res,next)=>{
    try {
        const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ","")
        if(!token){
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            })
        }

        const decodedToken = jwt.verify(token,process.env.ACCESS_TOKEN_SECRET_KEY)
        const user = await User.findById(decodedToken?._id).select("-refreshToken -password")

        if(!user){
            return res.status(401).json({
                success: false,
                message: "Invalid access token"
            })
        }

        req.user=user
        next()
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: error?.message || "Invalid Access Token"
        })
    }

}

const optionalJWT = async(req,res,next)=>{
    try {
        const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ","")
        if(token){
            const decodedToken = jwt.verify(token,process.env.ACCESS_TOKEN_SECRET_KEY)
            req.user = await User.findById(decodedToken?._id).select("-refreshToken -password")
        }
    } catch (error) {
        req.user = null
    }

    next()
}

export {verifyJWT,optionalJWT}