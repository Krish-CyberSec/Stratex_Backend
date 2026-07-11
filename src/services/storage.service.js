const { ImageKit } = require("@imagekit/nodejs")
const path = require("path");
require('dotenv').config({ path: path.resolve(__dirname, "../../.env") })

let imagekitClient;

const getImageKitClient = () => {
    if (!process.env.IMAGEKIT_PRIVATE_KEY) {
        throw new Error("IMAGEKIT_PRIVATE_KEY is required for file uploads");
    }

    if (!imagekitClient) {
        imagekitClient = new ImageKit({
            privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
        });
    }

    return imagekitClient;
};

const UploadProfile = async (fileBuffer, originalName) => {
    try {
        const extension = originalName.split('.').pop();

        return await getImageKitClient().files.upload({
            file: fileBuffer.toString("base64"),
            fileName: `User-${Date.now()}.${extension}`,
            folder: "/acadmics/userProfiles"
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

        return await getImageKitClient().files.upload({
            file: fileBuffer.toString("base64"),
            fileName: `${slug}-${Date.now()}.${extension}`,
            folder: typeOf === "logo"
                ? "/acadmics/SchoolLogos"
                : "/acadmics/SchoolBanners",

        });
    }
    catch (err) {
        console.error("Error uploading image:", err.message);
        throw err;
    }

}

const noticeAttachment = async (fileBuffer, originalName) => {
    try {
        const extension = originalName.split('.').pop();

        return await getImageKitClient().files.upload({
            file: fileBuffer.toString("base64"),
            fileName: `Notice-${Date.now()}.${extension}`,
            folder: "/acadmics/NoticeAttachments"
        });
    }
    catch (err) {
        console.error("Error uploading notice attachment:", err.message);
        throw err;
    }
}



const deleteFile = async (fileId) => {
    return getImageKitClient().files.delete(fileId);
};
module.exports = { UploadFiles: UploadProfile, schoolImg, noticeAttachment, deleteFile}
