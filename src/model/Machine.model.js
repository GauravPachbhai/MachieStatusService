import mongoose from "mongoose";

const MachineSchema = new mongoose.Schema(
  {
    // IoT unique reference ID (from external system)
    id: {
      type: String,
      required: true,
      unique: true, // ensures no duplicate IoT IDs
      trim: true,
    },


    // Display name / label
    machineNameL: {
      type: String,
      required: true,
      trim: true,
    },

    // Company / customer relationship
    customer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    tonnage: {
      type: String,
      required: true,
    },
    make: {
      type: String,
      required: true,
    },
    dateofpurchase: {
      type: Date,
      required: true,
    },
    // Status flag
    is_active: {
      type: Boolean,
      default: true,
    },
    downStartedAt: {
      type: Date,
      required: false,
    },
    // Audit fields
    created_at: {
      type: Date,
      default: Date.now,
    },
    modified_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "modified_at" },
    versionKey: false,
  }
);

// 🔹 Indexes to improve lookup performance
MachineSchema.index({ customer_id: 1 });

// 🔹 Auto-update modified_at before saving
MachineSchema.pre("save", function (next) {
  this.modified_at = new Date();
  next();
});

export default mongoose.model("Machine", MachineSchema);
