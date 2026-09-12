import type { Metadata } from "next";
import "./globals.css";
import { Roboto } from "next/font/google";
import { cn } from "@/lib/utils";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { listServers } from "@llm-tools/data";

const roboto = Roboto({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Control Panel",
  description: "Check and update tool permissions and configuration.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const servers = listServers();

  return (
    <html lang="en" className={cn("font-sans", roboto.variable)} suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <TooltipProvider>
            <SidebarProvider>
              <AppSidebar servers={servers} />
              <SidebarInset className="bg-transparent">
                <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b px-4 backdrop-blur-sm">
                  <SidebarTrigger />
                  <Separator orientation="vertical" className="h-4" />
                  <span className="text-sm font-medium">
                    llm_tools control panel
                  </span>
                  <div className="ml-auto flex items-center gap-1">
                    <ThemeToggle />
                  </div>
                </header>
                <main className="flex-1 p-6 bg-transparent">{children}</main>
              </SidebarInset>
            </SidebarProvider>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
