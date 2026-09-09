"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartColumnBig, LayoutDashboard, Server } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { GithubIcon } from "@/components/icons/github-icon";
import type { ServerDescriptor } from "@/lib/servers";
import type { LucideIcon } from "lucide-react";

export const LUCIDE_ICON_MAP: Record<string, LucideIcon> = {
  Server,
};

/**
 * Local (non-lucide) icons, inlined as components rather than loaded via
 * `<img src>` - an externally-referenced SVG can't inherit `currentColor`
 * from the page, so it can never pick up the active/hover text color here.
 */
export const LOCAL_ICON_MAP: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  github: GithubIcon,
};

export function AppSidebar({ servers }: { servers: ServerDescriptor[] }) {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname === "/"} size="lg">
              <Link href="/" className="flex flex-row items-center gap-2">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <LayoutDashboard className="size-4" />
                </span>
                <span className="flex flex-col leading-tight">
                  <span className="font-medium">Control Panel</span>
                  <span className="text-xs text-muted-foreground">llm_tools</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/metrics"}>
                  <Link href="/metrics" className="flex flex-row gap-2 items-center">
                    <ChartColumnBig />
                    <span>Metrics</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel className="flex flex-row items-center text-m uppercase gap-2">Servers</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {servers.map((server) => {
                const href = `/servers/${server.slug}`;

                let ServerIcon: React.ReactNode = <Server />;
                if (server.icon_name && server.icon_source === "lucide") {
                  const Icon = LUCIDE_ICON_MAP[server.icon_name];
                  if (Icon) ServerIcon = <Icon />;
                } else if (server.icon_name && server.icon_source === "local") {
                  const Icon = LOCAL_ICON_MAP[server.icon_name];
                  if (Icon) ServerIcon = <Icon className="size-4.5" />;
                }

                return (
                  <SidebarMenuItem key={server.slug} className="rounded-full">
                    <SidebarMenuButton asChild isActive={pathname === href} className="flex flex-row gap-2 items-center rounded-full">
                      <Link href={href}>
                        {ServerIcon}
                        <span>{server.server_name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
