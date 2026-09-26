import { isValidObjectId } from "mongoose";
import { User } from "../model/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import {uploadOnCloudinary} from '../utils/cloudinary.js'

const generateAccessAndRefreshToken = async(userId)=>{
    
    try {

        if(!isValidObjectId(userId)){
            throw new ApiError(404,"Invalid User Id")
        }
        const user = await User.findById(userId);
        if(!user){
            throw new ApiError(404,"User not exist with that id")
        }
    
        const accessToken = await user.generateAccessToken();
        const refreshToken = await user.generateRefreshToken();
        
        if(!accessToken || !refreshToken){
            throw new ApiError(500,"Error in generation of access or refresh Token")
        }
    
        user.refreshToken=refreshToken
        await user.save({validateBeforeSave:false})

        return {accessToken,refreshToken}

    
    } catch (error) {
        console.log("Error in Generate Tokens ",error)
        throw new ApiError(500,"Something went wrong while generating tokens")
    }

}

const createUser = asyncHandler(async(req,res)=>{
    
    const {username,fullName,email,password}=req.body;
    if([username,fullName,email,password].some((field)=>field?.trim()=="")){
        throw new ApiError(404,"All the fields are required")
    }

    const existedUser = await User.findOne({
        $or:[{username},{email}]
    })
    
    if(existedUser){
        throw new ApiError(404,"User already exist with thar username or email");
    }

    const avatarLocalPath = req.files?.avatar?.[0]?.path;
    if(!avatarLocalPath){
        throw new ApiError(404,"Avatar file path not exist")
    }
    //console.log("Before cloudinary",avatarLocalPath)
    const upload = await uploadOnCloudinary(avatarLocalPath);
   // console.log("uploaded file url ",upload.url)
    if(!upload?.url){
        throw new ApiError(500,"Error in uploading file on cloudinary")
    }


    const user = await User.create({
        username:username,
        fullName:fullName,
        email,
        password,
        avatar:upload.url
    })

    if(!user){
        throw new ApiError(404,"Error in creating user")
    }
    const createdUser = await User.findById(user._id).select("-password -refreshToken")

    return res.status(200).json(new ApiResponse(200,createdUser,"User created Successfully"))

})

const loginUser = asyncHandler(async(req,res)=>{
    
    const {email,password} = req.body;
    
    if(!email || !password){
        throw new ApiError(400,"Email or password required");
    }

    const user = await User.findOne({email:email});
    
    if(!user){
        throw new ApiError(404,"User not exist with this email id")
    }

    const isPasswordValid = await user.isPasswordCorrect(password);

    if(!isPasswordValid){
        throw new ApiError(404,"Invalid User credentials");
    }

    const {accessToken,refreshToken}=await generateAccessAndRefreshToken(user._id);
    const loginUser =await User.findById(user._id).select("-password -refreshToken");
    
    const options={
        httpOnly:true,
        secure:process.env.NODE_ENV === "production",
        sameSite:process.env.NODE_ENV === "production" ? "none" : "lax"
    }

    return res.status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(new ApiResponse(200,loginUser,"User Login Successfully"))

})

const logoutUser = asyncHandler(async(req,res)=>{
    

    const userId= req.user._id;
    
    if(!isValidObjectId(userId)){
        throw new ApiError(404,"UserId is not valid")
    }
    await User.findByIdAndUpdate(userId,{
        $unset:{
            refreshToken:1
        }
    },{new:true});
    

    const options={
        httpOnly:true,
        secure:process.env.NODE_ENV === "production",
        sameSite:process.env.NODE_ENV === "production" ? "none" : "lax"
    }

    return res.status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(new ApiResponse(200,{},"User Logout Successfully"))

})

const getCurrentUser = asyncHandler(async(req,res)=>{
    return res.status(200).json(new ApiResponse(200,req.user || null,"Current User fetched successfully"));
})

const getallUsers = asyncHandler(async (req, res) => {

    const users = await User
        .find({
            _id: { $ne: req.user._id }
        })
        .select("-password -refreshToken");

    return res.status(200).json(
        new ApiResponse(
            200,
            users,
            "Users fetched successfully"
        )
    );
});

export {createUser,loginUser,logoutUser,getallUsers,getCurrentUser}