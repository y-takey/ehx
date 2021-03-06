const { execSync } = require("child_process");

const [, , key, targetUrl] = process.argv;

const execOptions = { stdio: "inherit" };

execSync(`yarn catalog ${key} ${targetUrl}`, execOptions);
execSync(`yarn download ${key}`, execOptions);
