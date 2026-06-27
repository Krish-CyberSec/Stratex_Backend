const mongoose = require("mongoose");

const subjectSchema = new mongoose.Schema(
    {
        code: {
            type: String,
            required: true,
            trim: true
        },

        name: {
            type: String,
            required: true,
            trim: true
        },

        description: {
            type: String,
            trim: true
        },

        schoolId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "School",
            required: true
        },

        programId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Program",
            required: true
        },

        specializationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Specialization"
        },

        semesterId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Semester",
            required: true
        },

        credits: {
            type: Number,
            required: true,
            min: 0
        },

        coordinatorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },
        facultyIds: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        }],

        status: {
            type: String,
            enum: ["active", "inactive"],
            default: "active"
        },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        }
    },
    {
        timestamps: true
    }
);
subjectSchema.index({
    semesterId: 1
});

subjectSchema.index({
    coordinatorId: 1
});

subjectSchema.index({
    facultyIds: 1
});

subjectSchema.index(
    {
        code: 1,
        programId: 1,
        specializationId: 1,
        semesterId: 1
    },
    {
        unique: true
    }
);

module.exports =
    mongoose.model("Subject", subjectSchema);
