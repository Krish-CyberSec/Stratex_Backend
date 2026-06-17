const mongoose = require('mongoose');

const schoolSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },

    slug: {
        type: String,
        required: true,
        lowercase: true,
        trim: true
    }
    ,
    description: {
        type: String,
        trim: true
    },
    logo: {
        type: String,
        default: null
    },

    banner: {
        type: String,
        default: null
    },

    status: {
        type: String,
        enum: ["active", "inactive"],
        default: "active"
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },

    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'

    }
},
    {
        timestamps: true
    })





schoolSchema.index({ name: 1 }, { unique: true });
schoolSchema.index({ slug: 1 }, { unique: true });


schoolSchema.virtual("schoolUrl").get(function () {
    return `/schools/${this.slug}`;
});

const schoolModel = mongoose.model('School', schoolSchema);

module.exports = schoolModel;