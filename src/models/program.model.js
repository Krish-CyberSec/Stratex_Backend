const mongoose = require("mongoose");

const programSchema = new mongoose.Schema(
{
    name: {
        type: String,
        required: true,
        trim: true
    },

    schoolId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "School",
        required: true
    },

    description: {
        type: String,
        trim: true
    },

    status: {
        type: String,
        enum: ["active", "inactive"],
        default: "active"
    },

    duration: {
        type: Number, // years
        required: true,
        min: 1
    },

    degreeType: {
        type: String,
        enum: [
            "UG",
            "PG",
            "Diploma",
            "PhD"
        ],
        required: true
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
});

programSchema.index({
    schoolId: 1,
    name: 1
}, {
    unique: true
});

const programModel = mongoose.model(
    "Program",
    programSchema
);

module.exports = programModel;