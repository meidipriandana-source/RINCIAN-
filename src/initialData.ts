import { BudgetCategory, RealisasiTransaction } from "./types";

export const INITIAL_CATEGORIES: BudgetCategory[] = [
  {
    id: "makan-minum",
    kode: "5.1.02.01.001.00052",
    nama: "Belanja Makanan dan Minuman Rapat",
    items: [
      {
        id: "mami-1",
        nama: "Makanan dan Minuman Rapat Spesifikasi : Nasi Kotak Biasa",
        rencana: 124920000,
        monthlySpent: { 1: 0, 2: 0, 3: 45000000, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0 }
      },
      {
        id: "mami-2",
        nama: "Makanan dan Minuman Rapat Spesifikasi : Nasi Kotak Biasa (Akreditasi)",
        rencana: 157380000,
        monthlySpent: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0 }
      },
      {
        id: "mami-3",
        nama: "Prasmanan VIP Spesifikasi : Per Porsi (Akreditasi)",
        rencana: 21250000,
        monthlySpent: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0 }
      }
    ]
  },
  {
    id: "honorarium",
    kode: "5.1.02.02.001.00011",
    nama: "Honorarium",
    items: [
      {
        id: "hon-1",
        nama: "Honorarium Penyelenggaraan Kegiatan Pendidikan dan Pelatihan Spesifikasi : Honorarium Pengajar Luar Satuan Kerja Perangkat Daerah Penyelenggara",
        rencana: 229200000,
        monthlySpent: { 1: 0, 2: 0, 3: 30000000, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0 }
      },
      {
        id: "hon-2",
        nama: "Belanja Jasa Iklan/Reklame, Film, dan Pemotretan Spesifikasi : Media Cetak, Surat Kabar Harian",
        rencana: 15000000,
        monthlySpent: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0 }
      }
    ]
  },
  {
    id: "kontribusi",
    kode: "5.1.02.02.012.00001",
    nama: "Belanja Kursus Singkat/Pelatihan - Kontribusi",
    items: [
      {
        id: "kon-1",
        nama: "Kontribusi Tenaga Medis/Keperawatan/Penunjang/Manajemen (50 Orang)",
        rencana: 500000000,
        monthlySpent: { 1: 0, 2: 0, 3: 50000000, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0 }
      },
      {
        id: "kon-2",
        nama: "Kontribusi Tenaga Medis/Keperawatan/Penunjang/Manajemen (5 Orang)",
        rencana: 50000000,
        monthlySpent: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0 }
      },
      {
        id: "kon-3",
        nama: "Kontribusi Surveyor/Pendampingan Akreditasi (Spesifikasi: 1 Kegiatan @ Rp20.000.000)",
        rencana: 20000000,
        monthlySpent: { 1: 0, 2: 0, 3: 20000000, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0 }
      },
      {
        id: "kon-4",
        nama: "Kontribusi Surveyor/Pendampingan Akreditasi (Spesifikasi: 1 Kegiatan @ Rp40.000.000)",
        rencana: 40000000,
        monthlySpent: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0 }
      },
      {
        id: "kon-5",
        nama: "Kontribusi Surveyor/Pendampingan Akreditasi (Spesifikasi: 1 Kegiatan @ Rp30.000.000)",
        rencana: 30000000,
        monthlySpent: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0 }
      }
    ]
  },
  {
    id: "perjadin",
    kode: "5.1.02.04.001.00001",
    nama: "Belanja Perjalanan Dinas Biasa",
    items: [
      {
        id: "per-1",
        nama: "Biaya Perjalanan Dinas Dalam Negeri Spesifikasi : Paket 10 (Tenaga Medis/Penunjang 6 Orang)",
        rencana: 60000000,
        monthlySpent: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0 }
      },
      {
        id: "per-2",
        nama: "Biaya Perjalanan Dinas Dalam Negeri Spesifikasi : Paket 10 (Tenaga Medis/Penunjang 76 Orang)",
        rencana: 760000000,
        monthlySpent: { 1: 0, 2: 0, 3: 86994324, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0 }
      },
      {
        id: "per-3",
        nama: "Biaya Perjalanan Dinas Dalam Negeri Spesifikasi : Paket 10 (Surveyor 5 Paket)",
        rencana: 50000000,
        monthlySpent: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0 }
      }
    ]
  },
  {
    id: "barang-habis",
    kode: "5.1.02.01.001.00026",
    nama: "Belanja Barang Pakai Habis",
    items: [
      {
        id: "hab-1",
        nama: "Belanja Alat/Bahan untuk Kegiatan Kantor- Bahan Cetak Spesifikasi : Sertifikat Peserta Pelatihan Asessor",
        rencana: 30000000,
        monthlySpent: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0 }
      },
      {
        id: "hab-2",
        nama: "Pengadaan Dokumen/Fotokopi Spesifikasi : Kertas Hps/Hpl, Ukuran F4/A4",
        rencana: 24768,
        monthlySpent: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0 }
      },
      {
        id: "hab-3",
        nama: "Plakat Spesifikasi : Bahan Kayu + Logam Kuningan dengan Logo Kalimantan Utara",
        rencana: 6200000,
        monthlySpent: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0 }
      }
    ]
  }
];

export const INITIAL_TRANSACTIONS: RealisasiTransaction[] = [
  {
    id: "tx-mami-1",
    itemId: "mami-1",
    categoryId: "makan-minum",
    amount: 45000000,
    date: "2026-03-12",
    month: 3,
    description: "Pembayaran makanan dan minuman rapat akreditasi RSUD dr. H. Jusuf SK"
  },
  {
    id: "tx-hon-1",
    itemId: "hon-1",
    categoryId: "honorarium",
    amount: 30000000,
    date: "2026-03-20",
    month: 3,
    description: "Honorarium pengajar eksternal pelatihan pelayanan prima medis"
  },
  {
    id: "tx-kon-1",
    itemId: "kon-1",
    categoryId: "kontribusi",
    amount: 50000000,
    date: "2026-03-05",
    month: 3,
    description: "Kontribusi pelatihan sertifikasi penanganan darurat bagi 10 dokter spesialis"
  },
  {
    id: "tx-kon-2",
    itemId: "kon-3",
    categoryId: "kontribusi",
    amount: 20000000,
    date: "2026-03-25",
    month: 3,
    description: "Biaya pendampingan persiapan akreditasi RS Gelombang I"
  },
  {
    id: "tx-per-1",
    itemId: "per-2",
    categoryId: "perjadin",
    amount: 86994324,
    date: "2026-03-18",
    month: 3,
    description: "Perjalanan dinas tiket pesawat & akomodasi koordinasi medis & penunjang di Jakarta"
  }
];
