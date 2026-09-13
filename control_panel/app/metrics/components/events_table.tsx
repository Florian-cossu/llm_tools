"use client";

import { useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Fingerprint,
  ScrollText,
  Server,
  Timer,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import {
  columnFilteringFeature,
  columnResizingFeature,
  columnSizingFeature,
  createColumnHelper,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_equalsString,
  filterFn_includesString,
  globalFilteringFeature,
  metaHelper,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_text,
  tableFeatures,
  useTable,
  type ColumnFiltersState,
  type PaginationState,
  type SortingState,
} from "@tanstack/react-table";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useLocale } from "@/hooks/use-locale";
import { cn } from "@/lib/utils";
import type { EventLogRow, EventStatus } from "@/lib/events";

type ColumnMeta = { icon: LucideIcon };

/**
 * Only the features this table actually uses - v9 tree-shakes unregistered
 * ones, so each slot below (sorting, filtering, pagination, resizing) needs
 * its feature and, where it processes rows, a row-model factory.
 */
const features = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
  globalFilteringFeature,
  rowPaginationFeature,
  columnSizingFeature,
  columnResizingFeature,
  columnMeta: metaHelper<ColumnMeta>(),
  sortedRowModel: createSortedRowModel(),
  filteredRowModel: createFilteredRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  filterFns: {
    includesString: filterFn_includesString,
    equalsString: filterFn_equalsString,
  },
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    text: sortFn_text,
  },
});

const columnHelper = createColumnHelper<typeof features, EventLogRow>();

const PAGE_SIZES = [10, 25, 50, 100];

function DetailField({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-sky-300 uppercase">
        <Icon className="size-4" />
        {label}
      </span>
      <div className="text-sm ml-6">{children}</div>
    </div>
  );
}

function parseCreatedAt(createdAt: string): number {
  // SQLite's `datetime('now')` is UTC without a zone suffix - append one so
  // the browser doesn't parse it as local time.
  return new Date(`${createdAt.replace(" ", "T")}Z`).getTime();
}

function formatTimestamp(createdAt: string, locale: string): string {
  const ms = parseCreatedAt(createdAt);
  return Number.isNaN(ms) ? createdAt : new Date(ms).toLocaleString(locale, { timeZone: "UTC" });
}

function buildColumns(locale: string) {
  return columnHelper.columns([
    columnHelper.accessor("created_at", {
      header: "Time",
      cell: (info) => formatTimestamp(info.getValue(), locale),
      meta: { icon: CalendarClock },
      size: 190,
      minSize: 120,
    }),
    columnHelper.accessor("server_name", {
      header: "Server",
      meta: { icon: Server },
      size: 130,
      minSize: 80,
    }),
    columnHelper.accessor("tool_slug", {
      header: "Tool",
      cell: (info) => info.getValue() ?? "—",
      meta: { icon: Wrench },
      size: 190,
      minSize: 100,
    }),
    columnHelper.accessor("status", {
      header: "Status",
      cell: (info) => (
        <Badge variant={info.getValue() === "error" ? "destructive" : "outline"}>
          {info.getValue()}
        </Badge>
      ),
      meta: { icon: CircleCheck },
      size: 100,
      minSize: 80,
      filterFn: "equalsString",
    }),
    columnHelper.accessor("duration_ms", {
      header: "Duration",
      cell: (info) => (info.getValue() !== null ? `${info.getValue()} ms` : "—"),
      meta: { icon: Timer },
      size: 100,
      minSize: 80,
    }),
    columnHelper.accessor("session_id", {
      header: "Session",
      cell: (info) => info.getValue() || "—",
      meta: { icon: Fingerprint },
      size: 160,
      minSize: 80,
    }),
    columnHelper.accessor("error_message", {
      header: "Error",
      cell: (info) => info.getValue() || "—",
      meta: { icon: AlertTriangle },
      size: 240,
      minSize: 100,
    }),
  ]);
}

type DateRange = { from?: string; to?: string };

export default function EventsTable({
  events,
  dateRange,
}: {
  events: EventLogRow[];
  /** Already applied server-side (`lib/events.ts`'s `listEvents`) - these inputs only reflect it and update the URL. */
  dateRange: DateRange;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const columns = useMemo(() => buildColumns(locale), [locale]);

  const [sorting, setSorting] = useState<SortingState>([{ id: "created_at", desc: true }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZES[1],
  });
  const [selectedEvent, setSelectedEvent] = useState<EventLogRow | null>(null);

  const statusFilter =
    (columnFilters.find((f) => f.id === "status")?.value as EventStatus | undefined) ?? "all";

  function setStatusFilter(value: string) {
    setColumnFilters((prev) => {
      const rest = prev.filter((f) => f.id !== "status");
      return value === "all" ? rest : [...rest, { id: "status", value }];
    });
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  }

  function setDateRange(next: DateRange) {
    const params = new URLSearchParams();
    if (next.from) params.set("from", next.from);
    if (next.to) params.set("to", next.to);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  }

  const table = useTable({
    features,
    columns,
    data: events,
    state: { sorting, columnFilters, globalFilter, pagination },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    globalFilterFn: "includesString",
    columnResizeMode: "onChange",
    enableColumnResizing: true,
    defaultColumn: { size: 150, minSize: 60 },
  });

  const rows = table.getRowModel().rows;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-row gap-4 items-center"><ScrollText className="size-6"/><p className="text-xl">Event logs</p></div>
      <div className="flex flex-row flex-wrap items-center gap-2">
        <Input
          placeholder="Filter by server, tool, session, error..."
          value={globalFilter}
          onChange={(e) => {
            setGlobalFilter(e.target.value);
            setPagination((p) => ({ ...p, pageIndex: 0 }));
          }}
          className="max-w-sm"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger size="sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="error">Error</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1.5">
          <CalendarClock className="size-4 text-muted-foreground" />
          <Input
            type="date"
            aria-label="From date"
            value={dateRange.from ?? ""}
            onChange={(e) => setDateRange({ ...dateRange, from: e.target.value || undefined })}
            className="w-auto"
          />
          <span className="text-sm text-muted-foreground">–</span>
          <Input
            type="date"
            aria-label="To date"
            value={dateRange.to ?? ""}
            onChange={(e) => setDateRange({ ...dateRange, to: e.target.value || undefined })}
            className="w-auto"
          />
        </div>
        <span className="ml-auto text-sm text-muted-foreground">
          {rows.length} event{rows.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table style={{ width: table.getTotalSize(), tableLayout: "fixed" }}>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="bg-sky-500/20 hover:bg-sky-500/20">
                {headerGroup.headers.map((header) => {
                  const sortDirection = header.column.getIsSorted();
                  const SortIcon =
                    sortDirection === "asc" ? ArrowUp : sortDirection === "desc" ? ArrowDown : ArrowUpDown;
                  const HeaderIcon = header.column.columnDef.meta?.icon;

                  return (
                    <TableHead
                      key={header.id}
                      style={{ width: header.getSize() }}
                      className="relative select-none"
                    >
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className="flex items-center gap-1 hover:text-foreground"
                      >
                        {HeaderIcon && <HeaderIcon className="size-3.5" />}
                        {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                        <SortIcon className="size-3.5 text-muted-foreground" />
                      </button>
                      {header.column.getCanResize() && (
                        <div
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          className="group absolute top-0 right-0 z-10 h-full w-4 translate-x-1/2 cursor-col-resize touch-none select-none"
                        >
                          <div
                            className={cn(
                              "mx-auto h-full w-px bg-border transition-[width,background-color] group-hover:w-1 group-hover:bg-primary",
                              header.column.getIsResizing() && "w-1 bg-primary",
                            )}
                          />
                        </div>
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center text-muted-foreground">
                  No events match this filter.
                </TableCell>
              </TableRow>
            )}
            {rows.map((row) => (
              <TableRow
                key={row.id}
                className="cursor-pointer"
                onClick={() => setSelectedEvent(row.original)}
              >
                {row.getAllCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    style={{ width: cell.column.getSize() }}
                    className="overflow-hidden text-ellipsis text-muted-foreground"
                  >
                    <table.FlexRender cell={cell} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          Rows per page
          <Select
            value={String(pagination.pageSize)}
            onValueChange={(value) => setPagination({ pageIndex: 0, pageSize: Number(value) })}
          >
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Page {pagination.pageIndex + 1} of {Math.max(1, table.getPageCount())}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            disabled={!table.getCanNextPage()}
            onClick={() => table.nextPage()}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>

      <Sheet
        open={selectedEvent !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedEvent(null);
        }}
      >
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Event #{selectedEvent?.id}</SheetTitle>
          </SheetHeader>
          {selectedEvent && (
            <div className="flex flex-col gap-4 overflow-y-auto px-4 pb-4">
              <DetailField label="Time" icon={CalendarClock}>
                {formatTimestamp(selectedEvent.created_at, locale)}
              </DetailField>
              <DetailField label="Server" icon={Server}>
                {selectedEvent.server_name}
              </DetailField>
              <DetailField label="Tool" icon={Wrench}>
                <span className="font-mono">{selectedEvent.tool_slug ?? "—"}</span>
              </DetailField>
              <DetailField label="Status" icon={CircleCheck}>
                <Badge variant={selectedEvent.status === "error" ? "destructive" : "outline"}>
                  {selectedEvent.status}
                </Badge>
              </DetailField>
              <DetailField label="Duration" icon={Timer}>
                {selectedEvent.duration_ms !== null ? `${selectedEvent.duration_ms} ms` : "—"}
              </DetailField>
              <DetailField label="Session" icon={Fingerprint}>
                <span className="font-mono">{selectedEvent.session_id || "—"}</span>
              </DetailField>
              <DetailField label="Error" icon={AlertTriangle}>
                <p className="wrap-break-word whitespace-pre-wrap">
                  {selectedEvent.error_message || "—"}
                </p>
              </DetailField>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
