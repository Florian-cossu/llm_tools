import { notFound } from "next/navigation";
import { AlertTriangle, ShieldCheck, ShieldOff, ShieldQuestion } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PermissionControl } from "@/components/permission-control";
import { findServer, SERVERS } from "@/lib/servers";
import { getGithubTools } from "@/lib/tools";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return SERVERS.map((server) => ({ server: server.slug }));
}

export default async function ServerPage({
  params,
}: {
  params: Promise<{ server: string }>;
}) {
  const { server: slug } = await params;
  const server = findServer(slug);
  if (!server) notFound();

  const tools = getGithubTools().filter((tool) => tool.server_name === server.slug);
  const byServerEffect = {
    read: tools.filter((t) => t.server_effect === "read").length,
    write: tools.filter((t) => t.server_effect === "write").length,
    destructive: tools.filter((t) => t.server_effect === "destructive").length,
  };
  const byState = {
    allow: tools.filter((t) => t.state === "allow").length,
    deny: tools.filter((t) => t.state === "deny").length,
    ask: tools.filter((t) => t.state === "ask").length,
  };
  const defects = tools.filter((t) => t.known_defects);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <p className="text-sm text-muted-foreground">servers</p>
        <h1 className="text-2xl font-semibold tracking-tight">{server.label}</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardDescription>Tools</CardDescription>
            <CardTitle className="text-3xl">{tools.length}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {byServerEffect.read} read &middot; {byServerEffect.write} write
            {byServerEffect.destructive ? ` · ${byServerEffect.destructive} destructive` : ""}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Current permission state</CardDescription>
            <CardTitle className="text-3xl">{tools.length}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Badge variant="outline" className="gap-1">
              <ShieldCheck className="size-3.5" />
              {byState.allow} allow
            </Badge>
            <Badge variant="outline" className="gap-1">
              <ShieldOff className="size-3.5" />
              {byState.deny} deny
            </Badge>
            <Badge variant="outline" className="gap-1">
              <ShieldQuestion className="size-3.5" />
              {byState.ask} ask
            </Badge>
          </CardContent>
        </Card>
      </div>

      {defects.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>
            {defects.length} known defect{defects.length === 1 ? "" : "s"}
          </AlertTitle>
          <AlertDescription>
            Flagged on the tool{defects.length === 1 ? "" : "s"} below.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">Permissions</h2>
        {tools.map((tool, i) => (
          <div key={tool.slug} className="flex flex-col gap-3">
            {i > 0 && <Separator />}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-medium">{tool.slug}</span>
                <Badge variant={tool.server_effect === "read" ? "secondary" : "default"}>
                  {tool.server_effect}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{tool.summary}</p>
            </div>
            {tool.known_defects && (
              <Alert variant="destructive">
                <AlertTriangle />
                <AlertTitle>Known defect</AlertTitle>
                <AlertDescription>{tool.known_defects}</AlertDescription>
              </Alert>
            )}
            <PermissionControl tool={tool} />
          </div>
        ))}
      </div>
    </div>
  );
}
