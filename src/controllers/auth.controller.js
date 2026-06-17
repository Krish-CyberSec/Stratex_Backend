const crypto = require('crypto');
const userModel = require('../models/user.model');
const schoolModel = require("../models/school.model");
const programModel = require("../models/program.model");
const specializationModel = require('../models/specelization.model');
const auditLogModel = require('../models/auditlog.model');
const jwt = require('jsonwebtoken')
const { UploadFiles } = require("../services/storage.service");
const sendSetupEmail = require("../services/email.service");

require('dotenv').config();

const registerUser = async (req, res) => {
    try {

        // getting the user info from req body 
        const {
            firstName,
            lastName,
            personalEmail,
            universityAccount,
            roles,
            status,
            schoolId,
            academicAssignments
        } = req.body;


        // return a error if any field is missing 

        if (
            !firstName ||
            !lastName ||
            !universityAccount ||
            !schoolId
        ) {
            return res.status(400).json({
                message: "Missing required fields"
            });
        }

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


        if (
            !academicAssignments ||
            !Array.isArray(academicAssignments) ||
            academicAssignments.length === 0
        ) {
            return res.status(400).json({
                message: "At least one academic assignment is required"
            });
        }


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
                    message: "Student must belong to exactly one academic assignment"
                });
            }

            const assignment = academicAssignments[0];

            if (
                !assignment.programId ||
                !assignment.specializationId ||
                !assignment.semesterId
            ) {
                return res.status(400).json({
                    message:
                        "Student must have program, specialization and semester assigned"
                });
            }
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



        // gen a random hash for creating initial password

        const rawToken =
            crypto.randomBytes(32).toString("hex");

        const hashedToken = crypto
            .createHash("sha256")
            .update(rawToken)
            .digest("hex");


        let uploadImg = null;


        try {
            if (req.file) {
                uploadImg = await UploadFiles(
                    req.file.buffer,
                    req.file.originalname
                );
            }
        }
        catch (uploadError) {
            console.error(uploadError)
            return res.status(500).json({
                message: "Profile image upload failed"
            });
        }



        const user = await userModel.create({
            profileImage: uploadImg ? uploadImg.url : null,
            firstName,
            lastName,
            personalEmail,
            universityAccount,
            roles,
            status: status ? status : "inactive",
            schoolId,
            academicAssignments,
            setupToken: hashedToken,
            setupTokenExpiry:
                Date.now() + 24 * 60 * 60 * 1000,
            createdBy: req.user._id
        });


        const setupLink =
            `${process.env.CLIENT_URL}/setup-password/${rawToken}`;


        try {
            const emails = [user.universityAccount.universityEmail];

            if (user.personalEmail) {
                emails.push(user.personalEmail);
            }

            await sendSetupEmail(
                emails,
                `${user.firstName} ${user.lastName}`,
                setupLink
            );
        }
        catch (error) {
            console.error("Email failed:", error);
            await auditLogModel.create({
                performedBy: req.user._id,
                action: "EMAIL_FAILED",
                module: "User",
                targetId: user._id,
                targetName: user.fullName,
                remarks: error.message,
                ipAddress: req.ip,
                userAgent: req.headers["user-agent"]
            });

            return res.status(201).json({
                message:
                    "User created successfully but setup email failed",
                user
            });

        }


        await auditLogModel.create({
            performedBy: req.user._id,
            action: "CREATE",
            module: "User",
            targetId: user._id,
            targetName: user.fullName,
            remarks: "User account created and setup email sent",

            ipAddress: req.ip,
            userAgent: req.headers["user-agent"]
        });



        const createdUser =
            await userModel
                .findById(user._id)
                .select("-setupToken -setupTokenExpiry")
                .lean();
        return res.status(201).json({
            message: "User account created successfully",
            user: createdUser
        });







    }
    catch (err) {
        console.error(err);

        try {
            await auditLogModel.create({
                performedBy: req.user?._id,

                action: "ACCOUNT_CREATION_FAILED",

                module: "User",

                targetName:
                    `${req.body.firstName || ""} ${req.body.lastName || ""}`.trim(),

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



const loginUser = async (req, res) => {

    const { personalEmail, universityAccount, password } = req.body;


}
module.exports = {
    register: registerUser,
    login: loginUser
};