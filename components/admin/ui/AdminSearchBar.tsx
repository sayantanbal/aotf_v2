"use client";

/**
 * components/admin/ui/AdminSearchBar.tsx
 *
 * Reusable search + filter bar for all admin list pages.
 * Pass `filters` to declaratively define which dropdowns to show.
 * All state lives in the parent — this is a pure controlled component.
 */

import React, { useRef, useEffect } from "react";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import { Select, SelectItem } from "@heroui/select";
import { Chip } from "@heroui/chip";
import { Card, CardBody } from "@heroui/card";
import { Search, Filter, X, SlidersHorizontal } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FilterOption {
  key: string;
  label: string;
}

export interface FilterConfig {
  /** Unique key used in filterValues / onChange */
  key: string;
  label: string;
  options: FilterOption[];
  /** Placeholder shown when nothing selected */
  placeholder?: string;
}

export interface AdminSearchBarProps {
  /** Current search string */
  searchValue: string;
  onSearchChange: (value: string) => void;

  /** Declarative filter definitions */
  filters?: FilterConfig[];
  /** Map of filterKey → selected option key (empty string = none) */
  filterValues?: Record<string, string>;
  onFilterChange?: (key: string, value: string) => void;

  /** Total results count to display */
  resultCount?: number;
  resultLabel?: string;

  /** Placeholder text for the search input */
  placeholder?: string;

  /** Called when "Clear all" is pressed */
  onClearAll?: () => void;

  /** Extra action buttons to render to the right of the search input */
  actions?: React.ReactNode;

  className?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminSearchBar({
  searchValue,
  onSearchChange,
  filters = [],
  filterValues = {},
  onFilterChange,
  resultCount,
  resultLabel = "result",
  placeholder = "Search...",
  onClearAll,
  actions,
  className = "",
}: AdminSearchBarProps) {
  const [showFilters, setShowFilters] = React.useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Count active filters
  const activeFilterCount =
    Object.values(filterValues).filter(Boolean).length + (searchValue ? 1 : 0);

  const hasActiveFilters = activeFilterCount > 0;

  const handleClear = () => {
    onSearchChange("");
    onClearAll?.();
    inputRef.current?.focus();
  };

  // Build active filter chips for display
  const activeChips: { label: string; onRemove: () => void }[] = [];
  if (searchValue) {
    activeChips.push({
      label: `"${searchValue}"`,
      onRemove: () => onSearchChange(""),
    });
  }
  filters.forEach((f) => {
    const val = filterValues[f.key];
    if (val) {
      const option = f.options.find((o) => o.key === val);
      activeChips.push({
        label: `${f.label}: ${option?.label ?? val}`,
        onRemove: () => onFilterChange?.(f.key, ""),
      });
    }
  });

  return (
    <div className={`space-y-2 ${className}`}>
      {/* ── Main row ── */}
      <div className="flex gap-2 items-center">
        {/* Search input */}
        <Input
          ref={inputRef}
          placeholder={placeholder}
          value={searchValue}
          onValueChange={onSearchChange}
          startContent={
            <Search size={16} className="text-default-400 shrink-0" />
          }
          endContent={
            searchValue ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => onSearchChange("")}
                className="text-default-400 hover:text-default-600 transition-colors"
              >
                <X size={15} />
              </button>
            ) : undefined
          }
          classNames={{
            base: "flex-1",
            inputWrapper: "h-9",
          }}
          size="lg"
          variant="bordered"
        />

        {/* Filter toggle — only show when filters are configured */}
        {filters.length > 0 && (
          <Button
            isIconOnly
            size="lg"
            variant={showFilters ? "flat" : "bordered"}
            color={showFilters ? "primary" : "default"}
            startContent={<SlidersHorizontal size={15} />}
            onPress={() => setShowFilters((v) => !v)}
            className="relative shrink-0"
          >
            {Object.values(filterValues).filter(Boolean).length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-white text-[10px] flex items-center justify-center">
                {Object.values(filterValues).filter(Boolean).length}
              </span>
            )}
          </Button>
        )}

        {/* Extra actions (e.g. "New Post" button) */}
        {actions}
      </div>

      {/* ── Filter panel ── */}
      {showFilters && filters.length > 0 && (
        <Card shadow="sm" className="border border-divider">
          <CardBody className="py-3 px-4">
            <div
              className={`grid gap-3 ${
                filters.length === 1
                  ? "grid-cols-1"
                  : filters.length === 2
                    ? "grid-cols-2"
                    : filters.length === 3
                      ? "grid-cols-3"
                      : "grid-cols-2 md:grid-cols-4"
              }`}
            >
              {filters.map((f) => (
                <Select
                  key={f.key}
                  label={f.label}
                  placeholder={f.placeholder ?? `All ${f.label}s`}
                  size="sm"
                  variant="bordered"
                  selectedKeys={
                    filterValues[f.key] ? [filterValues[f.key]] : []
                  }
                  onChange={(e) => onFilterChange?.(f.key, e.target.value)}
                >
                  {f.options.map((opt) => (
                    <SelectItem key={opt.key}>{opt.label}</SelectItem>
                  ))}
                </Select>
              ))}
            </div>

            {hasActiveFilters && (
              <div className="flex justify-end mt-3">
                <Button
                  size="sm"
                  variant="light"
                  color="danger"
                  startContent={<X size={13} />}
                  onPress={handleClear}
                >
                  Clear all
                </Button>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* ── Active filter chips + result count ── */}
      {(activeChips.length > 0 || resultCount !== undefined) && (
        <div className="flex flex-wrap items-center gap-2 min-h-6">
          {/* Result count */}
          {resultCount !== undefined && (
            <span className="text-xs text-default-400 mr-1">
              {resultCount}{" "}
              {resultCount === 1 ? resultLabel : `${resultLabel}s`}
            </span>
          )}

          {/* Active chips */}
          {activeChips.map((chip) => (
            <Chip
              key={chip.label}
              size="sm"
              variant="flat"
              color="primary"
              onClose={chip.onRemove}
              classNames={{ base: "h-5 text-xs" }}
            >
              {chip.label}
            </Chip>
          ))}

          {/* Clear all chip — only when ≥2 active */}
          {activeChips.length >= 2 && (
            <button
              type="button"
              onClick={handleClear}
              className="text-xs text-danger hover:underline"
            >
              Clear all
            </button>
          )}
        </div>
      )}
    </div>
  );
}
