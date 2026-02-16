import mongoose from "mongoose";

const DowntimeSchema = new mongoose.Schema(
  {
    // Machine reference
    machine_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Machine",
      required: true,
    },

    // Company reference (for filtering)
    company_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },

    // Date when downtime occurred (YYYY-MM-DD format)
    date: {
      type: String,
      required: true,
      index: true,
    },

    // Start time of downtime
    startTime: {
      type: Date,
      required: true,
    },

    // End time of downtime (optional for ongoing downtimes)
    endTime: {
      type: Date,
      required: false,
    },

    // Calculated duration in hours (only set when downtime ends)
    machinedownByHR: {
      type: Number,
      required: false,
      min: 0,
    },

    // Is this downtime currently active?
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    // Reason for downtime
    reason: {
      type: String,
      required: false,
      default: "Machine Status: DOWN",
      trim: true,
    },

    // Audit fields
    created_at: {
      type: Date,
      default: Date.now,
    },
    updated_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    versionKey: false,
  }
);

// Indexes for efficient querying
DowntimeSchema.index({ company_id: 1, date: 1 });
DowntimeSchema.index({ machine_id: 1, date: 1 });
DowntimeSchema.index({ machine_id: 1, isActive: 1 });

export default mongoose.model("Downtime", DowntimeSchema);
