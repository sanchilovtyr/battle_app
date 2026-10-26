"use client";

import { SessionProvider } from "next-auth/react";
import CloudSync from "@/components/CloudSync";
import Tracker from "@/components/Tracker";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <CloudSync />
      <Tracker />
      {children}
    </SessionProvider>
  );
}
