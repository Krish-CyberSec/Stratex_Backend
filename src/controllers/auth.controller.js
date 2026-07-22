const crypto = require('crypto');
const userModel = require('../models/user.model');
const auditLogModel = require('../models/auditlog.model');
const { registerUsers } = require("../services/auth/register.service");

require('dotenv').config();

const normalizeRegisterBody = (req) => {
    if (req.body?.payload && typeof req.body.payload === "string") {
        req.body = JSON.parse(req.body.payload);
    }
};

const registerUser = async (req, res) => {
    try {
        normalizeRegisterBody(req);
        const result = await registerUsers(req);
        return res.status(result.statusCode).json(result.body);
    }
    catch (err) {
        console.error(err);

        return res.status(err.statusCode || 500).json({
            message: err.statusCode ? err.message : "Internal Server Error"
        });
    }
}

const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const loginUser = async (req, res) => {
    try {

        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required"
            });
        }

        const user = await userModel
            .findOne({
                $or: [
                    {
                        personalEmail:
                            email.toLowerCase().trim()
                    },
                    {
                        "universityAccount.universityEmail":
                            email.toLowerCase().trim()
                    }
                ]
            })
            .select("+password");

        if (!user) {

            await auditLogModel.create({
                action: "LOGIN_FAILED",
                module: "Auth",
                remarks: `Login failed for email: ${email}`,
                ipAddress: req.ip,
                userAgent: req.headers["user-agent"]
            });

            return res.status(401).json({
                success: false,
                message: "Invalid credentials"
            });
        }

        if (user.status !== "active") {
            return res.status(403).json({
                success: false,
                message:
                    "Your account has been deactivated. Contact administrator."
            });
        }

        const isPasswordMatched =
            await bcrypt.compare(
                password,
                user.password
            );

        if (!isPasswordMatched) {

            await auditLogModel.create({
                performedBy: user._id,
                action: "LOGIN_FAILED",
                module: "Auth",
                remarks: "Invalid password",
                ipAddress: req.ip,
                userAgent: req.headers["user-agent"]
            });

            return res.status(401).json({
                success: false,
                message: "Invalid credentials"
            });
        }

        const token = jwt.sign(
            {
                userId: user._id,
                roles: user.roles,
                schoolId: user.schoolId
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "7d"
            }
        );

        res.cookie("access_token", token, {
            httpOnly: true,
            secure: true,
            sameSite: "none",
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        user.lastLogin = new Date();
        await user.save();

        await auditLogModel.create({
            performedBy: user._id,
            action: "LOGIN",
            module: "Auth",
            remarks: "User logged in successfully",
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"]
        });

        return res.status(200).json({
            success: true,
            message: "Login successful",

            token,

            user: {
                _id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                fullName: user.fullName, // virtual

                personalEmail: user.personalEmail,

                universityEmail:
                    user.universityAccount?.universityEmail,

                roles: user.roles,

                primaryRole: user.roles[0],

                mustChangePassword:
                    user.mustChangePassword,

                schoolId: user.schoolId,

                profileImage:
                    user.profileImage,

                status: user.status
            }
        });

    } catch (err) {

        console.error(err);

        return res.status(500).json({
            success: false,
            message: "Internal Server Error"
        });
    }
};


const getMe = async (req, res) => {
    const user = req.authUser;

    if (!user) {
        return res.status(401).json({
            success: false,
            message: "User not found"
        });
    }

    return res.status(200).json(user);
};


const logout = async (req, res) => {
    let performedBy;
    const token =
        req.cookies?.access_token ||
        req.headers.authorization?.split(" ")[1];

    if (token) {
        try {
            performedBy = jwt.verify(token, process.env.JWT_SECRET)?.userId;
        } catch {
            performedBy = undefined;
        }
    }

    res.clearCookie("access_token", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
    });

    try {
        await auditLogModel.create({
            performedBy,
            action: "LOGOUT",
            module: "Auth",
            remarks: "User logged out",
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"]
        });
    } catch (auditErr) {
        console.error("Logout audit log failed:", auditErr.message);
    }

    return res.status(200).json({
        success: true,
        message: "Logged out"
    });
};

const setupPassword = async (req, res) => {
    try {
        const { token, password } = req.body;

        if (!token || !password) {
            return res.status(400).json({
                message: "Token and password are required"
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                message: "Password must be at least 8 characters"
            });
        }

        const hashedToken = crypto
            .createHash("sha256")
            .update(token)
            .digest("hex");

        const user = await userModel
            .findOne({
                setupToken: hashedToken,
                setupTokenExpiry: { $gt: Date.now() }
            })
            .select("+password +setupToken +setupTokenExpiry");

        if (!user) {
            return res.status(400).json({
                message: "Invalid or expired setup token"
            });
        }

        user.password = await bcrypt.hash(password, 10);
        user.setupToken = undefined;
        user.setupTokenExpiry = undefined;
        user.mustChangePassword = false;
        user.isEmailVerified = true;
        user.status = "active";
        user.passwordChangedAt = new Date();

        await user.save();

        await auditLogModel.create({
            performedBy: user._id,
            action: "SETUP_PASSWORD",
            module: "Auth",
            remarks: "User completed password setup",
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"]
        });

        return res.status(200).json({
            message: "Password setup completed"
        });
    } catch (err) {
        console.error(err);

        return res.status(500).json({
            message: "Internal Server Error"
        });
    }
};

module.exports = {
    register: registerUser,
    login: loginUser,
    getMe,
    logout,
    setupPassword
};
