import { jsPDF } from "jspdf";
import React, { useState, useEffect, useMemo } from "react";
import { toPng, toJpeg } from "html-to-image";
import { motion, AnimatePresence } from "motion/react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import {
  LayoutDashboard,
  FileSpreadsheet,
  Plane,
  Utensils,
  Medal,
  Plus,
  Download,
  FileBadge,
  CircleAlert,
  TrendingUp,
  Wallet,
  Calendar,
  ChevronRight,
  Trash2,
  Edit2,
  Search,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  FileText,
  DollarSign,
  Briefcase,
  X,
  Cloud,
  CloudOff,
  Database,
  FolderOpen,
  RefreshCw,
  LogOut,
  Globe,
  ExternalLink,
  Camera
} from "lucide-react";
import { BudgetCategory, RealisasiTransaction, BudgetItem } from "./types";
import { INITIAL_CATEGORIES, INITIAL_TRANSACTIONS } from "./initialData";
import {
  formatCurrency,
  formatNumberRaw,
  calculateTotalRencana,
  calculateTotalRealisasi,
  calculateCategoryRealisasi,
  calculateCategoryRencana,
  calculateItemRealisasi,
  calculateItemMonthlySpent,
  getMonthName,
  getShortMonthName
} from "./utils";
import {
  initAuth,
  googleSignIn,
  logout,
  getCachedToken,
  uploadPdfToDrive,
  saveAllDataToGoogleSheets,
  loadAllDataFromGoogleSheets,
  FOLDER_ID,
  SPREADSHEET_ID
} from "./googleWorkspace";

const getCategoryColor = (id: string): string => {
  switch (id) {
    case "makan-minum": return "#f59e0b"; // Amber / Orange
    case "honorarium": return "#6366f1"; // Indigo / Blue-purple
    case "kontribusi": return "#06b6d4"; // Cyan
    case "perjadin": return "#8b5cf6"; // Purple / Violet
    case "barang-habis": return "#e11d48"; // Rose / Pink-red
    default: return "#10b981"; // Emerald / Green
  }
};

export default function App() {
  // --- PERSISTENCE STATES ---
  const [categories, setCategories] = useState<BudgetCategory[]>(() => {
    try {
      const saved = localStorage.getItem("apbd_2026_categories") || localStorage.getItem("blud_2026_categories");
      return saved ? JSON.parse(saved) : INITIAL_CATEGORIES;
    } catch (e) {
      console.error("Gagal memuat kategori dari local storage:", e);
      return INITIAL_CATEGORIES;
    }
  });

  const [transactions, setTransactions] = useState<RealisasiTransaction[]>(() => {
    try {
      const saved = localStorage.getItem("apbd_2026_transactions") || localStorage.getItem("blud_2026_transactions");
      return saved ? JSON.parse(saved) : INITIAL_TRANSACTIONS;
    } catch (e) {
      console.error("Gagal memuat transaksi dari local storage:", e);
      return INITIAL_TRANSACTIONS;
    }
  });

  const [highlightedTxId, setHighlightedTxId] = useState<string | null>(null);

  // --- GOOGLE WORKSPACE SYSTEM STATES ---
  const [isGoogleLinked, setIsGoogleLinked] = useState(() => {
    return localStorage.getItem("apbd_2026_google_linked") === "true";
  });
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [isGoogleSyncLoading, setIsGoogleSyncLoading] = useState(false);
  const [isSheetLoaded, setIsSheetLoaded] = useState(false);
  const [googleSyncError, setGoogleSyncError] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem("apbd_2026_categories", JSON.stringify(categories));
    } catch (e) {
      console.error("Gagal menyimpan kategori ke local storage:", e);
    }
  }, [categories]);

  // Sync state with verified offline/PDF baseline for key budgets (including Honorarium & Makan-Minum division)
  useEffect(() => {
    try {
      let corrected = false;
      const verifiedCategories = categories.map((cat) => {
        const baselineCat = INITIAL_CATEGORIES.find((bc) => bc.id === cat.id);
        if (!baselineCat) return cat;

        // Check if item structure matches (same IDs and count)
        const hasSameStructure = cat.items.length === baselineCat.items.length && 
          cat.items.every(it => baselineCat.items.some(bi => bi.id === it.id));

        if (!hasSameStructure) {
          // Replace items list entirely with baseline items to get the new structure
          corrected = true;
          return { ...cat, items: JSON.parse(JSON.stringify(baselineCat.items)) };
        }

        // Structure is same, check if individual names or plans need sync
        const verifiedItems = cat.items.map((it) => {
          const baselineIt = baselineCat.items.find((bi) => bi.id === it.id);
          if (!baselineIt) return it;
          let itemCorrected = false;
          const updatedItem = { ...it };

          if (it.rencana !== baselineIt.rencana) {
            updatedItem.rencana = baselineIt.rencana;
            itemCorrected = true;
          }
          if (it.nama !== baselineIt.nama) {
            updatedItem.nama = baselineIt.nama;
            itemCorrected = true;
          }

          if (itemCorrected) {
            corrected = true;
          }
          return updatedItem;
        });

        return { ...cat, items: verifiedItems };
      });

      if (corrected) {
        setCategories(verifiedCategories);
        showToast("Sinkronisasi Anggaran: Struktur mata rekening & pagu baseline berhasil disesuaikan dengan RKA resmi!", "info");
      }
    } catch (e) {
      console.error("Gagal melakukan sinkronisasi baseline:", e);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("apbd_2026_transactions", JSON.stringify(transactions));
    } catch (e) {
      console.error("Gagal menyimpan transaksi ke local storage:", e);
      showToast("Penyimpanan lokal penuh karena lampiran PDF cukup besar. Hubungkan ke Google Drive untuk penyimpanan cloud praktis!", "warn");
    }
  }, [transactions]);

  // --- THEME STATE ---
  const [themeSetting, setThemeSetting] = useState<"system" | "light" | "dark" | "navy" | "contrast">(() => {
    const saved = localStorage.getItem("apbd_2026_theme_setting");
    return (saved as "system" | "light" | "dark" | "navy" | "contrast") || "system";
  });

  const [systemTheme, setSystemTheme] = useState<"light" | "dark">(() => {
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return "dark";
  });

  useEffect(() => {
    localStorage.setItem("apbd_2026_theme_setting", themeSetting);
  }, [themeSetting]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? "dark" : "light");
    };
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const theme = useMemo(() => {
    if (themeSetting === "system") {
      return systemTheme;
    }
    return themeSetting;
  }, [themeSetting, systemTheme]);

  // --- NAVIGATION / SCREEN STATES ---
  const [activeTab, setActiveTab] = useState<string>("monitoring");
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<number | "all">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [warningFilter, setWarningFilter] = useState<string>("all"); // all, safe, warning, over
  const [hoveredProjIdx, setHoveredProjIdx] = useState<number | null>(null);

  // --- INTERACTION / FORM STATES ---
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [isPaguModalOpen, setIsPaguModalOpen] = useState(false);
  const [selectedItemForPagu, setSelectedItemForPagu] = useState<BudgetItem | null>(null);
  const [selectedCategoryForPagu, setSelectedCategoryForPagu] = useState<string>("");
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [txIdToDelete, setTxIdToDelete] = useState<string | null>(null);

  // Overrun warning systems state
  const [isOverrunModalOpen, setIsOverrunModalOpen] = useState(false);
  const [overrunDetails, setOverrunDetails] = useState<{
    itemName: string;
    pagu: number;
    currentSpent: number;
    proposedAmount: number;
    newTotal: number;
    type: "add" | "edit";
  } | null>(null);

  // Interactive Pie Chart states
  const [pieChartMetric, setPieChartMetric] = useState<"spent" | "rencana">("spent");
  const [pieActiveIndex, setPieActiveIndex] = useState<number | null>(null);

  // Snapshot Dashboard capture state
  const [isCapturing, setIsCapturing] = useState(false);

  // Add Transaction Form States
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formItemId, setFormItemId] = useState("");
  const [formAmount, setFormAmount] = useState<number | "">("");
  const [formDate, setFormDate] = useState("2026-06-05");
  const [formDescription, setFormDescription] = useState("");
  const [formWarning, setFormWarning] = useState<string | null>(null);
  const [formPdfUrl, setFormPdfUrl] = useState<string | undefined>("");
  const [formPdfName, setFormPdfName] = useState<string | undefined>("");

  // Edit Transaction Form States
  const [isEditTxModalOpen, setIsEditTxModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<RealisasiTransaction | null>(null);
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editItemId, setEditItemId] = useState("");
  const [editAmount, setEditAmount] = useState<number | "">("");
  const [editDate, setEditDate] = useState("2026-06-05");
  const [editDescription, setEditDescription] = useState("");
  const [editPdfUrl, setEditPdfUrl] = useState<string | undefined>("");
  const [editPdfName, setEditPdfName] = useState<string | undefined>("");
  const [editWarning, setEditWarning] = useState<string | null>(null);

  // Edit Pagu Form States
  const [paguInputValue, setPaguInputValue] = useState<string>("");

  // Notify Toasts
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "info" | "warn" } | null>(null);

  const showToast = (text: string, type: "success" | "info" | "warn" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // --- GOOGLE WORKSPACE API SCRIPTING HANDLERS ---
  const loadFromSheets = async () => {
    setIsGoogleSyncLoading(true);
    setGoogleSyncError(null);
    try {
      const token = getCachedToken();
      if (!token) {
        setGoogleSyncError("Lakukan login Google sebelum memuat dari Google Sheets.");
        showToast("Hubungkan dengan Akun Google terlebih dahulu.", "info");
        return;
      }
      const data = await loadAllDataFromGoogleSheets();
      if (data.categories && data.categories.length > 0) {
        setCategories(data.categories);
        setTransactions(data.transactions);
        setIsSheetLoaded(true);
        showToast("Data anggaran APBD berhasil disinkronkan dari Google Sheets!", "success");
      } else {
        // Newly created tab or spreadsheet, upload what we have as baseline
        await saveAllDataToGoogleSheets(categories, transactions);
        setIsSheetLoaded(true);
        showToast("Spreadsheet baru terdeteksi: Baseline berhasil diupload ke Google Sheets!", "success");
      }
    } catch (err: any) {
      console.warn("Spreadsheet load issue:", err);
      setGoogleSyncError(err.message || "Failed to load spreadsheet rows.");
      showToast("Data Google Sheets Gagal dimuat. Menggunakan data lokal.", "warn");
    } finally {
      setIsGoogleSyncLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setIsGoogleSyncLoading(true);
      const res = await googleSignIn();
      if (res) {
        setGoogleUser(res.user);
        setIsGoogleLinked(true);
        localStorage.setItem("apbd_2026_google_linked", "true");
        showToast("Berhasil terhubung dengan Akun Google!", "success");
        // Start automatic reload from sheets
        setTimeout(() => {
          loadFromSheets();
        }, 500);
      }
    } catch (err: any) {
      console.error(err);
      showToast("Tautan Google gagal: " + (err.message || err), "warn");
    } finally {
      setIsGoogleSyncLoading(false);
    }
  };

  const handleGoogleLogout = async () => {
    const confirmLogout = window.confirm("Apakah Anda yakin ingin memutuskan tautan Google Sheets & Drive?");
    if (!confirmLogout) return;
    try {
      await logout();
      setGoogleUser(null);
      setIsGoogleLinked(false);
      setIsSheetLoaded(false);
      showToast("Tautan Google diputuskan. Data kembali disimpan lokal.", "info");
    } catch (err) {
      console.error(err);
    }
  };

  // Automatically check credentials on mount
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setGoogleUser(user);
        setIsGoogleLinked(true);
        // User logged in! Populate in background
        loadFromSheets();
      },
      () => {
        // Not configured or session expired
        setGoogleUser(null);
      }
    );
    return () => unsubscribe();
  }, []);

  // Sync state modifications automatically to Google Sheets
  useEffect(() => {
    if (!isGoogleLinked || !isSheetLoaded || !getCachedToken()) return;

    const delayDebounce = setTimeout(async () => {
      try {
        setIsGoogleSyncLoading(true);
        await saveAllDataToGoogleSheets(categories, transactions);
        showToast("Perubahan berhasil disimpan ke Google Sheets otomatis!", "success");
      } catch (err: any) {
        console.warn("Auto Sync Google Sheets error:", err);
        showToast("Gagal menyinkronkan otomatis ke Google Sheets.", "warn");
      } finally {
        setIsGoogleSyncLoading(false);
      }
    }, 1500); // 1.5s debounce

    return () => clearTimeout(delayDebounce);
  }, [categories, transactions, isGoogleLinked, isSheetLoaded]);

  // --- THEME-BASED DYNAMIC STYLING CONFIGURATIONS ---
  const isDark = theme === "dark";
  const isLight = theme === "light";
  const isNavy = theme === "navy";
  const isContrast = theme === "contrast";

  const themeClasses = useMemo(() => {
    if (theme === "light") {
      return {
        root: "bg-[#f1f5f9] text-slate-800",
        panel: "bg-white border border-slate-200/80 shadow-md backdrop-blur-md",
        header: "bg-white border border-slate-200/80 shadow-md p-6 md:p-8 rounded-[32px] md:rounded-[40px]",
        cardGradient: "bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 shadow-md",
        textWhite: "text-slate-900",
        textSlate100: "text-slate-800",
        textSlate200: "text-slate-700",
        textSlate350: "text-slate-600",
        textSlate450: "text-slate-600",
        textSlate400: "text-slate-500",
        textSlate500: "text-slate-500",
        textSlate600: "text-slate-400",
        borderWhite5Or10: "border-slate-200",
        borderWhite10: "border-slate-200/80",
        tableHeader: "bg-slate-50 border-b border-slate-200/80 text-slate-700",
        rowHover: "hover:bg-slate-100 border-b border-slate-100",
        inputBg: "bg-slate-50 text-slate-900 border border-slate-200",
        pillActive: "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20",
        pillInactive: "text-slate-600 hover:text-slate-900 hover:bg-slate-100",
        pillNav: "bg-slate-200/60 border border-slate-200/60 p-1.5 rounded-3xl",
        textIndigo300: "text-indigo-600",
        textIndigo400: "text-indigo-600",
        bgWhite5: "bg-slate-50",
        glows: "bg-indigo-100/40",
        modalBg: "bg-white border border-slate-200 shadow-2xl rounded-[32px] text-slate-900",
        modalOverlay: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm",
        buttonReset: "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200",
        buttonAddTx: "bg-indigo-650 hover:bg-indigo-600 text-white",
        footerText: "text-slate-500 font-medium"
      };
    } else if (theme === "navy") {
      return {
        root: "bg-[#050c1e] text-slate-100",
        panel: "bg-[#0b1935]/80 border border-[#1b325c] backdrop-blur-lg shadow-xl",
        header: "bg-[#0c1f44] border border-[#1e3b6f] backdrop-blur-xl p-6 md:p-8 rounded-[32px] md:rounded-[40px] shadow-2xl",
        cardGradient: "bg-gradient-to-br from-[#0c1e40] to-[#040e21] border border-[#1d3d75] shadow-2xl",
        textWhite: "text-[#f3f4f6]",
        textSlate100: "text-slate-100",
        textSlate200: "text-slate-200",
        textSlate350: "text-[#9cb3e2]",
        textSlate450: "text-[#8aa1cc]",
        textSlate400: "text-[#8aa1cc]",
        textSlate500: "text-[#7188b5]",
        textSlate600: "text-[#637aa6]",
        borderWhite5Or10: "border-[#152a52]",
        borderWhite10: "border-[#1b325c]",
        tableHeader: "bg-[#07132b] border-b border-[#1b325c]",
        rowHover: "hover:bg-[#0d1d3d] border-b border-[#14284d]",
        inputBg: "bg-[#040b17] border border-[#1b325c]",
        pillActive: "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30",
        pillInactive: "text-[#8aa1cc] hover:text-white hover:bg-white/5",
        pillNav: "bg-[#040b17] border border-[#1b325c] p-1.5 rounded-3xl",
        textIndigo300: "text-indigo-400",
        textIndigo400: "text-[#818cf8]",
        bgWhite5: "bg-[#040b17]",
        glows: "bg-indigo-950/25",
        modalBg: "bg-[#061126] border border-[#1d3d75] rounded-[32px] text-slate-100",
        modalOverlay: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md",
        buttonReset: "bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-[#1b325c]",
        buttonAddTx: "bg-indigo-650 hover:bg-indigo-600 text-white",
        footerText: "text-[#637aa6] font-medium"
      };
    } else if (theme === "contrast") {
      return {
        root: "bg-black text-white border-white",
        panel: "bg-black border-2 border-white/80 shadow-[0_0_15px_rgba(255,255,255,0.25)]",
        header: "bg-black border-4 border-white p-6 md:p-8 rounded-[32px] md:rounded-[40px] shadow-[0_0_25px_rgba(255,255,255,0.3)]",
        cardGradient: "bg-black border-4 border-white shadow-[0_0_20px_rgba(255,255,255,0.2)]",
        textWhite: "text-white font-black",
        textSlate100: "text-white",
        textSlate200: "text-zinc-100",
        textSlate350: "text-zinc-200 font-bold",
        textSlate450: "text-zinc-300 font-medium",
        textSlate400: "text-zinc-200 font-bold",
        textSlate500: "text-zinc-300",
        textSlate600: "text-zinc-400",
        borderWhite5Or10: "border-zinc-300 border-2",
        borderWhite10: "border-white border-2",
        tableHeader: "bg-zinc-900 border-b-4 border-white text-white font-extrabold text-[13px] tracking-wide",
        rowHover: "hover:bg-zinc-900/80 border-b-2 border-zinc-700",
        inputBg: "bg-black text-white border-2 border-white",
        pillActive: "bg-white text-black font-black border-4 border-black scale-[1.03] shadow-[0_0_10px_rgba(255,255,255,0.8)]",
        pillInactive: "text-zinc-350 border border-zinc-500 hover:text-white hover:bg-zinc-900",
        pillNav: "bg-black border-2 border-white p-1.5 rounded-3xl",
        textIndigo300: "text-yellow-400 font-black",
        textIndigo400: "text-yellow-400 font-black",
        bgWhite5: "bg-zinc-900 border border-zinc-700",
        glows: "bg-white/5 shadow-inner",
        modalBg: "bg-black border-4 border-white rounded-[24px] text-white shadow-[0_0_40px_rgba(255,255,255,0.5)]",
        modalOverlay: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95",
        buttonReset: "bg-zinc-800 hover:bg-zinc-700 text-white border-2 border-white",
        buttonAddTx: "bg-white text-black font-black hover:bg-zinc-100 border-2 border-white shadow-xl",
        footerText: "text-white font-black font-mono tracking-wider"
      };
    } else {
      return {
        root: "bg-[#02040a] text-slate-100",
        panel: "bg-white/5 border border-white/10 backdrop-blur-xl shadow-xl",
        header: "bg-white/5 border border-white/10 backdrop-blur-xl p-6 md:p-8 rounded-[32px] md:rounded-[40px] shadow-2xl",
        cardGradient: "bg-gradient-to-br from-[#0c1020] to-[#04060d] border border-white/10 shadow-2xl",
        textWhite: "text-white",
        textSlate100: "text-slate-100",
        textSlate200: "text-slate-200",
        textSlate350: "text-slate-300",
        textSlate450: "text-slate-400",
        textSlate400: "text-slate-400",
        textSlate500: "text-slate-500",
        textSlate600: "text-[#64748b]",
        borderWhite5Or10: "border-white/5",
        borderWhite10: "border-white/10",
        tableHeader: "bg-white/[0.04] border-b border-white/10",
        rowHover: "hover:bg-white/[0.03] border-b border-white/[0.03]",
        inputBg: "bg-white/5 border border-white/10",
        pillActive: "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 border border-white/10 scale-[1.02]",
        pillInactive: "text-slate-400 hover:text-white hover:bg-white/5",
        pillNav: "bg-white/5 border border-white/10 p-1.5 rounded-3xl",
        textIndigo300: "text-[#818cf8]",
        textIndigo400: "text-[#818cf8]",
        bgWhite5: "bg-white/5",
        glows: "bg-indigo-900/20",
        modalBg: "bg-[#04060d]/95 border border-white/10 rounded-[32px] shadow-2xl text-slate-100",
        modalOverlay: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md",
        buttonReset: "bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/5",
        buttonAddTx: "bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white shadow-lg shadow-indigo-500/20",
        footerText: "text-slate-500 font-semibold"
      };
    }
  }, [theme]);

  // --- CORE SYSTEM CALCULATIONS ---
  const totalAnggaran = useMemo(() => calculateTotalRencana(categories), [categories]);
  const totalRealisasi = useMemo(() => calculateTotalRealisasi(transactions), [transactions]);
  const totalSisa = Math.max(0, totalAnggaran - totalRealisasi);
  const persentaseRealisasi = totalAnggaran > 0 ? (totalRealisasi / totalAnggaran) * 100 : 0;

  // Derive which budget items are currently under stress (>80% used) or over budget (>100%)
  const checkedItemsWithStats = useMemo(() => {
    const list: Array<{ item: BudgetItem; category: BudgetCategory; spent: number; percent: number; sisa: number }> = [];
    categories.forEach((cat) => {
      cat.items.forEach((item) => {
        const spent = calculateItemRealisasi(item.id, transactions);
        const percent = item.rencana > 0 ? (spent / item.rencana) * 100 : 0;
        list.push({
          item,
          category: cat,
          spent,
          percent,
          sisa: item.rencana - spent
        });
      });
    });
    return list;
  }, [categories, transactions]);

  // Count metrics for indicators
  const statsThreshold = useMemo(() => {
    const safe = checkedItemsWithStats.filter(x => x.percent <= 80).length;
    const warning = checkedItemsWithStats.filter(x => x.percent > 80 && x.percent <= 100).length;
    const over = checkedItemsWithStats.filter(x => x.percent > 100).length;
    return { safe, warning, over };
  }, [checkedItemsWithStats]);

  // Aggregate monthly spending (Jan - Des) across all transactions
  const monthlyRealisasiStats = useMemo(() => {
    const stats = Array(12).fill(0);
    transactions.forEach((tx) => {
      const idx = tx.month - 1;
      if (idx >= 0 && idx < 12) {
        stats[idx] += tx.amount;
      }
    });
    return stats;
  }, [transactions]);

  const maxMonthValue = useMemo(() => {
    const max = Math.max(...monthlyRealisasiStats, 1000000);
    return max * 1.15; // padding for chart height
  }, [monthlyRealisasiStats]);

  // --- ANNUAL PROJECTION MATH MODEL (Months 6 - 12) ---
  const projectionData = useMemo(() => {
    // Jan-May completed months: index 0 to 4
    const n = 5;
    
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;
    
    for (let i = 0; i < n; i++) {
      const y = monthlyRealisasiStats[i] || 0;
      const x = i + 1; // Month 1 to 5
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
    }
    
    const avgY = sumY / n;
    const avgX = sumX / n;
    
    // slope m and intercept c
    let slope = 0;
    const denominator = sumX2 - n * avgX * avgX;
    if (denominator !== 0) {
      slope = (sumXY - n * avgX * avgY) / denominator;
    }
    const intercept = avgY - slope * avgX;
    
    // Fallback standard baseline monthly budget
    const baselineMonthly = totalAnggaran > 0 ? totalAnggaran / 12 : 500000000;
    const maxAllowableMonthly = Math.max(baselineMonthly * 2.5, avgY * 2.5);
    const minAllowableMonthly = Math.max(0, avgY * 0.1); // min 10% previous average
    
    // Total spent up to May (index 0..4)
    const spentUpToMay = monthlyRealisasiStats.slice(0, 5).reduce((a, b) => a + b, 0);
    
    // Generate comparison points for June to December (Months 6 to 12)
    const projectedMonthsList = [6, 7, 8, 9, 10, 11, 12];
    const results: Array<{
      month: number;
      monthName: string;
      projectedSpent: number;
      remainingBudget: number;
    }> = [];
    
    let currentRemaining = Math.max(0, totalAnggaran - spentUpToMay);
    
    projectedMonthsList.forEach((m) => {
      let projectedSpent = slope * m + intercept;
      
      // Bounds checks
      if (projectedSpent > maxAllowableMonthly) projectedSpent = maxAllowableMonthly;
      if (projectedSpent < minAllowableMonthly) projectedSpent = minAllowableMonthly;
      
      results.push({
        month: m,
        monthName: getMonthName(m),
        projectedSpent: Math.round(projectedSpent),
        remainingBudget: Math.round(currentRemaining)
      });
      
      // Update remaining for the next calculation
      currentRemaining = Math.max(0, currentRemaining - projectedSpent);
    });
    
    // Check if we face a deficit or run out of budget
    let runoutMonthName: string | null = null;
    let tempRemaining = Math.max(0, totalAnggaran - spentUpToMay);
    for (let i = 0; i < results.length; i++) {
      const item = results[i];
      if (tempRemaining - item.projectedSpent < 0) {
        runoutMonthName = item.monthName;
        break;
      }
      tempRemaining -= item.projectedSpent;
    }
    const projectedSurplus = Math.max(0, tempRemaining);
    
    return {
      results,
      slope,
      intercept,
      spentUpToMay,
      startingRemaining: Math.max(0, totalAnggaran - spentUpToMay),
      averageSpentMay: avgY,
      runoutMonthName,
      projectedSurplus
    };
  }, [monthlyRealisasiStats, totalAnggaran]);

  // Computed data for Recharts Pie Chart (Proportion of category spent vs planned)
  const pieData = useMemo(() => {
    return categories.map((cat) => {
      const value = pieChartMetric === "spent" 
        ? calculateCategoryRealisasi(cat.id, transactions)
        : calculateCategoryRencana(cat);
      
      return {
        id: cat.id,
        kode: cat.kode,
        name: cat.nama.replace("Belanja ", "").split(" - ")[0],
        fullName: cat.nama,
        value: value,
      };
    }).filter(item => item.value > 0);
  }, [categories, transactions, pieChartMetric]);

  const pieTotalValue = useMemo(() => {
    return pieData.reduce((acc, curr) => acc + curr.value, 0);
  }, [pieData]);

  // Filter categories according to search queries, active category tab, or dropdown alerts
  const filteredCategories = useMemo(() => {
    const targetCategories = activeTab === "monitoring"
      ? categories
      : categories.filter((c) => c.id === activeTab);

    return targetCategories.map((cat) => {
      // Find items matching search text
      const filteredItems = cat.items.filter((item) => {
        const matchesSearch = item.nama.toLowerCase().includes(searchQuery.toLowerCase());
        
        // Match alert filters
        const spent = calculateItemRealisasi(item.id, transactions);
        const percent = item.rencana > 0 ? (spent / item.rencana) * 100 : 0;
        
        if (warningFilter === "all") return matchesSearch;
        if (warningFilter === "safe") return matchesSearch && percent <= 80;
        if (warningFilter === "warning") return matchesSearch && percent > 80 && percent <= 100;
        if (warningFilter === "over") return matchesSearch && percent > 100;
        return matchesSearch;
      });

      return {
        ...cat,
        items: filteredItems
      };
    }).filter(cat => cat.items.length > 0 || searchQuery === "");
  }, [categories, searchQuery, warningFilter, transactions, activeTab]);

  // --- FORM HANDLERS ---
  const handleOpenAddTx = () => {
    const defaultCatId = activeTab !== "monitoring" ? activeTab : (categories[0]?.id || "");
    const selectedCat = categories.find(c => c.id === defaultCatId) || categories[0];
    setFormCategoryId(defaultCatId);
    setFormItemId(selectedCat?.items[0]?.id || "");
    setFormAmount("");
    setFormDate("2026-06-05");
    setFormDescription("");
    setFormWarning(null);
    setIsTxModalOpen(true);
  };

  const handleOpenAddTxWithPrefab = (catId: string, itemId: string) => {
    setFormCategoryId(catId);
    setFormItemId(itemId);
    setFormAmount("");
    setFormDate("2026-06-05");
    setFormDescription("");
    setFormWarning(null);
    setIsTxModalOpen(true);
    showToast("Mengisi form realisasi otomatis...", "info");
  };

  // Watch selected category to update nested items in form
  useEffect(() => {
    if (formCategoryId) {
      const cat = categories.find((c) => c.id === formCategoryId);
      if (cat) {
        const itemExists = cat.items.some((it) => it.id === formItemId);
        if (!itemExists && cat.items.length > 0) {
          setFormItemId(cat.items[0].id);
        }
      } else {
        setFormItemId("");
      }
    }
  }, [formCategoryId, categories, formItemId]);

  // Check budget headroom live during typing
  useEffect(() => {
    if (formItemId && formAmount && typeof formAmount === "number") {
      const item = checkedItemsWithStats.find(x => x.item.id === formItemId);
      if (item) {
        const remaining = item.item.rencana - item.spent;
        if (formAmount > remaining) {
          setFormWarning(`Perhatian: Nilai realisasi melebihi sisa pagu anggaran item ini (Sisa Pagu: ${formatCurrency(remaining)}).`);
        } else {
          setFormWarning(null);
        }
      }
    } else {
      setFormWarning(null);
    }
  }, [formItemId, formAmount, checkedItemsWithStats]);

  // Check budget headroom live during editing
  useEffect(() => {
    if (editItemId && editAmount && typeof editAmount === "number" && editingTx) {
      const item = checkedItemsWithStats.find(x => x.item.id === editItemId);
      if (item) {
        const originalAmountInCurrentItem = (editingTx.itemId === editItemId) ? editingTx.amount : 0;
        const remaining = item.item.rencana - item.spent + originalAmountInCurrentItem;
        if (editAmount > remaining) {
          setEditWarning(`Perhatian: Nilai realisasi melebihi sisa pagu anggaran item ini (Sisa Pagu Terkoreksi: ${formatCurrency(remaining)}).`);
        } else {
          setEditWarning(null);
        }
      } else {
        setEditWarning(null);
      }
    } else {
      setEditWarning(null);
    }
  }, [editItemId, editAmount, checkedItemsWithStats, editingTx]);

  const handleOpenEditTx = (tx: RealisasiTransaction) => {
    setEditingTx(tx);
    setEditCategoryId(tx.categoryId);
    setEditItemId(tx.itemId);
    setEditAmount(tx.amount);
    setEditDate(tx.date);
    setEditDescription(tx.description);
    setEditPdfUrl(tx.pdfUrl || "");
    setEditPdfName(tx.pdfName || "");
    setEditWarning(null);
    setIsEditTxModalOpen(true);
  };

  const handleSaveEditTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx || !editCategoryId || !editItemId || !editAmount || editAmount <= 0) {
      showToast("Gagal menyimpan. Harap isi semua rincian form dengan nominal positif.", "warn");
      return;
    }

    const txDate = new Date(editDate);
    const txMonth = txDate.getMonth() + 1;
    const updatedAmount = Number(editAmount);

    // Check budget limit exceeding 100% of planned pagu
    const itemWithStat = checkedItemsWithStats.find(x => x.item.id === editItemId);
    if (itemWithStat) {
      const originalAmountInCurrentItem = (editingTx.itemId === editItemId) ? editingTx.amount : 0;
      const currentSpentWithoutThisTx = itemWithStat.spent - originalAmountInCurrentItem;
      const newTotal = currentSpentWithoutThisTx + updatedAmount;

      if (newTotal > itemWithStat.item.rencana) {
        setOverrunDetails({
          itemName: itemWithStat.item.nama,
          pagu: itemWithStat.item.rencana,
          currentSpent: currentSpentWithoutThisTx,
          proposedAmount: updatedAmount,
          newTotal: newTotal,
          type: "edit"
        });
        setIsOverrunModalOpen(true);
        showToast("Peringatan: Total realisasi hasil edit akan melebihi 100% pagu anggaran!", "warn");
        return;
      }
    }

    setTransactions((prev) =>
      prev.map((tx) => {
        if (tx.id === editingTx.id) {
          return {
            ...tx,
            itemId: editItemId,
            categoryId: editCategoryId,
            amount: updatedAmount,
            date: editDate,
            month: txMonth,
            description: editDescription || `Realisasi ${categories.find(c => c.id === editCategoryId)?.items?.find(i => i.id === editItemId)?.nama || "Kuitansi Belanja"}`,
            pdfUrl: editPdfUrl || undefined,
            pdfName: editPdfName || undefined,
          };
        }
        return tx;
      })
    );

    setIsEditTxModalOpen(false);
    showToast(`Berhasil memperbarui rincian transaksi realisasi!`);
  };

  const handleRemovePdf = () => {
    setEditPdfUrl("");
    setEditPdfName("");
    showToast("Berkas lampiran PDF dihapus.");
  };

  const handleRemoveFormPdf = () => {
    setFormPdfUrl("");
    setFormPdfName("");
    showToast("Berkas lampiran PDF dihapus.");
  };

  const handleAddTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCategoryId || !formItemId || !formAmount || formAmount <= 0) {
      showToast("Gagal menyimpan. Harap isi semua rincian form dengan nominal positif.", "warn");
      return;
    }

    const txDate = new Date(formDate);
    // Extract month (1-indexed)
    const txMonth = txDate.getMonth() + 1;
    const addedAmount = Number(formAmount);

    // Check budget limit exceeding 100% of planned pagu
    const itemWithStat = checkedItemsWithStats.find(x => x.item.id === formItemId);
    if (itemWithStat) {
      const remaining = itemWithStat.item.rencana - itemWithStat.spent;
      if (addedAmount > remaining) {
        setOverrunDetails({
          itemName: itemWithStat.item.nama,
          pagu: itemWithStat.item.rencana,
          currentSpent: itemWithStat.spent,
          proposedAmount: addedAmount,
          newTotal: itemWithStat.spent + addedAmount,
          type: "add"
        });
        setIsOverrunModalOpen(true);
        showToast("Peringatan: Total realisasi transaksi akan melebihi 100% pagu anggaran!", "warn");
        return;
      }
    }

    const newTx: RealisasiTransaction = {
      id: `tx-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      itemId: formItemId,
      categoryId: formCategoryId,
      amount: addedAmount,
      date: formDate,
      month: txMonth,
      description: formDescription || `Realisasi ${categories.find(c => c.id === formCategoryId)?.items?.find(i => i.id === formItemId)?.nama || "Kuitansi Belanja"}`,
      pdfUrl: formPdfUrl || undefined,
      pdfName: formPdfName || undefined
    };

    setTransactions((prev) => [newTx, ...prev]);
    setIsTxModalOpen(false);

    setHighlightedTxId(newTx.id);
    setTimeout(() => {
      setHighlightedTxId((prev) => (prev === newTx.id ? null : prev));
    }, 4000);

    // Reset Form Input Fields
    setFormAmount("");
    setFormDescription("");
    setFormPdfUrl("");
    setFormPdfName("");

    showToast(`Berhasil merekam realisasi sebesar ${formatCurrency(addedAmount)}!`);
  };

  const handleDeleteTransaction = (txId: string) => {
    setTxIdToDelete(txId);
  };

  const confirmDeleteTransaction = () => {
    if (!txIdToDelete) return;
    const deletedTx = transactions.find((tx) => tx.id === txIdToDelete);
    if (deletedTx) {
      setTransactions((prev) => prev.filter((tx) => tx.id !== txIdToDelete));
      showToast(`Berhasil menghapus realisasi ${formatCurrency(deletedTx.amount)}`);
    }
    setTxIdToDelete(null);
  };

  const handleConfirmOverrun = () => {
    if (!overrunDetails) return;

    if (overrunDetails.type === "add") {
      const txDate = new Date(formDate);
      const txMonth = txDate.getMonth() + 1;
      const addedAmount = overrunDetails.proposedAmount;

      const newTx: RealisasiTransaction = {
        id: `tx-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        itemId: formItemId,
        categoryId: formCategoryId,
        amount: addedAmount,
        date: formDate,
        month: txMonth,
        description: formDescription || `Realisasi ${categories.find(c => c.id === formCategoryId)?.items?.find(i => i.id === formItemId)?.nama || "Kuitansi Belanja"}`,
        pdfUrl: formPdfUrl || undefined,
        pdfName: formPdfName || undefined
      };

      setTransactions((prev) => [newTx, ...prev]);
      setIsTxModalOpen(false);

      setHighlightedTxId(newTx.id);
      setTimeout(() => {
        setHighlightedTxId((prev) => (prev === newTx.id ? null : prev));
      }, 4000);

      // Reset Form Input Fields
      setFormAmount("");
      setFormDescription("");
      setFormPdfUrl("");
      setFormPdfName("");

      showToast(`Berhasil merekam realisasi melebihi pagu sebesar ${formatCurrency(addedAmount)}!`, "warn");
    } else if (overrunDetails.type === "edit" && editingTx) {
      const txDate = new Date(editDate);
      const txMonth = txDate.getMonth() + 1;
      const updatedAmount = overrunDetails.proposedAmount;

      setTransactions((prev) =>
        prev.map((tx) => {
          if (tx.id === editingTx.id) {
            return {
              ...tx,
              itemId: editItemId,
              categoryId: editCategoryId,
              amount: updatedAmount,
              date: editDate,
              month: txMonth,
              description: editDescription || `Realisasi ${categories.find(c => c.id === editCategoryId)?.items?.find(i => i.id === editItemId)?.nama || "Kuitansi Belanja"}`,
              pdfUrl: editPdfUrl || undefined,
              pdfName: editPdfName || undefined,
            };
          }
          return tx;
        })
      );

      setIsEditTxModalOpen(false);
      showToast(`Berhasil memperbarui rincian transaksi realisasi melebihi pagu!`, "warn");
    }

    setIsOverrunModalOpen(false);
    setOverrunDetails(null);
  };

  const handleOpenEditPagu = (item: BudgetItem, catId: string) => {
    setSelectedItemForPagu(item);
    setSelectedCategoryForPagu(catId);
    setPaguInputValue(item.rencana.toString());
    setIsPaguModalOpen(true);
  };

  const handleSavePagu = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemForPagu || !paguInputValue) return;

    const rawVal = paguInputValue.replace(/[^0-9]/g, "");
    const newPagu = Number(rawVal);

    if (isNaN(newPagu) || newPagu <= 0) {
      showToast("Pagu anggaran tidak boleh kurang dari atau sama dengan nol.", "warn");
      return;
    }

    setCategories((prev) =>
      prev.map((cat) => {
        if (cat.id === selectedCategoryForPagu) {
          return {
            ...cat,
            items: cat.items.map((it) => {
              if (it.id === selectedItemForPagu.id) {
                return { ...it, rencana: newPagu };
              }
              return it;
            })
          };
        }
        return cat;
      })
    );

    setIsPaguModalOpen(false);
    showToast(`Pagu anggaran berhasil direvisi menjadi ${formatCurrency(newPagu)}`);
  };

  const handleResetSystem = () => {
    setIsResetConfirmOpen(true);
  };

  const confirmResetSystem = () => {
    setCategories(INITIAL_CATEGORIES);
    setTransactions(INITIAL_TRANSACTIONS);
    setActiveTab("monitoring");
    setSearchQuery("");
    setWarningFilter("all");
    showToast("Sistem berhasil dikembalikan ke baseline awal.", "info");
    setIsResetConfirmOpen(false);
  };

  // --- CSV SPREADSHEET EXPORTER ---
  const handleExportCSV = () => {
    try {
      let csvContent = "\uFEFF"; // Byte Order Mark for Excel automatic UTF-8 detection
      // Header
      csvContent += "KODE REKENING,KATEGORI ANGGARAN,URAIAN BELANJA,PAGU RENCANA (IDR),REALISASI TOTAL (IDR),SISA ANGGARAN (IDR),PERSENTASE PENYERAPAN\n";

      categories.forEach((cat) => {
        cat.items.forEach((item) => {
          const spent = calculateItemRealisasi(item.id, transactions);
          const sisa = item.rencana - spent;
          const pct = item.rencana > 0 ? ((spent / item.rencana) * 100).toFixed(2) : "0";

          // Sanitize commas out of strings
          const safeCategory = cat.nama.replace(/,/g, " ");
          const safeItem = item.nama.replace(/,/g, " ");

          csvContent += `"${cat.kode}","${safeCategory}","${safeItem}",${item.rencana},${spent},${sisa},${pct}%\n`;
        });
      });

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `RKA_Peningkatan_SDM_Jusuf_SK_2026.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showToast("Berhasil mengekspor format spreadsheet CSV!", "success");
    } catch {
      showToast("Gagal melakukan ekspor data CSV.", "warn");
    }
  };

  // --- PDF REPORT EXPORTER ---
  const handleExportPDF = () => {
    try {
      const isMonthly = selectedMonthFilter !== "all";
      const bName = isMonthly ? getMonthName(selectedMonthFilter as number).toUpperCase() : "";

      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      // Colors definitions
      const PRIMARY_COLOR = [21, 32, 48]; // Dark Slate
      const TEXT_DARK = [33, 43, 54];
      const DECORATOR_COLOR = [99, 102, 241]; // Indigo accent

      let currentPage = 1;

      const drawHeader = (pNum: number) => {
        // Draw top thin accent line
        doc.setFillColor(99, 102, 241);
        doc.rect(0, 0, 210, 4, "F");

        // Document Title block
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(110, 120, 130);
        doc.text("RSUD dr. H. JUSUF SK TARAKAN", 15, 15);

        doc.setFontSize(12);
        doc.setTextColor(21, 32, 48);
        const docTitle = isMonthly 
          ? `LPJ REALISASI ANGGARAN BULAN ${bName} (APBD 2026)`
          : "LAPORAN PERTANGGUNGJAWABAN REALISASI ANGGARAN (APBD 2026)";
        doc.text(docTitle, 15, 22);

        doc.setFont("helvetica", "italic");
        doc.setFontSize(9);
        doc.setTextColor(110, 120, 130);
        doc.text("Peningkatan Mutu dan Kapasitas Ketenagaan Medis Kaltara", 15, 27);

        // Thin separator rule
        doc.setDrawColor(220, 225, 230);
        doc.setLineWidth(0.4);
        doc.line(15, 30, 195, 30);

        // Footer-like indicator for page number
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(150, 155, 160);
        doc.text(`Pertanggungjawaban Sistem APBD - Hal ${pNum}`, 195, 287, { align: "right" });
        doc.text(`Waktu Ekspor: ${new Date().toLocaleString("id-ID")}`, 15, 287);
      };

      drawHeader(currentPage);

      let y = 38;

      // KPI CARDS BLOCK (Draw elegant boxed summary stats)
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
      const sectionTitle = isMonthly 
        ? `I. RINGKASAN REKAPITULASI KINERJA KEUANGAN BULAN ${bName}`
        : "I. RINGKASAN REKAPITULASI KINERJA KEUANGAN";
      doc.text(sectionTitle, 15, y);
      y += 6;

      const totalRencana = calculateTotalRencana(categories);
      
      // Filter transactions accordingly
      const activeTxs = isMonthly ? transactions.filter(tx => tx.month === selectedMonthFilter) : transactions;
      const cumulativeTxs = isMonthly ? transactions.filter(tx => tx.month <= (selectedMonthFilter as number)) : transactions;

      const totalRealisasiVal = activeTxs.reduce((sum, tx) => sum + tx.amount, 0);
      const cumulativeSpent = cumulativeTxs.reduce((sum, tx) => sum + tx.amount, 0);
      const sisaKeseluruhan = totalRencana - cumulativeSpent;
      const finalPercentage = totalRencana > 0 ? (cumulativeSpent / totalRencana) * 100 : 0;

      // Draw Grid cards for summary metrics
      const cardWidth = 54;
      const cardHeight = 22;
      const cardY = y;

      const formatIDR = (val: number) => {
        return "Rp " + val.toLocaleString("id-ID");
      };

      // Card 1: Total Pagu Rencana
      doc.setFillColor(245, 247, 250);
      doc.roundedRect(15, cardY, cardWidth, cardHeight, 3, 3, "F");
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.roundedRect(15, cardY, cardWidth, cardHeight, 3, 3, "D");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(100, 110, 120);
      doc.text("TOTAL PAGU RENCANA", 18, cardY + 6);
      doc.setFontSize(9);
      doc.setTextColor(21, 32, 48);
      doc.text(formatIDR(totalRencana), 18, cardY + 14);

      // Card 2: Total Realisasi
      doc.setFillColor(240, 243, 255);
      doc.roundedRect(15 + cardWidth + 3, cardY, cardWidth, cardHeight, 3, 3, "F");
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.roundedRect(15 + cardWidth + 3, cardY, cardWidth, cardHeight, 3, 3, "D");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(99, 102, 241); // Indigo color
      const realisasiCardLabel = isMonthly ? `REALISASI BULAN ${bName}` : "TOTAL REALISASI MARET";
      doc.text(realisasiCardLabel, 15 + cardWidth + 6, cardY + 6);
      doc.setFontSize(9);
      doc.setTextColor(99, 102, 241);
      doc.text(formatIDR(totalRealisasiVal), 15 + cardWidth + 6, cardY + 14);

      // Card 3: Sisa Anggaran (Kumulatif)
      doc.setFillColor(240, 253, 244); // light green
      doc.roundedRect(15 + (cardWidth + 3) * 2, cardY, cardWidth, cardHeight, 3, 3, "F");
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.roundedRect(15 + (cardWidth + 3) * 2, cardY, cardWidth, cardHeight, 3, 3, "D");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(22, 101, 52); // green
      const sisaCardLabel = isMonthly ? "SISA PAGU TAHUN (YTD)" : "SISA ANGGARAN";
      doc.text(sisaCardLabel, 15 + (cardWidth + 3) * 2 + 3, cardY + 6);
      doc.setFontSize(9);
      doc.setTextColor(22, 101, 52);
      doc.text(formatIDR(sisaKeseluruhan), 15 + (cardWidth + 3) * 2 + 3, cardY + 14);

      // Sisa Budget / Percentage
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
      const noteTextVal = isMonthly 
        ? `Tingkat Penyerapan Anggaran Kumulatif s/d ${getMonthName(selectedMonthFilter as number)}: ${finalPercentage.toFixed(2)}% dari total pagu rencana.`
        : `Tingkat Penyerapan Anggaran (KPI): ${finalPercentage.toFixed(2)}% dari total pagu rencana program pengembangan ketenagaan.`;
      doc.text(noteTextVal, 15, cardY + cardHeight + 6);

      y = cardY + cardHeight + 14;

      // Section II: Rincian Anggaran Per-Kategori
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
      doc.text("II. RINCIAN PAGU ANGGARAN DAN REALISASI PER KATEGORI BELANJA", 15, y);
      y += 6;

      // Table Header for Categories
      doc.setFillColor(240, 242, 245);
      doc.rect(15, y, 180, 7, "F");
      doc.setDrawColor(210, 215, 220);
      doc.rect(15, y, 180, 7, "D");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(50, 60, 70);
      doc.text("Kode", 17, y + 5);
      doc.text("Nama Kategori Program Belanja", 42, y + 5);
      doc.text("Rencana (IDR)", 117, y + 5);
      
      const relisasiLabelMain = isMonthly ? `Realisasi ${getShortMonthName(selectedMonthFilter as number)} (IDR)` : "Realisasi (IDR)";
      const sisaLabelMain = isMonthly ? "Sisa YTD (IDR)" : "Sisa (IDR)";
      doc.text(relisasiLabelMain, 142, y + 5);
      doc.text(sisaLabelMain, 174, y + 5);
      y += 7;

      categories.forEach((cat) => {
        // Page break safety check
        if (y > 260) {
          doc.addPage();
          currentPage++;
          drawHeader(currentPage);
          y = 38;
        }

        const catRencana = calculateCategoryRencana(cat);
        const catSpent = isMonthly
          ? transactions.filter(tx => tx.categoryId === cat.id && tx.month === selectedMonthFilter).reduce((sum, tx) => sum + tx.amount, 0)
          : calculateCategoryRealisasi(cat.id, transactions);
        const catCumulativeSpent = isMonthly
          ? transactions.filter(tx => tx.categoryId === cat.id && tx.month <= (selectedMonthFilter as number)).reduce((sum, tx) => sum + tx.amount, 0)
          : catSpent;
        const catSisa = catRencana - catCumulativeSpent;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
        
        let shortenedName = cat.nama;
        if (shortenedName.length > 40) {
          shortenedName = shortenedName.substring(0, 38) + "...";
        }

        doc.text(cat.kode, 17, y + 5);
        doc.text(shortenedName, 42, y + 5);
        doc.text(catRencana.toLocaleString("id-ID"), 117, y + 5);
        doc.text(catSpent.toLocaleString("id-ID"), 142, y + 5);
        doc.text(catSisa.toLocaleString("id-ID"), 174, y + 5);

        // Thin separator between lines
        doc.setDrawColor(240, 242, 245);
        doc.setLineWidth(0.1);
        doc.line(15, y + 7, 195, y + 7);

        y += 7;
      });

      y += 5;

      // Section III: Registrasi Mutasi Realisasi
      if (y > 240) {
        doc.addPage();
        currentPage++;
        drawHeader(currentPage);
        y = 38;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
      const thirdSectionLabel = isMonthly 
        ? `III. REGISTRASI JURNAL MUTASI REALISASI BULAN ${bName}`
        : "III. REGISTRASI JURNAL MUTASI REALISASI EXPENSE";
      doc.text(thirdSectionLabel, 15, y);
      y += 6;

      // Table Header for Transactions
      doc.setFillColor(240, 242, 245);
      doc.rect(15, y, 180, 7, "F");
      doc.setDrawColor(210, 215, 220);
      doc.rect(15, y, 180, 7, "D");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(50, 60, 70);
      doc.text("Tanggal", 17, y + 5);
      doc.text("Kategori & Sub-item Anggaran", 38, y + 5);
      doc.text("Uraian / Keterangan Kuitansi", 98, y + 5);
      doc.text("Nominal (IDR)", 168, y + 5);
      y += 7;

      if (activeTxs.length === 0) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8);
        doc.text("Belum ada mutasi pembayaran / kuitansi realisasi yang direkam untuk periode ini.", 17, y + 5);
        y += 7;
      } else {
        activeTxs.forEach((tx) => {
          if (y > 265) {
            doc.addPage();
            currentPage++;
            drawHeader(currentPage);
            
            y = 38;
            doc.setFillColor(240, 242, 245);
            doc.rect(15, y, 180, 7, "F");
            doc.setDrawColor(210, 215, 220);
            doc.rect(15, y, 180, 7, "D");

            doc.setFont("helvetica", "bold");
            doc.setFontSize(7.5);
            doc.setTextColor(50, 60, 70);
            doc.text("Tanggal", 17, y + 5);
            doc.text("Kategori & Sub-item Anggaran", 38, y + 5);
            doc.text("Uraian / Keterangan Kuitansi", 98, y + 5);
            doc.text("Nominal (IDR)", 168, y + 5);
            y += 7;
          }

          doc.setFont("helvetica", "normal");
          doc.setFontSize(7);
          doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);

          const catObject = categories.find((c) => c.id === tx.categoryId);
          const catName = catObject?.nama || "Lainnya";
          const subItemName = catObject?.items?.find((i) => i.id === tx.itemId)?.nama || "Lainnya";

          let shortCatSub = `[${catName.substring(0, 15)}] ${subItemName}`;
          if (shortCatSub.length > 38) {
            shortCatSub = shortCatSub.substring(0, 36) + "...";
          }

          let shortDesc = tx.description;
          if (shortDesc.length > 55) {
            shortDesc = shortDesc.substring(0, 52) + "...";
          }

          doc.text(tx.date, 17, y + 5);
          doc.text(shortCatSub, 38, y + 5);
          doc.text(shortDesc, 98, y + 5);
          
          doc.setFont("helvetica", "bold");
          doc.text(tx.amount.toLocaleString("id-ID"), 168, y + 5);
          doc.setFont("helvetica", "normal");

          doc.setDrawColor(245, 247, 250);
          doc.setLineWidth(0.1);
          doc.line(15, y + 7, 195, y + 7);

          y += 7;
        });
      }

      // --- SECTION IV: YEARLY EXECUTIVE SUMMARY ---
      // Force page break to place the executive summary on its own clean final page of the report
      doc.addPage();
      currentPage++;
      drawHeader(currentPage);
      y = 38;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
      doc.text("IV. RINGKASAN EKSEKUTIF PENYERAPAN ANGGARAN TAHUNAN (KUMULATIF TAHUN 2026)", 15, y);
      y += 5;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
      doc.text("Berikut adalah analisis rekapitulasi penyerapan anggaran tahunan kumulatif (Januari s.d Desember) dibandingkan", 15, y);
      y += 4;
      doc.text("dengan sisa sisa pagu anggaran akhir (headroom) untuk masing-masing kategori program belanja RSUD dr. H. Jusuf SK.", 15, y);
      y += 6;

      // Draw table header of the executive summary
      doc.setFillColor(240, 242, 245);
      doc.rect(15, y, 180, 7, "F");
      doc.setDrawColor(210, 215, 220);
      doc.rect(15, y, 180, 7, "D");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(50, 60, 70);
      doc.text("No", 17, y + 5);
      doc.text("Kode Rekening", 23, y + 5);
      doc.text("Nama Kategori Program Belanja", 55, y + 5);
      doc.text("Pagu Rencana (IDR)", 114, y + 5);
      doc.text("Total Realisasi (IDR)", 141, y + 5);
      doc.text("Sisa Anggaran (IDR)", 168, y + 5);
      doc.text("Abs (%)", 188, y + 5);
      y += 7;

      let idxSum = 1;
      let totalRencanaYear = 0;
      let totalSpentYear = 0;

      categories.forEach((cat) => {
        const catRencana = calculateCategoryRencana(cat);
        const catSpent = calculateCategoryRealisasi(cat.id, transactions);
        const catSisa = catRencana - catSpent;
        const catPct = catRencana > 0 ? (catSpent / catRencana) * 100 : 0;

        totalRencanaYear += catRencana;
        totalSpentYear += catSpent;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);

        let shortenedName = cat.nama;
        if (shortenedName.length > 34) {
          shortenedName = shortenedName.substring(0, 32) + "...";
        }

        doc.text(idxSum.toString(), 17, y + 5);
        doc.text(cat.kode, 23, y + 5);
        doc.text(shortenedName, 55, y + 5);
        doc.text(catRencana.toLocaleString("id-ID"), 114, y + 5);
        doc.text(catSpent.toLocaleString("id-ID"), 141, y + 5);
        doc.text(catSisa.toLocaleString("id-ID"), 168, y + 5);
        
        doc.setFont("helvetica", "bold");
        doc.text(`${catPct.toFixed(1)}%`, 188, y + 5);
        doc.setFont("helvetica", "normal");

        // Separator inside sum table
        doc.setDrawColor(240, 242, 245);
        doc.setLineWidth(0.1);
        doc.line(15, y + 7, 195, y + 7);

        y += 7;
        idxSum++;
      });

      // Total row for summary
      doc.setFillColor(248, 250, 252);
      doc.rect(15, y, 180, 7, "F");
      doc.setDrawColor(210, 215, 220);
      doc.rect(15, y, 180, 7, "D");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
      doc.text("TOTAL ESTIMASI TAHUNAN", 23, y + 5);
      
      doc.text(totalRencanaYear.toLocaleString("id-ID"), 114, y + 5);
      doc.text(totalSpentYear.toLocaleString("id-ID"), 141, y + 5);
      doc.text((totalRencanaYear - totalSpentYear).toLocaleString("id-ID"), 168, y + 5);
      const totalPctYear = totalRencanaYear > 0 ? (totalSpentYear / totalRencanaYear) * 100 : 0;
      doc.text(`${totalPctYear.toFixed(1)}%`, 188, y + 5);
      y += 12;

      // Legal Signatures Section directly follows on the final page
      if (y > 220) {
        doc.addPage();
        currentPage++;
        drawHeader(currentPage);
        y = 38;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
      
      const sigPlace = "Tarakan, " + new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
      doc.text(sigPlace, 140, y);
      y += 5;
      
      doc.text("Disetujui Oleh,", 15, y);
      doc.text("Dibuat Oleh,", 140, y);
      
      y += 4;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.text("Kuasa Pengguna Anggaran (KPA)", 15, y);
      doc.text("Bendahara Pengeluaran RSUD", 140, y);

      y += 18;
      
      doc.setFont("helvetica", "bold");
      doc.setTextColor(21, 32, 48);
      doc.text("dr. Rustan Samsuddin, M.M.", 15, y);
      doc.text("Meidi Priandana, S.Sos,.M.Si", 140, y);

      y += 4;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 110, 120);
      doc.text("NIP. 19781203 200501 1 002", 15, y);
      doc.text("NIP. 19890522 201503 1 005", 140, y);

      const fn = isMonthly ? `LPJ_Realisasi_APBD_Tarakan_Bulan_${bName}_2026.pdf` : `LPJ_Realisasi_APBD_Tarakan_2026.pdf`;
      doc.save(fn);
      showToast(isMonthly ? `Laporan realisasi bulan ${getMonthName(selectedMonthFilter as number)} PDF berhasil diunduh!` : "Laporan pertanggungjawaban PDF berhasil diunduh!", "success");

    } catch (e: any) {
      console.error(e);
      showToast("Gagal memproses pembuatan laporan PDF.", "warn");
    }
  };

  // --- CATEGORY PDF EXPORTER ---
  const handleExportCategoryPDF = (cat: BudgetCategory) => {
    try {
      const isMonthly = selectedMonthFilter !== "all";
      const bName = isMonthly ? getMonthName(selectedMonthFilter as number).toUpperCase() : "";

      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      // Colors definitions
      const PRIMARY_COLOR = [21, 32, 48]; // Dark Slate
      const TEXT_DARK = [33, 43, 54];

      let currentPage = 1;

      const drawHeader = (pNum: number) => {
        // Draw top thin accent line
        doc.setFillColor(99, 102, 241);
        doc.rect(0, 0, 210, 4, "F");

        // Document Title block
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(110, 120, 130);
        doc.text("RSUD dr. H. JUSUF SK TARAKAN", 15, 15);

        doc.setFontSize(11);
        doc.setTextColor(21, 32, 48);
        const docTitle = isMonthly
          ? `LAPORAN PERTANGGUNGJAWABAN REALISASI KATEGORI BULAN ${bName}`
          : "LAPORAN PERTANGGUNGJAWABAN REALISASI KATEGORI BELANJA";
        doc.text(docTitle, 15, 22);

        doc.setFont("helvetica", "italic");
        doc.setFontSize(9);
        doc.setTextColor(110, 120, 130);
        doc.text("Peningkatan Mutu dan Kapasitas Ketenagaan Medis Kaltara", 15, 27);

        // Thin separator rule
        doc.setDrawColor(220, 225, 230);
        doc.setLineWidth(0.4);
        doc.line(15, 30, 195, 30);

        // Footer-like indicator for page number
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(150, 155, 160);
        doc.text(`Detail Kategori: ${cat.nama} - Hal ${pNum}`, 195, 287, { align: "right" });
        doc.text(`Waktu Ekspor: ${new Date().toLocaleString("id-ID")}`, 15, 287);
      };

      drawHeader(currentPage);

      let y = 38;

      // I. INFORMASI KATEGORI BELANJA
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
      const secITitle = isMonthly
        ? `I. INFORMASI DAN RINGKASAN REALISASI KATEGORI BULAN ${bName}`
        : "I. INFORMASI DAN RINGKASAN REALISASI KATEGORI";
      doc.text(secITitle, 15, y);
      y += 6;

      // Metadata information box
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(15, y, 180, 16, 2, 2, "F");
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.roundedRect(15, y, 180, 16, 2, 2, "D");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(100, 110, 120);
      doc.text("KODE REKENING RKA:", 18, y + 5);
      doc.text("KATEGORI PROGRAM BELANJA:", 18, y + 11);

      doc.setFont("helvetica", "bold");
      doc.setTextColor(21, 32, 48);
      doc.text(cat.kode, 48, y + 5);
      doc.text(cat.nama, 63, y + 11);

      y += 20;

      // RINGKASAN KEUANGAN KATEGORI KPI CARDS
      const catRencana = calculateCategoryRencana(cat);
      const catSpent = isMonthly
        ? transactions.filter(tx => tx.categoryId === cat.id && tx.month === selectedMonthFilter).reduce((sum, tx) => sum + tx.amount, 0)
        : calculateCategoryRealisasi(cat.id, transactions);
      const catCumulativeSpent = isMonthly
        ? transactions.filter(tx => tx.categoryId === cat.id && tx.month <= (selectedMonthFilter as number)).reduce((sum, tx) => sum + tx.amount, 0)
        : catSpent;
      const catSisa = catRencana - catCumulativeSpent;
      const catPercentage = catRencana > 0 ? (catCumulativeSpent / catRencana) * 100 : 0;

      // Draw Grid cards for summary metrics
      const cardWidth = 54;
      const cardHeight = 22;
      const cardY = y;

      const formatIDR = (val: number) => {
        return "Rp " + val.toLocaleString("id-ID");
      };

      // Card 1: Total Pagu Rencana Kategori
      doc.setFillColor(245, 247, 250);
      doc.roundedRect(15, cardY, cardWidth, cardHeight, 3, 3, "F");
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.roundedRect(15, cardY, cardWidth, cardHeight, 3, 3, "D");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(100, 110, 120);
      doc.text("PAGU RENCANA KATEGORI", 18, cardY + 4);
      doc.setFontSize(8.5);
      doc.setTextColor(21, 32, 48);
      doc.text(formatIDR(catRencana), 18, cardY + 13);

      // Card 2: Total Realisasi Kategori
      doc.setFillColor(240, 243, 255);
      doc.roundedRect(15 + cardWidth + 3, cardY, cardWidth, cardHeight, 3, 3, "F");
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.roundedRect(15 + cardWidth + 3, cardY, cardWidth, cardHeight, 3, 3, "D");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(99, 102, 241);
      const realisasiCatLabel = isMonthly ? `REALISASI BULAN ${bName}` : "TOTAL REALISASI BELANJA";
      doc.text(realisasiCatLabel, 15 + cardWidth + 6, cardY + 4);
      doc.setFontSize(8.5);
      doc.setTextColor(99, 102, 241);
      doc.text(formatIDR(catSpent), 15 + cardWidth + 6, cardY + 13);

      // Card 3: Sisa Anggaran Kategori
      doc.setFillColor(240, 253, 244); // light green
      doc.roundedRect(15 + (cardWidth + 3) * 2, cardY, cardWidth, cardHeight, 3, 3, "F");
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.roundedRect(15 + (cardWidth + 3) * 2, cardY, cardWidth, cardHeight, 3, 3, "D");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(22, 101, 52); // green
      const sisaCatLabel = isMonthly ? "SISA BUDGET KATEGORI (Kumulatif)" : "SISA BUDGET KATEGORI";
      doc.text(sisaCatLabel, 15 + (cardWidth + 3) * 2 + 3, cardY + 4);
      doc.setFontSize(8.5);
      doc.setTextColor(22, 101, 52);
      doc.text(formatIDR(catSisa), 15 + (cardWidth + 3) * 2 + 3, cardY + 13);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
      const catNote = isMonthly
        ? `Persentase Penyerapan Belanja Kategori (Kumulatif s/d ${getMonthName(selectedMonthFilter as number)}): ${catPercentage.toFixed(2)}% dari total alokasi pagu rencana yang ditetapkan.`
        : `Persentase Penyerapan Belanja Kategori: ${catPercentage.toFixed(2)}% dari total alokasi pagu rencana yang ditetapkan.`;
      doc.text(catNote, 15, cardY + cardHeight + 6);

      y = cardY + cardHeight + 14;

      // Section II: Rincian Sub-item Belanja
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
      const secIITitle = isMonthly
        ? `II. RINCIAN ALOKASI DAN PENYERAPAN SUB-ITEM BULAN ${bName}`
        : "II. DETIL ALOKASI DAN PENYERAPAN SUB-ITEM BELANJA";
      doc.text(secIITitle, 15, y);
      y += 6;

      // Table Header for Sub-items
      doc.setFillColor(240, 242, 245);
      doc.rect(15, y, 180, 7, "F");
      doc.setDrawColor(210, 215, 220);
      doc.rect(15, y, 180, 7, "D");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(50, 60, 70);
      doc.text("Nama Sub-Item Rekening Belanja", 17, y + 5);
      doc.text("Alokasi Rencana (IDR)", 112, y + 5);
      const subItemSpentLabel = isMonthly ? `Realisasi ${getShortMonthName(selectedMonthFilter as number)} (IDR)` : "Realisasi (IDR)";
      const subItemSisaLabel = isMonthly ? "Sisa YTD (IDR)" : "Sisa (IDR)";
      doc.text(subItemSpentLabel, 142, y + 5);
      doc.text(subItemSisaLabel, 172, y + 5);
      y += 7;

      cat.items.forEach((item) => {
        if (y > 260) {
          doc.addPage();
          currentPage++;
          drawHeader(currentPage);
          y = 38;
        }

        const itemSpent = isMonthly
          ? transactions.filter(tx => tx.itemId === item.id && tx.month === selectedMonthFilter).reduce((sum, tx) => sum + tx.amount, 0)
          : calculateItemRealisasi(item.id, transactions);
        const itemCumulativeSpent = isMonthly
          ? transactions.filter(tx => tx.itemId === item.id && tx.month <= (selectedMonthFilter as number)).reduce((sum, tx) => sum + tx.amount, 0)
          : itemSpent;
        const itemSisa = item.rencana - itemCumulativeSpent;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);

        let sName = item.nama;
        if (sName.length > 55) {
          sName = sName.substring(0, 52) + "...";
        }

        doc.text(sName, 17, y + 5);
        doc.text(item.rencana.toLocaleString("id-ID"), 112, y + 5);
        doc.text(itemSpent.toLocaleString("id-ID"), 142, y + 5);
        doc.text(itemSisa.toLocaleString("id-ID"), 172, y + 5);

        doc.setDrawColor(240, 242, 245);
        doc.setLineWidth(0.1);
        doc.line(15, y + 7, 195, y + 7);

        y += 7;
      });

      y += 5;

      // Section III: Histori Kuitansi Realisasi Kategori
      if (y > 240) {
        doc.addPage();
        currentPage++;
        drawHeader(currentPage);
        y = 38;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
      const secIIITitle = isMonthly
        ? `III. HISTORI KUITANSI REALISASI KATEGORI BULAN ${bName}`
        : "III. HISTORI KHUSUS BUKTI KUITANSI REALISASI KATEGORI";
      doc.text(secIIITitle, 15, y);
      y += 6;

      // Table Header for Transactions
      doc.setFillColor(240, 242, 245);
      doc.rect(15, y, 180, 7, "F");
      doc.setDrawColor(210, 215, 220);
      doc.rect(15, y, 180, 7, "D");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(50, 60, 70);
      doc.text("Tanggal", 17, y + 5);
      doc.text("Sub-item Anggaran", 38, y + 5);
      doc.text("Uraian / Keterangan Kuitansi", 98, y + 5);
      doc.text("Nominal (IDR)", 168, y + 5);
      y += 7;

      const catTransactions = transactions.filter((tx) => tx.categoryId === cat.id && (selectedMonthFilter === "all" || tx.month === selectedMonthFilter));

      if (catTransactions.length === 0) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8);
        const emptyLabel = isMonthly
          ? `Belum ada bukti kuitansi realisasi yang direkam untuk kategori belanja ini di bulan ${getMonthName(selectedMonthFilter as number)}.`
          : "Belum ada bukti kuitansi realisasi yang direkam untuk kategori belanja ini.";
        doc.text(emptyLabel, 17, y + 5);
        y += 7;
      } else {
        catTransactions.forEach((tx) => {
          if (y > 265) {
            doc.addPage();
            currentPage++;
            drawHeader(currentPage);

            y = 38;
            doc.setFillColor(240, 242, 245);
            doc.rect(15, y, 180, 7, "F");
            doc.setDrawColor(210, 215, 220);
            doc.rect(15, y, 180, 7, "D");

            doc.setFont("helvetica", "bold");
            doc.setFontSize(7.5);
            doc.setTextColor(50, 60, 70);
            doc.text("Tanggal", 17, y + 5);
            doc.text("Sub-item Anggaran", 38, y + 5);
            doc.text("Uraian / Keterangan Kuitansi", 98, y + 5);
            doc.text("Nominal (IDR)", 168, y + 5);
            y += 7;
          }

          doc.setFont("helvetica", "normal");
          doc.setFontSize(7);
          doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);

          const subItemName = cat.items.find((i) => i.id === tx.itemId)?.nama || "Lainnya";

          let shortSub = subItemName;
          if (shortSub.length > 38) {
            shortSub = shortSub.substring(0, 36) + "...";
          }

          let shortDesc = tx.description;
          if (shortDesc.length > 55) {
            shortDesc = shortDesc.substring(0, 52) + "...";
          }

          doc.text(tx.date, 17, y + 5);
          doc.text(shortSub, 38, y + 5);
          doc.text(shortDesc, 98, y + 5);

          doc.setFont("helvetica", "bold");
          doc.text(tx.amount.toLocaleString("id-ID"), 168, y + 5);
          doc.setFont("helvetica", "normal");

          doc.setDrawColor(245, 247, 250);
          doc.setLineWidth(0.1);
          doc.line(15, y + 7, 195, y + 7);

          y += 7;
        });
      }

      // Legal Signatures Section
      if (y > 220) {
        doc.addPage();
        currentPage++;
        drawHeader(currentPage);
        y = 38;
      }

      y += 10;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);

      const sigPlace = "Tarakan, " + new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
      doc.text(sigPlace, 140, y);
      y += 5;

      doc.text("Disetujui Oleh,", 15, y);
      doc.text("Dibuat Oleh,", 140, y);

      y += 4;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.text("Kuasa Pengguna Anggaran (KPA)", 15, y);
      doc.text("Bendahara Pengeluaran RSUD", 140, y);

      y += 18;

      doc.setFont("helvetica", "bold");
      doc.setTextColor(21, 32, 48);
      doc.text("dr. Rustan Samsuddin, M.M.", 15, y);
      doc.text("Meidi Priandana, S.Sos,.M.Si", 140, y);

      y += 4;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 110, 120);
      doc.text("NIP. 19781203 200501 1 002", 15, y);
      doc.text("NIP. 19890522 201503 1 005", 140, y);

      const fn = isMonthly ? `Laporan_APBD_Kategori_${cat.id.toUpperCase()}_Bulan_${bName}_2026.pdf` : `Laporan_APBD_Kategori_${cat.id.toUpperCase()}_2026.pdf`;
      doc.save(fn);
      showToast(`Berhasil mengunduh Laporan Kategori ${cat.nama} ${isMonthly ? "Bulan " + getMonthName(selectedMonthFilter as number) : ""}!`, "success");

    } catch (e: any) {
      console.error(e);
      showToast("Gagal memproses pembuatan laporan PDF kategori.", "warn");
    }
  };

  // --- SNAPSHOT DASHBOARD EXPORTER ---
  const handleDashboardSnapshot = async (format: "png" | "jpeg" = "png") => {
    if (isCapturing) return;
    setIsCapturing(true);

    const originalTab = activeTab;
    let switched = false;

    // Switch to Overview if not active
    if (activeTab !== "monitoring") {
      setActiveTab("monitoring");
      switched = true;
      showToast("Beralih ke tab Overview untuk mengambil gambar snapshot...", "info");
      // Give enough milliseconds for React render and styles loading
      await new Promise((resolve) => setTimeout(resolve, 400));
    } else {
      showToast("Sedang mengambil gambar snapshot dashboard...", "info");
    }

    const node = document.getElementById("dashboard-capture-container");
    if (!node) {
      showToast("Gagal menemukan elemen dashboard untuk snapshot", "warn");
      setIsCapturing(false);
      return;
    }

    try {
      const bg = theme === "light" ? "#f1f5f9" : theme === "navy" ? "#050c1e" : theme === "contrast" ? "#000000" : "#02040a";
      const options = {
        backgroundColor: bg,
        quality: 0.95,
        style: {
          borderRadius: "24px",
          padding: "16px",
        },
      };

      const dataUrl = format === "png" 
        ? await toPng(node, options) 
        : await toJpeg(node, options);

      // Restore active tab to original
      if (switched) {
        setActiveTab(originalTab);
      }

      // Download file
      const link = document.createElement("a");
      const cleanDate = new Date().toISOString().split("T")[0];
      link.download = `Snapshot_Overview_Dashboard_${cleanDate}.${format}`;
      link.href = dataUrl;
      link.click();

      showToast(`Snapshot berhasil diunduh sebagai ${format.toUpperCase()}!`, "success");
    } catch (err) {
      console.error("Gagal mengambil gambar snapshot:", err);
      showToast("Gagal mengunduh gambar snapshot dashboard", "warn");
      
      if (switched) {
        setActiveTab(originalTab);
      }
    } finally {
      setIsCapturing(false);
    }
  };

  // Switch Tab Icons Helper
  const getTabIcon = (id: string) => {
    switch (id) {
      case "makan-minum": return Utensils;
      case "honorarium": return Medal;
      case "kontribusi": return FileSpreadsheet;
      case "perjadin": return Plane;
      case "barang-habis": return FileText;
      default: return LayoutDashboard;
    }
  };

  // Selected Category Workspace Context (if not monitoring)
  const categoryWorkspace = useMemo(() => {
    if (activeTab === "monitoring") return null;
    return categories.find((c) => c.id === activeTab) || null;
  }, [activeTab, categories]);

  // Transactions specific to currently active Tab Kategori and chosen month
  const filteredTransactions = useMemo(() => {
    let list = transactions;
    if (activeTab !== "monitoring") {
      list = list.filter(tx => tx.categoryId === activeTab);
    }
    if (selectedMonthFilter !== "all") {
      list = list.filter(tx => tx.month === selectedMonthFilter);
    }
    return list;
  }, [transactions, activeTab, selectedMonthFilter]);

  return (
    <div id="app_root" className={`min-h-screen font-sans antialiased relative overflow-x-hidden transition-colors duration-300 ${themeClasses.root}`}>
      
      {/* ATMOSPHERIC BACKGROUND GLOWS - IMMERSIVE UI */}
      <div className={`absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] pointer-events-none transition-all duration-500 ${isLight ? 'bg-indigo-300/15' : isNavy ? 'bg-indigo-900/15' : 'bg-indigo-900/20'}`}></div>
      <div className={`absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] pointer-events-none transition-all duration-500 ${isLight ? 'bg-purple-300/10' : isNavy ? 'bg-purple-900/15' : 'bg-purple-900/20'}`}></div>

      <div className="p-3 md:p-8 relative z-10 max-w-[1780px] xl:max-w-[1855px] mx-auto space-y-6 md:space-y-8">
        
        {/* --- SYSTEM NOTIFICATION TOAST --- */}
        {toastMessage && (
          <div 
            className={`fixed top-6 right-6 z-[999] flex items-center gap-3 px-5 py-4 rounded-2xl border shadow-2xl transition-all duration-300 animate-in slide-in-from-top-4 ${
              toastMessage.type === "success" 
                ? "bg-emerald-950/80 border-emerald-500/30 text-emerald-300 backdrop-blur-md"
                : toastMessage.type === "warn"
                ? "bg-rose-950/80 border-rose-500/30 text-rose-300 backdrop-blur-md"
                : "bg-slate-900/85 border-indigo-500/30 text-indigo-300 backdrop-blur-md"
            }`}
          >
            {toastMessage.type === "success" && <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />}
            {toastMessage.type === "warn" && <AlertTriangle size={18} className="text-rose-400 shrink-0" />}
            {toastMessage.type === "info" && <CircleAlert size={18} className="text-indigo-400 shrink-0" />}
            <span className="text-sm font-medium tracking-wide">{toastMessage.text}</span>
          </div>
        )}

        {/* --- GOOGLE WORKSPACE SYSTEM DESKTOP INTELLIGENCE COUPLING --- */}
        <section className={`backdrop-blur-xl p-6 rounded-[32px] shadow-xl border transition-all duration-300 relative overflow-hidden ${
          isLight 
            ? 'bg-white border-slate-200' 
            : isDark 
            ? 'bg-[#060a16]/90 border-indigo-500/10' 
            : 'bg-[#080f25]/90 border-blue-500/10'
        }`}>
          {/* Subtle backgrounds */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/5 rounded-full blur-[48px] pointer-events-none"></div>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
            <div className="space-y-2 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${
                  isGoogleLinked 
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                    : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isGoogleLinked ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
                  {isGoogleLinked ? 'Cloud Sync Active' : 'Cloud Sync Offline'}
                </span>
                
                {isGoogleLinked && getCachedToken() && (
                  <span className="text-[10px] font-bold bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-2.5 py-1 rounded-full uppercase tracking-wider">
                    Sesi Google Drive & Sheets Terhubung
                  </span>
                )}
              </div>

              <h2 className={`text-md md:text-lg font-bold tracking-tight ${themeClasses.textWhite}`}>
                Integrasi Cloud Google Drive & Google Sheets
              </h2>

              <p className="text-xs text-slate-400 leading-relaxed max-w-xl">
                {isGoogleLinked 
                  ? "Sistem APBD RSUD terhubung dengan Google Workspace. Data Pagu dan rincian transaksi belanja secara otomatis disinkronkan langsung ke Spreadsheet & kuitansi pendukung diunggah ke Google Drive."
                  : "Hubungkan dengan Akun Kemenkeu/RSUD Google Workspace untuk merekam lampiran bukti PDF langsung ke Google Drive dan melakukan sinkronisasi database dinamis secara real-time ke Google Sheets."
                }
              </p>

              {/* Destination folder / sheet ids representation */}
              <div className="pt-2 flex flex-col md:flex-row gap-3 text-[11px] text-slate-400 font-mono">
                <div className={`p-2.5 rounded-xl flex items-center gap-2 border flex-1 ${isLight ? 'bg-slate-50 border-slate-100 text-slate-600' : 'bg-white/[0.02] border-white/5'}`}>
                  <FileSpreadsheet size={14} className="text-emerald-500 shrink-0" />
                  <span className="font-bold uppercase tracking-wider shrink-0 text-[9px] text-slate-500">Sheet:</span>
                  <a 
                    href={`https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`} 
                    target="_blank" 
                    referrerPolicy="no-referrer"
                    className="truncate hover:underline text-[#818cf8]"
                  >
                    {SPREADSHEET_ID}
                  </a>
                  <ExternalLink size={10} className="text-slate-500 shrink-0" />
                </div>

                <div className={`p-2.5 rounded-xl flex items-center gap-2 border flex-1 ${isLight ? 'bg-slate-50 border-slate-100 text-slate-600' : 'bg-white/[0.02] border-white/5'}`}>
                  <FolderOpen size={14} className="text-indigo-400 shrink-0" />
                  <span className="font-bold uppercase tracking-wider shrink-0 text-[9px] text-slate-500">Folder:</span>
                  <a 
                    href={`https://drive.google.com/drive/folders/${FOLDER_ID}`} 
                    target="_blank" 
                    referrerPolicy="no-referrer"
                    className="truncate hover:underline text-[#818cf8]"
                  >
                    {FOLDER_ID}
                  </a>
                  <ExternalLink size={10} className="text-slate-500 shrink-0" />
                </div>
              </div>
            </div>

            {/* Sync Controls buttons */}
            <div className="flex flex-col sm:flex-row items-stretch lg:items-center gap-3">
              {isGoogleLinked ? (
                <>
                  <div className="flex flex-col gap-1 text-right mr-2 justify-center">
                    <span className={`text-[10px] font-black uppercase tracking-wider ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                      {googleUser?.email || "Operator Terhubung"}
                    </span>
                    <span className="text-[9px] text-emerald-400 font-bold uppercase">Auto-Saved to Cloud</span>
                  </div>

                  <button
                    onClick={loadFromSheets}
                    disabled={isGoogleSyncLoading}
                    className={`px-4 py-2.5 rounded-xl text-xs font-bold tracking-wider border flex items-center justify-center gap-2 cursor-pointer transition-all ${
                      isLight 
                        ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700' 
                        : 'bg-white/5 hover:bg-white/10 border-white/10 text-white'
                    }`}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isGoogleSyncLoading ? 'animate-spin text-indigo-400' : ''}`} />
                    Tarik Data Sheets
                  </button>

                  <button
                    onClick={handleGoogleLogout}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold tracking-wider bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 flex items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Putus Tautan
                  </button>
                </>
              ) : (
                <button
                  onClick={handleGoogleLogin}
                  disabled={isGoogleSyncLoading}
                  className="px-5 py-3 cursor-pointer rounded-xl text-xs font-black tracking-wide bg-[#818cf8] hover:bg-indigo-600 text-white flex items-center justify-center gap-3 shadow-lg shadow-indigo-500/20 transition-all hover:-translate-y-0.5"
                >
                  {isGoogleSyncLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <Globe className="w-4 h-4 text-white" />
                  )}
                  <span>OTORISASI GOOGLE CLOUD SYNC</span>
                </button>
              )}
            </div>
          </div>
        </section>

        {/* --- HEADER --- */}
        <header className={`flex flex-col lg:flex-row lg:items-center justify-between gap-6 backdrop-blur-xl p-6 md:p-8 rounded-[32px] md:rounded-[40px] shadow-2xl transition-all duration-300 ${themeClasses.header}`}>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3 md:gap-4">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-600/30 transition-transform hover:scale-105 duration-300">
                <LayoutDashboard className="w-5 h-5 md:w-6 md:h-6" strokeWidth={2} />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <h1 className={`text-lg md:text-2xl font-extrabold tracking-tight transition-colors duration-300 ${themeClasses.textWhite}`}>APBD RSUD dr. H. JUSUF SK</h1>
                  <span className="text-xs bg-indigo-500/10 text-indigo-400 font-bold px-2.5 py-1 rounded-full border border-indigo-500/20 uppercase tracking-wider">
                    DPA 2026
                  </span>
                </div>
                <p className={`text-xs md:text-sm font-medium transition-colors duration-300 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  Sistem Informasi & Realisasi Anggaran Peningkatan Kompetensi SDM
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium border-l-2 border-indigo-500 pl-3">
              <span>Provinsi Kalimantan Utara</span>
              <span>•</span>
              <span>Total Alokasi RKA Rp 2.093.974.768</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* THEME SELECTOR CONTROLS */}
            <div className={`p-1 flex flex-wrap items-center gap-1 rounded-2xl border transition-all duration-300 ${isLight ? 'bg-slate-100 border-slate-200' : isNavy ? 'bg-[#030917] border-[#1b325c]' : 'bg-white/5 border-white/10'}`}>
              <button
                onClick={() => { setThemeSetting("system"); showToast("Tema otomatis mengikuti preferensi sistem", "info"); }}
                className={`px-2.5 py-1.5 rounded-xl text-[10px] font-bold uppercase transition-all flex items-center gap-1 cursor-pointer ${
                  themeSetting === "system"
                    ? isLight
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-indigo-600/30 text-indigo-300 border border-indigo-500/35 animate-pulse"
                    : isLight ? "text-slate-550 hover:text-slate-900" : "text-slate-400 hover:text-white"
                }`}
                title="Otomatis mengikuti preferensi sistem (System Default)"
              >
                <span>💻 Auto</span>
              </button>
              <button
                onClick={() => { setThemeSetting("light"); showToast("Beralih ke Kemenkeu Light Mode", "info"); }}
                className={`px-2.5 py-1.5 rounded-xl text-[10px] font-bold uppercase transition-all flex items-center gap-1 cursor-pointer ${
                  themeSetting === "light"
                    ? "bg-white text-indigo-600 shadow-sm border border-slate-200"
                    : isLight ? "text-slate-550 hover:text-slate-900" : "text-slate-400 hover:text-white"
                }`}
                title="Mode Terang (Light Mode)"
              >
                <span>☀️ Terang</span>
              </button>
              <button
                onClick={() => { setThemeSetting("dark"); showToast("Beralih ke Cosmic Dark Mode", "info"); }}
                className={`px-2.5 py-1.5 rounded-xl text-[10px] font-bold uppercase transition-all flex items-center gap-1 cursor-pointer ${
                  themeSetting === "dark"
                    ? "bg-indigo-600/20 text-[#818cf8] border border-indigo-500/35 shadow-sm"
                    : isLight ? "text-slate-550 hover:text-slate-900" : "text-slate-400 hover:text-white"
                }`}
                title="Mode Cosmic (Dark Mode)"
              >
                <span>🌙 Gelap</span>
              </button>
              <button
                onClick={() => { setThemeSetting("navy"); showToast("Beralih ke Royal Navy Mode", "info"); }}
                className={`px-2.5 py-1.5 rounded-xl text-[10px] font-bold uppercase transition-all flex items-center gap-1 cursor-pointer ${
                  themeSetting === "navy"
                    ? "bg-indigo-600/30 text-indigo-300 border border-indigo-500/35"
                    : isLight ? "text-slate-550 hover:text-slate-900" : "text-slate-400 hover:text-white"
                }`}
                title="Mode Samudra Biru (Royal Navy)"
              >
                <span>🌌 Navy</span>
              </button>
              <button
                onClick={() => { setThemeSetting("contrast"); showToast("Beralih ke Presentasi Kontras Tinggi (High Contrast Mode)", "info"); }}
                className={`px-2.5 py-1.5 rounded-xl text-[10px] font-bold uppercase transition-all flex items-center gap-1 cursor-pointer ${
                  themeSetting === "contrast"
                    ? "bg-white text-black border-2 border-black font-black"
                    : isLight ? "text-slate-550 hover:text-slate-900" : "text-slate-400 hover:text-white"
                }`}
                title="Presentasi Kontras Tinggi (High Contrast)"
              >
                <span>⚡ Kontras</span>
              </button>
            </div>

            {/* MONTH FILTER DROP-DOWN */}
            <div className="flex items-center gap-1.5">
              <span className={`text-[10px] font-bold uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Periode:</span>
              <select
                id="monthSelectorDropDown"
                value={selectedMonthFilter}
                onChange={(e) => {
                  const val = e.target.value;
                  const filterVal = val === "all" ? "all" : parseInt(val, 10);
                  setSelectedMonthFilter(filterVal);
                  showToast(val === "all" ? "Menampilkan data akumulatif (Semua Bulan)" : `Filter data aktif: Bulan ${getMonthName(filterVal as number)}`, "info");
                }}
                className={`px-3 py-2.5 rounded-xl text-xs font-bold tracking-wide border cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all ${
                  isLight 
                    ? 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50' 
                    : isNavy 
                      ? 'bg-[#091125] border-[#1b325c] text-indigo-100 hover:bg-[#030917]' 
                      : 'bg-white/5 border-white/10 text-slate-100 hover:bg-white/10'
                }`}
              >
                <option value="all" className={isLight ? "bg-white text-slate-800" : isNavy ? "bg-[#091125] text-indigo-100" : isContrast ? "bg-black text-white font-bold" : "bg-[#02040a] text-slate-100"}>Semua Bulan (Accumulated)</option>
                <option value="1" className={isLight ? "bg-white text-slate-800" : isNavy ? "bg-[#091125] text-indigo-100" : isContrast ? "bg-black text-white font-bold" : "bg-[#02040a] text-slate-100"}>Januari (01)</option>
                <option value="2" className={isLight ? "bg-white text-slate-800" : isNavy ? "bg-[#091125] text-indigo-100" : isContrast ? "bg-black text-white font-bold" : "bg-[#02040a] text-slate-100"}>Februari (02)</option>
                <option value="3" className={isLight ? "bg-white text-slate-800" : isNavy ? "bg-[#091125] text-indigo-100" : isContrast ? "bg-black text-white font-bold" : "bg-[#02040a] text-slate-100"}>Maret (03)</option>
                <option value="4" className={isLight ? "bg-white text-slate-800" : isNavy ? "bg-[#091125] text-indigo-100" : isContrast ? "bg-black text-white font-bold" : "bg-[#02040a] text-slate-100"}>April (04)</option>
                <option value="5" className={isLight ? "bg-white text-slate-800" : isNavy ? "bg-[#091125] text-indigo-100" : isContrast ? "bg-black text-white font-bold" : "bg-[#02040a] text-slate-100"}>Mei (05)</option>
                <option value="6" className={isLight ? "bg-white text-slate-800" : isNavy ? "bg-[#091125] text-indigo-100" : isContrast ? "bg-black text-white font-bold" : "bg-[#02040a] text-slate-100"}>Juni (06)</option>
                <option value="7" className={isLight ? "bg-white text-slate-800" : isNavy ? "bg-[#091125] text-indigo-100" : isContrast ? "bg-black text-white font-bold" : "bg-[#02040a] text-slate-100"}>Juli (07)</option>
                <option value="8" className={isLight ? "bg-white text-slate-800" : isNavy ? "bg-[#091125] text-indigo-100" : isContrast ? "bg-black text-white font-bold" : "bg-[#02040a] text-slate-100"}>Agustus (08)</option>
                <option value="9" className={isLight ? "bg-white text-slate-800" : isNavy ? "bg-[#091125] text-indigo-100" : isContrast ? "bg-black text-white font-bold" : "bg-[#02040a] text-slate-100"}>September (09)</option>
                <option value="10" className={isLight ? "bg-white text-slate-800" : isNavy ? "bg-[#091125] text-indigo-100" : isContrast ? "bg-black text-white font-bold" : "bg-[#02040a] text-slate-100"}>Oktober (10)</option>
                <option value="11" className={isLight ? "bg-white text-slate-800" : isNavy ? "bg-[#091125] text-indigo-100" : isContrast ? "bg-black text-white font-bold" : "bg-[#02040a] text-slate-100"}>November (11)</option>
                <option value="12" className={isLight ? "bg-white text-slate-800" : isNavy ? "bg-[#091125] text-indigo-100" : isContrast ? "bg-black text-white font-bold" : "bg-[#02040a] text-slate-100"}>Desember (12)</option>
              </select>
            </div>

            <button
              onClick={handleExportCSV}
              className={`px-4 py-3 rounded-2xl text-xs font-semibold tracking-wider transition-all flex items-center gap-2 cursor-pointer ${isLight ? 'bg-indigo-150 border border-indigo-250 text-indigo-750 hover:bg-indigo-200' : 'bg-indigo-600/10 border border-indigo-500/20 hover:bg-indigo-600/20 text-indigo-300'}`}
            >
              <Download size={14} />
              <span>Download CSV</span>
            </button>

            {/* --- SNAPSHOT DASHBOARD TOGGLE BUTTON WITH PNG/JPEG DROP MENU --- */}
            <div className="relative group/snapshot">
              <button
                disabled={isCapturing}
                onClick={() => handleDashboardSnapshot("png")}
                className={`px-4 py-3 rounded-2xl text-xs font-semibold tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
                  isLight 
                    ? 'bg-emerald-100 border border-emerald-300 text-emerald-800 hover:bg-emerald-200' 
                    : 'bg-emerald-950/20 border border-emerald-500/20 hover:bg-emerald-950/40 text-emerald-300'
                } ${isCapturing ? 'opacity-60 cursor-not-allowed animate-pulse' : ''}`}
                title="Ekspor gambar Dashboard (Klik langsung untuk unduh format PNG)"
              >
                <Camera size={14} className={isCapturing ? 'animate-spin' : ''} />
                <span>{isCapturing ? 'Mengekspor...' : 'Snapshot Dashboard'}</span>
              </button>
              
              {!isCapturing && (
                <div className={`absolute left-0 sm:right-0 sm:left-auto top-full mt-2 hidden group-hover/snapshot:flex flex-col rounded-xl border shadow-2xl z-50 overflow-hidden text-[11px] font-bold tracking-wide transition-all min-w-[130px] ${
                  isLight ? 'bg-white border-slate-200 text-slate-755 text-slate-700' : 'bg-[#0a0f1d] border-white/10 text-slate-350'
                }`}>
                  <button 
                    type="button"
                    onClick={() => handleDashboardSnapshot("png")}
                    className={`px-3 py-2 text-left transition-colors cursor-pointer w-full text-emerald-600 hover:bg-emerald-500/5`}
                  >
                    Ekspor Gambar PNG
                  </button>
                  <button 
                    type="button"
                    onClick={() => handleDashboardSnapshot("jpeg")}
                    className={`px-3 py-2 text-left border-t transition-colors cursor-pointer w-full ${
                      isLight ? 'border-slate-100 hover:bg-indigo-50/50 text-indigo-600' : 'border-white/5 hover:bg-indigo-500/5 text-indigo-400'
                    }`}
                  >
                    Ekspor Gambar JPEG
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={() => {
                if (activeTab === "monitoring") {
                  handleExportPDF();
                } else if (categoryWorkspace) {
                  handleExportCategoryPDF(categoryWorkspace);
                }
              }}
              className={`px-4 py-3 rounded-2xl text-xs font-semibold tracking-wider transition-all flex items-center gap-2 cursor-pointer ${isLight ? 'bg-rose-100 border border-rose-300 text-rose-800 hover:bg-rose-200' : 'bg-rose-950/20 border border-rose-500/20 hover:bg-rose-950/40 text-rose-300'}`}
            >
              <FileText size={14} />
              <span>
                {activeTab === "monitoring" 
                  ? (selectedMonthFilter === "all" ? "Laporan PDF" : `Laporan PDF (${getShortMonthName(selectedMonthFilter)})`) 
                  : (selectedMonthFilter === "all" ? "Laporan PDF Kategori" : `Laporan PDF Kat. (${getShortMonthName(selectedMonthFilter)})`)
                }
              </span>
            </button>
            <button
              onClick={handleOpenAddTx}
              className={`px-6 py-3 font-bold text-xs rounded-2xl shadow-lg tracking-wider transition-all flex items-center gap-2 cursor-pointer ${themeClasses.buttonAddTx}`}
            >
              <Plus size={16} />
              <span>Rekam Realisasi</span>
            </button>
          </div>
        </header>

        {/* --- NAVIGATION BARS & STATUS COUNTERS --- */}
        <section className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <nav className={`flex items-center gap-2 p-1.5 backdrop-blur-xl rounded-3xl overflow-x-auto no-scrollbar shadow-lg grow transition-all duration-300 ${themeClasses.pillNav}`}>
            <button
              onClick={() => setActiveTab("monitoring")}
              className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all shrink-0 cursor-pointer ${
                activeTab === "monitoring"
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 border border-white/10 scale-[1.02]"
                  : `${isLight ? 'text-slate-650 hover:text-slate-900 hover:bg-white/50' : 'text-slate-400 hover:text-white hover:bg-white/5'}`
              }`}
            >
              <LayoutDashboard size={14} />
              <span>Overview</span>
            </button>

            {categories.map((cat) => {
              const TabIcon = getTabIcon(cat.id);
              const totalCatSpent = calculateCategoryRealisasi(cat.id, transactions);
              const totalCatRenc = calculateCategoryRencana(cat);
              const catPct = totalCatRenc > 0 ? (totalCatSpent / totalCatRenc) * 100 : 0;

              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveTab(cat.id)}
                  className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all shrink-0 cursor-pointer ${
                    activeTab === cat.id
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 border border-white/10 scale-[1.02]"
                      : `${isLight ? 'text-slate-650 hover:text-slate-900 hover:bg-white/50' : 'text-slate-400 hover:text-white hover:bg-white/5'}`
                  }`}
                >
                  <TabIcon size={14} />
                  <span className="hidden md:inline">{cat.nama.replace("Belanja ", "").split(" - ")[0]}</span>
                  <span className="md:hidden">{cat.nama.replace("Belanja ", "").substr(0, 8)}..</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${catPct > 100 ? 'bg-rose-500 text-white' : isLight ? 'bg-indigo-50 text-indigo-600' : 'bg-white/10 text-indigo-300'}`}>
                    {catPct.toFixed(0)}%
                  </span>
                </button>
              );
            })}
          </nav>

          {/* WARNING THRESHOLD CLASSIFIER */}
          <div className={`flex items-center gap-2 justify-end self-end xl:self-auto p-1.5 rounded-2xl shadow-md transition-all duration-300 ${themeClasses.panel}`}>
            <span className="text-[10px] uppercase font-black tracking-widest text-slate-500 px-2">Kondisi:</span>
            <button
              onClick={() => setWarningFilter("all")}
              className={`px-3 py-2 rounded-xl text-[10px] font-bold uppercase transition-all cursor-pointer ${
                warningFilter === "all" ? (isLight ? "bg-indigo-50 border border-indigo-200/50 text-indigo-600 shadow-sm" : isNavy ? "bg-indigo-900/30 border border-indigo-500/20 text-indigo-300" : "bg-white/10 text-indigo-300 border border-white/10 shadow-sm") : "text-slate-500 hover:text-slate-350"
              }`}
            >
              Semua ({checkedItemsWithStats.length})
            </button>
            <button
              onClick={() => setWarningFilter("warning")}
              className={`px-3 py-2 rounded-xl text-[10px] font-bold uppercase transition-all flex items-center gap-1.5 cursor-pointer ${
                warningFilter === "warning" ? "bg-amber-500/20 text-amber-500 border border-amber-500/30" : "text-slate-500 hover:text-slate-350"
              }`}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400"></div>
              <span>Warning ({statsThreshold.warning})</span>
            </button>
            <button
              onClick={() => setWarningFilter("over")}
              className={`px-3 py-2 rounded-xl text-[10px] font-bold uppercase transition-all flex items-center gap-1.5 cursor-pointer ${
                warningFilter === "over" ? "bg-rose-500/20 text-rose-500 border border-rose-500/30" : "text-slate-500 hover:text-slate-350"
              }`}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-rose-400"></div>
              <span>Over ({statsThreshold.over})</span>
            </button>
          </div>
        </section>

        <div id="dashboard-capture-container" className="space-y-6 md:space-y-8 p-1">
          {/* --- MAIN STATISTICS GAUGES (Bento Layout) --- */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* CORE STAT: TOTAL EXPENDITURES VS TOTAL PLANS */}
          <div className={`rounded-[32px] p-6 md:p-8 lg:col-span-2 relative overflow-hidden shadow-2xl flex flex-col justify-between group transition-all duration-300 ${themeClasses.cardGradient}`}>
            <div className="absolute top-0 right-0 p-6 pointer-events-none">
              <TrendingUp className="text-indigo-400/10 w-32 h-32 transform translate-x-4 translate-y-2 group-hover:scale-105 transition-transform duration-700" />
            </div>

            <div className="relative z-10 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-[10px] uppercase font-black tracking-widest mb-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>TOTAL ANGGARAN APBD DIKELOLA</p>
                  <h3 className={`text-3xl md:text-5xl font-light tracking-tight mb-2 font-sans transition-colors duration-300 ${themeClasses.textWhite}`}>
                    {formatCurrency(totalAnggaran)}
                  </h3>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest block mb-1">TINGKAT ABSORPSI</span>
                  <span className={`text-2xl md:text-3xl font-extrabold tracking-tight ${persentaseRealisasi > 100 ? 'text-rose-450 text-rose-500' : 'text-indigo-450 text-indigo-500'}`}>
                    {persentaseRealisasi.toFixed(2)}%
                  </span>
                </div>
              </div>

              {/* TWO COLUMN DETAIL */}
              <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-6 ${themeClasses.borderWhite5Or10}`}>
                <div className={`p-4 rounded-2xl border flex items-center gap-4 transition-colors ${isLight ? 'bg-white border-slate-200/80 hover:border-slate-350' : 'bg-white/5 border-white/5 hover:border-white/10'}`}>
                  <div className="w-10 h-10 bg-indigo-500/10 text-indigo-500 rounded-xl flex items-center justify-center shrink-0">
                    <Wallet size={16} />
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 uppercase font-bold block mb-0.5 font-sans">Realisasi (Terpakai)</span>
                    <span className={`text-base font-bold transition-colors ${themeClasses.textSlate100}`}>{formatCurrency(totalRealisasi)}</span>
                  </div>
                </div>

                <div className={`p-4 rounded-2xl border flex items-center gap-4 transition-colors ${isLight ? 'bg-white border-slate-200/80 hover:border-slate-350' : 'bg-white/5 border-white/5 hover:border-white/10'}`}>
                  <div className="w-10 h-10 bg-emerald-500/10 text-emerald-500 rounded-xl flex items-center justify-center shrink-0">
                    <CheckCircle2 size={16} />
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 uppercase font-bold block mb-0.5 font-sans">Sisa Anggaran Tersedia</span>
                    <span className="text-base font-bold text-emerald-500 font-mono">{formatCurrency(totalSisa)}</span>
                  </div>
                </div>
              </div>

              {/* Progress Slider */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className={`font-semibold ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>{persentaseRealisasi.toFixed(1)}% Realized</span>
                  <span className={`font-semibold ${isLight ? 'text-slate-650' : 'text-slate-400'}`}>Sisa: {((totalSisa / totalAnggaran) * 100).toFixed(1)}%</span>
                </div>
                <div className={`w-full rounded-full h-2.5 overflow-hidden border ${isLight ? 'bg-slate-250 bg-slate-200 border-slate-300' : 'bg-slate-900 border-white/5'}`}>
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_8px_rgba(99,102,241,0.5)] ${
                      persentaseRealisasi > 100 
                        ? 'bg-gradient-to-r from-rose-500 to-rose-450'
                        : 'bg-gradient-to-r from-indigo-500 to-purple-500'
                    }`}
                    style={{ width: `${Math.min(100, persentaseRealisasi)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          {/* CIRCLE RADIAL ABSORPTION WHEEL */}
          <div className={`backdrop-blur-xl p-6 md:p-8 rounded-[32px] flex flex-col justify-between items-center text-center relative overflow-hidden shadow-xl transition-all duration-300 ${themeClasses.header}`}>
            <div className="space-y-1">
              <span className={`text-[10px] uppercase font-black tracking-widest block ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>PROPORSI PENYERAPAN</span>
              <p className="text-xs text-slate-500 leading-relaxed">Persentase dana yang sudah tersalurkan</p>
            </div>

            {/* SVG DONUT CHART */}
            <div className="relative w-44 h-44 flex items-center justify-center my-4">
              <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90 animate-in spin-in-12 duration-1000">
                {/* Underlay bottom circle */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                  stroke={isLight ? "rgba(0, 0, 0, 0.05)" : "rgba(255, 255, 255, 0.03)"}
                  strokeWidth="11"
                />
                
                {/* Glowing colored ring */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                  stroke={persentaseRealisasi > 100 ? "#f43f5e" : "#6366f1"}
                  strokeWidth="11"
                  strokeDasharray={`${2 * Math.PI * 40}`}
                  strokeDashoffset={`${(2 * Math.PI * 40) - (Math.min(100, persentaseRealisasi) / 100) * (2 * Math.PI * 40)}`}
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col justify-center items-center">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-0.5">Tingkat KPI</span>
                <span className={`text-3xl font-extrabold tracking-widest transition-colors duration-300 ${themeClasses.textWhite}`}>{persentaseRealisasi.toFixed(1)}%</span>
              </div>
            </div>

            <div className="flex gap-4 w-full justify-center">
              <div className="flex items-center gap-1.5 text-xs">
                <div className="w-2.5 h-2.5 rounded bg-indigo-500 shadow-sm shadow-indigo-500/40"></div>
                <span className={`text-[10px] font-bold uppercase tracking-widest ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Realisasi</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <div className={`w-2.5 h-2.5 rounded ${isLight ? 'bg-slate-200' : 'bg-white/10'}`}></div>
                <span className={`text-[10px] font-bold uppercase tracking-widest ${isLight ? 'text-slate-650' : 'text-slate-400'}`}>Sisa Budget</span>
              </div>
            </div>
          </div>

        </section>

        {/* --- DYNAMIC MONTHLY ABSORPTION HISTORY VERTICAL GRAPH (Pure SVG/HTML) --- */}
        {activeTab === "monitoring" && (
          <section className={`backdrop-blur-xl p-6 md:p-8 rounded-[32px] space-y-6 shadow-xl transition-all duration-300 ${themeClasses.header}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h3 className={`text-lg font-bold flex items-center gap-2 transition-colors duration-300 ${themeClasses.textWhite}`}>
                  <Calendar className="text-[#818cf8]" size={18} />
                  <span>Tren Grafik Serapan Bulanan Tahun 2026</span>
                </h3>
                <p className="text-xs text-slate-500">Total nominal realisasi yang dibelanjakan setiap bulannya</p>
              </div>
              <div className={`text-[10px] font-bold uppercase tracking-wider transition-all px-3 py-1.5 rounded-full border ${isLight ? 'text-indigo-650 bg-indigo-50/80 border-indigo-200' : 'text-[#818cf8] bg-white/5 border-white/10'}`}>
                Maret Dominan (Pre-Seeded)
              </div>
            </div>

            {/* RESPONSIVE GRAPHICAL RECTANGLES */}
            <div className={`pt-4 pb-2 border-b ${themeClasses.borderWhite5Or10}`}>
              <div className="grid grid-cols-12 gap-2 md:gap-4 h-52 items-end">
                {monthlyRealisasiStats.map((amount, idx) => {
                  const mName = getShortMonthName(idx + 1);
                  const barHeightPct = Math.max(2, (amount / maxMonthValue) * 100);

                  return (
                    <div key={idx} className="group flex flex-col justify-end items-center h-full relative cursor-help">
                      
                      {/* Interactive Floating Hover Popover */}
                      <div className={`absolute bottom-full mb-3 hidden group-hover:block border p-2.5 rounded-xl text-center shadow-2xl z-30 pointer-events-none min-w-[124px] transition-all duration-200 ${isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-[#0e1222] border-white/10 text-white'}`}>
                        <p className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">{getMonthName(idx + 1)} 2026</p>
                        <p className={`text-xs font-black ${isLight ? 'text-indigo-600' : 'text-[#818cf8]'}`}>{formatCurrency(amount)}</p>
                      </div>

                      {/* Bar columns */}
                      <div className={`w-full rounded-t-lg grow relative overflow-hidden transition-all flex flex-col justify-end items-center border ${isLight ? 'bg-slate-50 border-slate-200/50 hover:bg-slate-100/50 hover:border-slate-350' : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.06] hover:border-white/10'}`}>
                        <div
                           className={`w-full rounded-t @theme transition-all duration-1000 ease-out relative ${
                            amount > 0 
                              ? "bg-gradient-to-t from-indigo-650 via-indigo-500 to-purple-400 shadow-[0_0_12px_rgba(99,102,241,0.3)]" 
                              : isLight ? "bg-slate-200/65" : "bg-white/5"
                          }`}
                          style={{ height: `${barHeightPct}%` }}
                        >
                          {amount > 0 && (
                            <div className="absolute top-1 left-0 right-0 h-1.5 bg-white/20 blur-[1px]"></div>
                          )}
                        </div>
                      </div>

                      {/* Label Month (Short name) */}
                      <span className="text-[9px] md:text-[11px] text-slate-500 font-bold uppercase tracking-wider mt-3 group-hover:text-indigo-600 transition-colors">
                        {mName}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs pt-2 font-medium">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded bg-gradient-to-tr from-indigo-500 to-purple-400 shrink-0 shadow-sm shadow-indigo-500/30"></span>
                <span className={`${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Bulan Berjalan (Terdapat Realisasi Rekaman)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded shrink-0 border ${isLight ? 'bg-slate-200 border-slate-300' : 'bg-white/10 border-white/5'}`}></span>
                <span className="text-slate-500">Belum Ada Pengeluaran Terdaftar</span>
              </div>
              <div className="text-right w-full md:col-span-1 hidden md:block text-slate-500">
                Puncak Pengeluaran: {formatCurrency(Math.max(...monthlyRealisasiStats))}
              </div>
            </div>
          </section>
        )}

        {/* --- DYNAMIC ANNUAL FORWARD PROJECTION CHART SECTION (Projected spent vs Remaining limit) --- */}
        {activeTab === "monitoring" && (
          <section className={`backdrop-blur-xl p-6 md:p-8 rounded-[32px] space-y-6 shadow-xl transition-all duration-300 ${themeClasses.header}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h3 className={`text-lg font-bold flex items-center gap-2 transition-colors duration-300 ${themeClasses.textWhite}`}>
                  <TrendingUp className="text-indigo-400" size={18} />
                  <span>Proyeksi & Analisis Sisa Tahun Anggaran 2026</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Estimasi real-time tren belanja dan penyerapan dana dari Juni s/d Desember 2026
                </p>
              </div>
              <div className="flex items-center gap-2">
                {projectionData.runoutMonthName ? (
                  <span className="text-[10px] uppercase font-black tracking-widest px-3 py-1.5 rounded-full border bg-rose-500/10 border-rose-500/20 text-rose-450 flex items-center gap-1.5 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                    Pagu Kritis ({projectionData.runoutMonthName})
                  </span>
                ) : (
                  <span className="text-[10px] uppercase font-black tracking-widest px-3 py-1.5 rounded-full border bg-emerald-500/10 border-emerald-500/20 text-emerald-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    Kapasitas Anggaran Aman
                  </span>
                )}
              </div>
            </div>

            {/* CARDS INFORMATION GRID */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Card 1: Slope direction */}
              <div className={`p-4 rounded-2xl border transition-all duration-350 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/[0.02] border-white/5'}`}>
                <span className="text-[9px] uppercase font-black tracking-wider text-slate-500 block mb-1">Arah Tren Belanja (Regresi Linier)</span>
                <div className="flex items-center gap-2">
                  {projectionData.slope > 0 ? (
                    <TrendingUp className="text-rose-400 shrink-0" size={20} />
                  ) : (
                    <TrendingUp className="text-emerald-400 shrink-0 rotate-180" size={20} />
                  )}
                  <span className={`text-sm md:text-md font-bold ${isLight ? 'text-slate-800' : 'text-slate-100'}`}>
                    {projectionData.slope > 0 ? "Meningkat" : "Menurun / Stabil"}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1 select-none">
                  {projectionData.slope > 0 
                    ? "Pengeluaran bulanan cenderung naik. Diperlukan efisiensi struktural RKA." 
                    : "Pola penyerapan terkendali dengan tren pengeluaran bulanan yang stabil."
                  }
                </p>
              </div>

              {/* Card 2: Projected Remaining spent */}
              <div className={`p-4 rounded-2xl border transition-all duration-350 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/[0.02] border-white/5'}`}>
                <span className="text-[9px] uppercase font-black tracking-wider text-slate-500 block mb-1">Total Proyeksi Belanja (Jun - Des)</span>
                <div className="flex items-center gap-1">
                  <span className={`text-sm md:text-md font-extrabold ${themeClasses.textWhite}`}>
                    {formatCurrency(projectionData.results.reduce((acc, curr) => acc + curr.projectedSpent, 0))}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1 select-none">
                  Berdasarkan rata-rata historis (Jan-Mei) sebesar <strong className="font-semibold">{formatCurrency(projectionData.averageSpentMay)} / bln</strong>
                </p>
              </div>

              {/* Card 3: Year-end outcome */}
              <div className={`p-4 rounded-2xl border transition-all duration-350 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/[0.02] border-white/5'}`}>
                <span className="text-[9px] uppercase font-black tracking-wider text-slate-500 block mb-1">Estimasi Kas Akhir Tahun (Des 2026)</span>
                <div className="flex items-center gap-1.5">
                  <Wallet className={`${projectionData.runoutMonthName ? "text-rose-450" : "text-emerald-400"} shrink-0`} size={18} />
                  <span className={`text-sm md:text-md font-black ${projectionData.runoutMonthName ? "text-rose-450" : "text-emerald-400"}`}>
                    {projectionData.runoutMonthName ? "Potensi Defisit" : formatCurrency(projectionData.projectedSurplus)}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1 select-none">
                  {projectionData.runoutMonthName 
                    ? `Perkiraan habis sisa dana di bulan ${projectionData.runoutMonthName}.` 
                    : "Surplus tersisa setelah seluruh proyeksi belanja terpenuhi."
                  }
                </p>
              </div>
            </div>

            {/* MAIN CHART CONTROLLER & SPEC TABLE SUMMARY */}
            <div className={`grid grid-cols-1 lg:grid-cols-4 gap-6 p-4 rounded-2xl border ${isLight ? 'bg-[#f8fafc] border-slate-200' : 'bg-[#02040a]/40 border-white/5'}`}>
              
              {/* Chart canvas SVG - Span 3 columns */}
              <div className="lg:col-span-3 w-full overflow-x-auto no-scrollbar pt-2">
                <div className="min-w-[550px] relative">
                  {(() => {
                    const chartResults = projectionData.results;
                    const maxProjVal = Math.max(...chartResults.map(r => Math.max(r.remainingBudget, r.projectedSpent)), 100000);
                    
                    const paddingLeft = 75;
                    const paddingRight = 35;
                    const paddingTop = 25;
                    const paddingBottom = 40;
                    const svgWidth = 650;
                    const svgHeight = 280;
                    const chartWidth = svgWidth - paddingLeft - paddingRight;
                    const chartHeight = svgHeight - paddingTop - paddingBottom;
                    
                    const pointsRemaining = chartResults.map((r, i) => {
                      const x = paddingLeft + (i / 6) * chartWidth;
                      const y = paddingTop + chartHeight - (r.remainingBudget / maxProjVal) * chartHeight;
                      return { x, y, value: r.remainingBudget, month: r.monthName, spent: r.projectedSpent };
                    });

                    const pointsSpent = chartResults.map((r, i) => {
                      const x = paddingLeft + (i / 6) * chartWidth;
                      const y = paddingTop + chartHeight - (r.projectedSpent / maxProjVal) * chartHeight;
                      return { x, y, value: r.projectedSpent, month: r.monthName, remaining: r.remainingBudget };
                    });

                    const remPath = pointsRemaining.length > 0 
                      ? `M ${pointsRemaining[0].x} ${pointsRemaining[0].y} ` + pointsRemaining.slice(1).map(p => `L ${p.x} ${p.y}`).join(" ")
                      : "";

                    const spentPath = pointsSpent.length > 0 
                      ? `M ${pointsSpent[0].x} ${pointsSpent[0].y} ` + pointsSpent.slice(1).map(p => `L ${p.x} ${p.y}`).join(" ")
                      : "";

                    const remAreaPath = remPath 
                      ? `${remPath} L ${pointsRemaining[pointsRemaining.length - 1].x} ${paddingTop + chartHeight} L ${pointsRemaining[0].x} ${paddingTop + chartHeight} Z` 
                      : "";

                    const spentAreaPath = spentPath 
                      ? `${spentPath} L ${pointsSpent[pointsSpent.length - 1].x} ${paddingTop + chartHeight} L ${pointsSpent[0].x} ${paddingTop + chartHeight} Z` 
                      : "";

                    const gridLineRatios = [0.25, 0.5, 0.75, 1.0];

                    return (
                      <svg viewBox="0 0 650 300" className="w-full h-auto">
                        <defs>
                          <linearGradient id="remAreaGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.12"/>
                            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0"/>
                          </linearGradient>
                          <linearGradient id="spentAreaGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.05"/>
                            <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.0"/>
                          </linearGradient>
                        </defs>

                        {/* DRAW horizontal grid lines */}
                        {gridLineRatios.map((ratio, idx) => {
                          const yPos = paddingTop + chartHeight - ratio * chartHeight;
                          const gridVal = maxProjVal * ratio;
                          let labelText = "";
                          if (gridVal >= 1000000000) {
                            labelText = `${(gridVal / 1000000000).toFixed(1)} M`;
                          } else if (gridVal >= 1000000) {
                            labelText = `${(gridVal / 1000000).toFixed(0)} Jt`;
                          } else {
                            labelText = gridVal.toLocaleString("id-ID");
                          }

                          return (
                            <g key={idx}>
                              <line 
                                x1={paddingLeft} 
                                y1={yPos} 
                                x2={650 - paddingRight} 
                                y2={yPos} 
                                stroke={isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.05)"} 
                                strokeWidth="1" 
                                strokeDasharray="4 4" 
                              />
                              <text 
                                x={paddingLeft - 8} 
                                y={yPos + 3} 
                                textAnchor="end" 
                                className="text-[9px] font-mono font-black text-slate-500 fill-current"
                              >
                                {labelText}
                              </text>
                            </g>
                          );
                        })}

                        {/* Axis base borders */}
                        <line 
                          x1={paddingLeft} 
                          y1={paddingTop} 
                          x2={paddingLeft} 
                          y2={paddingTop + chartHeight} 
                          stroke={isLight ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.1)"} 
                          strokeWidth="1.5" 
                        />
                        <line 
                          x1={paddingLeft} 
                          y1={paddingTop + chartHeight} 
                          x2={650 - paddingRight} 
                          y2={paddingTop + chartHeight} 
                          stroke={isLight ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.1)"} 
                          strokeWidth="1.5" 
                        />

                        {/* AREA SHADING */}
                        {remAreaPath && <path d={remAreaPath} fill="url(#remAreaGrad)" />}
                        {spentAreaPath && <path d={spentAreaPath} fill="url(#spentAreaGrad)" />}

                        {/* Sisa Anggaran (Line 1 Indigo) */}
                        {remPath && (
                          <path 
                            d={remPath} 
                            fill="none" 
                            stroke="#6366f1" 
                            strokeWidth="3.5" 
                            strokeLinecap="round" 
                            className="drop-shadow-[0_2px_8px_rgba(99,102,241,0.35)]"
                          />
                        )}

                        {/* Projected Spent (Line 2 Rose - Dashed structure for forecast) */}
                        {spentPath && (
                          <path 
                            d={spentPath} 
                            fill="none" 
                            stroke="#f43f5e" 
                            strokeWidth="3" 
                            strokeLinecap="round" 
                            strokeDasharray="6 4"
                            className="drop-shadow-[0_2px_6px_rgba(244,63,94,0.3)]"
                          />
                        )}

                        {/* VERTICAL TRACKER */}
                        {hoveredProjIdx !== null && (
                          <line 
                            x1={pointsRemaining[hoveredProjIdx].x} 
                            y1={paddingTop} 
                            x2={pointsRemaining[hoveredProjIdx].x} 
                            y2={paddingTop + chartHeight} 
                            stroke={isLight ? "rgba(0,0,0,0.15)" : "rgba(255, 255, 255, 0.2)"} 
                            strokeWidth="1.5" 
                            strokeDasharray="4 4" 
                          />
                        )}

                        {/* Circle Markers for Sisa Anggaran */}
                        {pointsRemaining.map((p, idx) => (
                          <g key={idx}>
                            <circle 
                              cx={p.x} 
                              cy={p.y} 
                              r={hoveredProjIdx === idx ? 6.5 : 4.5} 
                              fill={isLight ? "#ffffff" : "#0a0f24"} 
                              stroke="#6366f1" 
                              strokeWidth={hoveredProjIdx === idx ? 4 : 2} 
                              className="transition-all duration-150 cursor-pointer"
                            />
                            {hoveredProjIdx === idx && (
                              <circle cx={p.x} cy={p.y} r={13} fill="#6366f1" fillOpacity="0.18" className="animate-ping pointer-events-none" />
                            )}
                          </g>
                        ))}

                        {/* Circle Markers for Projected Monthly spend */}
                        {pointsSpent.map((p, idx) => (
                          <g key={idx}>
                            <circle 
                              cx={p.x} 
                              cy={p.y} 
                              r={hoveredProjIdx === idx ? 6.5 : 4.5} 
                              fill={isLight ? "#ffffff" : "#0a0f24"} 
                              stroke="#f43f5e" 
                              strokeWidth={hoveredProjIdx === idx ? 4 : 2} 
                              className="transition-all duration-150 cursor-pointer"
                            />
                          </g>
                        ))}

                        {/* X Axis label Names */}
                        {pointsRemaining.map((p, idx) => (
                          <text 
                            key={idx}
                            x={p.x} 
                            y={paddingTop + chartHeight + 18} 
                            textAnchor="middle" 
                            className={`text-[10px] font-bold tracking-wider fill-current transition-colors duration-200 ${
                              hoveredProjIdx === idx 
                                ? 'text-indigo-500 font-black scale-105' 
                                : 'text-slate-500'
                            }`}
                          >
                            {p.month.substring(0, 3)}
                          </text>
                        ))}

                        {/* GHOST HITBOXES FOR HIGHLIGHTS */}
                        {pointsRemaining.map((p, idx) => {
                          const rectW = chartWidth / 6;
                          const rectX = p.x - rectW / 2;
                          return (
                            <rect 
                              key={idx}
                              x={rectX} 
                              y={paddingTop} 
                              width={rectW} 
                              height={chartHeight} 
                              fill="transparent" 
                              className="cursor-crosshair focus:outline-none"
                              onMouseEnter={() => setHoveredProjIdx(idx)}
                              onMouseLeave={() => setHoveredProjIdx(null)}
                            />
                          );
                        })}
                      </svg>
                    );
                  })()}
                </div>

                {/* LEGEND CLASSIFICTION */}
                <div className="flex flex-wrap items-center justify-center gap-6 mt-3 pb-1 text-xs select-none">
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-1 bg-indigo-500 rounded-full inline-block"></span>
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                      Alokasi Sisa Pagu Anggaran (Remaining Budget)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-1 border-t-2 border-dashed border-rose-500 inline-block"></span>
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                      Proyeksi Belanja Bulanan (Projected Expenditure)
                    </span>
                  </div>
                </div>
              </div>

              {/* STATISTICAL REPORT DETAILED CONTAINER */}
              <div className="lg:col-span-1 flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-indigo-500/10 pt-4 lg:pt-0 lg:pl-5 space-y-4">
                <div className="space-y-4">
                  <span className="text-[10px] uppercase font-black tracking-widest text-[#818cf8] block">Eksplorasi Interaktif</span>
                  
                  {hoveredProjIdx !== null ? (
                    <div className="space-y-3 animate-in fade-in duration-200">
                      <div>
                        <span className="text-[9px] uppercase font-bold text-slate-500 block">Bulan Prediksi (2026)</span>
                        <h4 className={`text-md font-extrabold ${themeClasses.textWhite}`}>
                          {projectionData.results[hoveredProjIdx].monthName} 2026
                        </h4>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[9px] uppercase font-bold text-slate-500 block">Proyeksi Rencana Belanja</span>
                        <p className="text-xs font-black text-rose-500">
                          {formatCurrency(projectionData.results[hoveredProjIdx].projectedSpent)}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[9px] uppercase font-bold text-slate-500 block">Prediksi Sisa Pagu (Awal Bulan)</span>
                        <p className="text-xs font-black text-[#6366f1]">
                          {formatCurrency(projectionData.results[hoveredProjIdx].remainingBudget)}
                        </p>
                      </div>

                      {projectionData.results[hoveredProjIdx].remainingBudget - projectionData.results[hoveredProjIdx].projectedSpent < 0 ? (
                        <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-semibold leading-relaxed">
                          Sisa pagu defisit! Tidak mumpuni membiayai pengeluaran bulan ini.
                        </div>
                      ) : (
                        <div className="p-2.5 rounded-xl bg-[#10b981]/10 border border-[#10b981]/20 text-[#10b981] text-[10px] font-semibold">
                          Alokasi dana aman dan mencukupi sisa kebutuhan RKA berjalan.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="py-8 text-center text-slate-500 italic text-[11px] leading-relaxed flex flex-col items-center justify-center h-full">
                      <TrendingUp size={24} className="opacity-20 mb-2 stroke-[1.5]" />
                      <span>Sorot pointer kursor pada grafik untuk rincian data analitis bulanan secara dinamis.</span>
                    </div>
                  )}
                </div>

                <div className={`p-3.5 rounded-xl border text-[10px] space-y-1 select-none leading-relaxed ${isLight ? 'bg-indigo-50/50 border-indigo-100 text-slate-600' : 'bg-indigo-500/5 border-indigo-500/10 text-slate-400'}`}>
                  <strong className="font-bold text-[#818cf8] block mb-0.5">Model Regresi Linear:</strong>
                  Estimasi deviasi dihitung memakai metode kuadrat terkecil (<strong className="font-semibold">Least Squares Method</strong>) menjamin proyeksi akurat pergerakan saldo kas belanja RSUD.
                </div>
              </div>
            </div>
          </section>
        )}

        {/* --- INTERACTIVE CATEGORY BUDGET PIE CHART SECTION --- */}
        {activeTab === "monitoring" && (
          <section className={`backdrop-blur-xl p-6 md:p-8 rounded-[32px] space-y-6 shadow-xl transition-all duration-300 ${themeClasses.header}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h3 className={`text-lg font-bold flex items-center gap-2 transition-colors duration-300 ${themeClasses.textWhite}`}>
                  <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                    <svg className="w-5 h-5 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" stroke="#818cf8" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" stroke="#818cf8" />
                    </svg>
                  </span>
                  <span>Proporsi Komposisi Anggaran Per Kategori</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Visualisasi proporsi penyerapan realisasi maupun pagu rencana per rekening secara interaktif
                </p>
              </div>

              {/* Toggle metric state */}
              <div className={`p-1 flex items-center rounded-2xl border transition-all ${isLight ? 'bg-slate-100/80 border-slate-200' : 'bg-[#0b1020] border-white/10'}`}>
                <button
                  type="button"
                  onClick={() => setPieChartMetric("spent")}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                    pieChartMetric === "spent" 
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/25" 
                      : "text-slate-500 hover:text-indigo-400"
                  }`}
                >
                  Serapan Realisasi
                </button>
                <button
                  type="button"
                  onClick={() => setPieChartMetric("rencana")}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                    pieChartMetric === "rencana" 
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/25" 
                      : "text-slate-500 hover:text-indigo-400"
                  }`}
                >
                  Pagu Rencana
                </button>
              </div>
            </div>

            {/* Layout grid containing Pie Chart and detailed list */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center pt-2">
              
              {/* Pie Chart display column - Span 5 */}
              <div id="chart_diagram_panel" className="lg:col-span-5 flex flex-col items-center justify-center relative min-h-[280px]">
                {pieData.length > 0 ? (
                  <div className="w-full h-[280px] transition-all relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={70}
                          outerRadius={95}
                          paddingAngle={3}
                          dataKey="value"
                          onMouseEnter={(_, index) => setPieActiveIndex(index)}
                          onMouseLeave={() => setPieActiveIndex(null)}
                        >
                          {pieData.map((entry, index) => {
                            const isHovered = pieActiveIndex === index;
                            return (
                              <Cell 
                                key={`cell-${entry.id}`} 
                                fill={getCategoryColor(entry.id)} 
                                className="transition-all duration-300 focus:outline-none"
                                style={{
                                  filter: isHovered ? "drop-shadow(0px 0px 8px rgba(99,102,241,0.5))" : "none",
                                  opacity: pieActiveIndex === null || isHovered ? 1.0 : 0.45,
                                  cursor: "pointer",
                                }}
                              />
                            );
                          })}
                        </Pie>
                        <Tooltip 
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              return (
                                <div className={`p-4 border rounded-2xl shadow-2xl font-mono text-xs max-w-[260px] leading-relaxed transition-all duration-200 ${
                                  isLight 
                                    ? "bg-white border-slate-200 text-slate-800" 
                                    : "bg-[#0b1020]/95 border-white/10 text-white"
                                }`}>
                                  <p className="font-extrabold text-[9px] text-slate-400 uppercase tracking-widest mb-1">
                                    {data.kode}
                                  </p>
                                  <p className="font-bold text-xs leading-snug mb-1.5 text-indigo-500 dark:text-indigo-400">
                                    {data.name}
                                  </p>
                                  <div className="h-px bg-slate-200 dark:bg-white/10 my-1.5" />
                                  <div className="flex justify-between items-center gap-4 mt-1">
                                    <span className="text-slate-500 text-[9px] uppercase font-bold">Nominal:</span>
                                    <span className="font-bold text-slate-950 dark:text-white">{formatCurrency(data.value)}</span>
                                  </div>
                                  <div className="flex justify-between items-center gap-4">
                                    <span className="text-slate-500 text-[9px] uppercase font-bold">Proporsi:</span>
                                    <span className="font-black text-indigo-500 dark:text-indigo-400">
                                      {((data.value / pieTotalValue) * 100).toFixed(1)}%
                                    </span>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    
                    {/* Central textual info card */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center transform translate-y-[-2px]">
                      {pieActiveIndex !== null && pieData[pieActiveIndex] ? (
                        <div className="animate-in fade-in zoom-in-90 duration-150 p-1">
                          <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider font-mono">
                            {pieData[pieActiveIndex].kode.split('.').slice(-2).join('.')}
                          </span>
                          <span className="block text-lg font-black text-slate-850 dark:text-slate-100 tracking-tight leading-none mt-1">
                            {((pieData[pieActiveIndex].value / pieTotalValue) * 100).toFixed(1)}%
                          </span>
                          <span 
                            className="block text-[10px] font-extrabold mt-1.5 truncate max-w-[130px] font-sans" 
                            style={{ color: getCategoryColor(pieData[pieActiveIndex].id) }}
                          >
                            {pieData[pieActiveIndex].name}
                          </span>
                        </div>
                      ) : (
                        <div className="animate-in fade-in duration-300">
                          <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider font-mono">Total {pieChartMetric === "spent" ? "Serapan" : "Pagu"}</span>
                          <span className="block text-md font-black text-indigo-600 dark:text-indigo-400 tracking-tight mt-1 leading-none">
                            {formatCurrency(pieTotalValue)}
                          </span>
                          <span className="block text-[8px] text-slate-500 mt-1 uppercase font-bold tracking-widest leading-none">
                            100% Kategori
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 space-y-3">
                    <p className="text-sm text-slate-400 font-semibold">Tidak ada data proporsi {pieChartMetric === "spent" ? "penyerapan" : "rencana"} yang tersedia.</p>
                    <p className="text-xs text-slate-500">Mata rekening belanja belum terisi transaksi realisasi apapun.</p>
                  </div>
                )}
              </div>

              {/* Colors and detail legends - Span 7 */}
              <div className="lg:col-span-7 space-y-3">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400/80 mb-2 font-mono">Daftar Komposisi Rekening Belanja</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {categories.map((cat, i) => {
                    const value = pieChartMetric === "spent" 
                      ? calculateCategoryRealisasi(cat.id, transactions)
                      : calculateCategoryRencana(cat);
                    
                    const percent = pieTotalValue > 0 ? (value / pieTotalValue) * 100 : 0;
                    const color = getCategoryColor(cat.id);
                    const isHovered = pieActiveIndex !== null && pieData[pieActiveIndex]?.id === cat.id;

                    return (
                      <div 
                        key={cat.id}
                        onMouseEnter={() => {
                          const idx = pieData.findIndex(x => x.id === cat.id);
                          if (idx !== -1) setPieActiveIndex(idx);
                        }}
                        onMouseLeave={() => setPieActiveIndex(null)}
                        onClick={() => setActiveTab(cat.id)}
                        className={`p-3.5 border rounded-2xl transition-all duration-300 cursor-pointer flex justify-between items-center group relative overflow-hidden ${
                          isHovered 
                            ? "bg-slate-100/50 border-indigo-400 dark:border-indigo-500/40 shadow-md scale-[1.01]" 
                            : isLight 
                              ? "bg-slate-50 border-slate-200/80 hover:bg-slate-100 hover:border-slate-300"
                              : "bg-white/[0.01] border-[#152030] hover:bg-white/[0.03] hover:border-indigo-500/30"
                        }`}
                        style={{
                          borderLeft: `5px solid ${color}`
                        }}
                      >
                        <div className="space-y-1 pr-3 max-w-[70%]">
                          <span className="text-[9px] font-black font-mono tracking-wider text-slate-500 block">KODE: {cat.kode}</span>
                          <span className={`text-xs font-bold leading-tight line-clamp-1 block transition-colors ${isLight ? 'text-slate-800 font-semibold' : 'text-slate-200 font-medium'} group-hover:text-indigo-600 dark:group-hover:text-indigo-400`}>
                            {cat.nama.replace("Belanja ", "").split(" - ")[0]}
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className={`block font-mono text-xs font-bold ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>{formatCurrency(value)}</span>
                          <span className="block text-[10px] font-black text-indigo-500 dark:text-indigo-400 leading-none mt-0.5">
                            {percent.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          </section>
        )}

        {/* --- BUDGET CATEGORY CARDS IN OVERVIEW TAB --- */}
        {activeTab === "monitoring" && (
          <motion.section 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-4"
          >
            <h3 className={`text-sm font-black uppercase tracking-wider ${isLight ? 'text-slate-500/80' : 'text-slate-400'}`}>Analisa Pagu Progres Per Kategori</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <AnimatePresence mode="popLayout">
                {categories.map((cat, index) => {
                  const plans = calculateCategoryRencana(cat);
                  const spent = calculateCategoryRealisasi(cat.id, transactions);
                  const sisa = Math.max(0, plans - spent);
                  const pct = plans > 0 ? (spent / plans) * 100 : 0;
                  const CatIcon = getTabIcon(cat.id);

                  return (
                    <motion.div
                      layout
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      whileHover={{ scale: 1.025, y: -4 }}
                      whileTap={{ scale: 0.985 }}
                      transition={{ 
                        type: "spring", 
                        stiffness: 300, 
                        damping: 24,
                        delay: index * 0.05 
                      }}
                      key={cat.id}
                      onClick={() => setActiveTab(cat.id)}
                      className={`p-6 rounded-[24px] border transition-all duration-300 cursor-pointer group shadow-lg ${isLight ? 'bg-white border-slate-200/80 hover:bg-slate-50 hover:border-indigo-500/40' : 'bg-white/[0.02] hover:bg-white/[0.05] border-[#152030] hover:border-indigo-500/40'}`}
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="w-9 h-9 rounded-xl bg-[#818cf8]/10 text-[#818cf8] flex items-center justify-center group-hover:scale-110 transition-all duration-300">
                          <CatIcon size={16} />
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${
                          pct > 100 ? 'bg-rose-500/10 text-rose-500' : pct > 80 ? 'bg-amber-500/10 text-amber-500' : isLight ? 'bg-slate-100 text-slate-500' : 'bg-white/5 text-slate-400'
                        }`}>
                          {pct.toFixed(1)}% Realized
                        </span>
                      </div>

                      <h4 className={`font-bold text-sm group-hover:text-indigo-600 transition-colors tracking-tight line-clamp-1 mb-2 ${themeClasses.textSlate100}`}>
                        {cat.nama}
                      </h4>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider font-extrabold mb-4">KODE: {cat.kode}</p>

                      <div className={`space-y-3 border-t pt-4 mt-2 ${themeClasses.borderWhite5Or10}`}>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-500 font-medium">Pagu Rencana:</span>
                          <span className={`font-bold ${themeClasses.textSlate200}`}>{formatCurrency(plans)}</span>
                        </div>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-500 font-medium font-sans">Maret Realisasi:</span>
                          <span className="text-indigo-600 dark:text-[#818cf8] font-bold">{formatCurrency(spent)}</span>
                        </div>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-500 font-medium">Sisa Pagu:</span>
                          <span className="text-emerald-500 font-bold">{formatCurrency(sisa)}</span>
                        </div>
                      </div>

                      <div className="mt-4 grow">
                        <div className={`w-full h-1.5 rounded-full overflow-hidden border ${isLight ? 'bg-slate-200 border-slate-300/30' : 'bg-slate-900 border-white/5'}`}>
                          <div 
                            className={`h-full rounded-full transition-all duration-700 ${pct > 100 ? 'bg-rose-500' : pct > 80 ? 'bg-amber-400' : 'bg-gradient-to-r from-indigo-500 to-indigo-400'}`}
                            style={{ width: `${Math.min(100, pct)}%` }}
                          ></div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </motion.section>
        )}
        </div>

        {/* --- MAIN SPREADSHEET TABLE & TRANSACTION LEDGER WORKSPACE --- */}
        <section className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h3 className={`text-xl font-bold flex items-center gap-3 transition-colors ${themeClasses.textWhite}`}>
              <span className="w-1.5 h-6 bg-gradient-to-b from-indigo-500 to-purple-400 rounded-full shadow-[0_0_8px_indigo]"></span>
              <span>{activeTab === "monitoring" ? "Uraian Struktur RKA (Semua Kategori)" : `Detail Workspace: ${categoryWorkspace?.nama}`}</span>
            </h3>
            
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto animate-in slide-in-from-right-4 duration-300">
              {activeTab !== "monitoring" && categoryWorkspace && (
                <button
                  onClick={() => handleExportCategoryPDF(categoryWorkspace)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold tracking-wide transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap grow sm:grow-0 ${
                    isLight 
                      ? "bg-rose-50 border border-rose-250 text-rose-800 hover:bg-rose-100" 
                      : "bg-rose-950/20 border border-rose-500/20 hover:bg-rose-950/40 text-rose-300"
                  }`}
                  title={`Unduh Laporan PDF Kategori ${categoryWorkspace.nama}`}
                >
                  <FileText size={14} />
                  <span>Unduh PDF Kategori</span>
                </button>
              )}

              {/* Search items filter input */}
              <div className="relative max-w-sm w-full sm:w-80">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={15} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari uraian belanja..."
                  className={`w-full text-xs border rounded-xl py-2.5 pl-10 pr-4 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors font-medium ${isLight ? 'bg-white border-slate-250 border-slate-200 text-slate-800' : 'bg-white/5 border-white/10 text-[#e2e8f0]'}`}
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* TABLE INTERACTIVE CONTAINER */}
          <motion.div
            key={`${activeTab}-${warningFilter}`}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className={`text-left overflow-hidden rounded-[28px] shadow-2xl backdrop-blur-md transition-all duration-300 ${themeClasses.panel}`}
          >
            
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-left border-collapse min-w-[1350px]">
                <thead>
                  <tr className={`transition-colors ${themeClasses.tableHeader}`}>
                    <th className={`px-4 py-4 text-[11px] font-black uppercase tracking-widest w-[24%] min-w-[280px] ${isLight ? 'text-indigo-650' : 'text-[#818cf8]'}`}>Uraian Struktur Belanja</th>
                    <th className={`px-3 py-4 text-[11px] font-black uppercase tracking-widest whitespace-nowrap text-right ${isLight ? 'text-indigo-650' : 'text-[#818cf8]'}`}>PAGU RENCANA (IDR)</th>
                    
                    {/* Monthly Columns (Jan-Des Dynamic Render) */}
                    {Array.from({ length: 12 }).map((_, mIdx) => (
                      <th key={mIdx} className={`px-1 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center whitespace-nowrap border-r ${isLight ? 'border-slate-200/40' : 'border-white/[0.03]'}`}>
                        {getShortMonthName(mIdx + 1)}
                      </th>
                    ))}

                    <th className={`px-3 py-4 text-[11px] font-black uppercase tracking-widest text-right whitespace-nowrap ${isLight ? 'text-indigo-650' : 'text-[#818cf8]'}`}>REALISASI (IDR)</th>
                    <th className={`px-3 py-4 text-[11px] font-black uppercase tracking-widest text-right whitespace-nowrap ${isLight ? 'text-indigo-650' : 'text-[#818cf8]'}`}>SISA BUDGET (IDR)</th>
                    <th className={`px-3 py-4 text-[11px] font-black uppercase tracking-widest text-center ${isLight ? 'text-indigo-650' : 'text-[#818cf8]'}`}>TINDAKAN</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isLight ? 'divide-slate-200/50' : 'divide-white/5'}`}>
                  
                  {filteredCategories.length === 0 ? (
                    <tr>
                      <td colSpan={17} className="p-12 text-center text-slate-500">
                        <CircleAlert className="mx-auto mb-3 text-slate-600" size={32} />
                        <span className="text-sm font-semibold">Uraian tidak ditemukan. Coba hapus pencarian atau cari sub-kategori lain.</span>
                      </td>
                    </tr>
                  ) : (
                    filteredCategories.map((catGroup, catIdx) => (
                      <React.Fragment key={catGroup.id}>
                        
                        {/* CATEGORY BANNER ROW */}
                        <tr className={`border-y ${isLight ? 'bg-slate-50 border-slate-200/80 text-indigo-750' : 'bg-white/[0.02] border-white/5 text-[#818cf8]'}`}>
                          <td colSpan={17} className="px-5 py-4 text-xs font-extrabold tracking-wide">
                            <span className="font-mono bg-indigo-500/10 text-indigo-500 dark:text-[#818cf8] px-2 py-1 rounded-lg border border-[#818cf8]/20 mr-3 text-[10px]">
                              {catGroup.kode}
                            </span>
                            <span className={`italic transition-colors ${themeClasses.textSlate100}`}>{catGroup.nama}</span>
                          </td>
                        </tr>

                        {/* ITEMS ROWS */}
                        {catGroup.items.map((item) => {
                          const spent = calculateItemRealisasi(item.id, transactions);
                          const remaining = item.rencana - spent;
                          const spentPct = item.rencana > 0 ? (spent / item.rencana) * 100 : 0;

                          return (
                            <tr key={item.id} className={`transition-all duration-150 border-b ${isLight ? 'hover:bg-slate-100/50 border-slate-100' : 'hover:bg-white/[0.03] border-white/[0.03]'}`}>
                              <td className={`px-4 py-3.5 text-xs font-semibold leading-relaxed min-w-[280px] transition-colors ${themeClasses.textSlate200}`}>
                                {item.nama}
                              </td>

                              <td className={`px-3 py-3.5 text-xs font-extrabold text-right font-mono tracking-tight whitespace-nowrap ${themeClasses.textSlate100}`}>
                                {formatCurrency(item.rencana)}
                              </td>

                              {/* MONTHS DYNAMIC BUDGET METER */}
                              {Array.from({ length: 12 }).map((_, mIdx) => {
                                const localMonth = mIdx + 1;
                                const localSpent = calculateItemMonthlySpent(item.id, localMonth, transactions);

                                return (
                                  <td 
                                    key={mIdx} 
                                    className={`px-1 py-3.5 text-[10px] text-center font-mono tracking-tighter border-r ${isLight ? 'border-slate-200/40' : 'border-white/[0.02]'} ${
                                      localSpent > 0 ? (isLight ? "text-indigo-600 font-extrabold" : "text-indigo-400 font-extrabold") : isLight ? "text-slate-300" : "text-slate-600"
                                    }`}
                                  >
                                    {localSpent > 0 ? formatNumberRaw(localSpent) : "—"}
                                  </td>
                                );
                              })}

                              <td className={`px-3 py-3.5 text-xs font-extrabold text-right font-mono tracking-tight whitespace-nowrap ${spent > 0 ? (isLight ? "text-indigo-650 font-black" : "text-[#818cf8] font-black") : "text-slate-500"}`}>
                                {spent > 0 ? formatCurrency(spent) : "Rp 0"}
                              </td>

                              <td className={`px-3 py-3.5 text-xs font-extrabold text-right font-mono tracking-tight whitespace-nowrap ${remaining < 0 ? "text-rose-500 font-black" : "text-emerald-500 font-black"}`}>
                                {formatCurrency(remaining)}
                                {spentPct > 100 && (
                                  <span className="block text-[8px] text-rose-500 font-black uppercase mt-1 tracking-wider whitespace-normal">Lampu Merah (Defisit)</span>
                                )}
                                {spentPct > 80 && spentPct <= 100 && (
                                  <span className="block text-[8px] text-amber-500 font-black uppercase mt-1 tracking-wider whitespace-normal">Sisa Kritis (&gt;80%)</span>
                                )}
                              </td>

                              <td className="px-3 py-3.5 text-center whitespace-nowrap">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    onClick={() => handleOpenAddTxWithPrefab(catGroup.id, item.id)}
                                    title="Rekam transaksi realisasi sub-item secara langsung"
                                    className={`px-2.5 py-1 rounded-lg transition-all border cursor-pointer flex items-center justify-center gap-1 text-[9px] font-bold uppercase tracking-wider ${
                                      isContrast
                                        ? 'bg-black text-white border-2 border-white hover:bg-zinc-900 shadow-[0_0_8px_rgba(255,255,255,0.4)]'
                                        : isLight 
                                          ? 'bg-emerald-50 hover:bg-emerald-150 text-emerald-700 border-emerald-250/60' 
                                          : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/10'
                                    }`}
                                  >
                                    <Plus size={10} className="stroke-[3]" />
                                    <span>Realisasi</span>
                                  </button>
                                  <button
                                    onClick={() => handleOpenEditPagu(item, catGroup.id)}
                                    title="Revisi pagu anggaran"
                                    className={`p-1.5 rounded-lg transition-colors border cursor-pointer ${isLight ? 'bg-indigo-50 hover:bg-indigo-150 text-indigo-650 border-indigo-200/50' : 'bg-[#818cf8]/10 hover:bg-[#818cf8]/20 text-[#818cf8] border-[#818cf8]/10'}`}
                                  >
                                    <Edit2 size={11} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}

                      </React.Fragment>
                    ))
                  )}

                </tbody>
              </table>
            </div>

            <div className={`p-4 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest select-none border-t ${isLight ? 'bg-slate-50 border-slate-200 text-slate-550' : 'bg-white/[0.02] border-white/5 text-slate-500'}`}>
              <CircleAlert size={12} className="text-[#818cf8]" />
              <span>Gunakan gesture geser ke kanan untuk menjelajahi rincian per bulan anggaran (Jan - Des)</span>
            </div>
          </motion.div>
        </section>

        {/* --- DEDICATED TRANSACTION HISTORY SECTION --- */}
        <section className={`backdrop-blur-xl p-6 md:p-8 rounded-[32px] space-y-6 shadow-xl transition-all duration-300 ${themeClasses.header}`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className={`text-lg font-bold flex items-center gap-2 transition-all ${themeClasses.textWhite}`}>
                <FileBadge className="text-[#818cf8]" size={18} />
                <span>Registrasi Mutasi Jurnal Realisasi ({filteredTransactions.length} Tercatat)</span>
              </h3>
              <p className="text-xs text-slate-550 text-slate-500">Arsip mutasi pembayaran, kuitansi, atau transaksi belanja dari RKA</p>
            </div>
            
            {activeTab !== "monitoring" && (
              <span className={`text-xs px-3 py-1.5 rounded-lg font-bold border ${isLight ? 'bg-indigo-50 border-indigo-200 text-indigo-650' : 'bg-indigo-500/10 border border-indigo-500/20 text-[#818cf8]'}`}>
                Difilter: Kategori Aktif
              </span>
            )}
          </div>

          <div className={`overflow-hidden rounded-2xl shadow-lg border transition-all ${isLight ? 'bg-white border-slate-200' : 'bg-[#0e1220]/80 border-white/10'}`}>
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className={`transition-colors ${themeClasses.tableHeader}`}>
                    <th className="p-4 text-[10px] uppercase font-black tracking-wider text-slate-500">Tanggal Transaksi</th>
                    <th className="p-4 text-[10px] uppercase font-black tracking-wider text-slate-500">Mata Rekening</th>
                    <th className="p-4 text-[10px] uppercase font-black tracking-wider text-slate-500">Uraian Keterangan Pengeluaran</th>
                    <th className="p-4 text-[10px] uppercase font-black tracking-wider text-right text-slate-500">Nominal Realisasi</th>
                    <th className="p-4 text-[10px] uppercase font-black tracking-wider text-center text-slate-500">Tindakan</th>
                  </tr>
                </thead>
                <tbody className={`divide-y text-xs ${isLight ? 'divide-slate-150' : 'divide-white/5'}`}>
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-500">
                        Belum ada kuitansi realisasi yang direkam untuk folder ini.
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((tx) => {
                      // Lookup item name
                      let itemName = "Tidak Diketahui";
                      let catName = "Kategori Umum";
                      categories.forEach((cat) => {
                        const matched = cat.items?.find(i => i.id === tx.itemId);
                        if (matched) {
                          itemName = matched.nama;
                          catName = cat.nama;
                        }
                      });

                      const isHighlighted = tx.id === highlightedTxId;

                      return (
                        <tr 
                          key={tx.id} 
                          className={`transition-all duration-500 border-b ${
                            isHighlighted
                              ? isContrast
                                ? "bg-amber-400 text-black font-bold ring-2 ring-white/80"
                                : isLight
                                  ? "bg-emerald-50 border-emerald-200 text-emerald-950 shadow-inner"
                                  : "bg-emerald-950/30 border-emerald-800/40 text-emerald-100 shadow-inner"
                              : isLight 
                                ? "hover:bg-slate-50 border-slate-100" 
                                : "hover:bg-white/[0.02] border-white/[0.01]"
                          }`}
                        >
                          <td className="p-4 whitespace-nowrap font-mono text-slate-500 text-xs">
                            {isHighlighted && (
                              <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-widest text-[#10b981] bg-emerald-500/10 px-1.5 py-0.5 rounded-md animate-pulse mb-1 block w-max">
                                BARU
                              </span>
                            )}
                            {tx.date} 
                            <span className="text-[10px] text-slate-400 block">Bulan {getMonthName(tx.month)}</span>
                          </td>
                          <td className="p-4 max-w-xs leading-relaxed">
                            <span className={`font-medium block truncate ${themeClasses.textSlate100}`}>{itemName}</span>
                            <span className={`text-[9px] uppercase font-bold block leading-none mt-1 ${isLight ? 'text-indigo-650' : 'text-[#818cf8]'}`}>{catName}</span>
                          </td>
                          <td className={`p-4 text-xs font-light max-w-sm whitespace-normal ${themeClasses.textSlate200}`}>
                            <div className="flex flex-col gap-1.5">
                              <span>{tx.description}</span>
                              {tx.pdfName && tx.pdfUrl && (
                                <a
                                  href={tx.pdfUrl}
                                  download={tx.pdfName}
                                  className={`self-start inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-lg border transition-colors ${isLight ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100' : 'bg-rose-950/20 border-rose-900/30 text-rose-300 hover:bg-rose-900/50'}`}
                                  title="Download salinan lampiran PDF"
                                >
                                  <FileText size={11} className="text-red-500" />
                                  <span className="truncate max-w-[150px]">{tx.pdfName}</span>
                                </a>
                              )}
                            </div>
                          </td>
                          <td className={`p-4 text-right font-extrabold font-mono text-xs ${isLight ? 'text-indigo-650' : 'text-slate-200'}`}>
                            {formatCurrency(tx.amount)}
                          </td>
                          <td className="p-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleOpenEditTx(tx)}
                                title="Ubah kuitansi"
                                className={`p-1 px-2.5 rounded-lg transition-colors text-[10px] font-bold inline-flex items-center gap-1.5 cursor-pointer ${isLight ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700' : 'bg-indigo-950/20 hover:bg-indigo-900/30 text-[#818cf8]'}`}
                              >
                                <Edit2 size={11} />
                                Ubah
                              </button>
                              <button
                                onClick={() => handleDeleteTransaction(tx.id)}
                                title="Hapus realisasi"
                                className={`p-1 px-2.5 rounded-lg transition-colors text-[10px] font-bold inline-flex items-center gap-1.5 cursor-pointer ${isLight ? 'bg-rose-50 hover:bg-rose-100 text-rose-600' : 'bg-rose-950/20 hover:bg-rose-900/30 text-rose-400 text-[#f43f5e]'}`}
                              >
                                <Trash2 size={11} />
                                Hapus
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* --- STATUTORY FOOTER --- */}
        <footer className={`pt-8 border-t text-center text-xs space-y-2 transition-all ${isLight ? 'border-slate-200 text-slate-500' : 'border-white/5 text-slate-500'}`}>
          <p>© 2026 APBD SMART MONITORING SYSTEM • KABUPATEN TARAKAN</p>
          <p className={`text-[10px] tracking-wider font-semibold uppercase ${themeClasses.footerText}`}>
            RSUD dr. H. JUSUF SK (FORMERLY RSUD TARAKAN) • PENINGKATAN MUTU DAN KAPASITAS KETENAGAAN MEDIS KALTARA
          </p>
        </footer>

      </div>

      {/* --- FORM 1: REKAM REALISASI FORM MODAL --- */}
      {isTxModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className={`w-full max-w-lg border rounded-[32px] shadow-2xl p-6 md:p-8 text-left relative animate-in zoom-in-95 duration-200 transition-all ${isLight ? 'bg-white border-slate-205 border-slate-200 text-slate-800' : 'bg-[#04060d]/95 border-white/10 text-white'}`}>
            <button
              onClick={() => setIsTxModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-indigo-650 dark:hover:text-white transition-colors p-1 cursor-pointer"
            >
              <X size={18} />
            </button>

            <header className="mb-6 space-y-1">
              <h4 className={`text-lg font-bold flex items-center gap-2 ${themeClasses.textWhite}`}>
                <FileBadge className="text-[#818cf8]" size={20} />
                <span>Form Perekaman Realisasi Belanja</span>
              </h4>
              <p className="text-xs text-slate-500">Rekam penggunaan anggaran murni dari DPA secara valid</p>
            </header>

            <form onSubmit={handleAddTransaction} className="space-y-4">
              
              {/* Category Dropdown */}
              <div className="space-y-1">
                <label className={`text-[10px] uppercase font-black tracking-wider block ${isLight ? 'text-black' : 'text-slate-500'}`}>Kategori Belanja</label>
                <select
                  value={formCategoryId}
                  onChange={(e) => setFormCategoryId(e.target.value)}
                  className={`w-full text-xs border rounded-xl px-4 py-2.5 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer font-bold ${isLight ? 'bg-white border-slate-300 text-black' : 'bg-white/5 border-white/10 text-white'}`}
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id} className={isLight ? "bg-white text-black" : "bg-[#02040a] text-white"}>
                      {cat.nama}
                    </option>
                  ))}
                </select>
              </div>

              {/* Items Dropdown */}
              <div className="space-y-1">
                <label className={`text-[10px] uppercase font-black tracking-wider block ${isLight ? 'text-black' : 'text-slate-500'}`}>Spesifik Item RKA</label>
                <select
                  value={formItemId}
                  onChange={(e) => setFormItemId(e.target.value)}
                  className={`w-full text-xs border rounded-xl px-4 py-2.5 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer font-bold ${isLight ? 'bg-white border-slate-300 text-black' : 'bg-white/5 border-white/10 text-white'}`}
                >
                  {categories.find(c => c.id === formCategoryId)?.items?.map((item) => {
                    const spent = calculateItemRealisasi(item.id, transactions);
                    const sisa = item.rencana - spent;
                    return (
                      <option key={item.id} value={item.id} className={isLight ? "bg-white text-black" : "bg-[#02040a] text-white"}>
                        {item.nama} (Sisa Pagu: {formatCurrency(sisa)})
                      </option>
                    );
                  }) || (
                    <option value="" className={isLight ? "bg-white text-black" : "bg-[#02040a] text-white"}>Tidak ada sub-item</option>
                  )}
                </select>
              </div>

              {/* DATE PICKER & AUTO MONTH INFERENCE */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className={`text-[10px] uppercase font-black tracking-wider block ${isLight ? 'text-black' : 'text-slate-500'}`}>Tanggal Kuitansi</label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className={`w-full text-xs border rounded-xl px-4 py-2.5 focus:outline-none focus:border-indigo-550 transition-all ${isLight ? 'bg-white border-slate-300 text-black' : 'bg-white/5 border-white/10 text-white'}`}
                  />
                </div>
                <div className="space-y-1 text-left">
                  <span className={`text-[10px] uppercase font-black tracking-wider block ${isLight ? 'text-black' : 'text-slate-500'}`}>Bulan Anggaran</span>
                  <div className={`w-full text-xs rounded-xl px-4 py-2.5 font-bold select-none border ${isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-white/[0.02] border-white/5 text-slate-400'}`}>
                    {getMonthName(new Date(formDate).getMonth() + 1)}
                  </div>
                </div>
              </div>

              {/* Amount input */}
              <div className="space-y-1 col-span-2">
                <label className={`text-[10px] uppercase font-black tracking-wider block ${isLight ? 'text-black' : 'text-slate-500'}`}>Besaran Rupiah (IDR)</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                    Rp
                  </div>
                  <input
                    type="number"
                    required
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="Contoh: 15000000"
                    className={`w-full text-xs font-extrabold border rounded-xl py-2.5 pl-10 pr-4 focus:outline-none focus:border-indigo-500 transition-all ${isLight ? 'bg-white border-slate-300 text-black' : 'bg-white/5 border-white/10 text-indigo-300'}`}
                  />
                </div>
              </div>

              {/* Warning badge */}
              {formWarning && (
                <div className="bg-amber-500/10 border border-amber-500/20 text-amber-550 dark:text-amber-300 rounded-xl p-3 text-[11px] leading-relaxed flex gap-2">
                  <AlertTriangle className="text-amber-500 shrink-0" size={14} />
                  <span>{formWarning}</span>
                </div>
              )}

              {/* Description input */}
              <div className="space-y-1">
                <label className={`text-[10px] uppercase font-black tracking-wider block ${isLight ? 'text-black' : 'text-slate-500'}`}>Keterangan / Deskripsi Belanja</label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Misal: Biaya konsumsi, bukti tiket AirAsia Jakarta-Tarakan, atau sertifikat pengajar..."
                  rows={3}
                  className={`w-full text-xs border rounded-xl px-4 py-2.5 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-all resize-none ${isLight ? 'bg-white border-slate-300 text-black' : 'bg-white/5 border-white/10 text-white'}`}
                />
              </div>

              {/* Attachment PDF uploader block */}
              <div className="space-y-1">
                <label className={`text-[10px] uppercase font-black tracking-wider block ${isLight ? 'text-black' : 'text-slate-500'}`}>
                  Lampirkan Bukti Pertanggungjawaban (PDF)
                </label>
                {formPdfName ? (
                  <div className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-bold leading-none ${isLight ? 'bg-indigo-50 border-indigo-200 text-indigo-750' : 'bg-indigo-950/20 border-[#818cf8]/10 text-indigo-300'}`}>
                    <div className="flex items-center gap-2 overflow-hidden mr-2">
                      <FileText size={16} className="shrink-0 text-red-500" />
                      <span className="truncate text-xs block font-mono" title={formPdfName}>{formPdfName}</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveFormPdf}
                      className={`p-1.5 px-2.5 rounded-lg border text-[10px] uppercase font-black transition-colors ${isLight ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100' : 'bg-rose-950/20 border-rose-800/40 text-rose-400 hover:bg-rose-900/20'}`}
                    >
                      Hapus
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="file"
                      accept="application/pdf"
                      id="formPdfUploadInput"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.type !== "application/pdf") {
                            showToast("Berkas harus berupa format PDF.", "warn");
                            return;
                          }
                          if (isGoogleLinked && getCachedToken()) {
                            try {
                              setIsGoogleSyncLoading(true);
                              showToast("Mengunggah dokumen PDF ke Google Drive Anda...", "info");
                              const uploadRes = await uploadPdfToDrive(file);
                              setFormPdfUrl(uploadRes.webViewLink);
                              setFormPdfName(uploadRes.name);
                              showToast("Dokumen PDF berhasil disimpan ke Google Drive!", "success");
                            } catch (err: any) {
                              console.error(err);
                              showToast("Gagal mengupload berkas ke Google Drive: " + err.message, "warn");
                            } finally {
                              setIsGoogleSyncLoading(false);
                            }
                          } else {
                            const reader = new FileReader();
                            reader.onload = () => {
                              setFormPdfUrl(reader.result as string);
                              setFormPdfName(file.name);
                              showToast("Dokumen PDF tersimpan sementara di memori lokal!");
                            };
                            reader.readAsDataURL(file);
                          }
                        }
                      }}
                    />
                    <label
                      htmlFor="formPdfUploadInput"
                      className={`w-full flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-4 py-5 cursor-pointer hover:border-indigo-500 transition-colors ${isLight ? 'bg-slate-50 border-slate-205 border-slate-200 text-slate-500 hover:bg-slate-100/50' : 'bg-[#0a0f1d] border-white/10 text-slate-400 hover:bg-white/[0.02]'}`}
                    >
                      <FileText size={20} className="text-slate-400 mb-1.5" />
                      <span className="text-[11px] font-bold">Pilih berkas kuitansi PDF</span>
                      <span className="text-[9px] text-slate-500 mt-1 uppercase font-black tracking-wider">Simpan langsung ke Google Drive folder</span>
                    </label>
                  </div>
                )}
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsTxModalOpen(false)}
                  className={`px-5 py-2.5 rounded-xl text-xs font-semibold tracking-wider transition-colors cursor-pointer ${isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-600' : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white'}`}
                >
                  Kembali
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-indigo-650 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold tracking-wider shadow-lg shadow-indigo-650/15 transition-all cursor-pointer"
                >
                  Simpan Transaksi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- FORM 2: EDIT PAGU BUDGET CAPITAL MODAL --- */}
      {isPaguModalOpen && selectedItemForPagu && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className={`w-full max-w-md border rounded-[32px] shadow-2xl p-6 md:p-8 text-left relative animate-in zoom-in-95 duration-200 transition-all ${isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-[#04060d]/95 border-white/10 text-white'}`}>
            <button
              onClick={() => setIsPaguModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-indigo-650 dark:hover:text-white transition-colors p-1 cursor-pointer"
            >
              <X size={18} />
            </button>

            <header className="mb-6 space-y-1">
              <h4 className={`text-lg font-bold flex items-center gap-2 ${themeClasses.textWhite}`}>
                <Edit2 className="text-[#818cf8]" size={18} />
                <span>Form Revisi Pagu Rencana Anggaran</span>
              </h4>
              <p className="text-xs text-slate-500">Ganti nilai pagu rencana kerja anggaran (RKA) terpilih</p>
            </header>

            <form onSubmit={handleSavePagu} className="space-y-4">
              
              <div className={`space-y-1 p-4 rounded-xl text-xs border ${isLight ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-white/5 border-white/5 text-slate-350 text-slate-300'}`}>
                <span className="text-[9px] uppercase font-bold text-slate-500">Nama Struktur Item Belanja:</span>
                <p className={`font-semibold tracking-tight mt-0.5 leading-relaxed ${themeClasses.textSlate100}`}>{selectedItemForPagu.nama}</p>
                
                <div className="mt-3 flex justify-between">
                  <span className="text-slate-500 font-medium">Realisasi saat ini:</span>
                  <span className="text-indigo-500 dark:text-indigo-400 font-mono font-bold">
                    {formatCurrency(calculateItemRealisasi(selectedItemForPagu.id, transactions))}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black text-slate-500 tracking-wider block">Pagi Pagu Baru (IDR)</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-505">
                    Rp
                  </div>
                  <input
                    type="text"
                    required
                    value={paguInputValue}
                    onChange={(e) => {
                      const rawNumericStr = e.target.value.replace(/[^0-9]/g, "");
                      setPaguInputValue(rawNumericStr);
                    }}
                    placeholder="Contoh: 350000000"
                    className={`w-full text-sm font-extrabold border rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:border-indigo-500 transition-all font-mono ${isLight ? 'bg-emerald-50/20 border-slate-200 text-emerald-650' : 'bg-white/5 border-white/10 text-emerald-400'}`}
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsPaguModalOpen(false)}
                  className={`px-5 py-2.5 rounded-xl text-xs font-semibold tracking-wider transition-colors cursor-pointer ${isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-600' : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white'}`}
                >
                  Kembalikan
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-indigo-650 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold tracking-wider shadow-lg shadow-indigo-650/15 transition-all cursor-pointer"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- REASSURANCE MODAL CARD: RESET SYSTEM --- */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className={`w-full max-w-md border rounded-[32px] shadow-2xl p-6 md:p-8 text-left relative animate-in zoom-in-95 duration-200 transition-all ${isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-[#04060d]/95 border-white/10 text-white'}`}>
            <button
              onClick={() => setIsResetConfirmOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-indigo-650 dark:hover:text-white transition-colors p-1 cursor-pointer"
            >
              <X size={18} />
            </button>

            <header className="mb-6 space-y-2">
              <div className="w-12 h-12 bg-amber-500/10 text-amber-500 rounded-2xl flex items-center justify-center mb-3">
                <RotateCcw size={22} className="animate-spin-slow" />
              </div>
              <h4 className={`text-lg font-bold flex items-center gap-2 ${themeClasses.textWhite}`}>
                <span>Konfirmasi Reset Sistem</span>
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Apakah Anda yakin ingin menyetel ulang seluruh sistem ke data awal rencana kerja anggaran (RKA) baseline? Semua input realisasi transaksi dan revisi pagu yang telah Anda rekam akan dihapus secara permanen.
              </p>
            </header>

            <div className="pt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(false)}
                className={`px-5 py-2.5 rounded-xl text-xs font-semibold tracking-wider transition-colors cursor-pointer ${isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-600' : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white'}`}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmResetSystem}
                className="px-6 py-2.5 bg-amber-600 hover:bg-amber-505 text-white rounded-xl text-xs font-bold tracking-wider shadow-lg shadow-amber-600/15 transition-all cursor-pointer"
              >
                Ya, Reset Baseline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- CONFIRM SYSTEM MODAL: DELETE TRANSACTION --- */}
      {txIdToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className={`w-full max-w-md border rounded-[32px] shadow-2xl p-6 md:p-8 text-left relative animate-in zoom-in-95 duration-200 transition-all ${isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-[#04060d]/95 border-white/10 text-white'}`}>
            <button
              onClick={() => setTxIdToDelete(null)}
              className="absolute top-5 right-5 text-slate-400 hover:text-indigo-650 dark:hover:text-white transition-colors p-1 cursor-pointer"
            >
              <X size={18} />
            </button>

            <header className="mb-6 space-y-2">
              <div className="w-12 h-12 bg-rose-500/10 text-rose-500 rounded-2xl flex items-center justify-center mb-3">
                <Trash2 size={22} />
              </div>
              <h4 className={`text-lg font-bold flex items-center gap-2 ${themeClasses.textWhite}`}>
                <span>Hapus Catatan Realisasi</span>
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Apakah Anda yakin ingin menghapus kuitansi mutasi ini? Tindakan ini bersifat permanen dan sisa saldo pagu anggaran untuk mata rekening belanja ini akan dikembalikan secara otomatis.
              </p>
              {transactions.find(t => t.id === txIdToDelete) && (
                <div className={`p-3 border rounded-xl space-y-1.5 text-xs font-mono ${isLight ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-white/5 border-white/5 text-slate-300'}`}>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Uraian:</span>
                    <span className="font-semibold line-clamp-1">{transactions.find(t => t.id === txIdToDelete)?.description}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Nominal:</span>
                    <span className="font-bold text-rose-500">{formatCurrency(transactions.find(t => t.id === txIdToDelete)?.amount || 0)}</span>
                  </div>
                </div>
              )}
            </header>

            <div className="pt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setTxIdToDelete(null)}
                className={`px-5 py-2.5 rounded-xl text-xs font-semibold tracking-wider transition-colors cursor-pointer ${isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-600' : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white'}`}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmDeleteTransaction}
                className="px-6 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold tracking-wider shadow-lg shadow-rose-600/15 transition-all cursor-pointer"
              >
                Ya, Hapus Realisasi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- CONFIRM SYSTEM MODAL: BUDGET OVERRUN (EXCEEDS 100%) --- */}
      {isOverrunModalOpen && overrunDetails && (
        <div id="overrun_warning_modal" className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className={`w-full max-w-lg border rounded-[32px] shadow-2xl p-6 md:p-8 text-left relative animate-in zoom-in-95 duration-200 transition-all ${isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-[#04060d]/95 border-white/10 text-white'}`}>
            <button
              onClick={() => {
                setIsOverrunModalOpen(false);
                setOverrunDetails(null);
              }}
              className="absolute top-5 right-5 text-slate-400 hover:text-indigo-650 dark:hover:text-white transition-colors p-1 cursor-pointer"
            >
              <X size={18} />
            </button>

            <header className="mb-6 space-y-2">
              <div className="w-12 h-12 bg-amber-500/15 text-amber-500 rounded-2xl flex items-center justify-center mb-3">
                <AlertTriangle size={22} className="animate-pulse" />
              </div>
              <h4 className={`text-lg font-bold flex items-center gap-2 ${themeClasses.textWhite}`}>
                <span>Peringatan: Pagu Anggaran Terlampaui</span>
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Realisasi {overrunDetails.type === "add" ? "baru" : "hasil edit"} ini akan menyebabkan total realisasi pada mata rekening belanja yang Anda pilih melampaui rencana pagu anggaran baseline <strong>{'(>100%)'}</strong>.
              </p>
            </header>

            <div className={`p-4 border rounded-2xl space-y-3.5 text-xs font-mono mb-4 ${isLight ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-white/5 border-white/5 text-slate-300'}`}>
              <div className="flex flex-col gap-1">
                <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Sub-Item Rekening:</span>
                <span className="font-semibold text-xs leading-relaxed text-indigo-500">{overrunDetails.itemName}</span>
              </div>
              
              <div className="h-px bg-slate-200 dark:bg-white/10" />

              <div className="grid grid-cols-2 gap-y-2.5 gap-x-4">
                <div className="flex flex-col">
                  <span className="text-slate-500 text-[9px] font-bold uppercase tracking-wider">Alokasi Rencana (Pagu):</span>
                  <span className="font-bold text-sm text-indigo-500 mt-0.5">{formatCurrency(overrunDetails.pagu)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-slate-500 text-[9px] font-bold uppercase tracking-wider">Total Realisasi Sebelumnya:</span>
                  <span className="font-bold text-sm text-slate-600 dark:text-slate-300 mt-0.5">{formatCurrency(overrunDetails.currentSpent)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-slate-500 text-[9px] font-bold uppercase tracking-wider font-mono">Nominal Realisasi {overrunDetails.type === "add" ? "Masuk" : "Edit"}:</span>
                  <span className="font-bold text-sm text-amber-500 mt-0.5">{formatCurrency(overrunDetails.proposedAmount)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-slate-500 text-[9px] font-bold uppercase tracking-wider">Estimasi Penyerapan Baru:</span>
                  <span className="font-bold text-sm text-rose-500 mt-0.5">
                    {formatCurrency(overrunDetails.newTotal)} ({((overrunDetails.newTotal / overrunDetails.pagu) * 100).toFixed(1)}%)
                  </span>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-amber-600 dark:text-amber-400 leading-relaxed font-semibold bg-amber-500/5 dark:bg-amber-500/10 p-3 rounded-2xl border border-amber-500/10 mb-4 flex items-start gap-2">
              <CircleAlert size={14} className="shrink-0 mt-0.5 text-amber-500" />
              <span>
                Simpan jika kebutuhan mendesak atau terdapat revisi mendahului perubahan. Rekening ini akan ditandai over-budget pada visualizer dashboard.
              </span>
            </p>

            <div className="pt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsOverrunModalOpen(false);
                  setOverrunDetails(null);
                }}
                className={`px-5 py-2.5 rounded-xl text-xs font-semibold tracking-wider transition-colors cursor-pointer ${isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-600' : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white'}`}
              >
                Kembali & Sesuaikan
              </button>
              <button
                type="button"
                onClick={handleConfirmOverrun}
                className="px-6 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold tracking-wider shadow-lg shadow-amber-600/15 transition-all cursor-pointer flex items-center gap-2"
              >
                <CheckCircle2 size={13} />
                <span>Ya, Tetap Simpan</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- FORM 3: UBOH REALISASI & UPLOAD PDF MODAL --- */}
      {isEditTxModalOpen && editingTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className={`w-full max-w-lg border rounded-[32px] shadow-2xl p-6 md:p-8 text-left relative animate-in zoom-in-95 duration-200 transition-all ${isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-[#04060d]/95 border-white/10 text-white'}`}>
            <button
              onClick={() => setIsEditTxModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-indigo-650 dark:hover:text-white transition-colors p-1 cursor-pointer"
            >
              <X size={18} />
            </button>

            <header className="mb-6 space-y-1">
              <h4 className={`text-lg font-bold flex items-center gap-2 ${themeClasses.textWhite}`}>
                <Edit2 className="text-[#818cf8]" size={18} />
                <span>Form Koreksi Realisasi & Lampiran</span>
              </h4>
              <p className="text-xs text-slate-500">Ubah rincian kuitansi belanja dan lampirkan berkas bukti pertanggungjawaban PDF</p>
            </header>

            <form onSubmit={handleSaveEditTransaction} className="space-y-4">
              
              {/* Category Dropdown */}
              <div className="space-y-1">
                <label className={`text-[10px] uppercase font-black tracking-wider block ${isLight ? 'text-black' : 'text-slate-500'}`}>Kategori Belanja</label>
                <select
                  value={editCategoryId}
                  onChange={(e) => {
                    const newCatId = e.target.value;
                    setEditCategoryId(newCatId);
                    const catObj = categories.find(c => c.id === newCatId);
                    if (catObj && catObj.items.length > 0) {
                      setEditItemId(catObj.items[0].id);
                    } else {
                      setEditItemId("");
                    }
                  }}
                  className={`w-full text-xs border rounded-xl px-4 py-2.5 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer font-bold ${isLight ? 'bg-white border-slate-300 text-black' : 'bg-white/5 border-white/10 text-white'}`}
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id} className={isLight ? "bg-white text-black" : "bg-[#02040a] text-white"}>
                      {cat.nama}
                    </option>
                  ))}
                </select>
              </div>

              {/* Items Dropdown */}
              <div className="space-y-1">
                <label className={`text-[10px] uppercase font-black tracking-wider block ${isLight ? 'text-black' : 'text-slate-500'}`}>Spesifik Item RKA</label>
                <select
                  value={editItemId}
                  onChange={(e) => setEditItemId(e.target.value)}
                  className={`w-full text-xs border rounded-xl px-4 py-2.5 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer font-bold ${isLight ? 'bg-white border-slate-300 text-black' : 'bg-white/5 border-white/10 text-white'}`}
                >
                  {categories.find(c => c.id === editCategoryId)?.items?.map((item) => {
                    const spent = calculateItemRealisasi(item.id, transactions);
                    const originalAmount = editingTx?.itemId === item.id ? (editingTx?.amount || 0) : 0;
                    const sisa = item.rencana - spent + originalAmount;
                    return (
                      <option key={item.id} value={item.id} className={isLight ? "bg-white text-black" : "bg-[#02040a] text-white"}>
                        {item.nama} (Sisa Pagu: {formatCurrency(sisa)})
                      </option>
                    );
                  }) || (
                    <option value="" className={isLight ? "bg-white text-black" : "bg-[#02040a] text-white"}>Tidak ada sub-item</option>
                  )}
                </select>
              </div>

              {/* Date & Auto Month */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className={`text-[10px] uppercase font-black tracking-wider block ${isLight ? 'text-black' : 'text-slate-500'}`}>Tanggal Kuitansi</label>
                  <input
                    type="date"
                    required
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className={`w-full text-xs border rounded-xl px-4 py-2.5 focus:outline-none focus:border-indigo-555 transition-all ${isLight ? 'bg-white border-slate-300 text-black' : 'bg-white/5 border-white/10 text-white'}`}
                  />
                </div>
                <div className="space-y-1 text-left">
                  <span className={`text-[10px] uppercase font-black tracking-wider block ${isLight ? 'text-black' : 'text-slate-500'}`}>Bulan Anggaran</span>
                  <div className={`w-full text-xs rounded-xl px-4 py-2.5 font-bold select-none border ${isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-white/[0.02] border-white/5 text-slate-400'}`}>
                    {getMonthName(new Date(editDate).getMonth() + 1)}
                  </div>
                </div>
              </div>

              {/* Amount Input */}
              <div className="space-y-1">
                <label className={`text-[10px] uppercase font-black tracking-wider block ${isLight ? 'text-black' : 'text-slate-500'}`}>Besaran Rupiah (IDR)</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                    Rp
                  </div>
                  <input
                    type="number"
                    required
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="Contoh: 15000000"
                    className={`w-full text-xs font-extrabold border rounded-xl py-2.5 pl-10 pr-4 focus:outline-none focus:border-indigo-500 transition-all ${isLight ? 'bg-white border-slate-300 text-black' : 'bg-white/5 border-white/10 text-indigo-300'}`}
                  />
                </div>
              </div>

              {/* Warning badge */}
              {editWarning && (
                <div className="bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-300 rounded-xl p-3 text-[11px] leading-relaxed flex gap-2">
                  <AlertTriangle className="text-amber-500 shrink-0" size={14} />
                  <span>{editWarning}</span>
                </div>
              )}

              {/* Description textarea */}
              <div className="space-y-1">
                <label className={`text-[10px] uppercase font-black tracking-wider block ${isLight ? 'text-black' : 'text-slate-500'}`}>Keterangan / Deskripsi Belanja</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Deskripsi pengeluaran atau alasan perbaikan..."
                  rows={2}
                  className={`w-full text-xs border rounded-xl px-4 py-2.5 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-all resize-none ${isLight ? 'bg-white border-slate-300 text-black' : 'bg-white/5 border-white/10 text-white'}`}
                />
              </div>

              {/* Attachment PDF uploader block */}
              <div className="space-y-1">
                <label className={`text-[10px] uppercase font-black tracking-wider block ${isLight ? 'text-black' : 'text-slate-500'}`}>
                  Unggah Dokumen Bukti (PDF)
                </label>
                {editPdfName ? (
                  <div className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-bold leading-none ${isLight ? 'bg-indigo-50 border-indigo-200 text-indigo-750' : 'bg-indigo-950/20 border-[#818cf8]/10 text-indigo-300'}`}>
                    <div className="flex items-center gap-2 overflow-hidden mr-2">
                      <FileText size={16} className="shrink-0 text-red-500" />
                      <span className="truncate text-xs block font-mono" title={editPdfName}>{editPdfName}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {editPdfUrl && (
                        <a
                          href={editPdfUrl}
                          download={editPdfName}
                          className={`p-1.5 px-2.5 rounded-lg border text-[10px] uppercase font-black transition-colors ${isLight ? 'bg-white border-slate-250 hover:bg-slate-100 text-slate-700' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'}`}
                          title="Download PDF"
                        >
                          Unduh
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={handleRemovePdf}
                        className={`p-1.5 px-2.5 rounded-lg border text-[10px] uppercase font-black transition-colors ${isLight ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100' : 'bg-rose-950/20 border-rose-800/40 text-rose-400 hover:bg-rose-900/20'}`}
                        title="Hapus berkas ini"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="file"
                      accept="application/pdf"
                      id="editPdfUploadInput"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.type !== "application/pdf") {
                            showToast("Berkas harus berupa format PDF.", "warn");
                            return;
                          }
                          if (isGoogleLinked && getCachedToken()) {
                            try {
                              setIsGoogleSyncLoading(true);
                              showToast("Mengunggah dokumen PDF ke Google Drive Anda...", "info");
                              const uploadRes = await uploadPdfToDrive(file);
                              setEditPdfUrl(uploadRes.webViewLink);
                              setEditPdfName(uploadRes.name);
                              showToast("Dokumen PDF berhasil disimpan ke Google Drive!", "success");
                            } catch (err: any) {
                              console.error(err);
                              showToast("Gagal mengupload berkas ke Google Drive: " + err.message, "warn");
                            } finally {
                              setIsGoogleSyncLoading(false);
                            }
                          } else {
                            const reader = new FileReader();
                            reader.onload = () => {
                              setEditPdfUrl(reader.result as string);
                              setEditPdfName(file.name);
                              showToast("Dokumen PDF tersimpan sementara di memori lokal!");
                            };
                            reader.readAsDataURL(file);
                          }
                        }
                      }}
                    />
                    <label
                      htmlFor="editPdfUploadInput"
                      className={`w-full flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-4 py-5 cursor-pointer hover:border-indigo-500 transition-colors ${isLight ? 'bg-slate-50 border-slate-205 border-slate-200 text-slate-500 hover:bg-slate-100/50' : 'bg-[#0a0f1d] border-white/10 text-slate-400 hover:bg-white/[0.02]'}`}
                    >
                      <FileText size={20} className="text-slate-400 mb-1.5" />
                      <span className="text-[11px] font-bold">Pilih berkas kwitansi PDF</span>
                      <span className="text-[9px] text-slate-500 mt-1 uppercase font-black tracking-wider">Maksimum file PDF: 5 MB</span>
                    </label>
                  </div>
                )}
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditTxModalOpen(false)}
                  className={`px-5 py-2.5 rounded-xl text-xs font-semibold tracking-wider transition-colors cursor-pointer ${isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-600' : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white'}`}
                >
                  Kembali
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-indigo-650 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold tracking-wider shadow-lg shadow-indigo-650/15 transition-all cursor-pointer"
                >
                  Simpan Koreksi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
