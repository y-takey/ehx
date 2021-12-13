import { execSync, ExecSyncOptions } from "child_process";

const [, , key, targetUrl] = process.argv;

const execOptions: ExecSyncOptions = { stdio: "inherit" };

execSync(`yarn catalog ${key} ${targetUrl}`, execOptions);
execSync(`yarn download ${key}`, execOptions);
