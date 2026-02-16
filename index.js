import dotenv from "dotenv";
import app from "./app.js";
import { connectDB } from "./src/config/db.js";
import { startMachineStatusJob } from "./src/Jobs/MachineStatus.job.js";
import { startMidnightDowntimeJob } from "./src/Jobs/MidnightDowntime.job.js";

dotenv.config();

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);

    // Start Background Jobs after DB connected
    startMachineStatusJob();
    startMidnightDowntimeJob();
  });
});
