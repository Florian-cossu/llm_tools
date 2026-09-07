/** The CHECK (state IN (...)) vocabulary on `permissions.default_state`. */
export type PermissionState = "allow" | "deny" | "ask";

/** The CHECK (tool_effect IN (...)) vocabulary on `permissions.tool_effect`. */
export type ToolEffect = "read" | "write" | "destructive";

export type ToolPermission = {
  id: number;
  server_id: number;
  slug: string;
  tool_effect: ToolEffect;
  description: string | null;
  /** The decision a permission layer would consult - editable, unlike `default_state`. */
  state: PermissionState;
  default_state: PermissionState;
};