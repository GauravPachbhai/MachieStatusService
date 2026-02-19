import { splitDowntimesAtMidnight } from "../services/Downtime.service.js";

let isRunning = false;

/**
 * Job that runs once daily at midnight to split active downtimes across day boundaries
 */
export const startMidnightDowntimeJob = () => {
    // Calculate time until next midnight IST
    const scheduleNextRun = () => {
        const now = new Date();

        // Use Intl.DateTimeFormat to get the current time in IST
        const formatter = new Intl.DateTimeFormat("en-US", {
            timeZone: "Asia/Kolkata",
            year: "numeric",
            month: "numeric",
            day: "numeric",
            hour: "numeric",
            minute: "numeric",
            second: "numeric",
            hour12: false,
        });

        const parts = formatter.formatToParts(now);
        const map = Object.fromEntries(parts.map(p => [p.type, p.value]));

        // Construct the current date in IST
        const istNow = new Date(
            parseInt(map.year),
            parseInt(map.month) - 1,
            parseInt(map.day),
            parseInt(map.hour),
            parseInt(map.minute),
            parseInt(map.second)
        );

        // Target: next midnight IST
        const nextMidnightIST = new Date(
            parseInt(map.year),
            parseInt(map.month) - 1,
            parseInt(map.day) + 1,
            0, 0, 0, 0
        );

        // Convert back to real time difference
        // We can use a simpler approach: get the ISO string for IST midnight and parse it
        const nextMidnightISTString = `${map.year}-${map.month.padStart(2, '0')}-${(parseInt(map.day) + 1).toString().padStart(2, '0')}T00:00:00`;

        // This is still tricky due to Date object being UTC based.
        // Let's use the offset method.
        const istOffset = 5.5 * 60 * 60 * 1000;
        const nowIST = new Date(now.getTime() + istOffset);
        const nextMidnightIST_Obj = new Date(nowIST);
        nextMidnightIST_Obj.setUTCHours(24, 0, 0, 0); // Next UTC day at 00:00

        const timeUntilMidnight = nextMidnightIST_Obj.getTime() - nowIST.getTime();

        console.log(
            `Midnight Downtime Job (IST) scheduled to run in ${Math.floor(timeUntilMidnight / 1000 / 60)} minutes.`
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
