import { z } from "zod";

const publicConfigSchema = z.object({
  endpoint: z.string().url(),
  projectId: z.string().min(1),
  databaseId: z.string().min(1),
  materialsBucketId: z.string().min(1),
});

const serverConfigSchema = publicConfigSchema.extend({
  apiKey: z.string().min(1),
});

export type PublicAppwriteConfig = z.infer<typeof publicConfigSchema>;
export type ServerAppwriteConfig = z.infer<typeof serverConfigSchema>;

export function getPublicAppwriteConfig(): PublicAppwriteConfig {
  return publicConfigSchema.parse({
    endpoint: process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT,
    projectId: process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID,
    databaseId: process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    materialsBucketId: process.env.NEXT_PUBLIC_APPWRITE_MATERIALS_BUCKET_ID,
  });
}

export function getServerAppwriteConfig(): ServerAppwriteConfig {
  return serverConfigSchema.parse({
    ...getPublicAppwriteConfig(),
    apiKey: process.env.APPWRITE_API_KEY,
  });
}
