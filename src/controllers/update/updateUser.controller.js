const userModel = require("../../models/user.model");
const auditLogModel = require("../../models/auditlog.model");

const updateUser = async (req, res) => {
    try {

        const { userId } = req.params;

        const {
            firstName,
            lastName,
            personalEmail,
            phoneNumber,
            status
        } = req.body;

        const allowedRoles = [
            "superAdmin",
            "schoolAdmin"
        ];

        // Authorization
        if (
            !req.user.roles.some(role =>
                allowedRoles.includes(role)
            )
        ) {

            await auditLogModel.create({
                performedBy: req.user?._id,
                action: "UNAUTHORIZED_UPDATE_ATTEMPT",
                module: "User",
                remarks: "Unauthorized user update attempt",
                ipAddress: req.ip,
                userAgent: req.headers["user-agent"]
            });

            return res.status(403).json({
                message: "Unauthorized"
            });
        }

        const user = await userModel.findById(userId);

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        // Status Validation
        const allowedStatus = [
            "active",
            "inactive"
        ];

        if (
            status &&
            !allowedStatus.includes(status)
        ) {
            return res.status(400).json({
                message: "Invalid status"
            });
        }

        // Email Duplicate Check
        if (
            personalEmail &&
            personalEmail.toLowerCase() !==
                user.personalEmail?.toLowerCase()
        ) {

            const existingUser =
                await userModel.findOne({
                    personalEmail:
                        personalEmail.toLowerCase(),
                    _id: { $ne: userId }
                });

            if (existingUser) {
                return res.status(409).json({
                    message:
                        "Personal email already exists"
                });
            }
        }

        // Update Allowed Fields

        if (firstName) {
            user.firstName = firstName.trim();
        }

        if (lastName) {
            user.lastName = lastName.trim();
        }

        if (personalEmail) {
            user.personalEmail =
                personalEmail.toLowerCase().trim();
        }

        if (phoneNumber) {
            user.phoneNumber = phoneNumber.trim();
        }

        if (status) {
            user.status = status;
        }

        user.updatedBy = req.user._id;

        await user.save();

        await auditLogModel.create({
            performedBy: req.user._id,
            action: "UPDATE",
            module: "User",
            targetId: user._id,
            targetName:
                `${user.firstName} ${user.lastName}`,
            remarks: "User updated successfully",
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"]
        });

        return res.status(200).json({
            message: "User updated successfully",
            user
        });

    } catch (err) {

        console.error(err);

        try {

            await auditLogModel.create({
                performedBy: req.user?._id,
                action: "USER_UPDATE_FAILED",
                module: "User",
                targetId: req.params?.userId,
                remarks: err.message,
                ipAddress: req.ip,
                userAgent: req.headers["user-agent"]
            });

        } catch (auditErr) {
            console.error(auditErr);
        }

        return res.status(500).json({
            message: "Internal Server Error"
        });
    }
};

module.exports = {
    updateUser
};