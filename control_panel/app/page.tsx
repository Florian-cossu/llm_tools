import Link from "next/link";
import { LayoutDashboard, Server as ServerIcon, ShieldCheck, ShieldOff, ShieldQuestion, Wrench } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listServers, listToolPermissions } from "@llm-tools/data";
import HarnessCard from "@/components/harness-card";

export const dynamic = "force-dynamic";

export default function Home() {
  const servers = listServers();
  const tools = listToolPermissions();
  const byServerEffect = {
    read: tools.filter((t) => t.tool_effect === "read").length,
    write: tools.filter((t) => t.tool_effect === "write").length,
    destructive: tools.filter((t) => t.tool_effect === "destructive").length,
  };
  const byState = {
    allow: tools.filter((t) => t.state === "allow").length,
    deny: tools.filter((t) => t.state === "deny").length,
    ask: tools.filter((t) => t.state === "ask").length,
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <div className="flex flex-row gap-2 items-center">
          <LayoutDashboard />
          <h1 className="text-2xl font-semibold tracking-tight">Control Panel</h1>
        </div>
        <p className="text-muted-foreground">
          Check and adjust what each MCP server&apos;s tools are allowed to do.
        </p>
      </div>

      <HarnessCard />

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Current permission state</CardTitle>
          <CardDescription>
            Live from <code className="font-mono text-xs">permissions</code> in{" "}
            <code className="font-mono text-xs">data/harness.db</code>, across every server.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Badge variant="outline" className="gap-1">
            <ShieldCheck className="size-3.5 text-primary" />
            {byState.allow} allow
          </Badge>
          <Badge variant="outline" className="gap-1">
            <ShieldOff className="size-3.5 text-destructive" />
            {byState.deny} deny
          </Badge>
          <Badge variant="outline" className="gap-1">
            <ShieldQuestion className="size-3.5 text-muted-foreground" />
            {byState.ask} ask
          </Badge>
        </CardContent>
      </Card>
    </div>
  );
}
