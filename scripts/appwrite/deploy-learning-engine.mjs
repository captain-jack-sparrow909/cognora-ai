import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import {
  Client,
  Functions,
  ProjectKeyScopes,
  Role,
  Runtime,
} from "node-appwrite";
import { InputFile } from "node-appwrite/file";

const required = [
  "NEXT_PUBLIC_APPWRITE_ENDPOINT",
  "NEXT_PUBLIC_APPWRITE_PROJECT_ID",
  "APPWRITE_API_KEY",
  "APPWRITE_DATABASE_ID",
  "APPWRITE_MATERIALS_BUCKET_ID",
  "APPWRITE_SUBMISSIONS_BUCKET_ID",
  "DEEPSEEK_API_KEY",
  "DEEPSEEK_BASE_URL",
  "DEEPSEEK_FAST_MODEL",
  "DEEPSEEK_REASONING_MODEL",
  "AI_DAILY_REQUEST_LIMIT",
];
for (const key of required) if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`);

const functionId = process.env.NEXT_PUBLIC_APPWRITE_LEARNING_FUNCTION_ID || "learning-engine";
const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);
const functions = new Functions(client);

let current;
try {
  current = await functions.get({ functionId });
} catch (caught) {
  if (caught?.code !== 404) throw caught;
}

const settings = {
  functionId,
  name: "Cognora learning engine",
  runtime: Runtime.Node22,
  execute: [Role.users()],
  timeout: 180,
  enabled: true,
  logging: true,
  entrypoint: "src/main.js",
  commands: "npm install",
  scopes: [ProjectKeyScopes.RowsRead, ProjectKeyScopes.RowsWrite, ProjectKeyScopes.FilesRead],
};

if (current) {
  await functions.update(settings);
  console.log(`Updated function: ${functionId}`);
} else {
  await functions.create(settings);
  console.log(`Created function: ${functionId}`);
}

const variables = [
  ["appwrite_endpoint", "APPWRITE_ENDPOINT", process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT, false],
  ["database_id", "APPWRITE_DATABASE_ID", process.env.APPWRITE_DATABASE_ID, false],
  ["materials_bucket", "APPWRITE_MATERIALS_BUCKET_ID", process.env.APPWRITE_MATERIALS_BUCKET_ID, false],
  ["submissions_bucket", "APPWRITE_SUBMISSIONS_BUCKET_ID", process.env.APPWRITE_SUBMISSIONS_BUCKET_ID, false],
  ["deepseek_key", "DEEPSEEK_API_KEY", process.env.DEEPSEEK_API_KEY, true],
  ["deepseek_base", "DEEPSEEK_BASE_URL", process.env.DEEPSEEK_BASE_URL, false],
  ["deepseek_fast", "DEEPSEEK_FAST_MODEL", process.env.DEEPSEEK_FAST_MODEL, false],
  ["deepseek_reasoning", "DEEPSEEK_REASONING_MODEL", process.env.DEEPSEEK_REASONING_MODEL, false],
  ["ai_daily_limit", "AI_DAILY_REQUEST_LIMIT", process.env.AI_DAILY_REQUEST_LIMIT, false],
];
const existing = await functions.listVariables({ functionId, total: false });
for (const [variableId, key, value, secret] of variables) {
  const match = existing.variables.find((variable) => variable.key === key);
  if (match) await functions.updateVariable({ functionId, variableId: match.$id, key, value, secret });
  else await functions.createVariable({ functionId, variableId, key, value, secret });
}
console.log("Synced learning-engine variables.");

const sourceDirectory = new URL("../../functions/learning-engine", import.meta.url).pathname;
const archivePath = "/private/tmp/cognora-learning-engine.tar.gz";
if (!existsSync(sourceDirectory)) throw new Error(`Function source not found: ${sourceDirectory}`);
execFileSync("tar", ["--exclude=node_modules", "-czf", archivePath, "-C", sourceDirectory, "."], { stdio: "inherit" });
const deployment = await functions.createDeployment({
  functionId,
  code: InputFile.fromPath(archivePath),
  activate: true,
  entrypoint: "src/main.js",
  commands: "npm install",
});
console.log(`Created deployment: ${deployment.$id}`);

const deadline = Date.now() + 8 * 60_000;
while (Date.now() < deadline) {
  const status = await functions.getDeployment({ functionId, deploymentId: deployment.$id });
  if (status.status === "ready") {
    console.log("Cognora learning engine is deployed and ready.");
    process.exit(0);
  }
  if (status.status === "failed") throw new Error(`Function deployment failed: ${status.buildLogs || "No build log available"}`);
  await new Promise((resolve) => setTimeout(resolve, 3_000));
}
throw new Error("Timed out waiting for the learning-engine deployment.");
