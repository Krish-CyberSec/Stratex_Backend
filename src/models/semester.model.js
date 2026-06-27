const mongoose = require("mongoose");

const semesterSchema = new mongoose.Schema(
    {
        programId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Program",
            required: true
        },

        specializationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Specialization",
            default: null
        },

        semesterNumber: {
            type: Number,
            required: true
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

semesterSchema.index(
{
    programId: 1,
    specializationId: 1,
    semesterNumber: 1
},
{
    unique: true
});

const semesterModel = mongoose.model(
    "Semester",
    semesterSchema
);



module.exports = semesterModel;
