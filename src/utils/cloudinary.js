import {v2 as cloudinary} from "cloudinary"
import { ApiError } from "./ApiError.js"
import fs from "fs"
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
    api_key: process.env.CLOUDINARY_API_KEY, 
    api_secret: process.env.CLOUDINARY_API_SECRET
})
const uploadOnCloudinary = async (filepath) => {
    try {
        if (!filepath) {
            throw new ApiError(400, "Filepath does not exist");
        }

       // console.log("Cloudinary upload path:", filepath);

        const response = await cloudinary.uploader.upload(filepath, {
            resource_type: "auto"
        });

       // console.log("Cloudinary response:", response);

        // Delete the local file after successful upload
        if (fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
        }

        return response;

    } catch (error) {

        // IMPORTANT: Print the actual error
        console.error(
            "Cloudinary upload failed:",
            error.message
        );

        console.error(error);

        // Delete the temporary file safely
        if (filepath && fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
        }

        return null;
    }
};

const deleteFromCloudinary = async(public_id)=>{
    try {
        const response = cloudinary.uploader.destroy(public_id,{resource_type:"image",invalidate:true})
        return response;
    } catch (error) {
        return null;
    }

}

export {uploadOnCloudinary}