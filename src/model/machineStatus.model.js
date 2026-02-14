import mongoose from "mongoose";

const MachineStatusSchema = new mongoose.Schema(
  {
    machine: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Machine",
      required: true,
      index: true,
    },

    imei: {
      type: String,
      required: true,
      index: true,
    },

    date: {
      type: String, // YYYY-MM-DD format
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: ["RUNNING", "IDLE", "DOWN"],
      required: true,
    },

    currentProdcount: Number,
    previousProdcount: Number,

    lastSeenAt: Date,
    evaluatedAt: Date,
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Unique per machine per day
MachineStatusSchema.index({ imei: 1, date: 1 }, { unique: true });

export default mongoose.model("MachineStatus", MachineStatusSchema);
