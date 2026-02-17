import Machine from "../model/Machine.js";
import MachineStatus from "../model/MachineStatus.js";
import MoulditDevice from "../model/MoulditDevice.js";
import { startDowntime, endDowntime } from "./Downtime.service.js";

const DOWN_THRESHOLD_MINUTES = 10;

const getISODate = (date) => date.toISOString().split("T")[0];
const isSameDay = (d1, d2) => getISODate(d1) === getISODate(d2);

export const evaluateMachineStatuses = async () => {
  const now = new Date();
  const today = getISODate(now);

  const machines = await Machine.find({ is_active: true }).select("_id id");

  for (const machine of machines) {
    try {
      // ✅ Validate machine has IMEI
      const imei = machine.id;
      if (!imei) {
        console.warn(`⚠️ Machine ${machine._id} has no IMEI, skipping...`);
        continue;
      }

      const records = await MoulditDevice.find({ imei })
        .sort({ createdAt: -1 })
        .limit(2);

      // ✅ Fetch previous status FIRST (needed for 10-minute threshold logic)
      const previousStatus = await MachineStatus.findOne({
        imei,
        date: today,
      });

      let status = "DOWN";
      let currentProdcount = 0;
      let previousProdcount = 0;
      let lastSeenAt = null;
      let downReason = "NO_DATA"; // Track why machine is DOWN
      let downStartedAt = null; // Track when same-prodcount condition started

      if (records.length > 0) {
        const latest = records[0];
        const previous = records[1];

        lastSeenAt = latest.createdAt;
        currentProdcount = latest.Prodcount ?? 0;
        // ✅ Set previousProdcount early (fix for logic bug)
        if (previous) {
          previousProdcount = previous.Prodcount ?? 0;
        }

        // 🔑 CHECK: Is latest telemetry from today?
        if (isSameDay(latest.createdAt, now)) {
          // ✅ PRIORITY: Production count change is the authoritative indicator
          if (currentProdcount !== previousProdcount) {
            // Production count changed = machine is RUNNING
            status = "RUNNING";
            downReason = null;
            downStartedAt = null; // Clear entry point
          } else {
            // Same production count - apply 10-minute threshold
            // Only mark DOWN if same condition has been ongoing for 10+ minutes
            
            // Check if this is a continuation of same condition or a new condition
            const wasRunningBefore = previousStatus && previousStatus.status === "RUNNING";
            const hadDownStartedAt = previousStatus && previousStatus.downStartedAt;
            
            if (hadDownStartedAt && !wasRunningBefore) {
              // Continuing from same prodcount condition - use existing entry point
              const timeElapsed = (now - new Date(previousStatus.downStartedAt)) / (1000 * 60); // minutes
              
              if (timeElapsed >= DOWN_THRESHOLD_MINUTES) {
                // 10+ minutes of same prodcount = DOWN
                status = "DOWN";
                downReason = "SAME_PRODCOUNT_10MIN";
                downStartedAt = previousStatus.downStartedAt; // Keep original entry point
              } else {
                // Less than 10 minutes - keep RUNNING but track entry point
                status = "RUNNING";
                downReason = `SAME_PRODCOUNT_WITHIN_${Math.floor(timeElapsed)}_MIN`;
                downStartedAt = previousStatus.downStartedAt; // Keep entry point
              }
            } else {
              // First time or coming back from RUNNING - start new entry point
              status = "RUNNING";
              downReason = "SAME_PRODCOUNT_ENTRY";
              downStartedAt = now; // Start tracking from now
            }
          }
        } else {
          // ⚠️ Telemetry is from a different day - likely DOWN
          status = "DOWN";
          downReason = "OLD_DATA";
        }
      } else {
        // No data - apply 10-minute threshold
        
        // Check if this is a continuation or a new condition
        const wasRunningBefore = previousStatus && previousStatus.status === "RUNNING";
        const hadDownStartedAt = previousStatus && previousStatus.downStartedAt;
        
        if (hadDownStartedAt && !wasRunningBefore) {
          // Continuing from NO_DATA condition - use existing entry point
          const timeElapsed = (now - new Date(previousStatus.downStartedAt)) / (1000 * 60); // minutes
          
          if (timeElapsed >= DOWN_THRESHOLD_MINUTES) {
            status = "DOWN";
            downReason = "NO_DATA_10MIN";
            downStartedAt = previousStatus.downStartedAt;
          } else {
            status = "RUNNING";
            downReason = `NO_DATA_WITHIN_${Math.floor(timeElapsed)}_MIN`;
            downStartedAt = previousStatus.downStartedAt;
          }
        } else {
          // First time NO_DATA or coming back from RUNNING - start new entry point
          status = "RUNNING";
          downReason = "NO_DATA_ENTRY";
          downStartedAt = now;
        }
      }

      const oldStatus = previousStatus?.status;

      // Update machine status
      await MachineStatus.findOneAndUpdate(
        { imei, date: today },
        {
          machine: machine._id,
          imei,
          date: today,
          status,
          currentProdcount,
          previousProdcount,
          lastSeenAt,
          evaluatedAt: now,
          downStartedAt: downStartedAt, // Track when same-prodcount condition started
        },
        { upsert: true, returnDocument: "after" }
      );

      // Track status changes and manage downtimes
      // 🔑 CHANGE: Always call startDowntime if status is DOWN to update machinedownByHR
      if (status === "DOWN") {
        await startDowntime(machine._id);
        console.log(`⬇️ Machine ${machine._id} (${imei}) → DOWN [Reason: ${downReason}]`);
      } else if (oldStatus === "DOWN" && status !== "DOWN") {
        // Status changed from DOWN to something else
        await endDowntime(machine._id);
        console.log(`⬆️ Machine ${machine._id} (${imei}) → ${status} (Recovery from DOWN)`);
      } else if (status === "RUNNING") {
        console.log(`▶️ Machine ${machine._id} (${imei}) → RUNNING`);
      }
    } catch (err) {
      console.error(`Error processing machine ${machine.id}`, err);
    }
  }
};
