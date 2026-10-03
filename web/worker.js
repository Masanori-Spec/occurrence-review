import { compareCalendars } from "../src/engine.js";
self.onmessage = async ({ data }) => {
  const { requestId, beforeText, afterText, options } = data;
  try {
    const report = await compareCalendars(beforeText, afterText, options);
    self.postMessage({ requestId, report });
  } catch (error) {
    self.postMessage({
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
