import "server-only";

import { Client, Functions, Storage, TablesDB, Users } from "node-appwrite";
import { getServerAppwriteConfig } from "./config";

export function createAppwriteAdminServices() {
  const config = getServerAppwriteConfig();
  const client = new Client()
    .setEndpoint(config.endpoint)
    .setProject(config.projectId)
    .setKey(config.apiKey);

  return {
    databaseId: config.databaseId,
    tables: new TablesDB(client),
    storage: new Storage(client),
    functions: new Functions(client),
    users: new Users(client),
  };
}
