import { PermissionControl } from "@/components/permission-control";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ToolDescriptor } from "@/lib/github/tools";
import { cn } from "cn";
import {
  ChevronRight,
  FilePlus,
  Inbox,
  List,
  RefreshCcw,
  Skull,
} from "lucide-react";

type ToolsBySlug =
  | {
      list: ToolDescriptor[];
      get: ToolDescriptor[];
      create: ToolDescriptor[];
      update: ToolDescriptor[];
      delete: ToolDescriptor[];
    }
  | undefined;

type ToolTypeHeaderType = {
  title: string;
  description: string;
  lucide_icon: any;
  is_dangerous: boolean;
};

const cardIconTheme = `w-5 h-5`;

const ToolTypeHeader = {
  list: {
    title: "Listing tools",
    description: "This set of tools allows listing items from a repository.",
    lucide_icon: <List className={cardIconTheme} />,
    is_dangerous: false,
  },
  get: {
    title: "Get tools",
    description:
      "This set of tools allows retrieving a single item from a repository.",
    lucide_icon: <Inbox className={cardIconTheme} />,
    is_dangerous: false,
  },
  create: {
    title: "Creation tools",
    description: "This set of tools allows creating new items in a repository",
    lucide_icon: <FilePlus className={cardIconTheme} />,
    is_dangerous: false,
  },
  update: {
    title: "Update tools",
    description:
      "This set of tools allows updating existing items in a repository",
    lucide_icon: <RefreshCcw className={cardIconTheme} />,
    is_dangerous: false,
  },
  delete: {
    title: "Destructive tools - Use with caution",
    description:
      "This set of tools allows deleting items in a repository. Use with caution as the action may be irreversible.",
    lucide_icon: <Skull className={cardIconTheme} />,
    is_dangerous: true,
  },
};

export default async function permissionCards(tools: ToolDescriptor[]) {
  const bySlug: ToolsBySlug = {
    list: tools.filter((t: ToolDescriptor) => t.slug.startsWith("list")),
    get: tools.filter((t: ToolDescriptor) => t.slug.startsWith("get")),
    create: tools.filter((t: ToolDescriptor) => t.slug.startsWith("create")),
    update: tools.filter((t: ToolDescriptor) => t.slug.startsWith("update")),
    delete: tools.filter((t: ToolDescriptor) => t.slug.startsWith("delete")),
  };

  return (
    <div className="flex flex-col w-full gap-8">
      {bySlug.list.length > 0 &&
        permissionCard(bySlug.list, ToolTypeHeader.list)}
      {bySlug.get.length > 0 && permissionCard(bySlug.get, ToolTypeHeader.get)}
      {bySlug.create.length > 0 &&
        permissionCard(bySlug.create, ToolTypeHeader.create)}
      {bySlug.update.length > 0 &&
        permissionCard(bySlug.update, ToolTypeHeader.update)}
      {bySlug.delete.length > 0 &&
        permissionCard(bySlug.delete, ToolTypeHeader.delete)}
    </div>
  );
}

async function permissionCard(
  tools: ToolDescriptor[],
  toolType: ToolTypeHeaderType,
) {
  return (
    <Card className="pt-0">
      <CardHeader
        className={`p-2 py-4 ${toolType.is_dangerous ? "bg-red-500/10" : "bg-sky-500/10"}`}
      >
        <CardTitle
          className={cn(
            `flex flex-row gap-4 items-center px-2`,
            `${toolType.is_dangerous ? "text-red-500" : "text-sky-500"}`,
          )}
        >
          {toolType.lucide_icon} {toolType.title}
        </CardTitle>
        <CardDescription
          className={`px-2 ${toolType.is_dangerous ? "text-red-700" : ""}`}
        >
          {toolType.description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {tools.map((tool, i) => (
          <div key={tool.slug} className="flex flex-col gap-3">
            {i > 0 && <Separator />}
            <div>
              <div className="flex items-center gap-2">
                <ChevronRight
                  className={`w-4 h-4 ${toolType.is_dangerous ? "text-red-500" : "text-sky-500"}`}
                />
                <span
                  className={`font-mono font-medium p-1 px-3 rounded-md ${toolType.is_dangerous ? "bg-red-400/20" : "bg-gray-400/20"}`}
                >
                  {tool.slug}
                </span>
                <Badge
                  variant={
                    tool.server_effect === "read" ? "secondary" : "default"
                  }
                >
                  {tool.server_effect}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{tool.summary}</p>
            </div>
            <PermissionControl tool={tool} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
