import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cognora Workspace — Plan, learn, practice, improve",
  description: "Your private Cognora AI learning workspace.",
};

export default function WorkspaceLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
