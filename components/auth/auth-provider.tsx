"use client";

import { ID, type Models } from "appwrite";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getAppwriteBrowserServices } from "@/lib/appwrite/client";
import { isAppwriteNotFound } from "@/lib/appwrite/errors";
import type { StudentProfile, StudyLevel } from "@/lib/appwrite/models";
import { privateUserPermissions } from "@/lib/appwrite/permissions";

type OnboardingInput = {
  displayName: string;
  studyLevel: StudyLevel;
  timezone: string;
  weeklyHours: number;
  learningGoal: string;
};

type AuthContextValue = {
  user: Models.User<Models.Preferences> | null;
  profile: StudentProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  completeOnboarding: (input: OnboardingInput) => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Models.User<Models.Preferences> | null>(null);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { account, tables, config } = getAppwriteBrowserServices();

    try {
      const currentUser = await account.get();
      setUser(currentUser);

      try {
        const currentProfile = await tables.getRow<StudentProfile>({
          databaseId: config.databaseId,
          tableId: "profiles",
          rowId: currentUser.$id,
        });
        setProfile(currentProfile);
      } catch (error) {
        if (!isAppwriteNotFound(error)) throw error;
        setProfile(null);
      }
    } catch {
      setUser(null);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void refresh());
  }, [refresh]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      loading,
      refresh,
      async signIn(email, password) {
        const { account } = getAppwriteBrowserServices();
        await account.createEmailPasswordSession({ email, password });
        await refresh();
      },
      async register(name, email, password) {
        const { account } = getAppwriteBrowserServices();
        await account.create({ userId: ID.unique(), email, password, name });
        await account.createEmailPasswordSession({ email, password });
        await refresh();
      },
      async signOut() {
        const { account } = getAppwriteBrowserServices();
        await account.deleteSession({ sessionId: "current" });
        setUser(null);
        setProfile(null);
      },
      async completeOnboarding(input) {
        if (!user) throw new Error("Sign in before completing onboarding.");
        const { tables, config } = getAppwriteBrowserServices();
        const saved = await tables.upsertRow<StudentProfile>({
          databaseId: config.databaseId,
          tableId: "profiles",
          rowId: user.$id,
          data: {
            ownerId: user.$id,
            displayName: input.displayName,
            studyLevel: input.studyLevel,
            timezone: input.timezone,
            weeklyHours: input.weeklyHours,
            learningGoal: input.learningGoal,
            onboardingComplete: true,
            createdAt: new Date().toISOString(),
          },
          permissions: privateUserPermissions(user.$id),
        });
        setProfile(saved);
      },
    }),
    [loading, profile, refresh, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
