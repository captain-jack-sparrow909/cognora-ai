import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { Client, Functions, ProjectKeyScopes, Query, Role, Runtime } from "node-appwrite";
import { InputFile } from "node-appwrite/file";

const required = ["NEXT_PUBLIC_APPWRITE_ENDPOINT", "NEXT_PUBLIC_APPWRITE_PROJECT_ID", "APPWRITE_API_KEY", "APPWRITE_DATABASE_ID", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_CALENDAR_REDIRECT_URI", "CALENDAR_TOKEN_ENCRYPTION_KEY", "APP_PUBLIC_URL"];
for (const key of required) if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`);

const functionId = "google-calendar-oauth";
const client = new Client().setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT).setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID).setKey(process.env.APPWRITE_API_KEY);
const functions = new Functions(client);
const settings = { functionId, name: "Cognora Google Calendar OAuth", runtime: Runtime.Node22, execute: [Role.any()], timeout: 60, enabled: true, logging: true, entrypoint: "src/main.js", commands: "npm install", scopes: [ProjectKeyScopes.RowsRead, ProjectKeyScopes.RowsWrite] };
let current;
try { current = await functions.get({ functionId }); } catch (caught) { if (caught?.code !== 404) throw caught; }
if (current) await functions.update(settings); else await functions.create(settings);

const variables = [
  ["google_oauth_appwrite_admin_key", "APPWRITE_ADMIN_API_KEY", process.env.APPWRITE_API_KEY, true],
  ["google_oauth_database", "APPWRITE_DATABASE_ID", process.env.APPWRITE_DATABASE_ID, false],
  ["google_oauth_client_id", "GOOGLE_CLIENT_ID", process.env.GOOGLE_CLIENT_ID, false],
  ["google_oauth_client_secret", "GOOGLE_CLIENT_SECRET", process.env.GOOGLE_CLIENT_SECRET, true],
  ["google_oauth_redirect", "GOOGLE_CALENDAR_REDIRECT_URI", process.env.GOOGLE_CALENDAR_REDIRECT_URI, false],
  ["google_oauth_encryption", "CALENDAR_TOKEN_ENCRYPTION_KEY", process.env.CALENDAR_TOKEN_ENCRYPTION_KEY, true],
  ["google_oauth_public_url", "APP_PUBLIC_URL", process.env.APP_PUBLIC_URL, false],
  ["google_oauth_workspace_url", "APP_WORKSPACE_URL", process.env.APP_WORKSPACE_URL || `${process.env.APP_PUBLIC_URL.replace(/\/$/, "")}/app`, false],
];
const existing = await functions.listVariables({ functionId, queries: [Query.limit(100)], total: false });
for (const [variableId, key, value, secret] of variables) {
  const match = existing.variables.find((variable) => variable.key === key);
  if (match) await functions.updateVariable({ functionId, variableId: match.$id, key, value, secret });
  else await functions.createVariable({ functionId, variableId, key, value, secret });
}

const sourceDirectory = new URL("../../functions/google-calendar-oauth", import.meta.url).pathname;
const archivePath = "/private/tmp/cognora-google-calendar-oauth.tar.gz";
if (!existsSync(sourceDirectory)) throw new Error("Google Calendar OAuth source is missing.");
execFileSync("tar", ["--exclude=node_modules", "-czf", archivePath, "-C", sourceDirectory, "."], { stdio: "inherit" });
const deployment = await functions.createDeployment({ functionId, code: InputFile.fromPath(archivePath), activate: true, entrypoint: "src/main.js", commands: "npm install" });
const deadline = Date.now() + 180_000;
while (Date.now() < deadline) {
  const currentDeployment = await functions.getDeployment({ functionId, deploymentId: deployment.$id });
  if (currentDeployment.status === "ready") { console.log("Cognora Google Calendar OAuth is deployed and ready."); process.exit(0); }
  if (currentDeployment.status === "failed") throw new Error(currentDeployment.buildLogs || "Google Calendar OAuth deployment failed.");
  await new Promise((resolve) => setTimeout(resolve, 2_000));
}
throw new Error("Timed out waiting for the Google Calendar OAuth deployment.");
