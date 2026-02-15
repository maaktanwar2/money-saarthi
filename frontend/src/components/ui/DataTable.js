// Data Table v3.0 — Compact, horizontally-scrollable trading table
import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronUp, ChevronDown, Search, Filter, 
  ChevronLeft, ChevronRight, Download 
} from 'lucide-react';
import { cn, formatINR, formatPercent, getChangeColor } from '../../lib/utils';
import { Input, Button, Badge, Spinner } from './index';

export const DataTable = ({
  data = [],
  columns = [],
  loading = false,
  searchable = true,
  sortable = true,
  pagination = true,
  pageSize = 15,
  compact = false,
  stickyFirst = false,
  onRowClick,
  emptyMessage = 'No data available',
  className,
  actions,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => { setCurrentPage(1); }, [data, searchQuery]);

  const filteredData = useMemo(() => {
    if (!searchQuery) return data;
    return data.filter((row) =>
      columns.some((col) => {
        const value = row[col.key];
        if (value === null || value === undefined) return false;
        return String(value).toLowerCase().includes(searchQuery.toLowerCase());
      })
    );
  }, [data, searchQuery, columns]);

  const sortedData = useMemo(() => {
    if (!sortConfig.key) return filteredData;
    return [...filteredData].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return sortConfig.direction === 'asc'
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  }, [filteredData, sortConfig]);

  const paginatedData = useMemo(() => {
    if (!pagination) return sortedData;
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize, pagination]);

  const totalPages = Math.ceil(sortedData.length / pageSize);

  const handleSort = (key) => {
    if (!sortable) return;
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const renderCell = (row, column) => {
    const value = row[column.key];
    if (column.render) return column.render(value, row);
    if (column.type === 'currency') return <span className="tabular-nums">{formatINR(value, { compact: column.compact })}</span>;
    if (column.type === 'percent') return <span className={cn('tabular-nums', getChangeColor(value))}>{formatPercent(value)}</span>;
    if (column.type === 'change') return <span className={cn('tabular-nums', getChangeColor(value))}>{value >= 0 ? '+' : ''}{value?.toFixed(2)}</span>;
    if (column.type === 'badge') return <Badge variant={column.getVariant?.(value) || 'default'} size="sm">{value}</Badge>;
    return value;
  };

  const cellPad = compact ? 'px-3 py-2' : 'px-4 py-2.5';
  const textSize = compact ? 'text-xs' : 'text-sm';

  return (
    <div className={cn('rounded-xl overflow-hidden', className)}>
      {/* Toolbar */}
      {searchable && (
        <div className="px-3 py-2.5 border-b border-border flex items-center gap-2">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground-faint" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
          <div className="flex items-center gap-1.5">
            {actions}
            <Button variant="ghost" size="xs">
              <Filter className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="xs">
              <Download className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Scrollable Table */}
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr className="bg-surface-1/50">
              {columns.map((column, ci) => (
                <th
                  key={column.key}
                  onClick={() => column.sortable !== false && handleSort(column.key)}
                  className={cn(
                    cellPad, 'text-left text-2xs font-semibold text-foreground-muted uppercase tracking-wider whitespace-nowrap',
                    sortable && column.sortable !== false && 'cursor-pointer hover:text-foreground transition-colors select-none',
                    column.align === 'right' && 'text-right',
                    column.align === 'center' && 'text-center',
                    stickyFirst && ci === 0 && 'sticky left-0 z-10 bg-surface-1'
                  )}
                  style={{ width: column.width }}
                >
                  <div className={cn(
                    'flex items-center gap-0.5',
                    column.align === 'right' && 'justify-end',
                    column.align === 'center' && 'justify-center'
                  )}>
                    {column.label}
                    {sortable && sortConfig.key === column.key && (
                      sortConfig.direction === 'asc' 
                        ? <ChevronUp className="w-3 h-3" />
                        : <ChevronDown className="w-3 h-3" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            <AnimatePresence mode="popLayout">
              {loading ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-8 text-center">
                    <Spinner size="sm" className="mx-auto" />
                    <p className="text-xs text-foreground-muted mt-2">Loading...</p>
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-8 text-center text-foreground-muted text-xs">
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                paginatedData.map((row, index) => (
                  <motion.tr
                    key={row.id || index}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.1, delay: index * 0.015 }}
                    onClick={() => onRowClick?.(row)}
                    className={cn(
                      'interactive-row',
                      onRowClick && 'cursor-pointer'
                    )}
                  >
                    {columns.map((column, ci) => (
                      <td
                        key={column.key}
                        className={cn(
                          cellPad, textSize, 'whitespace-nowrap',
                          column.align === 'right' && 'text-right',
                          column.align === 'center' && 'text-center',
                          stickyFirst && ci === 0 && 'sticky left-0 z-10 bg-card font-medium'
                        )}
                      >
                        {renderCell(row, column)}
                      </td>
                    ))}
                  </motion.tr>
                ))
              )}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      {/* Compact Pagination */}
      {pagination && totalPages > 1 && (
        <div className="px-3 py-2 border-t border-border flex items-center justify-between">
          <p className="text-2xs text-foreground-muted tabular-nums">
            {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, sortedData.length)} of {sortedData.length}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) pageNum = i + 1;
              else if (currentPage <= 3) pageNum = i + 1;
              else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
              else pageNum = currentPage - 2 + i;
              return (
                <Button
                  key={pageNum}
                  variant={currentPage === pageNum ? 'default' : 'ghost'}
                  size="icon-xs"
                  onClick={() => setCurrentPage(pageNum)}
                  className="text-2xs w-6"
                >
                  {pageNum}
                </Button>
              );
            })}
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataTable;
