import { CircleCheck, KeyRound, Tag } from "lucide-react";

import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchTokenByServerSlug, listAvailableTokens } from "@/lib/tokens";
import { AddTokenForm } from "./add-token-form";
import { TokenActiveToggle } from "./token-active-toggle";

const COLUMNS = [
  { label: "Token name", icon: KeyRound },
  { label: "Type", icon: Tag },
  { label: "Status", icon: CircleCheck },
];

/**
 * Root `.env` keys registered as tokens for one server, grouped visually by
 * `type` (sorted, not sectioned) with a switch per row - `setTokenActive`
 * enforces at most one active token per `(server_id, type)`, so within a
 * type these behave like a radio group. Plus a form to register another
 * unused `.env` key.
 */
export default function TokensManager({ serverSlug }: { serverSlug: string }) {
  const tokens = fetchTokenByServerSlug(serverSlug) ?? [];
  const availableKeys = listAvailableTokens(serverSlug) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <AddTokenForm serverSlug={serverSlug} availableKeys={availableKeys} />

      {tokens.length > 0 && (
        <>
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
                {tokens
                  .slice()
                  .sort((a, b) => a.type.localeCompare(b.type))
                  .map((token) => (
                    <TableRow key={token.id}>
                      <TableCell className="font-mono text-muted-foreground">
                        {token.token_name}
                      </TableCell>
                      <TableCell>{token.type}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <TokenActiveToggle token={token} />
                          <span className="text-muted-foreground">
                            {token.is_active ? "Active" : "Inactive"}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
