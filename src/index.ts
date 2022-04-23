import { execSync, ExecSyncOptions } from "child_process";

const arg = process.argv.slice(2).join(" ")

const execOptions: ExecSyncOptions = { stdio: "inherit" };

execSync(`yarn catalog ${arg}`, execOptions);
execSync(`yarn download ${arg}`, execOptions);
