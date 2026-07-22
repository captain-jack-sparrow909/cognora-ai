import { ID, Query } from "appwrite";
import { getAppwriteBrowserServices } from "@/lib/appwrite/client";
import type { BetaProfile } from "@/lib/appwrite/models";
import { privateUserPermissions } from "@/lib/appwrite/permissions";

const allowedEvents = new Set(["view_opened", "calendar_exported", "calendar_link_opened", "pwa_install_prompted", "pwa_installed", "feedback_submitted"]);

function sessionId() {
  const key = "cognora-beta-session";
  const existing = window.sessionStorage.getItem(key);
  if (existing) return existing;
  const value = crypto.randomUUID();
  window.sessionStorage.setItem(key, value);
  return value;
}

function safeMetadata(metadata: Record<string, string | number | boolean> = {}) {
  return Object.fromEntries(
    Object.entries(metadata)
      .filter(([key, value]) => key.length <= 32 && ["string", "number", "boolean"].includes(typeof value))
      .slice(0, 8)
      .map(([key, value]) => [key, typeof value === "string" ? value.slice(0, 80) : value]),
  );
}

export async function trackProductEvent(
  userId: string,
  eventName: string,
  view?: string,
  metadata?: Record<string, string | number | boolean>,
) {
  if (!allowedEvents.has(eventName)) return;
  const { tables, config } = getAppwriteBrowserServices();
  const profileRows = await tables.listRows<BetaProfile>({
    databaseId: config.databaseId,
    tableId: "beta_profiles",
    queries: [Query.equal("ownerId", [userId]), Query.limit(1)],
    ttl: 30,
  });
  if (!profileRows.rows[0]?.analyticsEnabled) return;
  await tables.createRow({
    databaseId: config.databaseId,
    tableId: "analytics_events",
    rowId: ID.unique(),
    data: {
      ownerId: userId,
      eventName,
      view: view?.slice(0, 48),
      sessionId: sessionId(),
      metadataJson: JSON.stringify(safeMetadata(metadata)),
      createdAt: new Date().toISOString(),
    },
    permissions: privateUserPermissions(userId),
  });
}
