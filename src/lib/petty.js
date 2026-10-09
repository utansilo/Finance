import {
  Document, Packer, Paragraph, Table, TableCell, TableRow,
  TextRun, ImageRun, HeadingLevel, AlignmentType, WidthType,
} from 'docx';
import { rupiah, namaBulan } from './finance.js';

// Kompres foto bukti jadi JPEG kecil supaya aman disimpan di
// localStorage + Firestore (1 dokumen max ~1MB).
// maxDim 1024px, quality 0.7 -> biasanya 60-150KB per foto.
export function compressImageFile(file, maxDim = 1024, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        let { width, height } = img;
        const scale = Math.min(1, maxDim / Math.max(width, height));
        width = Math.round(width * scale);
        height = Math.round(height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch (e) { reject(e); }
    };
    img.onerror = reject;
    img.src = url;
  });
}

export function dataURLtoUint8Array(dataUrl) {
  const base64 = dataUrl.split(',')[1];
  const bin = atob(base64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

// p = { id, tanggal, keterangan, jumlah, tipe: 'expense'|'advance', akunId, tanpaNota, photos: [] }
export function rekapPetty(list) {
  const expense = list.filter((p) => (p.tipe || 'expense') === 'expense')
    .reduce((s, p) => s + Number(p.jumlah), 0);
  const advance = list.filter((p) => p.tipe === 'advance')
    .reduce((s, p) => s + Number(p.jumlah), 0);
  return { expense, advance, sisa: advance - expense, count: list.length };
}

export function groupByTanggal(list) {
  const m = {};
  [...list].sort((a, b) => (a.tanggal || '').localeCompare(b.tanggal || ''))
    .forEach((p) => { (m[p.tanggal] = m[p.tanggal] || []).push(p); });
  return Object.entries(m).sort(([a], [b]) => a.localeCompare(b));
}

function cell(text, opts = {}) {
  return new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text: String(text), size: 20, ...opts })] })],
  });
}

export async function exportPettyDocx({ items, akunNama, periodeLabel, saldoAkun = 0 }) {
  const { expense, advance, sisa } = rekapPetty(items);
  const groups = groupByTanggal(items);
  const sorted = [...items].sort((a, b) => (a.tanggal || '').localeCompare(b.tanggal || ''));

  const headerRow = new TableRow({
    tableHeader: true,
    children: ['No', 'Tanggal', 'Keterangan', 'Bukti', 'Pengeluaran (Rp)', 'Cash Advance (Rp)'].map(
      (h) => cell(h, { bold: true })
    ),
  });
  const bodyRows = sorted.map((p, i) => new TableRow({
    children: [
      cell(i + 1),
      cell(p.tanggal || '-'),
      cell(`${p.keterangan || '-'}${p.tanpaNota && p.tipe !== 'advance' ? ' (tanpa nota / amplop)' : ''}`),
      cell(p.tipe === 'advance' ? '—' : ((p.photos?.length || 0) > 0 ? `${p.photos.length} foto (lihat lampiran)` : (p.tanpaNota ? 'Tanpa nota' : '-'))),
      cell(p.tipe === 'advance' ? '-' : Number(p.jumlah).toLocaleString('id-ID')),
      cell(p.tipe === 'advance' ? Number(p.jumlah).toLocaleString('id-ID') : '-'),
    ],
  }));
  const totalRow = new TableRow({
    children: [
      cell('', {}), cell('', {}), cell('TOTAL', { bold: true }), cell('', {}),
      cell(expense.toLocaleString('id-ID'), { bold: true }),
      cell(advance.toLocaleString('id-ID'), { bold: true }),
    ],
  });

  const children = [
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: 'Rekap Penggunaan Petty Cash', bold: true })] }),
    new Paragraph({ children: [new TextRun({ text: `Akun: ${akunNama}   •   Periode: ${periodeLabel}   •   Dicetak: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, size: 20, color: '64748B' })] }),
    new Paragraph({ text: '' }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [headerRow, ...bodyRows, totalRow],
    }),
    new Paragraph({ text: '' }),
    new Paragraph({ children: [new TextRun({ text: `Total Pengeluaran: ${rupiah(expense)}`, bold: true, size: 22 })] }),
    new Paragraph({ children: [new TextRun({ text: `Cash Advance: ${rupiah(advance)}`, bold: true, size: 22 })] }),
    new Paragraph({ children: [new TextRun({ text: `Sisa (Advance − Pengeluaran): ${rupiah(sisa)}`, bold: true, size: 22 })] }),
    new Paragraph({ children: [new TextRun({ text: `Saldo akun ${akunNama} saat ini: ${rupiah(saldoAkun)}`, size: 20, color: '64748B' })] }),
    new Paragraph({ text: '' }),
    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: 'Lampiran Bukti', bold: true })] }),
    new Paragraph({ children: [new TextRun({ text: 'Foto dikelompokkan per tanggal. Entri bertanda "(tanpa nota / amplop)" memang tidak memiliki struk (misal amplop ke orang).', size: 20, italics: true, color: '64748B' })] }),
  ];

  for (const [tgl, arr] of groups) {
    children.push(new Paragraph({ text: '' }));
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_3,
      children: [new TextRun({ text: `Tanggal ${tgl} — ${arr.length} transaksi`, bold: true })],
    }));
    for (const p of arr) {
      const label = p.tipe === 'advance'
        ? `• Cash advance ${rupiah(p.jumlah)} — ${p.keterangan || 'top-up kas'}`
        : `• ${rupiah(p.jumlah)} — ${p.keterangan || '-'}${p.tanpaNota ? ' (tanpa nota / amplop)' : ''}`;
      children.push(new Paragraph({ children: [new TextRun({ text: label, size: 20 })] }));
      for (const ph of (p.photos || [])) {
        try {
          const data = dataURLtoUint8Array(ph);
          children.push(new Paragraph({
            alignment: AlignmentType.LEFT,
            children: [new ImageRun({ data, transformation: { width: 400, height: 300 } })],
          }));
          children.push(new Paragraph({ children: [new TextRun({ text: `${p.tanggal} — ${p.keterangan || ''}`, size: 18, color: '64748B' })] }));
        } catch { /* foto rusak -> lewati */ }
      }
      if (!(p.photos?.length) && p.tipe !== 'advance') {
        children.push(new Paragraph({ children: [new TextRun({ text: p.tanpaNota ? '(tidak ada foto — tanpa nota/amplop)' : '(tidak ada foto terlampir)', size: 18, italics: true, color: '64748B' })] }));
      }
    }
  }

  // Tanda tangan
  children.push(new Paragraph({ text: '' }));
  children.push(new Paragraph({ text: '' }));
  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({
      children: [cell('Dibuat oleh,\n\n\n( .................... )'), cell('Disetujui oleh,\n\n\n( .................... )'), cell('Penerima / Kasir,\n\n\n( .................... )')],
    })],
  }));

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `rekap-petty-cash-${periodeLabel.replace(/\s+/g, '-').toLowerCase()}.docx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

export function periodeLabelPetty(mode, bulan, dari, sampai) {
  if (mode === 'bulan') return namaBulan(bulan);
  if (dari && sampai) return `${dari} s/d ${sampai}`;
  return namaBulan(bulan);
}
