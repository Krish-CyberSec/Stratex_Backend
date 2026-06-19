const jwt = require("jsonwebtoken");
require("dotenv").config();

const chkUser = async (req, res, next) => {
    try {

        const token =
            req.cookies?.access_token ||
            req.headers.authorization?.split(" ")[1];

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized"
            });
        }

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        req.user = decoded;

        next();

    } catch (err) {

        console.error(err.message);

        return res.status(401).json({
            success: false,
            message: "Invalid or expired token"
        });
    }
};

module.exports = {
    chkUser
};