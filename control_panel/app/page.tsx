import Link from "next/link";
import { AlertTriangle, Info, ShieldCheck, ShieldOff, ShieldQuestion } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getGithubTools } from "@/lib/tools";

export const dynamic = "force-dynamic";

export default function Home() {
  const tools = getGithubTools();
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
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Control Panel</h1>
        <p className="text-muted-foreground">
          Check and adjust what each MCP server&apos;s tools are allowed to do.
        </p>
      </div>

      <Alert>
        <Info />
        <AlertTitle>Storage only - not the permission layer</AlertTitle>
        <AlertDescription>
          The state below is a live read of <code className="font-mono text-xs">data/harness.db</code>,
          and editing a tool on its server page writes back to it via{" "}
          <code className="font-mono text-xs">/api/github_mcp_update_permission</code>. Slug,
          summary and effect still mirror the tool code by hand - there is no live tool enumeration
          yet (see docs/07-plans/current.md). Nothing in the github MCP server reads this table
          yet either - <code className="font-mono text-xs">GITHUB_ALLOW_WRITES</code> remains the
          actual gate.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardDescription>Servers</CardDescription>
            <CardTitle className="text-3xl">1</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <Link href="/servers/github" className="underline underline-offset-2">
              github
            </Link>
          </CardContent>
        </Card>
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
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Current permission state</CardTitle>
          <CardDescription>
            Live from <code className="font-mono text-xs">github_mcp</code> in{" "}
            <code className="font-mono text-xs">data/harness.db</code>.
          </CardDescription>
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

      {defects.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>
            {defects.length} known defect{defects.length === 1 ? "" : "s"}
          </AlertTitle>
          <AlertDescription>
            <ul className="list-inside list-disc">
              {defects.map((tool) => (
                <li key={tool.slug}>
                  <Link
                    href={`/servers/${tool.server_name}`}
                    className="font-mono underline underline-offset-2"
                  >
                    {tool.slug}
                  </Link>
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
