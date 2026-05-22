"use client";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { X } from "lucide-react";
import { Input } from "./input";
import { Button } from "./button";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  /** Primary column for single-column filter (legacy). */
  searchKey: string;
  /** When set, filter rows if any key matches (case-insensitive substring). */
  searchKeys?: string[];
  searchPlaceholder?: string;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchKey,
  searchKeys,
  searchPlaceholder,
}: DataTableProps<TData, TValue>) {
  const filterKeys = searchKeys ?? [searchKey];
  const useGlobalFilter = filterKeys.length > 1;

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: (row, _columnId, filterValue) => {
      const query = String(filterValue ?? "").trim().toLowerCase();
      if (!query) return true;
      const original = row.original as Record<string, unknown>;
      return filterKeys.some((key) => {
        const columnValue = row.getValue(key);
        const raw =
          columnValue !== undefined && columnValue !== null && columnValue !== ""
            ? columnValue
            : original[key];
        return String(raw ?? "")
          .toLowerCase()
          .includes(query);
      });
    },
    initialState: {
      pagination: {
        pageIndex: 0,
        pageSize: 10,
      },
    },
  });

  /* this can be used to get the selectedrows 
  console.log("value", table.getFilteredSelectedRowModel()); */

  const searchValue = useGlobalFilter
    ? ((table.getState().globalFilter as string) ?? "")
    : ((table.getColumn(searchKey)?.getFilterValue() as string) ?? "");

  const setSearchValue = (value: string) => {
    if (useGlobalFilter) {
      table.setGlobalFilter(value);
    } else {
      table.getColumn(searchKey)?.setFilterValue(value);
    }
  };

  return (
    <>
      <div className="flex items-center py-4">
        <div className="relative w-full md:max-w-sm">
          <Input
            placeholder={
              searchPlaceholder ??
              (useGlobalFilter
                ? `Search ${filterKeys.join(" or ")}...`
                : `Search ${searchKey}...`)
            }
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            className="w-full pr-9"
          />
          {searchValue ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0.5 top-1/2 h-8 w-8 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
              onClick={() => setSearchValue("")}
            >
              <X className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end space-x-2 py-4">
        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </>
  );
}
