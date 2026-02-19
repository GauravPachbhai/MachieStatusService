import mongoose from "mongoose";
const USER_TYPES = {
  ADMIN: 1,
  OWNER: 2,
  OPERATOR: 3,
  SUPERVISOR: 4, // optional - easy to extend
};

const CustomerSchema = new mongoose.Schema(
  {
    customer_name: { type: String, required: true, unique: true, trim: true },
    // IANA timezone name for the company (used for local date/time calculations)
    timezone: { type: String, default: "Asia/Kolkata", trim: true },
    is_active: { type: Boolean, default: true },
    created_by_type: {
      type: Number,
      enum: Object.values(USER_TYPES),
      required: true,
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    modified_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "modified_at" } }
);

export default mongoose.model("Customer", CustomerSchema);
