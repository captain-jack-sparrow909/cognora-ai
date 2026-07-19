"use client";

import { Account, Client, Functions, Storage, TablesDB } from "appwrite";
import { getPublicAppwriteConfig } from "./config";

let services: ReturnType<typeof createServices> | undefined;

function createServices() {
  const config = getPublicAppwriteConfig();
  const client = new Client().setEndpoint(config.endpoint).setProject(config.projectId);

  return {
    config,
    account: new Account(client),
    tables: new TablesDB(client),
    storage: new Storage(client),
    functions: new Functions(client),
  };
}

export function getAppwriteBrowserServices() {
  services ??= createServices();
  return services;
}
