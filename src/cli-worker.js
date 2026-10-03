import { parentPort, workerData } from "node:worker_threads";
import { compareCalendars } from "./engine.js";
try {
  parentPort.postMessage({
    report: compareCalendars(
      workerData.before,
      workerData.after,
      workerData.options,
    ),
  });
} catch (error) {
  parentPort.postMessage({ error: error.message });
}
