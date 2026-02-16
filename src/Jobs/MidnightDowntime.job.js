import { splitDowntimesAtMidnight } from "../services/Downtime.service.js";

let isRunning = false;

/**
 * Job that runs once daily at midnight to split active downtimes across day boundaries
 */
export const startMidnightDowntimeJob = () => {
    // Calculate time until next midnight
    const scheduleNextRun = () => {
        const now = new Date();
        const nextMidnight = new Date(now);
        nextMidnight.setHours(24, 0, 0, 0); // Set to next midnight

        const timeUntilMidnight = nextMidnight - now;

        console.log(
            `Midnight Downtime Job scheduled to run at ${nextMidnight.toISOString()}`
        );

        setTimeout(async () => {
            if (isRunning) {
                console.log("Previous midnight job still running, skipping...");
                scheduleNextRun(); // Schedule next run
                return;
            }

            isRunning = true;

            try {
                console.log("Running Midnight Downtime Job...");
                const splitCount = await splitDowntimesAtMidnight();
                console.log(
                    `Midnight Downtime Job Completed. Split ${splitCount} downtimes.`
                );
            } catch (err) {
                console.error("Midnight Downtime Job Error:", err);
            } finally {
                isRunning = false;
                scheduleNextRun(); // Schedule next run for tomorrow
            }
        }, timeUntilMidnight);
    };

    scheduleNextRun();
};
