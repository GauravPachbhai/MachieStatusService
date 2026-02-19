import Downtime from "../model/Downtime.model.js";
import Machine from "../model/Machine.js";

import Customer from "../model/Customer.js";

/**
 * Get the ISO date string (YYYY-MM-DD) from a Date object in a specific timezone
 */
const getISODate = (date, timezone = "Asia/Kolkata") => {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(date);
};

/**
 * Calculate duration in hours between two dates
 */
const calculateDurationInHours = (startTime, endTime) => {
    const diffMs = endTime - startTime;
    return diffMs / (1000 * 60 * 60); // Convert milliseconds to hours
};

/**
 * Start a new downtime record when a machine goes DOWN
 * @param {ObjectId} machine_id - The machine's database ID
 * @returns {Promise<Object>} The created downtime record
 */
export const startDowntime = async (machine_id) => {
    try {
        const machine = await Machine.findById(machine_id).select("customer_id");
        if (!machine) {
            throw new Error(`Machine ${machine_id} not found`);
        }

        const customer = await Customer.findById(machine.customer_id).select("timezone");
        const timezone = customer?.timezone || "Asia/Kolkata";
        const now = new Date();
        const today = getISODate(now, timezone);

        // Find ANY existing downtime record for this machine + date (active or not)
        const existingDowntime = await Downtime.findOne({
            machine_id,
            date: today,
        });

        if (existingDowntime) {
            if (existingDowntime.isActive) {
                // Already active — update duration and ensure endTime is null for ongoing
                const currentSegmentHours = calculateDurationInHours(existingDowntime.startTime, now);
                existingDowntime.machinedownByHR = (existingDowntime.machinedownByHR || 0) + currentSegmentHours;
                existingDowntime.startTime = now; // Reset start of this segment for next calculation
                existingDowntime.endTime = null; // Ensure endTime is null for active records
                await existingDowntime.save();
                console.log(`Updated active downtime for Machine ${machine_id}. Total: ${existingDowntime.machinedownByHR.toFixed(2)}h`);
            } else {
                // Was inactive (previous DOWN ended) — reactivate with a new segment
                existingDowntime.isActive = true;
                existingDowntime.startTime = now; // New segment starts now
                existingDowntime.endTime = null; // Clear previous endTime
                await existingDowntime.save();
                console.log(`Reactivated existing downtime for Machine ${machine_id}. Accumulated hours so far: ${(existingDowntime.machinedownByHR || 0).toFixed(2)}`);
            }
            return existingDowntime;
        }

        const downtime = await Downtime.create({
            machine_id,
            company_id: machine.customer_id,
            date: today,
            startTime: now,
            machinedownByHR: 0,
            isActive: true,
            reason: "Machine Status: DOWN",
        });

        console.log(`Started downtime tracking for machine ${machine_id} at ${now}`);
        return downtime;
    } catch (error) {
        console.error(`Error starting/updating downtime for machine ${machine_id}:`, error);
        throw error;
    }
};

/**
 * End the active downtime record when a machine comes back RUNNING
 * @param {ObjectId} machine_id - The machine's database ID
 * @returns {Promise<Object|null>} The updated downtime record, or null if none found
 */
export const endDowntime = async (machine_id) => {
    try {
        const machine = await Machine.findById(machine_id).select("customer_id");
        const customer = await Customer.findById(machine?.customer_id).select("timezone");
        const timezone = customer?.timezone || "Asia/Kolkata";

        const now = new Date();
        const today = getISODate(now, timezone);

        const activeDowntime = await Downtime.findOne({
            machine_id,
            date: today,
            isActive: true,
        });

        if (!activeDowntime) {
            console.log(`No active downtime found for machine ${machine_id} today`);
            return null;
        }

        // Calculate duration of THIS segment only
        const segmentDurationHours = calculateDurationInHours(
            activeDowntime.startTime,
            now
        );

        // Accumulate: add this segment's duration to existing total
        activeDowntime.machinedownByHR = (activeDowntime.machinedownByHR || 0) + segmentDurationHours;
        activeDowntime.endTime = now;
        activeDowntime.isActive = false;
        await activeDowntime.save();

        console.log(
            `Ended downtime for machine ${machine_id}. Segment: ${segmentDurationHours.toFixed(2)}h, Total today: ${activeDowntime.machinedownByHR.toFixed(2)}h`
        );
        return activeDowntime;
    } catch (error) {
        console.error(`Error ending downtime for machine ${machine_id}:`, error);
        throw error;
    }
};

/**
 * Split all active downtimes at midnight (day boundary)
 * This should be run as a scheduled job at 12:00 AM daily
 * @returns {Promise<number>} Number of downtimes that were split
 */
export const splitDowntimesAtMidnight = async () => {
    try {
        const activeDowntimes = await Downtime.find({ isActive: true });
        console.log(`Found ${activeDowntimes.length} active downtimes to evaluate for midnight split`);

        let splitCount = 0;

        for (const downtime of activeDowntimes) {
            try {
                const customer = await Customer.findById(downtime.company_id).select("timezone");
                const timezone = customer?.timezone || "Asia/Kolkata";

                const now = new Date();
                const currentDate = getISODate(now, timezone);

                // If the record's date is different from today in the customer's timezone, it needs splitting
                if (downtime.date !== currentDate) {
                    console.log(`Splitting downtime for machine ${downtime.machine_id} (Date: ${downtime.date}, Today in IST: ${currentDate})`);

                    // Create midnight timestamp for end of that record's day in customer's timezone
                    // Using 23:59:59.999 in the customer's timezone
                    const endOfThatDay = new Date(new Date(downtime.date + "T23:59:59.999").toLocaleString("en-US", { timeZone: timezone }));

                    // Actually, a cleaner way to get the exact midnight boundary in UTC for that timezone:
                    const startOfNextDay = new Date(new Date(currentDate + "T00:00:00.000").toLocaleString("en-US", { timeZone: timezone }));
                    const endOfPrevDay = new Date(startOfNextDay.getTime() - 1);

                    // Close the previous downtime
                    const durationHours = calculateDurationInHours(
                        downtime.startTime,
                        endOfPrevDay
                    );

                    downtime.endTime = endOfPrevDay;
                    downtime.machinedownByHR = (downtime.machinedownByHR || 0) + durationHours;
                    downtime.isActive = false;
                    await downtime.save();

                    // Create new downtime for today starting at 00:00:00
                    await Downtime.create({
                        machine_id: downtime.machine_id,
                        company_id: downtime.company_id,
                        date: currentDate,
                        startTime: startOfNextDay,
                        isActive: true,
                        reason: downtime.reason,
                    });

                    splitCount++;
                }
            } catch (error) {
                console.error(`Error splitting downtime ${downtime._id}:`, error);
            }
        }

        console.log(`Successfully split ${splitCount} downtimes across day boundaries`);
        return splitCount;
    } catch (error) {
        console.error("Error in splitDowntimesAtMidnight:", error);
        throw error;
    }
};
