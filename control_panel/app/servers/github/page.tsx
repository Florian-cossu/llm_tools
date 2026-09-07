import {
  ShieldCheck,
  ShieldOff,
  ShieldQuestion,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getGithubTools } from "@/lib/github/tools";
import permissionCards from "./components/tool_cards_by_slug";
import { Separator } from "@/components/ui/separator";
import { AddProfileForm } from "./components/add-profile-form";
import { listGithubProfiles } from "./lib/github_profiles";
import GithubProfilesTable from "./components/github_profiles_table";

export const dynamic = "force-dynamic";

export default async function GithubServerPage() {
  const tools = getGithubTools();
  const githubProfiles = listGithubProfiles();

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

  return (
    <div className="mx-auto flex w-[80%] flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">GitHub</h1>
      </div>

      <Card>
        <CardHeader>
          <CardDescription>Current permission state</CardDescription>
          <CardTitle className="text-3xl">{tools.length}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-row gap-2">
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
        <CardFooter>
          {byServerEffect.read} read &middot; {byServerEffect.write} write
          {byServerEffect.destructive
            ? ` · ${byServerEffect.destructive} destructive`
            : ""}
        </CardFooter>
      </Card>

      <div className="flex flex-col gap-4">
        <Card className="p-4">
          <AddProfileForm />
          <GithubProfilesTable profiles={githubProfiles} />
        </Card>
      </div>

      <div className="flex flex-col gap-4">
        <h1 className="text-lg font-medium">Permissions</h1>
        {permissionCards(tools)}
      </div>
    </div>
  );
}
