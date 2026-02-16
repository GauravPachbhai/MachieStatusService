import Downtime from "../model/Downtime.model.js";
import Machine from "../model/Machine.js";

/**
 * Get the ISO date string (YYYY-MM-DD) from a Date object
 */
const getISODate = (date) => date.toISOString().split("T")[0];

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
        const now = new Date();
        const today = getISODate(now);

        // Check if there's already an active downtime for this machine
        const existingDowntime = await Downtime.findOne({
            machine_id,
            isActive: true,
        });

        if (existingDowntime) {
            // Calculate current duration even if still active
            const durationHours = calculateDurationInHours(
                existingDowntime.startTime,
                now
            );

            existingDowntime.machinedownByHR = durationHours;
            await existingDowntime.save();

            console.log(`Updated active downtime for Machine ${machine_id}. Current duration: ${durationHours.toFixed(2)} hours`);
            return existingDowntime;
        }

        // Fetch machine to get company_id
        const machine = await Machine.findById(machine_id).select("customer_id");
        if (!machine) {
            throw new Error(`Machine ${machine_id} not found`);
        }

        // Create new downtime record
        const downtime = await Downtime.create({
            machine_id,
            company_id: machine.customer_id,
            date: today,
            startTime: now,
            machinedownByHR: 0, // Initial value
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
        const now = new Date();

        // Find the active downtime for this machine
        const activeDowntime = await Downtime.findOne({
            machine_id,
            isActive: true,
        });

        if (!activeDowntime) {
            console.log(`No active downtime found for machine ${machine_id}`);
            return null;
        }

        // Calculate duration
        const durationHours = calculateDurationInHours(
            activeDowntime.startTime,
            now
        );

        // Update the downtime record
        activeDowntime.endTime = now;
        activeDowntime.machinedownByHR = durationHours;
        activeDowntime.isActive = false;
        await activeDowntime.save();

        console.log(
            `Ended downtime for machine ${machine_id}. Duration: ${durationHours.toFixed(2)} hours`
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
        const now = new Date();
        const currentDate = getISODate(now);

        // Create midnight timestamp for end of previous day (23:59:59.999)
        const endOfYesterday = new Date(now);
        endOfYesterday.setHours(23, 59, 59, 999);
        endOfYesterday.setDate(endOfYesterday.getDate() - 1);
        const yesterdayDate = getISODate(endOfYesterday);

        // Create midnight timestamp for start of today (00:00:00.000)
        const startOfToday = new Date(now);
        startOfToday.setHours(0, 0, 0, 0);

        // Find all active downtimes from yesterday
        const activeDowntimes = await Downtime.find({
            isActive: true,
            date: yesterdayDate,
        });

        console.log(`Found ${activeDowntimes.length} active downtimes to split at midnight`);

        let splitCount = 0;

        for (const downtime of activeDowntimes) {
            try {
                // Close the yesterday's downtime at 23:59:59
                const durationHours = calculateDurationInHours(
                    downtime.startTime,
                    endOfYesterday
                );

                downtime.endTime = endOfYesterday;
                downtime.machinedownByHR = durationHours;
                downtime.isActive = false;
                await downtime.save();

                // Create new downtime for today starting at 00:00:00
                await Downtime.create({
                    machine_id: downtime.machine_id,
                    company_id: downtime.company_id,
                    date: currentDate,
                    startTime: startOfToday,
                    isActive: true,
                    reason: downtime.reason,
                });

                splitCount++;
                console.log(
                    `Split downtime for machine ${downtime.machine_id} across day boundary`
                );
            } catch (error) {
                console.error(
                    `Error splitting downtime ${downtime._id}:`,
                    error
                );
            }
        }

        console.log(`Successfully split ${splitCount} downtimes at midnight`);
        return splitCount;
    } catch (error) {
        console.error("Error in splitDowntimesAtMidnight:", error);
        throw error;
    }
};
