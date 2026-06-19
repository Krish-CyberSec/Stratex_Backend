const schoolModel = require("../../models/school.model")
const { schoolImg } = require("../../services/storage.service")
const auditLogModel = require("../../models/auditlog.model")

const createSchool = async (req, res) => {
    try {
        const { name, description, status, slug } = req.body;

        // Authorization
        const allowedRoles = ["superAdmin"];

        if (
            !req.user.roles.some(role =>
                allowedRoles.includes(role)
            )
        ) {
            await auditLogModel.create({
                performedBy: req.user?._id,
                action: "UNAUTHORIZED_CREATE_ATTEMPT",
                module: "School",
                remarks: "Unauthorized School Creation",
                ipAddress: req.ip,
                userAgent: req.headers["user-agent"]
            });

            return res.status(403).json({
                message: "Unauthorized"
            });
        }

        if (
            !name ||
            !slug 
            
        ) {
            return res.status(400).json({
                message: "All required fields are required"
            });
        }





        const slugRegex = /^[a-z0-9-]+$/;

        if (!slugRegex.test(slug)) {
            return res.status(400).json({
                message: "Invalid slug format"
            });
        }

        const normalizedName = name.trim();
        const normalizedSlug = slug.trim();
        const normalizedDescription = description?description.trim():null;


        if (normalizedName.length < 3) {
            return res.status(400).json({
                message: "School name must be at least 3 characters"
            });
        }

        const allowedStatus = ["active", "inactive"];

        if (status && !allowedStatus.includes(status)) {
            return res.status(400).json({
                message: "Invalid status"
            });
        }

        const isSchool = await schoolModel.findOne({
            $or: [
                { name: normalizedName },
                { slug: normalizedSlug }
            ]
        });

        if (isSchool) {
            await auditLogModel.create({
                performedBy: req.user._id,
                action: "SCHOOL_CREATION_FAILED",
                module: "School",
                targetId: isSchool._id,
                targetName: isSchool.name,
                remarks: "School with same name or slug already exists",
                ipAddress: req.ip,
                userAgent: req.headers["user-agent"]
            });

            return res.status(409).json({
                message: "School with same name or slug already exists",
                school: isSchool._id
            });
        }

        let schoolLogo;
        let schoolBanner;

        try {
            const logo = req.files?.logo?.[0];
            const banner = req.files?.banner?.[0];

            if (logo) {
                schoolLogo = await schoolImg(
                    logo.buffer,
                    logo.originalname,
                    normalizedSlug,
                    "logo"
                );
            }

            if (banner) {
                schoolBanner = await schoolImg(
                    banner.buffer,
                    banner.originalname,
                    normalizedSlug,
                    "banner"
                );
            }
        } catch (uploadError) {
            console.error(uploadError);

            return res.status(500).json({
                message: "Image upload failed"
            });
        }

        const school = await schoolModel.create({
            name: normalizedName,
            description: description ? description : null,
            logo: schoolLogo ? schoolLogo.url : null,
            banner: schoolBanner ? schoolBanner.url : null,
            status: status ? status : "active",
            createdBy: req.user._id,
            slug: normalizedSlug
        });


        await auditLogModel.create({
            performedBy: req.user._id,
            action: "CREATE",
            module: "School",
            targetId: school._id,
            targetName: school.name,
            remarks: "School created successfully",
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"]
        });

        return res.status(201).json({
            message: "School created successfully",
            school
        });

    }
    catch (err) {
        console.error(err);
        try {
            await auditLogModel.create({
                performedBy: req.user?._id,
                action: "REJECT",
                module: "School",
                targetName: req.body?.name,
                remarks: err.message,
                ipAddress: req.ip,
                userAgent: req.headers["user-agent"]
            });
        } catch (auditErr) {
            console.error(auditErr);
        }
        return res.status(500).json({
            message: "Internal server error"
        });
    }
}


module.exports = { schools: createSchool }