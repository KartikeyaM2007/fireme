"use client";
import { useState } from "react";
import { Landing } from "@/components/Landing";
import { Workspace } from "@/components/Workspace";

export default function Home() {
  const [screen, setScreen] = useState<"site" | "workspace">("site");
  return screen === "site" ? (
    <Landing openWorkspace={() => setScreen("workspace")} />
  ) : (
    <Workspace />
  );
}
