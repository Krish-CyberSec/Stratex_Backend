const userModel = require("../../models/user.model");
const auditLogModel = require("../../models/auditlog.model");

const softRemoveUser = async (req, res) => {
    try {

        const { userId } = req.params;

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
                action: "UNAUTHORIZED_DELETE_ATTEMPT",
                module: "User",
                remarks: "Unauthorized user deletion attempt",
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

        // Prevent self deletion
        if (
            user._id.toString() ===
            req.user._id.toString()
        ) {
            return res.status(400).json({
                message:
                    "You cannot deactivate your own account"
            });
        }

        // Already inactive
        if (user.status === "inactive") {
            return res.status(400).json({
                message:
                    "User account is already inactive"
            });
        }

        // Soft Delete
        user.status = "inactive";
        user.updatedBy = req.user._id;

        await user.save();

        await auditLogModel.create({
            performedBy: req.user._id,
            action: "DELETE",
            module: "User",
            targetId: user._id,
            targetName:
                `${user.firstName} ${user.lastName}`,
            remarks: "User deactivated successfully",
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"]
        });

        return res.status(200).json({
            message: "User deleted successfully"
        });

    } catch (err) {

        console.error(err);

        try {

            await auditLogModel.create({
                performedBy: req.user?._id,
                action: "USER_DELETE_FAILED",
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
    softRemoveUser
};