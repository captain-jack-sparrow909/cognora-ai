import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { Client, Functions, ProjectKeyScopes, Role, Runtime } from "node-appwrite";
import { InputFile } from "node-appwrite/file";

const required = ["NEXT_PUBLIC_APPWRITE_ENDPOINT", "NEXT_PUBLIC_APPWRITE_PROJECT_ID", "APPWRITE_API_KEY", "APPWRITE_DATABASE_ID"];
for (const key of required) if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`);

const stripeWebhookSecrets = [process.env.STRIPE_WEBHOOK_SECRET, process.env.STRIPE_WEBHOOK_SECRET_1, process.env.STRIPE_WEBHOOK_SECRET_2].filter(Boolean);
if (!process.env.STRIPE_SECRET_KEY || !stripeWebhookSecrets.length || !process.env.STRIPE_PRICE_PRO) {
  console.log("Stripe credentials are not configured; billing-webhook deployment remains safely skipped.");
  process.exit(0);
}

const functionId = "billing-webhook";
const client = new Client().setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT).setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID).setKey(process.env.APPWRITE_API_KEY);
const functions = new Functions(client);
const settings = { functionId, name: "Cognora billing webhook", runtime: Runtime.Node22, execute: [Role.any()], timeout: 60, enabled: true, logging: true, entrypoint: "src/main.js", commands: "npm install", scopes: [ProjectKeyScopes.RowsRead, ProjectKeyScopes.RowsWrite] };
let current;
try { current = await functions.get({ functionId }); } catch (caught) { if (caught?.code !== 404) throw caught; }
if (current) await functions.update(settings); else await functions.create(settings);

const variables = [
  ["billing_database_id", "APPWRITE_DATABASE_ID", process.env.APPWRITE_DATABASE_ID, false],
  ["billing_stripe_secret", "STRIPE_SECRET_KEY", process.env.STRIPE_SECRET_KEY, true],
  ["billing_stripe_webhook_secret", "STRIPE_WEBHOOK_SECRET", process.env.STRIPE_WEBHOOK_SECRET, true],
  ["billing_stripe_webhook_secret_1", "STRIPE_WEBHOOK_SECRET_1", process.env.STRIPE_WEBHOOK_SECRET_1, true],
  ["billing_stripe_webhook_secret_2", "STRIPE_WEBHOOK_SECRET_2", process.env.STRIPE_WEBHOOK_SECRET_2, true],
  ["billing_stripe_price_pro", "STRIPE_PRICE_PRO", process.env.STRIPE_PRICE_PRO, false],
].filter(([, , value]) => Boolean(value));
if (process.env.STRIPE_PRICE_EDUCATION) variables.push(["billing_stripe_price_education", "STRIPE_PRICE_EDUCATION", process.env.STRIPE_PRICE_EDUCATION, false]);
const existing = await functions.listVariables({ functionId, total: false });
for (const [variableId, key, value, secret] of variables) {
  const match = existing.variables.find((variable) => variable.key === key);
  if (match) await functions.updateVariable({ functionId, variableId: match.$id, key, value, secret });
  else await functions.createVariable({ functionId, variableId, key, value, secret });
}

const sourceDirectory = new URL("../../functions/billing-webhook", import.meta.url).pathname;
const archivePath = "/private/tmp/cognora-billing-webhook.tar.gz";
if (!existsSync(sourceDirectory)) throw new Error("Billing webhook source is missing.");
execFileSync("tar", ["--exclude=node_modules", "-czf", archivePath, "-C", sourceDirectory, "."], { stdio: "inherit" });
const deployment = await functions.createDeployment({ functionId, code: InputFile.fromPath(archivePath), activate: true, entrypoint: "src/main.js", commands: "npm install" });
const deadline = Date.now() + 180_000;
while (Date.now() < deadline) {
  const currentDeployment = await functions.getDeployment({ functionId, deploymentId: deployment.$id });
  if (currentDeployment.status === "ready") { console.log("Cognora billing webhook is deployed and ready."); process.exit(0); }
  if (currentDeployment.status === "failed") throw new Error(currentDeployment.buildLogs || "Billing webhook deployment failed.");
  await new Promise((resolve) => setTimeout(resolve, 2_000));
}
throw new Error("Timed out waiting for the billing webhook deployment.");
