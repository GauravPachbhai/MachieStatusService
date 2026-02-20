import Machine from "../model/Machine.js";
import MachineStatus from "../model/MachineStatus.js";
import MoulditDevice from "../model/MoulditDevice.js";
import Customer from "../model/Customer.js";
import { startDowntime, endDowntime } from "./Downtime.service.js";

const LOOKBACK_MINUTES = 5;
const DOWN_THRESHOLD_MINUTES = 10;

const getISODate = (date, timezone = "Asia/Kolkata") =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

export const evaluateMachineStatuses = async () => {
  const now = new Date();

  console.log("▶️ Running Machine Status Job...");

  const machines = await Machine.find({ is_active: true })
    .select("_id id machineNameL customer_id");

  for (const machine of machines) {
    try {
      const imei = machine.id;
      if (!imei) {
        console.warn(`⚠️ Machine ${machine._id} has no IMEI, skipping`);
        continue;
      }

      console.log(
        `\n🔍 Checking for machine ${machine.machineNameL} (${machine._id}) [IMEI: ${imei}]`
      );

      const customer = await Customer.findById(machine.customer_id)
        .select("timezone");

      const timezone = customer?.timezone || "Asia/Kolkata";
      const today = getISODate(now, timezone);

      const previousStatus = await MachineStatus.findOne({
        imei,
        date: today,
      });

      // ---- 1️⃣ Fetch telemetry in lookback window ----
      const since = new Date(
        now.getTime() - LOOKBACK_MINUTES * 60 * 1000
      );

      const records = await MoulditDevice.find({
        imei,
        createdAt: { $gte: since },
      })
        .sort({ createdAt: 1 }) // oldest → newest
        .select("Prodcount createdAt");

      console.log(
        `📥 Telemetry records in last ${LOOKBACK_MINUTES} min: ${records.length}`
      );

      // ---- 2️⃣ Detect production using Prodcount only ----
      let hasProduction = false;
      let firstProd = null;
      let lastProd = null;
      let lastSeenAt = null;

      for (const r of records) {
        lastSeenAt = r.createdAt;

        if (typeof r.Prodcount !== "number") continue;

        if (firstProd === null) {
          firstProd = r.Prodcount;
        }

        lastProd = r.Prodcount;

        if (lastProd > firstProd) {
          hasProduction = true;
          break;
        }
      }

      console.log(
        `📊 Prodcount window: first=${firstProd}, last=${lastProd}, produced=${hasProduction}`
      );

      // ---- 3️⃣ Status decision ----
      let status = "RUNNING";
      let downStartedAt = previousStatus?.downStartedAt ?? null;
      let downReason = null;

      if (!hasProduction) {
        if (downStartedAt) {
          const elapsedMin =
            (now - new Date(downStartedAt)) / (1000 * 60);

          console.log(
            `⏱ No production since ${downStartedAt} (${elapsedMin.toFixed(
              2
            )} min)`
          );

          if (elapsedMin >= DOWN_THRESHOLD_MINUTES) {
            status = "DOWN";
            downReason = "NO_PRODUCTION_10MIN";
          } else {
            status = "RUNNING";
            downReason = `NO_PRODUCTION_${Math.floor(elapsedMin)}MIN`;
          }
        } else {
          downStartedAt = now;
          status = "RUNNING";
          downReason = "NO_PRODUCTION_ENTRY";

          console.log(
            "🟡 No production detected — starting grace timer"
          );
        }
      } else {
        if (downStartedAt) {
          console.log(
            "🟢 Production resumed — clearing downStartedAt"
          );
        }
        downStartedAt = null;
      }

      const oldStatus = previousStatus?.status;

      // ---- 4️⃣ Persist MachineStatus ----
      await MachineStatus.findOneAndUpdate(
        { imei, date: today },
        {
          machine: machine._id,
          imei,
          date: today,
          status,
          lastSeenAt,
          evaluatedAt: now,
          downStartedAt,
        },
        { upsert: true }
      );

      // ---- 5️⃣ Downtime accounting ----
      if (status === "DOWN") {
        await startDowntime(machine._id);
        console.log(
          `⬇️ ${machine.machineNameL} → DOWN [${downReason}]`
        );
      } else if (oldStatus === "DOWN") {
        await endDowntime(machine._id);
        console.log(
          `⬆️ ${machine.machineNameL} → RUNNING (Recovered from DOWN)`
        );
      } else {
        console.log(
          `▶️ ${machine.machineNameL} → RUNNING`
        );
      }
    } catch (err) {
      console.error(
        `❌ Error processing machine ${machine.machineNameL} (${machine._id})`,
        err
      );
    }
  }

  console.log("\n✅ Machine Status Job Completed.");
};