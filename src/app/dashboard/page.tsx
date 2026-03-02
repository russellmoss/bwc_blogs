"use client";

import { AppShell } from "@/components/layout/AppShell";
import { SplitPane } from "@/components/layout/SplitPane";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { PreviewPanel } from "@/components/preview/PreviewPanel";

export default function DashboardPage() {
  return (
    <AppShell>
      <SplitPane
        left={<ChatPanel />}
        right={<PreviewPanel />}
      />
    </AppShell>
  );
}
