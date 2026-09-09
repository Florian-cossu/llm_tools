export type RecordEventStatusType = "success" | "error";
export type RecordEventStringOrNUllType = string | null;
export type RecordEventDurationType = number | null;
export type RecordEventIdType = number | null;

export type RecordEvent = {
    id: number,
    server_id: number;
    session_id: RecordEventStringOrNUllType;
    /** FK to `permissions.id` - a slug alone can't identify a tool, since it's only unique per `server_id`. */
    tool_id: RecordEventIdType;
    status: RecordEventStatusType;
    error_message: RecordEventStringOrNUllType;
    duration_ms: RecordEventDurationType;
    created_at: string;
}

/**
 * Input for `recordEvent`. Only `server_slug` is required so the same insert
 * covers a bare "this happened" ping and a full tool-call outcome - callers
 * pass whichever fields their use case has. `tool_slug` is resolved to
 * `permissions.id` for the FK - scoped by `server_slug`, since the same slug
 * can name different tools on different servers.
 */
export type RecordEventInput = {
    server_slug: string;
    session_id?: RecordEventStringOrNUllType;
    tool_slug?: RecordEventStringOrNUllType;
    status?: RecordEventStatusType;
    error_message?: RecordEventStringOrNUllType;
    duration_ms?: RecordEventDurationType;
}