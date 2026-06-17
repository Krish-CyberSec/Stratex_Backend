const mongoose = require("mongoose");

const specializationSchema = new mongoose.Schema(
{
    programId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Program",
        required: true
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
});

specializationSchema.index(
{
    programId: 1,
    name: 1
},
{
    unique: true
});

const specializationModel = mongoose.model(
    "Specialization",
    specializationSchema
);

module.exports = specializationModel;