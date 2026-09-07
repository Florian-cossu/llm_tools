import { CircleCheck, FolderGit, Tag, UserCheck } from "lucide-react";

import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { GithubProfile } from "../lib/github_profiles";
import { ProfileActiveToggle } from "./profile-active-toggle";

const COLUMNS = [
  { label: "Profile name", icon: Tag },
  { label: "Owner", icon: UserCheck },
  { label: "Repository", icon: FolderGit },
  { label: "Status", icon: CircleCheck },
];

export default function GithubProfilesTable({
  profiles,
}: {
  profiles: GithubProfile[];
}) {
  if (profiles.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      <Separator />
      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="bg-sky-500/20 hover:bg-sky-500/20">
              {COLUMNS.map(({ label, icon: Icon }) => (
                <TableHead key={label}>
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4" />
                    {label}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles.map(
              (profile) =>
                profile && (
                  <TableRow key={profile.id}>
                    <TableCell className="font-medium">
                      {profile.profile_name}
                    </TableCell>
                    <TableCell className="font-mono text-muted-foreground">
                      {profile.repository_owner}
                    </TableCell>
                    <TableCell className="font-mono text-muted-foreground">
                      {profile.repository_name}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <ProfileActiveToggle profile={profile} />
                        <span className="text-muted-foreground">
                          {profile.is_active ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ),
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
