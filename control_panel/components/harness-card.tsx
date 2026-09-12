import type { ReactNode } from "react";
import { ShieldBan, ShieldCheck, ShieldQuestion, Wrench } from "lucide-react";

import { McpIcon } from "@/components/icons/mcp-icon";
import { Card, CardContent, CardFooter, CardHeader } from "./ui/card";
import { Badge } from "./ui/badge";
import { listServers, listToolPermissions } from "@llm-tools/data";

export default function HarnessCard() {
  const servers = listServers();
  const tools = listToolPermissions();
  const byState = {
    allow: tools.filter((t) => t.state === "allow").length,
    deny: tools.filter((t) => t.state === "deny").length,
    ask: tools.filter((t) => t.state === "ask").length,
  };

  return (
    <div className="flex flex-row gap-4 justify-between">
      <ItemCard count={servers.length} type="mcp" />
      <ItemCard count={tools.length} type="tool" />
      <PermissionBadgesCard
        allow={byState.allow}
        deny={byState.deny}
        ask={byState.ask}
        total={tools.length}
      />
    </div>
  );
}

type ItemType = "mcp" | "tool" | "custom";

type ItemCardProps = {
  count: number;
  type: ItemType;
  customIcon?: ReactNode;
  customText?: string;
};

const ITEM_TYPE_PROPS: Record<
  Exclude<ItemType, "custom">,
  {
    icon: ReactNode;
    text: string;
    badgeClass: string;
    numberClass: string;
    glowClass: string;
  }
> = {
  mcp: {
    icon: <McpIcon className="size-5.5" />,
    text: "Server",
    badgeClass: "bg-sky-400/10 text-sky-400",
    numberClass: "text-sky-500",
    glowClass: "ring-sky-400/50 shadow-sky-400/40",
  },
  tool: {
    icon: <Wrench className="size-5.5" />,
    text: "Tool",
    badgeClass: "bg-emerald-400/10 text-emerald-400",
    numberClass: "text-emerald-500",
    glowClass: "ring-emerald-400/50 shadow-emerald-400/40",
  },
};

const CARD_BASE_STYLE = "flex flex-col items-center hover:shadow-lg transition-shadow ease-in-out duration-500";

const CUSTOM_ITEM_CLASSES = {
  badgeClass: "bg-primary/10 text-primary",
  numberClass: "text-primary",
  glowClass: "ring-primary/50 shadow-primary/40",
};

export function ItemCard({
  count,
  type,
  customIcon,
  customText,
}: ItemCardProps) {
  const { icon, text, badgeClass, numberClass, glowClass } =
    type === "custom"
      ? { icon: customIcon, text: customText ?? "", ...CUSTOM_ITEM_CLASSES }
      : ITEM_TYPE_PROPS[type];

  return (
    <Card className={`${CARD_BASE_STYLE} min-w-fit py-4 px-15 ${glowClass}`}>
      <CardHeader className="flex flex-col items-center">
        <div className={`max-w-fit max-h-fit p-2 rounded-full ${badgeClass}`}>
          {icon}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center grow">
        <p className={`text-4xl font-extrabold ${numberClass}`}>{count}</p>
      </CardContent>
      <CardFooter>
        <p>{`${text}${count > 1 ? "s" : ""}`}</p>
      </CardFooter>
    </Card>
  );
}

interface PermissionsCardProps {
  allow: number;
  deny: number;
  ask: number;
  total: number;
}

export function PermissionBadgesCard({
  allow,
  deny,
  ask,
  total,
}: PermissionsCardProps) {
  return (
    <Card className={`${CARD_BASE_STYLE} py-4 px-6 max-w-[16rem] ring-purple-400/50 shadow-purple-400/40`}>
      <CardHeader className="flex flex-col items-center">
        <div className="max-h-fit p-2 rounded-full bg-purple-400/10 text-purple-400">
          <ShieldCheck className="size-5.5" />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center gap-4 min-h-fit">
          <p className="text-4xl font-extrabold text-purple-500">{total}</p>
          <div className="flex flex-row flex-wrap gap-2 items-center justify-center">
            <Badge
              variant="default"
              className="bg-emerald-400/10 text-emerald-400"
            >
              <ShieldCheck />
              <p>{allow} allow</p>
            </Badge>
            <Badge variant="default" className="bg-rose-400/10 text-rose-400">
              <ShieldBan />
              <p>{deny} deny</p>
            </Badge>
            <Badge variant="default" className="bg-sky-400/10 text-sky-400">
              <ShieldQuestion />
              <p>{ask} ask</p>
            </Badge>
          </div>
      </CardContent>
      <CardFooter>
        <p>{`Permission${total > 1 ? "s" : ""}`}</p>
      </CardFooter>
    </Card>
  );
}
