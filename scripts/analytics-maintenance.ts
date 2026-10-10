import "dotenv/config";
import { maintainAnalytics } from "../server/lib/analytics-maintenance.js";
import { closeDbClient } from "../server/db/client.js";
try {
  const deadline = Date.now() + 55000;
  let batches = 0;
  let result;
  do {
    result = await maintainAnalytics();
    batches++;
  } while (result.more && batches < 100 && Date.now() < deadline);
  process.stdout.write(`${JSON.stringify({ batches, ...result })}\n`);
  if (result.more) {
    console.error(
      "Analytics maintenance has a remaining backlog; rerun the command.",
    );
    process.exitCode = 1;
  }
} catch {
  console.error(
    "Analytics maintenance failed; verify database availability and migrations.",
  );
  process.exitCode = 1;
} finally {
  await closeDbClient();
}
