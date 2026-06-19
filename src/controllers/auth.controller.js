const crypto = require('crypto');
const userModel = require('../models/user.model');
const schoolModel = require("../models/school.model");
const programModel = require("../models/program.model");
const specializationModel = require('../models/specelization.model');
const auditLogModel = require('../models/auditlog.model');
const { deleteFile } = require("../services/storage.service")
const mongoose = require("mongoose")
const { UploadFiles } = require("../services/storage.service");
const sendSetupEmail = require("../services/email.service");

require('dotenv').config();

const registerUser = async (req, res) => {

    const usersData = Array.isArray(req.body)
        ? req.body
        : [req.body];
    const usersToCreate = []
    try {

        const emailSet = new Set();
        const institutionIdSet = new Set();
        const personalEmailSet = new Set();

        for (const user of usersData) {
            const universityEmail =
                user.universityAccount?.universityEmail
                    ?.toLowerCase()
                    ?.trim();

            const institutionId =
                user.universityAccount?.institutionId
                    ?.trim();

            const personalEmail =
                user.personalEmail
                    ?.toLowerCase()
                    ?.trim();

            if (emailSet.has(universityEmail)) {
                return res.status(400).json({
                    message: `Duplicate university email: ${universityEmail}`
                });
            }

            if (institutionIdSet.has(institutionId)) {
                return res.status(400).json({
                    message: `Duplicate institution ID: ${institutionId}`
                });
            }

            if (
                personalEmail &&
                personalEmailSet.has(personalEmail)
            ) {
                return res.status(400).json({
                    message: `Duplicate personal email: ${personalEmail}`
                });
            }

            emailSet.add(universityEmail);
            institutionIdSet.add(institutionId);

            if (personalEmail) {
                personalEmailSet.add(personalEmail);
            }
        }

        // getting the user info from req body 

        for (const userData of usersData) {

            const {
                firstName,
                lastName,
                personalEmail,
                universityAccount,
                roles,
                status,
                schoolId,
                academicAssignments
            } = userData;

            if (
                !firstName ||
                !lastName ||
                !universityAccount ||
                !schoolId
            ) {
                return res.status(400).json({
                    message: `Missing required fields for ${firstName || "user"}`
                });
            }



            // all remaining validations here

            const allowedStatus = ["active", "inactive", "suspended"];

            if (status && !allowedStatus.includes(status)) {
                return res.status(400).json({
                    message: "Invalid status"
                });
            }


            if (
                !universityAccount.universityEmail ||
                !universityAccount.institutionId
            ) {
                return res.status(400).json({
                    message:
                        "University email and institution ID are required"
                });
            }


            // chk if user is other than superAdmin or schoolAdmin
            if (
                !req.user.roles.includes("superAdmin") &&
                !req.user.roles.includes("schoolAdmin")
            ) {

                await auditLogModel.create({
                    performedBy: req.user?._id,
                    action: "UNAUTHORIZED_CREATE_ATTEMPT",
                    module: "User",
                    remarks: "Unauthorized registration attempt",
                    ipAddress: req.ip,
                    userAgent: req.headers["user-agent"]
                });
                return res.status(403).json({
                    message: "Unauthorized"
                });
            }

            // check if atleast one role is there for the user or not 

            if (
                !roles ||
                !Array.isArray(roles) ||
                roles.length === 0
            ) {
                return res.status(400).json({
                    message: "At least one role is required"
                });
            }



            // return an error if tried to create a super admin account 

            if (roles.includes("superAdmin") &&
                !req.user.roles.includes("superAdmin")) {
                return res.status(403).json({ message: "Cannot register superAdmin through this endpoint" });
            }

            // return error if schoolAdmin try to create another school admin

            if (req.user.roles.includes("schoolAdmin") &&
                roles.includes("schoolAdmin")) {
                return res.status(403).json({
                    message: "SchoolAdmin Cannot create another SchoolAdmin"
                })
            }


            const uniqueRoles = [...new Set(roles)];

            if (uniqueRoles.length !== roles.length) {
                return res.status(400).json({
                    message: "Duplicate roles are not allowed"
                });
            }

            const allowedRoles = [
                "student",
                "faculty",
                "coordinator",
                "schoolAdmin",
                "examCell",
                "superAdmin"
            ];

            if (
                roles.some(role => !allowedRoles.includes(role))
            ) {
                return res.status(400).json({
                    message: "Invalid role provided"
                });
            }

            //chk if data already exsists

            const existingUser = await userModel.findOne({
                $or: [
                    {
                        "universityAccount.universityEmail":
                            universityAccount.universityEmail
                    },
                    {
                        "universityAccount.institutionId":
                            universityAccount.institutionId
                    }
                ]
            });

            if (existingUser) {
                return res.status(422).json({
                    message: "User Already Exsists With Us Try To Rest Your Password "
                })
            }

            // return an error if same personal email is already is being used

            if (personalEmail) {
                const existingPersonalEmail =
                    await userModel.findOne({
                        personalEmail
                    });

                if (existingPersonalEmail) {
                    return res.status(409).json({
                        message:
                            "Personal email already in use"
                    });
                }
            }




            // if school is there

            const school = await schoolModel.findById(schoolId);

            if (!school) {
                return res.status(404).json({
                    message: "School not found"
                });
            }


            const requiresAcademicAssignments =
                roles.includes("student") ||
                roles.includes("faculty") ||
                roles.includes("coordinator");

            if (
                requiresAcademicAssignments &&
                (
                    !academicAssignments ||
                    !Array.isArray(academicAssignments) ||
                    academicAssignments.length === 0
                )
            ) {
                return res.status(400).json({
                    message: "At least one academic assignment is required"
                });
            }

            if (requiresAcademicAssignments) {
                const assignmentKeys = academicAssignments.map(
                    assignment =>
                        `${String(assignment.programId)}-${String(assignment.specializationId || "")}`
                );

                if (
                    new Set(assignmentKeys).size !==
                    assignmentKeys.length
                ) {
                    return res.status(400).json({
                        message:
                            "Duplicate academic assignments are not allowed"
                    });
                }


                for (const assignment of academicAssignments) {


                    if (!assignment.programId) {
                        return res.status(400).json({
                            message: "Program ID is required"
                        });
                    }

                    const program =
                        await programModel.findById(
                            assignment.programId
                        );

                    if (!program) {
                        return res.status(404).json({
                            message:
                                `Program not found: ${assignment.programId}`
                        });
                    }

                    if (
                        program.schoolId.toString() !==
                        schoolId.toString()
                    ) {
                        return res.status(400).json({
                            message:
                                "Program does not belong to selected school"
                        });
                    }

                    if (assignment.specializationId) {

                        const specialization =
                            await specializationModel.findById(
                                assignment.specializationId
                            );

                        if (!specialization) {
                            return res.status(404).json({
                                message:
                                    "Specialization not found"
                            });
                        }

                        if (
                            specialization.programId.toString() !==
                            assignment.programId.toString()
                        ) {
                            return res.status(400).json({
                                message:
                                    "Specialization does not belong to selected program"
                            });
                        }



                        if (assignment.semesterId) {

                            const semester = await semesterModel.findById(
                                assignment.semesterId
                            );

                            if (!semester) {
                                return res.status(404).json({
                                    message: "Semester not found"
                                });
                            }

                            if (
                                semester.specializationId.toString() !==
                                assignment.specializationId.toString()
                            ) {
                                return res.status(400).json({
                                    message:
                                        "Semester does not belong to selected specialization"
                                });
                            }
                        }
                    }
                }

            }

            // Coordinator must also be Faculty
            if (
                roles.includes("coordinator") &&
                !roles.includes("faculty")
            ) {
                return res.status(400).json({
                    message:
                        "Coordinator must also have faculty role"
                });
            }


            // exam cell 

            if (roles.includes("examCell")) {

                if (academicAssignments?.length > 0) {
                    return res.status(400).json({
                        message:
                            "Exam Cell users cannot have academic assignments"
                    });
                }
            }

            // schoolAdmin

            if (roles.includes("schoolAdmin")) {

                if (academicAssignments?.length > 0) {
                    return res.status(400).json({
                        message:
                            "School Admin users cannot have academic assignments"
                    });
                }
            }

            // Student must belong to exactly one program
            if (roles.includes("student")) {

                if (academicAssignments.length !== 1) {
                    return res.status(400).json({
                        message:
                            "Student must belong to exactly one academic assignment"
                    });
                }

                const assignment = academicAssignments[0];

                if (
                    !assignment.programId ||
                    !assignment.semesterId
                ) {
                    return res.status(400).json({
                        message:
                            "Student must have program and semester assigned"
                    });
                }
            }



            // allow super admin and school admin only to create user accounts




            const forbiddenRoles = [
                "superAdmin",
                "schoolAdmin",
                "examCell"
            ];

            if (
                req.user.roles.includes("schoolAdmin") &&
                roles.some(role => forbiddenRoles.includes(role))
            ) {
                return res.status(403).json({
                    message: "School Admin cannot create privileged accounts"
                });
            }

            if (
                req.user.roles.includes("schoolAdmin") &&
                req.user.schoolId.toString() !== schoolId.toString()
            ) {
                return res.status(403).json({
                    message:
                        "School Admin can only create users for their own school"
                });
            }


            const rawToken =
                crypto.randomBytes(32).toString("hex");

            const hashedToken = crypto
                .createHash("sha256")
                .update(rawToken)
                .digest("hex");

            usersToCreate.push({
                firstName,
                lastName,
                personalEmail,
                universityAccount,
                roles,
                status: status || "inactive",
                schoolId,
                academicAssignments,
                setupToken: hashedToken,
                setupTokenExpiry:
                    Date.now() + 24 * 60 * 60 * 1000,
                createdBy: req.user._id,

                __rawToken: rawToken
            });
        }


        // gen a random hash for creating initial password


        // let uploadImg = null;

        // try {
        //     if (req.file) {
        //         uploadImg = await UploadFiles(
        //             req.file.buffer,
        //             req.file.originalname
        //         );
        //     }
        // } catch (err) {
        //     return res.status(500).json({
        //         message: "Profile image upload failed"
        //     });
        // }

        const session = await mongoose.startSession();

        try {

            session.startTransaction();

            const users = await userModel.create(
                usersToCreate.map(user => {
                    const { __rawToken, ...dbUser } = user;

                    return {
                        ...dbUser,
                        profileImage: null
                    };
                }),
                { session ,ordered: true}
            );

            for (let i = 0; i < users.length; i++) {

                const user = users[i];
                const sourceUser = usersToCreate[i];

                const emails = [
                    user.universityAccount.universityEmail
                ];

                if (user.personalEmail) {
                    emails.push(user.personalEmail);
                }

                const setupLink =
                    `${process.env.CLIENT_URL}/setup-password/${sourceUser.__rawToken}`;

                await sendSetupEmail(
                    emails,
                    user.fullName,
                    setupLink
                );
            }


            await auditLogModel.create(
                [{
                    performedBy: req.user._id,
                    action:
                        users.length > 1
                            ? "BULK_CREATE"
                            : "CREATE",
                    module: "User",

                    targetIds: users.map(user => user._id),

                    targetNames: usersData?.map(
                        user => `${user.firstName} ${user.lastName}`
                    ),

                    remarks:
                        users.length > 1
                            ? `${users.length} user accounts created and setup emails sent`
                            : "User account created and setup email sent",

                    ipAddress: req.ip,
                    userAgent: req.headers["user-agent"]
                }],
                { session }
            );

            await session.commitTransaction();

            const createdUsers = await userModel
                .find({
                    _id: {
                        $in: users.map(user => user._id)
                    }
                })
                .select("-setupToken -setupTokenExpiry")
                .lean();
            return res.status(201).json({
                message: `${createdUsers.length} user(s) created successfully`,
                users: createdUsers
            });


        } catch (error) {
            console.error("User creation/setup email error:", error);
            await session.abortTransaction();

            // cleanup uploaded image
            // if (uploadImg?.fileId) {
            //     try {
            //         await deleteFile(uploadImg.fileId);
            //     } catch (deleteErr) {
            //         console.error(
            //             "Failed to delete uploaded image:",
            //             deleteErr
            //         );
            //     }
            // }

            return res.status(500).json({
                message:
                    "User creation failed because setup email could not be sent"
            });

        } finally {
            await session.endSession();
        }

    }
    catch (err) {
        console.error(err);

        try {
            await auditLogModel.create({
                performedBy: req.user?._id,

                action: "ACCOUNT_CREATION_FAILED",

                module: "User",

                targetNames: usersData?.map(
                    user => `${user.firstName} ${user.lastName}`
                ),
                remarks: err.message,

                ipAddress: req.ip,

                userAgent: req.headers["user-agent"]
            });
        } catch (auditErr) {
            console.error(
                "Failed to create audit log:",
                auditErr
            );
        }

        return res.status(500).json({
            message: "Internal Server Error"
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
            httpOnly: true, // prevents JavaScript access
            secure: process.env.NODE_ENV === "production", // HTTPS only in production
            sameSite: "strict", // CSRF protection
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
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

                profilePicture:
                    user.profilePicture,

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

module.exports = {
    register: registerUser,
    login: loginUser
};