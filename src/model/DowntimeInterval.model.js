import mongoose from "mongoose";

const DowntimeIntervalSchema = new mongoose.Schema(
    {
        /**
         * =====================================================
         * REFERENCES
         * =====================================================
         */

        machine_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Machine",
            required: true,
            index: true,
        },

        company_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Customer",
            required: true,
            index: true,
        },

        /**
         * =====================================================
         * CONTINUOUS DOWNTIME INTERVAL
         * =====================================================
         * IMPORTANT:
         * One document = one continuous downtime
         */

        startTime: {
            type: Date,
            required: true,
            index: true,
        },

        endTime: {
            type: Date,
            default: null,
            index: true,
        },

        /**
         * =====================================================
         * ACTIVE STATUS
         * =====================================================
         */

        isActive: {
            type: Boolean,
            default: true,
            index: true,
        },

        /**
         * =====================================================
         * OPTIONAL INFO
         * =====================================================
         */

        reason: {
            type: String,
            trim: true,
            default: "",
        },

        /**
         * =====================================================
         * AUDIT FIELDS
         * =====================================================
         */

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
        timestamps: {
            createdAt: "created_at",
            updatedAt: "updated_at",
        },

        versionKey: false,
    }
);

/**
 * =====================================================
 * INDEXES
 * =====================================================
 */

DowntimeIntervalSchema.index({
    machine_id: 1,
    startTime: 1,
});

DowntimeIntervalSchema.index({
    company_id: 1,
    startTime: 1,
});

DowntimeIntervalSchema.index({
    machine_id: 1,
    isActive: 1,
});

export default mongoose.model(
    "DowntimeInterval",
    DowntimeIntervalSchema
);