import { BudgetCategory, RealisasiTransaction } from "./types";

// Curreny formatter helper
export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

// Raw number formatter without currency prefix (useful for inputs)
export const formatNumberRaw = (amount: number) => {
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

// Compact financial number helper (e.g. 550jt instead of 550.000.000)
export const formatCompactNumber = (amount: number) => {
  if (amount >= 1_000_000_000) {
    const val = amount / 1_000_000_000;
    return (val % 1 === 0 ? val.toFixed(0) : val.toFixed(1).replace(".", ",")) + " M";
  }
  if (amount >= 1_000_000) {
    const val = amount / 1_000_000;
    return (val % 1 === 0 ? val.toFixed(0) : val.toFixed(1).replace(".", ",")) + "jt";
  }
  if (amount >= 1_000) {
    const val = amount / 1_000;
    return (val % 1 === 0 ? val.toFixed(0) : val.toFixed(1).replace(".", ",")) + "rb";
  }
  return amount.toString();
};

// Calculate total plans across all categories
export const calculateTotalRencana = (categories: BudgetCategory[]): number => {
  return categories.reduce((total, cat) => {
    return total + cat.items.reduce((sum, item) => sum + item.rencana, 0);
  }, 0);
};

// Calculate total spent for a specific item from transaction list
export const calculateItemRealisasi = (itemId: string, transactions: RealisasiTransaction[]): number => {
  return transactions
    .filter((tx) => tx.itemId === itemId)
    .reduce((sum, tx) => sum + tx.amount, 0);
};

// Calculate total spent in a specific month for a specific item
export const calculateItemMonthlySpent = (
  itemId: string,
  month: number,
  transactions: RealisasiTransaction[]
): number => {
  return transactions
    .filter((tx) => tx.itemId === itemId && tx.month === month)
    .reduce((sum, tx) => sum + tx.amount, 0);
};

// Calculate total realisasi across all transactions
export const calculateTotalRealisasi = (transactions: RealisasiTransaction[]): number => {
  return transactions.reduce((sum, tx) => sum + tx.amount, 0);
};

// Calculate realisasi for a whole category
export const calculateCategoryRealisasi = (
  categoryId: string,
  transactions: RealisasiTransaction[]
): number => {
  return transactions
    .filter((tx) => tx.categoryId === categoryId)
    .reduce((sum, tx) => sum + tx.amount, 0);
};

// Calculate rencana for a whole category
export const calculateCategoryRencana = (category: BudgetCategory): number => {
  return category.items.reduce((sum, item) => sum + item.rencana, 0);
};

// Get name of standard Indonesian month
export const getMonthName = (monthNum: number): string => {
  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];
  return months[monthNum - 1] || "";
};

// Short Indonesian month
export const getShortMonthName = (monthNum: number): string => {
  const months = [
    "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
    "Jul", "Agu", "Sep", "Okt", "Nov", "Des"
  ];
  return months[monthNum - 1] || "";
};
