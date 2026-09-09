import { PermissionControl } from "@/components/permission-control";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ToolDescriptor } from "@/lib/github/tools";
import { cn } from "cn";
import {
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
  /** Tailwind classes for the icon badge, title and left accent border - `destructive` uses the theme's semantic token, the rest are fixed categorical hues (deliberately not theme-driven, so each tool group keeps a stable identity in both light and dark). */
  accent: { icon: string; title: string; border: string };
};

const cardIconTheme = `size-5`;

const ToolTypeHeader = {
  list: {
    title: "Listing tools",
    description: "This set of tools allows listing items from a repository.",
    lucide_icon: <List className={cardIconTheme} />,
    accent: {
      icon: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
      title: "text-sky-600 dark:text-sky-400",
      border: "border-l-sky-500",
    },
  },
  get: {
    title: "Get tools",
    description:
      "This set of tools allows retrieving a single item from a repository.",
    lucide_icon: <Inbox className={cardIconTheme} />,
    accent: {
      icon: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
      title: "text-violet-600 dark:text-violet-400",
      border: "border-l-violet-500",
    },
  },
  create: {
    title: "Creation tools",
    description: "This set of tools allows creating new items in a repository",
    lucide_icon: <FilePlus className={cardIconTheme} />,
    accent: {
      icon: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      title: "text-emerald-600 dark:text-emerald-400",
      border: "border-l-emerald-500",
    },
  },
  update: {
    title: "Update tools",
    description:
      "This set of tools allows updating existing items in a repository",
    lucide_icon: <RefreshCcw className={cardIconTheme} />,
    accent: {
      icon: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      title: "text-amber-600 dark:text-amber-400",
      border: "border-l-amber-500",
    },
  },
  delete: {
    title: "Destructive tools - Use with caution",
    description:
      "This set of tools allows deleting items in a repository. Use with caution as the action may be irreversible.",
    lucide_icon: <Skull className={cardIconTheme} />,
    accent: {
      icon: "bg-destructive/10 text-destructive",
      title: "text-destructive",
      border: "border-l-destructive",
    },
  },
};

const EFFECT_BADGE_VARIANT = {
  read: "secondary",
  write: "default",
  destructive: "destructive",
} as const;

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
    <Card className={cn("gap-0 border-l-4 pt-0", toolType.accent.border)}>
      <CardHeader className="flex flex-row items-center gap-4 space-y-0 border-b py-4">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg",
            toolType.accent.icon,
          )}
        >
          {toolType.lucide_icon}
        </span>
        <div className="flex flex-col">
          <CardTitle className={cn("text-base", toolType.accent.title)}>
            {toolType.title}
          </CardTitle>
          <CardDescription>{toolType.description}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="divide-y p-0">
        {tools.map((tool) => (
          <div key={tool.slug} className="flex flex-col gap-3 p-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <code className="rounded-md bg-muted px-2 py-1 font-mono text-sm font-medium">
                  {tool.slug}
                </code>
                <Badge variant={EFFECT_BADGE_VARIANT[tool.server_effect]}>
                  {tool.server_effect}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{tool.summary}</p>
            </div>
            <PermissionControl tool={tool} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
