import { runSender } from "../lib/telemetry/transport";

await runSender(process.argv[2]);
