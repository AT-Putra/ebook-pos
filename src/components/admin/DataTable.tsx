'use client';

import { useMemo, useState, ReactNode } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from '@tanstack/react-table';

export type DataTableColumn<T> = {
  id: string;
  header: string;
  /** Raw value used for sorting and export (numbers/dates sort by value, not string). */
  accessor: (row: T) => string | number;
  /** Optional custom cell render. Falls back to the accessor value. */
  cell?: (row: T) => ReactNode;
  align?: 'left' | 'right';
  /** Optional override for export serialization. Defaults to accessor. */
  exportValue?: (row: T) => string | number;
};

type Props<T> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  searchable?: boolean;
  pageSize?: number;
  exportFileName?: string;
  exportTitle?: string;
  /** Rendered in <tfoot>, outside the sorted/paged body (e.g. a TOTAL row). */
  footerRow?: ReactNode;
  emptyMessage?: string;
};

const PAGE_SIZES = [10, 20, 50, 100];

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function DataTable<T>({
  columns,
  rows,
  searchable = true,
  pageSize = 20,
  exportFileName = 'export',
  exportTitle,
  footerRow,
  emptyMessage = 'Tidak ada data.',
}: Props<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  const tableColumns = useMemo(() => {
    const helper = createColumnHelper<T>();
    return columns.map(col =>
      helper.accessor((row: T) => col.accessor(row), {
        id: col.id,
        header: col.header,
        cell: info => (col.cell ? col.cell(info.row.original) : info.getValue() as ReactNode),
      })
    );
  }, [columns]);

  const table = useReactTable({
    data: rows,
    columns: tableColumns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });

  /** All filtered + sorted rows (every page), for export. */
  function currentRows(): T[] {
    return table.getSortedRowModel().rows.map(r => r.original);
  }

  function exportCSV() {
    const header = columns.map(c => c.header);
    const lines = currentRows().map(row =>
      columns
        .map(c => {
          const v = (c.exportValue ?? c.accessor)(row);
          const s = String(v).replace(/"/g, '""');
          return /[",\n]/.test(s) ? `"${s}"` : s;
        })
        .join(',')
    );
    const csv = [header.join(','), ...lines].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    triggerDownload(blob, `${exportFileName}.csv`);
  }

  async function exportPDF() {
    const { jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;
    const doc = new jsPDF({ orientation: 'landscape' });
    if (exportTitle) {
      doc.setFontSize(13);
      doc.text(exportTitle, 14, 14);
    }
    autoTable(doc, {
      startY: exportTitle ? 20 : 14,
      head: [columns.map(c => c.header)],
      body: currentRows().map(row =>
        columns.map(c => String((c.exportValue ?? c.accessor)(row)))
      ),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [37, 99, 235] },
    });
    doc.save(`${exportFileName}.pdf`);
  }

  const btn: React.CSSProperties = {
    padding: '5px 12px', fontSize: '0.8rem', border: '1px solid #cbd5e1',
    borderRadius: 4, background: '#fff', color: '#374151', cursor: 'pointer',
  };

  return (
    <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
      {/* Toolbar: search + export */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '10px 12px', flexWrap: 'wrap' }}>
        {searchable ? (
          <input
            value={globalFilter}
            onChange={e => setGlobalFilter(e.target.value)}
            placeholder="Cari…"
            style={{ border: '1px solid #cbd5e1', borderRadius: 4, padding: '5px 10px', fontSize: '0.8rem', minWidth: 200 }}
          />
        ) : <span />}
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={exportCSV} style={btn}>Export CSV</button>
          <button onClick={exportPDF} style={btn}>Export PDF</button>
        </div>
      </div>

      <div style={{ overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <thead>
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id} style={{ background: '#f8fafc' }}>
                {hg.headers.map(header => {
                  const col = columns.find(c => c.id === header.column.id);
                  const align = col?.align ?? 'right';
                  const sorted = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      onClick={header.column.getToggleSortingHandler()}
                      style={{
                        padding: '8px 12px', textAlign: align, color: '#374151', fontWeight: 600,
                        borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap', cursor: 'pointer',
                        userSelect: 'none',
                      }}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {sorted === 'asc' ? ' ▲' : sorted === 'desc' ? ' ▼' : ''}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr><td colSpan={columns.length} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>{emptyMessage}</td></tr>
            ) : (
              table.getRowModel().rows.map((row, i) => (
                <tr key={row.id} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                  {row.getVisibleCells().map(cell => {
                    const col = columns.find(c => c.id === cell.column.id);
                    return (
                      <td key={cell.id} style={{ padding: '7px 12px', textAlign: col?.align ?? 'right' }}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
          {footerRow && <tfoot>{footerRow}</tfoot>}
        </table>
      </div>

      {/* Pagination */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '10px 12px', flexWrap: 'wrap', borderTop: '1px solid #e2e8f0', fontSize: '0.8rem', color: '#64748b' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>Baris per halaman:</span>
          <select
            value={table.getState().pagination.pageSize}
            onChange={e => table.setPageSize(Number(e.target.value))}
            style={{ border: '1px solid #cbd5e1', borderRadius: 4, padding: '3px 6px', fontSize: '0.8rem' }}
          >
            {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} style={{ ...btn, opacity: table.getCanPreviousPage() ? 1 : 0.4 }}>‹ Prev</button>
          <span>
            Hal {table.getState().pagination.pageIndex + 1} / {Math.max(1, table.getPageCount())}
          </span>
          <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} style={{ ...btn, opacity: table.getCanNextPage() ? 1 : 0.4 }}>Next ›</button>
        </div>
      </div>
    </div>
  );
}
