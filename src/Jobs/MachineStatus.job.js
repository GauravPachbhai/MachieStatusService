import { evaluateMachineStatuses } from "../services/MachineStatus.service.js";


let isRunning = false;

export const startMachineStatusJob = () => {
  setInterval(async () => {
    if (isRunning) {
      console.log("Previous job still running, skipping...");
      return;
    }

    isRunning = true;

    try {
      console.log("Running Machine Status Job...");
      await evaluateMachineStatuses();
      console.log("Machine Status Job Completed.");
    } catch (err) {
      console.error("Machine Status Job Error:", err);
    } finally {
      isRunning = false;
    }
  }, 60 * 1000); // Every 1 minute
};
