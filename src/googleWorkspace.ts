import { initializeApp, getApp, getApps } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User
} from "firebase/auth";
import firebaseConfig from "../firebase-applet-config.json";
import { BudgetCategory, RealisasiTransaction } from "./types";

// Initialize Firebase safely
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope("https://www.googleapis.com/auth/spreadsheets");
provider.addScope("https://www.googleapis.com/auth/drive");

export const FOLDER_ID = "1AJcP2TAvDYghh0kb21ZUQ_ou0WeW3B7k";
export const SPREADSHEET_ID = "1-gVQc5jKDzJaBgDCuOvx7khD9NS9839j";

let cachedAccessToken: string | null = null;
try {
  cachedAccessToken = localStorage.getItem("gdrive_access_token");
} catch (e) {
  console.error("Gagal memuat gdrive_access_token dari localStorage:", e);
}
let isSigningIn = false;

// Initialize auth listener
export const initAuth = (
  onAuthSuccess: (user: User, token: string) => void,
  onAuthFailure: () => void
) => {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      if (cachedAccessToken) {
        onAuthSuccess(user, cachedAccessToken);
      } else {
        // Token was cleared or wasn't saved in-memory yet, fallback to login screen indicators
        onAuthFailure();
      }
    } else {
      setCachedToken(null);
      onAuthFailure();
    }
  });
};

// Sign in with Google Popup and cache access token
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  if (isSigningIn) return null;
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("Gagal memperoleh access token dari Firebase Auth");
    }
    setCachedToken(credential.accessToken);
    return { user: result.user, accessToken: cachedAccessToken! };
  } catch (error) {
    console.error("Gagal Login dengan Google:", error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const logout = async () => {
  await auth.signOut();
  setCachedToken(null);
  localStorage.removeItem("apbd_2026_google_linked");
};

export const getCachedToken = () => cachedAccessToken;
export const setCachedToken = (token: string | null) => {
  cachedAccessToken = token;
  try {
    if (token) {
      localStorage.setItem("gdrive_access_token", token);
    } else {
      localStorage.removeItem("gdrive_access_token");
    }
  } catch (e) {
    console.error("Gagal menyimpan gdrive_access_token ke localStorage:", e);
  }
};

/**
 * GOOGLE DRIVE API - Upload PDF File to Specific Folder
 */
export async function uploadPdfToDrive(file: File): Promise<{ webViewLink: string; name: string }> {
  const token = cachedAccessToken;
  if (!token) {
    throw new Error("Anda harus login dengan Google terlebih dahulu untuk mengunggah ke Google Drive.");
  }

  // Helper function to perform upload
  const performUpload = async (parents?: string[]) => {
    const metadata: any = {
      name: file.name,
      mimeType: "application/pdf"
    };
    if (parents && parents.length > 0) {
      metadata.parents = parents;
    }

    const formData = new FormData();
    formData.append(
      "metadata",
      new Blob([JSON.stringify(metadata)], { type: "application/json" })
    );
    formData.append("file", file);

    return fetch(
      `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      }
    );
  };

  // Try uploading to specific folder first
  let response = await performUpload([FOLDER_ID]);

  if (!response.ok) {
    console.warn(`Gagal mengunggah file ke folder spesifik (${FOLDER_ID}). Mencoba mengunggah ke root Google Drive...`);
    // Retry without parent folder (defaults to Root of their Drive)
    response = await performUpload();
  }

  if (!response.ok) {
    const errText = await response.text();
    console.error("Gagal mengunggah file ke Google Drive (Root & Folder):", errText);
    throw new Error(`Upload gagal: ${response.statusText}`);
  }

  const result = await response.json();
  return {
    webViewLink: result.webViewLink,
    name: result.name
  };
}

/**
 * GOOGLE SHEETS API - Sync / Read / Write Data
 */

// Initialize Spreadsheet tabs if they are missing
async function ensureSheetsExist(token: string): Promise<void> {
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );

  if (!metaRes.ok) {
    throw new Error(`Gagal mengambil detail spreadsheet: ${metaRes.statusText}`);
  }

  const metaData = await metaRes.json();
  const sheets: any[] = metaData.sheets || [];
  const existingTitles = sheets.map(s => s.properties.title);

  const requests: any[] = [];
  if (!existingTitles.includes("Categories")) {
    requests.push({
      addSheet: {
        properties: { title: "Categories" }
      }
    });
  }
  if (!existingTitles.includes("Transactions")) {
    requests.push({
      addSheet: {
        properties: { title: "Transactions" }
      }
    });
  }

  if (requests.length > 0) {
    const updateRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ requests })
      }
    );
    if (!updateRes.ok) {
      console.warn("Gagal menambahkan tab baru di spreadsheet:", await updateRes.text());
    }
  }
}

// Write current local state data to the spreadsheet
export async function saveAllDataToGoogleSheets(
  categories: BudgetCategory[],
  transactions: RealisasiTransaction[]
): Promise<void> {
  const token = cachedAccessToken;
  if (!token) {
    throw new Error("Lakukan autentikasi Google sebelum menyimpan ke Google Sheets.");
  }

  await ensureSheetsExist(token);

  // Write Categories
  // Format: Category ID, Category Kode, Category Nama, Item ID, Item Nama, Item Rencana
  const categoryRows = [
    ["Category ID", "Category Kode", "Category Nama", "Item ID", "Item Nama", "Item Rencana"]
  ];
  categories.forEach((cat) => {
    cat.items.forEach((item) => {
      categoryRows.push([
        cat.id,
        cat.kode,
        cat.nama,
        item.id,
        item.nama,
        item.rencana.toString()
      ]);
    });
  });

  // Write Transactions
  // Format: Transaction ID, Item ID, Category ID, Amount, Date, Month, Description, PDF Url, PDF Name
  const transactionRows = [
    ["Transaction ID", "Item ID", "Category ID", "Amount", "Date", "Month", "Description", "PDF Url", "PDF Name"]
  ];
  transactions.forEach((tx) => {
    transactionRows.push([
      tx.id,
      tx.itemId,
      tx.categoryId,
      tx.amount.toString(),
      tx.date,
      tx.month.toString(),
      tx.description,
      tx.pdfUrl || "",
      tx.pdfName || ""
    ]);
  });

  // Execute Spreadsheet batchUpdate
  const data = [
    {
      range: "Categories!A1:F" + categoryRows.length,
      values: categoryRows
    },
    {
      range: "Transactions!A1:I" + transactionRows.length,
      values: transactionRows
    }
  ];

  // We should also clear any extra rows that might remain below
  // For simplicity, we can do a clear or just overwrite. Overwriting is usually fine,
  // but to be absolutely clean, we can clear the sheets first, or clear down to cell Z1000.
  // Let's clear the old ranges before writing new ones!
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Categories!A1:Z1000:clear`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` }
    }
  );

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Transactions!A1:Z1000:clear`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` }
    }
  );

  // Send updates
  const updateRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values:batchUpdate`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        valueInputOption: "USER_ENTERED",
        data: data
      })
    }
  );

  if (!updateRes.ok) {
    const errText = await updateRes.text();
    console.error("Gagal menyinkronkan data ke Google Sheets:", errText);
    throw new Error(`Sync gagal: ${updateRes.statusText}`);
  }
}

// Read and parse all data from target Google Spreadsheet
export async function loadAllDataFromGoogleSheets(): Promise<{
  categories: BudgetCategory[];
  transactions: RealisasiTransaction[];
}> {
  const token = cachedAccessToken;
  if (!token) {
    throw new Error("Lakukan login Google sebelum memuat dari Google Sheets.");
  }

  await ensureSheetsExist(token);

  // Fetch Categories sheet
  const catRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Categories!A2:F1000`,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );

  // Fetch Transactions sheet
  const txRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Transactions!A2:I1000`,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );

  if (!catRes.ok || !txRes.ok) {
    throw new Error("Gagal mengambil baris nilai dari Google Sheets.");
  }

  const catVal = await catRes.json();
  const txVal = await txRes.json();

  const catRows: string[][] = catVal.values || [];
  const txRows: string[][] = txVal.values || [];

  // Parse Categories
  // Columns: Category ID, Category Kode, Category Nama, Item ID, Item Nama, Item Rencana
  const loadedCategories: BudgetCategory[] = [];

  catRows.forEach((row) => {
    if (row.length < 6) return;
    const [catId, catKode, catNama, itemId, itemNama, itemRencanaStr] = row;
    const itemRencana = Number(itemRencanaStr) || 0;

    let existingCat = loadedCategories.find(c => c.id === catId);
    if (!existingCat) {
      existingCat = {
        id: catId,
        kode: catKode,
        nama: catNama,
        items: []
      };
      loadedCategories.push(existingCat);
    }

    existingCat.items.push({
      id: itemId,
      nama: itemNama,
      rencana: itemRencana,
      monthlySpent: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0 }
    });
  });

  // Parse Transactions
  // Columns: Transaction ID, Item ID, Category ID, Amount, Date, Month, Description, PDF Url, PDF Name
  const loadedTransactions: RealisasiTransaction[] = [];

  txRows.forEach((row) => {
    if (row.length < 7) return;
    const [id, itemId, categoryId, amountStr, date, monthStr, description, pdfUrl, pdfName] = row;
    loadedTransactions.push({
      id,
      itemId,
      categoryId,
      amount: Number(amountStr) || 0,
      date,
      month: Number(monthStr) || 1,
      description,
      pdfUrl: pdfUrl || undefined,
      pdfName: pdfName || undefined
    });
  });

  return {
    categories: loadedCategories,
    transactions: loadedTransactions
  };
}
