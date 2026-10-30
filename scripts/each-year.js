// Runs an npm script once per year in years.json.
//   node scripts/each-year.js release            every year
//   node scripts/each-year.js pull --connected   only years whose Drive kit is connected (has drive.json)
// Stops at the first failure.
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { REPO, config } = require("./year");

const [script, ...rest] = process.argv.slice(2);
if (!script) throw new Error("Usage: node scripts/each-year.js <npm script> [--connected]");
const connectedOnly = rest.includes("--connected");

for (const year of Object.keys(config.years)) {
  if (connectedOnly && !fs.existsSync(path.join(REPO, "years", year, "content", "drive.json"))) continue;
  console.log(`\n=== ${year}: npm run ${script} ===`);
  execSync(`npm run --silent ${script}`, { cwd: REPO, stdio: "inherit", env: { ...process.env, NFH_YEAR: year } });
}
