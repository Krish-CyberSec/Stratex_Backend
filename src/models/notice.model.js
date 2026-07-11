const mongoose = require("mongoose");

const noticeSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    content: {
      type: String,
      required: true,
      trim: true
    },
    audience: {
      type: [String],
      enum: ["superAdmin", "schoolAdmin", "faculty", "coordinator", "student", "examCell", "all"],
      default: ["all"]
    },
    status: {
      type: String,
      enum: ["draft", "published", "archived", "inactive"],
      default: "published"
    },
    publishedAt: {
      type: Date,
      default: Date.now
    },
    attachment: {
      url: {
        type: String,
        default: null
      },
      fileId: {
        type: String,
        default: null
      },
      name: {
        type: String,
        default: null
      },
      fileType: {
        type: String,
        default: null
      },
      size: {
        type: Number,
        default: null
      }
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

module.exports = mongoose.model("Notice", noticeSchema);
