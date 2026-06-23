'use client';

import { useState, useEffect, useCallback, useMemo, FormEvent } from 'react';
import { DataTable, type DataTableColumn } from './DataTable';
import { PageHeader } from './Card';
import { toWibDateInput, type SaleStatus } from '@/lib/programs';

type Attachment = { id: string; fileName: string; sortOrder: number };

export type Program = {
  id: string;
  slug: string;
  name: string;
  programName: string | null;
  description: string | null;
  linkMessageTemplate: string | null;
  priceIdr: number;
  isActive: boolean;
  fileName: string;
  salesStartAt: string | null;
  salesEndAt: string | null;
  salesStatus: SaleStatus;
  orderCount: number;
  attachments: Attachment[];
};

const STATUS_BADGE: Record<SaleStatus, { label: string; bg: string; fg: string }> = {
  open: { label: 'Aktif', bg: '#dcfce7', fg: '#16a34a' },
  scheduled: { label: 'Terjadwal', bg: '#fef9c3', fg: '#ca8a04' },
  closed: { label: 'Ditutup', bg: '#fee2e2', fg: '#dc2626' },
  inactive: { label: 'Nonaktif', bg: '#f1f5f9', fg: '#94a3b8' },
};

function fmtIDR(n: number) {
  return 'Rp' + n.toLocaleString('id-ID');
}

function dateInput(iso: string | null): string {
  return iso ? toWibDateInput(new Date(iso)) : '';
}

function periodLabel(p: Program): string {
  const s = dateInput(p.salesStartAt);
  const e = dateInput(p.salesEndAt);
  if (!s && !e) return '—';
  return `${s || '…'} → ${e || '…'}`;
}

export function ProgramManager() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Program | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/programs');
      if (res.ok) setPrograms((await res.json()).programs);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() { setEditing(null); setModalOpen(true); }
  function openEdit(p: Program) { setEditing(p); setModalOpen(true); }
  function closeModal() { setModalOpen(false); setEditing(null); }

  async function afterSave() { closeModal(); await load(); }

  async function removeProgram(p: Program) {
    if (p.orderCount > 0) {
      alert('Program ini sudah punya order. Nonaktifkan saja agar riwayat tetap utuh.');
      return;
    }
    if (!confirm(`Hapus program "${p.name}"? Tindakan ini tidak bisa dibatalkan.`)) return;
    const res = await fetch(`/api/admin/programs/${p.id}`, { method: 'DELETE' });
    if (!res.ok) alert((await res.json()).error ?? 'Gagal menghapus.');
    await load();
  }

  const columns: DataTableColumn<Program>[] = useMemo(() => [
    { id: 'id', header: 'ID', align: 'left', accessor: p => p.id, cell: p => <code style={{ fontSize: '0.72rem', color: '#64748b' }}>{p.id.slice(0, 8)}</code> },
    { id: 'name', header: 'Nama Produk', align: 'left', accessor: p => p.name },
    { id: 'programName', header: 'Nama Program', align: 'left', accessor: p => p.programName ?? '', cell: p => p.programName ?? <span style={{ color: '#94a3b8' }}>—</span> },
    { id: 'period', header: 'Periode', align: 'left', accessor: p => p.salesEndAt ?? '', cell: p => <span style={{ fontSize: '0.78rem' }}>{periodLabel(p)}</span>, exportValue: p => periodLabel(p) },
    { id: 'price', header: 'Harga', accessor: p => p.priceIdr, cell: p => fmtIDR(p.priceIdr), exportValue: p => fmtIDR(p.priceIdr) },
    {
      id: 'status', header: 'Status', accessor: p => p.salesStatus,
      cell: p => {
        const b = STATUS_BADGE[p.salesStatus];
        return <span style={{ background: b.bg, color: b.fg, borderRadius: 999, padding: '2px 10px', fontSize: '0.72rem', fontWeight: 600 }}>{b.label}</span>;
      },
      exportValue: p => STATUS_BADGE[p.salesStatus].label,
    },
    {
      id: 'actions', header: 'Aksi', align: 'right', accessor: () => '',
      cell: p => (
        <span style={{ display: 'inline-flex', gap: 8 }}>
          <button onClick={() => openEdit(p)} style={{ border: 'none', background: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>Edit</button>
          <button onClick={() => removeProgram(p)} style={{ border: 'none', background: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '0.8rem' }}>Hapus</button>
        </span>
      ),
    },
  ], []);

  return (
    <div>
      <PageHeader
        title="Program"
        subtitle="Kelola produk/e-book, lampiran, dan periode penjualan."
        right={
          <button onClick={openCreate}
            style={{ padding: '8px 18px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 6px rgba(37,99,235,0.3)' }}>
            + Tambah Program
          </button>
        }
      />

      {loading ? (
        <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Memuat…</p>
      ) : (
        <DataTable
          columns={columns}
          rows={programs}
          pageSize={20}
          exportFileName="program"
          exportTitle="Daftar Program"
          emptyMessage="Belum ada program. Klik “Tambah Program”."
        />
      )}

      {modalOpen && (
        <ProgramFormModal
          key={editing?.id ?? 'new'}
          editing={editing}
          onClose={closeModal}
          onSaved={afterSave}
          onAttachmentsChanged={load}
        />
      )}
    </div>
  );
}

// ── Add/Edit modal ──────────────────────────────────────────────────────────

function ProgramFormModal({
  editing, onClose, onSaved, onAttachmentsChanged,
}: {
  editing: Program | null;
  onClose: () => void;
  onSaved: () => void;
  onAttachmentsChanged: () => void;
}) {
  const isEdit = editing !== null;
  const [name, setName] = useState(editing?.name ?? '');
  const [programName, setProgramName] = useState(editing?.programName ?? '');
  const [slug, setSlug] = useState(editing?.slug ?? '');
  const [priceIdr, setPriceIdr] = useState(String(editing?.priceIdr ?? ''));
  const [description, setDescription] = useState(editing?.description ?? '');
  const [linkMessageTemplate, setLinkMessageTemplate] = useState(editing?.linkMessageTemplate ?? '');
  const [salesStartAt, setSalesStartAt] = useState(dateInput(editing?.salesStartAt ?? null));
  const [salesEndAt, setSalesEndAt] = useState(dateInput(editing?.salesEndAt ?? null));
  const [isActive, setIsActive] = useState(editing?.isActive ?? true);
  const [ebookFile, setEbookFile] = useState<File | null>(null);
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<Attachment[]>(editing?.attachments ?? []);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function removeExistingAttachment(att: Attachment) {
    if (!editing) return;
    if (!confirm(`Hapus lampiran "${att.fileName}"?`)) return;
    const res = await fetch(`/api/admin/programs/${editing.id}/attachments/${att.id}`, { method: 'DELETE' });
    if (res.ok) {
      setExistingAttachments(prev => prev.filter(a => a.id !== att.id));
      onAttachmentsChanged();
    } else {
      alert((await res.json()).error ?? 'Gagal menghapus lampiran.');
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!isEdit && !ebookFile) { setError('File e-book (PDF) wajib diunggah.'); return; }

    const fd = new FormData();
    fd.set('name', name);
    fd.set('programName', programName);
    fd.set('slug', slug);
    fd.set('priceIdr', priceIdr);
    fd.set('description', description);
    fd.set('linkMessageTemplate', linkMessageTemplate);
    fd.set('salesStartAt', salesStartAt);
    fd.set('salesEndAt', salesEndAt);
    if (isEdit) fd.set('isActive', String(isActive));
    if (ebookFile) fd.set('file', ebookFile);
    for (const a of attachmentFiles) fd.append('attachments', a);

    setSubmitting(true);
    try {
      const res = await fetch(
        isEdit ? `/api/admin/programs/${editing!.id}` : '/api/admin/programs',
        { method: isEdit ? 'PATCH' : 'POST', body: fd },
      );
      if (res.ok) {
        onSaved();
      } else {
        const data = await res.json();
        setError(data.issues?.join(' ') ?? data.error ?? 'Gagal menyimpan.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  const label: React.CSSProperties = { fontSize: '0.72rem', color: '#64748b', display: 'block', marginBottom: 3, fontWeight: 600 };
  const input: React.CSSProperties = { width: '100%', border: '1px solid #cbd5e1', borderRadius: 6, padding: '7px 10px', fontSize: '0.875rem', boxSizing: 'border-box' };

  return (
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '5vh 16px', zIndex: 50, overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 560, padding: '1.4rem', boxShadow: '0 20px 50px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>{isEdit ? 'Edit Program' : 'Tambah Program'}</h2>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 220px' }}>
              <label style={label}>Nama Program</label>
              <input value={programName} onChange={e => setProgramName(e.target.value)} placeholder="Diet90" style={input} />
            </div>
            <div style={{ flex: '1 1 220px' }}>
              <label style={label}>Nama Produk (untuk pembeli) *</label>
              <input value={name} onChange={e => setName(e.target.value)} required style={input} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 220px' }}>
              <label style={label}>Slug (URL) *</label>
              <input value={slug} onChange={e => setSlug(e.target.value)} required placeholder="diet-90-hari" style={input} />
            </div>
            <div style={{ flex: '1 1 120px' }}>
              <label style={label}>Harga (IDR) *</label>
              <input value={priceIdr} onChange={e => setPriceIdr(e.target.value.replace(/[^0-9]/g, ''))} required inputMode="numeric" placeholder="75000" style={input} />
            </div>
          </div>

          <div>
            <label style={label}>Deskripsi (opsional)</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} style={{ ...input, resize: 'vertical' }} />
          </div>

          <div>
            <label style={label}>Pesan link e-book WhatsApp (opsional)</label>
            <textarea
              value={linkMessageTemplate}
              onChange={e => setLinkMessageTemplate(e.target.value)}
              rows={3}
              placeholder="Kosongkan untuk pakai teks default. Placeholder: {{name}}, {{product}}, {{link}}"
              style={{ ...input, resize: 'vertical' }}
            />
            <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: '4px 0 0' }}>
              Pesan WhatsApp yang membawa link download e-book. Wajib menyertakan <code>{'{{link}}'}</code>.
              Placeholder tersedia: <code>{'{{name}}'}</code>, <code>{'{{product}}'}</code>, <code>{'{{link}}'}</code>.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 160px' }}>
              <label style={label}>Mulai Penjualan</label>
              <input type="date" value={salesStartAt} onChange={e => setSalesStartAt(e.target.value)} style={input} />
            </div>
            <div style={{ flex: '1 1 160px' }}>
              <label style={label}>Selesai Penjualan</label>
              <input type="date" value={salesEndAt} onChange={e => setSalesEndAt(e.target.value)} style={input} />
            </div>
          </div>
          <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: 0 }}>
            Setelah tanggal selesai, produk tidak bisa dibeli lagi. Kosongkan untuk tanpa batas.
          </p>

          <div>
            <label style={label}>File E-book (PDF) {isEdit ? '— biarkan kosong untuk pakai yang lama' : '*'}</label>
            <input type="file" accept="application/pdf" onChange={e => setEbookFile(e.target.files?.[0] ?? null)} style={{ fontSize: '0.8rem' }} />
            {isEdit && <p style={{ fontSize: '0.72rem', color: '#64748b', margin: '4px 0 0' }}>Saat ini: {editing!.fileName}</p>}
          </div>

          <div>
            <label style={label}>Lampiran Tambahan (PDF)</label>
            {existingAttachments.length > 0 && (
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 6px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {existingAttachments.map(a => (
                  <li key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', borderRadius: 6, padding: '5px 10px', fontSize: '0.8rem' }}>
                    <span>📎 {a.fileName}</span>
                    <button type="button" onClick={() => removeExistingAttachment(a)} style={{ border: 'none', background: 'none', color: '#dc2626', cursor: 'pointer' }}>✕</button>
                  </li>
                ))}
              </ul>
            )}
            <input type="file" accept="application/pdf" multiple
              onChange={e => setAttachmentFiles(Array.from(e.target.files ?? []))}
              style={{ fontSize: '0.8rem' }} />
            {attachmentFiles.length > 0 && (
              <p style={{ fontSize: '0.72rem', color: '#16a34a', margin: '4px 0 0' }}>{attachmentFiles.length} file lampiran akan ditambahkan.</p>
            )}
          </div>

          {isEdit && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
              <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
              Aktif
            </label>
          )}

          {error && <p style={{ color: '#dc2626', fontSize: '0.8rem', margin: 0 }}>{error}</p>}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{ padding: '8px 16px', background: '#fff', color: '#374151', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: '0.875rem', cursor: 'pointer' }}>Batal</button>
            <button type="submit" disabled={submitting}
              style={{ padding: '8px 18px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', opacity: submitting ? 0.7 : 1 }}>
              {submitting ? 'Menyimpan…' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
