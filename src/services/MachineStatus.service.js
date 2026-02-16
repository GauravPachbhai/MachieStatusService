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
      const imei = machine.id;

      const records = await MoulditDevice.find({ imei })
        .sort({ createdAt: -1 })
        .limit(2);

      let status = "DOWN";
      let currentProdcount = 0;
      let previousProdcount = 0;
      let lastSeenAt = null;

      if (records.length > 0) {
        const latest = records[0];
        const previous = records[1];

        lastSeenAt = latest.createdAt;
        currentProdcount = latest.Prodcount ?? 0;

        // 🔑 CHECK: Is latest telemetry from today?
        if (isSameDay(latest.createdAt, now)) {
          const diffMinutes =
            (now - latest.createdAt) / (1000 * 60);

          if (diffMinutes > DOWN_THRESHOLD_MINUTES) {
            status = "DOWN";
          } else if (latest.Prodcount === undefined) {
            status = "DOWN";
          } else if (!previous) {
            status = "RUNNING";
          } else {
            previousProdcount = previous.Prodcount ?? 0;

            if (currentProdcount !== previousProdcount) {
              status = "RUNNING"; // increment or reset
            } else {
              status = "DOWN";
            }
          }
        } else {
          status = "DOWN";
        }
      }

      // Fetch previous status to detect changes
      const previousStatus = await MachineStatus.findOne({
        imei,
        date: today,
      });

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
        },
        { upsert: true, returnDocument: "after" }
      );

      // Track status changes and manage downtimes
      if (oldStatus && oldStatus !== status) {
        // Status changed from RUNNING/IDLE to DOWN
        if (status === "DOWN" && oldStatus !== "DOWN") {
          await startDowntime(machine._id);
        }
        // Status changed from DOWN to RUNNING
        else if (status === "RUNNING" && oldStatus === "DOWN") {
          await endDowntime(machine._id);
        }
      } else if (!oldStatus && status === "DOWN") {
        // First status check and machine is DOWN
        await startDowntime(machine._id);
      }

    } catch (err) {
      console.error(`Error processing machine ${machine.id}`, err);
    }
  }
};
