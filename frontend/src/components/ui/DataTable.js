// Data Table Component - MUI-based trading table with sorting, filtering, pagination
import { useState, useMemo, useEffect } from 'react';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TableSortLabel from '@mui/material/TableSortLabel';
import TablePagination from '@mui/material/TablePagination';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';
import { Search, Filter, Download } from 'lucide-react';
import { formatINR, formatPercent } from '../../lib/utils';
import { Input, Button, Badge, Spinner } from './index';

export const DataTable = ({
  data = [],
  columns = [],
  loading = false,
  searchable = true,
  sortable = true,
  pagination = true,
  pageSize = 10,
  onRowClick,
  emptyMessage = 'No data available',
  className,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [page, setPage] = useState(0);

  useEffect(() => { setPage(0); }, [data, searchQuery]);

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
    return sortedData.slice(page * pageSize, page * pageSize + pageSize);
  }, [sortedData, page, pageSize, pagination]);

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
    if (column.type === 'currency') return formatINR(value, { compact: column.compact });
    if (column.type === 'percent') {
      const color = value > 0 ? 'success.main' : value < 0 ? 'error.main' : 'text.secondary';
      return <Typography component="span" sx={{ color }}>{formatPercent(value)}</Typography>;
    }
    if (column.type === 'change') {
      return <Typography component="span" sx={{ color: value >= 0 ? 'success.main' : 'error.main' }}>{value >= 0 ? '+' : ''}{value?.toFixed(2)}</Typography>;
    }
    if (column.type === 'badge') {
      return <Badge variant={column.getVariant?.(value) || 'default'}>{value}</Badge>;
    }
    return value;
  };

  return (
    <Paper className={className} sx={{ overflow: 'hidden' }}>
      {searchable && (
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Box sx={{ flex: 1, maxWidth: 320 }}>
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search style={{ width: 16, height: 16 }} />
                  </InputAdornment>
                ),
              }}
            />
          </Box>
          <Button variant="outline" size="sm">
            <Filter style={{ width: 16, height: 16, marginRight: 8 }} /> Filter
          </Button>
          <Button variant="outline" size="sm">
            <Download style={{ width: 16, height: 16, marginRight: 8 }} /> Export
          </Button>
        </Box>
      )}

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableCell
                  key={column.key}
                  align={column.align || 'left'}
                  style={{ width: column.width }}
                  sortDirection={sortConfig.key === column.key ? sortConfig.direction : false}
                >
                  {sortable && column.sortable !== false ? (
                    <TableSortLabel
                      active={sortConfig.key === column.key}
                      direction={sortConfig.key === column.key ? sortConfig.direction : 'asc'}
                      onClick={() => handleSort(column.key)}
                    >
                      {column.label}
                    </TableSortLabel>
                  ) : (
                    column.label
                  )}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length} align="center" sx={{ py: 6 }}>
                  <Spinner />
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Loading data...</Typography>
                </TableCell>
              </TableRow>
            ) : paginatedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} align="center" sx={{ py: 6 }}>
                  <Typography variant="body2" color="text.secondary">{emptyMessage}</Typography>
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((row, index) => (
                <TableRow
                  key={row.id || index}
                  hover
                  onClick={() => onRowClick?.(row)}
                  sx={{ cursor: onRowClick ? 'pointer' : 'default' }}
                >
                  {columns.map((column) => (
                    <TableCell key={column.key} align={column.align || 'left'}>
                      {renderCell(row, column)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {pagination && sortedData.length > pageSize && (
        <TablePagination
          component="div"
          count={sortedData.length}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={pageSize}
          rowsPerPageOptions={[pageSize]}
          sx={{ borderTop: 1, borderColor: 'divider' }}
        />
      )}
    </Paper>
  );
};

export default DataTable;
