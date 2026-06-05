export interface BudgetItem {
  id: string;
  nama: string;
  rencana: number;
  monthlySpent: { [key: number]: number }; // Keys 1 (Jan) to 12 (Des)
}

export interface BudgetCategory {
  id: string; // e.g., 'makan-minum', 'honorarium', 'kontribusi', 'perjadin', 'barang-habis'
  kode: string; // e.g., '5.1.02.01.001.00052'
  nama: string; // e.g., 'Belanja Makanan dan Minuman Rapat'
  items: BudgetItem[];
}

export interface RealisasiTransaction {
  id: string;
  itemId: string;
  categoryId: string;
  amount: number;
  date: string;
  month: number; // 1-12
  description: string;
  pdfUrl?: string;
  pdfName?: string;
}
