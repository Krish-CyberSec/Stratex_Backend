const { ImageKit } = require("@imagekit/nodejs")
require('dotenv').config()
const imagekitClient = new ImageKit({
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
})

const UploadProfile = async (fileBuffer, originalName) => {
    try {
        const extension = originalName.split('.').pop();

        return await imagekitClient.files.upload({
            file: fileBuffer.toString("base64"),
            fileName: `User-${Date.now()}.${extension}`,
            folder: "/userProfiles"
        });
        
    }
    catch (err) {
        console.error("Error uploading file:", err.message);
        throw err;
    }
}

const schoolImg = async (fileBuffer, originalName, slug, typeOf) => {

    try {
        const extension = originalName.split('.').pop();

        return await imagekitClient.files.upload({
            file: fileBuffer.toString("base64"),
            fileName: `${slug}-${Date.now()}.${extension}`,
            folder: typeOf === "logo"
                ? "/acadmics/SchoolLogos"
                : "/acadmics/SchoolBanners",

        });
        return response
    }
    catch (err) {
        console.error("Error uploading image:", err.message);
        throw err;
    }

}



const deleteFile = async (fileId) => {
    return imagekitClient.files.delete(fileId);
};
module.exports = { UploadFiles: UploadProfile, schoolImg , deleteFile}