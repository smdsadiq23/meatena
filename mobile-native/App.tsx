import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  errorCodes,
  isErrorWithCode,
  pick,
  types,
  type DocumentPickerResponse,
} from '@react-native-documents/picker';
import {
  Alert,
  Image,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput as RNTextInput,
  type TextInputProps,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

const meatenaLogo = require('./assets/brand-icon.png');

type Role = 'admin' | 'staff';
type Language = 'en' | 'ar';
type TransactionCurrency = 'KWD' | 'USD';
type Screen =
  | 'dashboard'
  | 'billing'
  | 'invoices'
  | 'customers'
  | 'stock'
  | 'purchases'
  | 'suppliers'
  | 'payments'
  | 'shift'
  | 'knet'
  | 'statement'
  | 'expenses'
  | 'reports'
  | 'activity'
  | 'admin'
  | 'users';

type AuthUser = {
  id?: number;
  sub?: number;
  username: string;
  role: Role;
};

type Customer = {
  id: number;
  name: string;
  mobile?: string | null;
  address?: string | null;
  credit_limit?: number | string;
  balance?: number | string;
};

type Product = {
  id: number;
  name: string;
  sku?: string | null;
  price_per_kg: number | string;
  stock_kg: number | string;
  stock_pieces?: number | string;
  low_stock_kg?: number | string;
  low_stock?: boolean;
};

type Supplier = {
  id: number;
  name: string;
  mobile?: string | null;
  address?: string | null;
  balance?: number | string;
};

type Purchase = {
  id: number;
  supplier_id: number;
  invoice_no?: string | null;
  transaction_currency?: TransactionCurrency;
  exchange_rate?: number | string;
  total_amount?: number | string;
  receipt_original_name?: string | null;
  receipt_file_name?: string | null;
  created_at?: string;
};

type PurchaseDetail = Purchase & {
  items: Array<{
    product_id: number;
    pieces?: number | string | null;
    weight: number | string;
    cost_per_kg: number | string;
  }>;
};

type Expense = {
  id: number;
  title: string;
  category: string;
  amount: number | string;
  date?: string;
};

type AuditLog = {
  id: number;
  action: string;
  entity: string;
  username?: string;
  created_at?: string;
};

type UserRecord = {
  id: number;
  username: string;
  role: Role;
};

type InventorySummary = {
  totals?: {
    productCount?: number;
    totalStockKg?: number | string;
    totalStockPieces?: number | string;
    stockValue?: number | string;
    estimatedRetailValue?: number | string;
    lowStockCount?: number;
    outOfStockCount?: number;
  };
  lowStockItems?: Array<{
    id: number;
    name: string;
    sku?: string | null;
    stock_kg: number | string;
    low_stock_kg?: number | string;
  }>;
};

type ReorderSuggestion = {
  product_id: number;
  product_name: string;
  stock_kg: number | string;
  suggested_purchase_kg?: number | string;
  suggestedPurchaseKg?: number | string;
};

type ShiftSummary = {
  date?: string;
  totals?: {
    paymentCount?: number;
    cashCollection?: number | string;
    knetCollection?: number | string;
    totalCollection?: number | string;
  };
  close?: ShiftClose | null;
};

type ShiftClose = {
  id: number;
  date: string;
  counted_cash: number | string;
  counted_knet: number | string;
  variance?: number | string;
  status?: string;
};

type StatementRow = {
  id?: number;
  date?: string;
  description?: string;
  debit?: number | string;
  credit?: number | string;
  balance?: number | string;
};

type CreditSummary = {
  total_outstanding?: number | string;
  customer_count?: number;
};

type KnetReconciliation = {
  pending?: number;
  completed?: number;
  failed?: number;
  sessions?: Array<{
    id?: number | string;
    invoice_id?: number;
    amount?: number | string;
    status?: string;
  }>;
};

type Invoice = {
  id: number;
  invoice_number?: string | null;
  customer_id?: number;
  date?: string;
  type?: string;
  total: number | string;
  previous_balance?: number | string;
  grand_total: number | string;
  paid_amount?: number | string;
  outstanding_amount?: number | string;
  payment_count?: number;
  payment_status?: string;
  status?: string;
  delivery_receipt_original_name?: string | null;
  delivery_receipt_uploaded_at?: string | null;
  void_reason?: string | null;
  voided_at?: string | null;
};

type InvoiceLineItem = {
  id: number;
  product_id?: number | null;
  product_name?: string;
  pieces?: number | string | null;
  weight: number | string;
  price_per_kg: number | string;
  amount: number | string;
};

type InvoiceDetail = Invoice & {
  customer?: Customer;
  items: InvoiceLineItem[];
  payments: PaymentRecord[];
};

type PaymentRecord = {
  id: number;
  customer_id: number;
  invoice_id?: number | null;
  amount: number | string;
  mode: string;
  status?: string;
  date?: string;
  reversal_reason?: string | null;
};

type HealthState = {
  status: 'ok' | 'degraded';
  dependencies: {
    database: { status: string };
    knet: { status: string; missing: string[] };
  };
};

type ReportData = {
  sales: number | string;
  expenses: number | string;
  expenseTotal?: number | string;
  profit: number | string;
};

type HistoricReport = {
  range: { from: string; to: string };
  totals: {
    invoiceCount: number;
    paymentCount: number;
    expenseCount: number;
    purchaseCount: number;
    stockMovementCount: number;
    salesTotal: number | string;
    netCollection: number | string;
    expenseTotal: number | string;
    purchaseTotal: number | string;
    grossProfit: number | string;
    cashCollection: number | string;
    knetCollection: number | string;
    stockInKg: number;
    stockOutKg: number;
    wastageKg: number;
  };
  invoices: Array<{ id: number; invoice_number: string; customer_name: string; total: number; type: string; date: string }>;
  payments: Array<{ id: number; customer_name: string; amount: number; mode: string; date: string }>;
  purchases: Array<{ id: number; supplier_name: string; invoice_no?: string | null; total: number; date: string }>;
  stockMovements: Array<{ id: number; product_name: string; type: string; quantity_kg: number; date: string }>;
  topCustomers: Array<{ id: number; name: string; sales: number; collected: number; invoiceCount: number }>;
  topProducts: Array<{ id: number; name: string; soldKg: number; purchasedKg: number; currentStockKg: number }>;
};

type DashboardData = {
  todaySales?: number | string;
  todayCollection?: number | string;
  outstanding?: number | string;
  invoiceCount?: number;
};

type InvoiceItemForm = {
  productId: number | null;
  pieces: string;
  weight: string;
  price: string;
};

type KnetLink = {
  url?: string;
  payment_url?: string;
  paymentId?: string;
};

type InvoiceProfile = {
  id?: number;
  name: string;
  invoice_title: string;
  invoice_title_ar?: string | null;
  company_name: string;
  company_name_ar?: string | null;
  company_activity?: string | null;
  company_activity_ar?: string | null;
  company_address: string;
  company_phone: string;
  company_email?: string | null;
  contact_names?: string | null;
  is_default?: boolean;
};

type InvoiceProfileForm = {
  id?: number;
  name: string;
  invoiceTitle: string;
  invoiceTitleAr: string;
  companyName: string;
  companyNameAr: string;
  companyActivity: string;
  companyActivityAr: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  contactNames: string;
};

const CLOUD_API = process.env.CLOUD_API_URL ?? 'https://meatena.induxen.com/api';
const LAN_API = process.env.LAN_API_URL ?? 'http://192.168.29.204:3003';
const DEFAULT_API = CLOUD_API;
const SERVER_PRESETS = [
  {
    label: 'Cloud server',
    value: CLOUD_API,
    caption: 'Use this APK anywhere with internet',
  },
  {
    label: 'This Mac LAN',
    value: LAN_API,
    caption: 'Use this only for local development on the same Wi-Fi',
  },
  {
    label: 'Android emulator',
    value: 'http://10.0.2.2:3003',
    caption: 'Mac localhost from emulator',
  },
  {
    label: 'Custom LAN',
    value: 'http://',
    caption: 'Type your server IP manually',
  },
  {
    label: Platform.OS === 'ios' ? 'iOS simulator' : 'Localhost',
    value: 'http://localhost:3003',
    caption: 'Web/iOS simulator only',
  },
];

const emptyInvoiceForm = {
  invoiceNumber: '',
  type: 'credit' as 'cash' | 'credit',
};

const defaultInvoiceProfile: InvoiceProfile = {
  name: 'Default',
  invoice_title: 'Credit Invoice',
  invoice_title_ar: '',
  company_name: 'Meatena Butchery Operations',
  company_name_ar: '',
  company_activity: '',
  company_activity_ar: '',
  company_address: 'Kuwait',
  company_phone: '00000000',
  company_email: 'almajad.albasat.co@gmail.com',
  contact_names: 'Abdul Basit, Zahoor Ellahi',
  is_default: true,
};

const ARABIC_LABELS: Record<string, string> = {
  'Meatena Native': 'ميتينا نيتف',
  'Butchery Operations': 'عمليات الملحمة',
  Server: 'الخادم',
  'Backend URL / IP': 'رابط أو عنوان الخادم',
  'Backend URL or IP': 'رابط أو عنوان الخادم',
  Login: 'تسجيل الدخول',
  Username: 'اسم المستخدم',
  Password: 'كلمة المرور',
  'Signing in...': 'جاري الدخول...',
  Logout: 'تسجيل الخروج',
  'Front Counter': 'الكاونتر',
  Stock: 'المخزون',
  Finance: 'المالية',
  Admin: 'الإدارة',
  Billing: 'الفوترة',
  History: 'السجل',
  Customers: 'العملاء',
  Collections: 'التحصيل',
  Statement: 'كشف الحساب',
  'Shift Close': 'إغلاق الوردية',
  Purchases: 'المشتريات',
  Suppliers: 'الموردون',
  Dashboard: 'لوحة التحكم',
  Reports: 'التقارير',
  Expenses: 'المصروفات',
  Activity: 'النشاط',
  System: 'النظام',
  Users: 'المستخدمون',
  KNET: 'كي نت',
  'Business Snapshot': 'ملخص الأعمال',
  'Meatena dashboard': 'لوحة تحكم ميتينا',
  'Today Sales': 'مبيعات اليوم',
  Collection: 'التحصيل',
  Outstanding: 'المستحقات',
  Invoices: 'الفواتير',
  Sales: 'المبيعات',
  Profit: 'الربح',
  'Inventory Snapshot': 'ملخص المخزون',
  'Retail Stock Value': 'قيمة المخزون للبيع',
  'Low Stock Items': 'أصناف منخفضة',
  'Out Of Stock': 'نفد المخزون',
  'Stock KG': 'المخزون كجم',
  'Restock Watch': 'متابعة إعادة الطلب',
  'Lowest stock items': 'أقل الأصناف مخزونا',
  'Performance Note': 'ملاحظة أداء',
  'POS Billing': 'فوترة الكاونتر',
  'Fast counter invoice screen': 'شاشة فوترة سريعة للكاونتر',
  'Invoice Details': 'تفاصيل الفاتورة',
  'Invoice number': 'رقم الفاتورة',
  'Invoice profile': 'ملف الفاتورة',
  'Add Profile': 'إضافة ملف',
  'Edit Profile': 'تعديل الملف',
  'Delete Profile': 'حذف الملف',
  'Profile setup': 'إعداد الملف',
  'Profile name': 'اسم الملف',
  'Invoice title': 'عنوان الفاتورة',
  'Invoice title Arabic': 'عنوان الفاتورة بالعربية',
  'Company name': 'اسم الشركة',
  'Company name Arabic': 'اسم الشركة بالعربية',
  'Company activity': 'نشاط الشركة',
  'Company activity Arabic': 'نشاط الشركة بالعربية',
  'Company address': 'عنوان الشركة',
  'Company phone': 'هاتف الشركة',
  'Company email': 'البريد الإلكتروني للشركة',
  'Contact names': 'أسماء جهات الاتصال',
  'Save Profile': 'حفظ الملف',
  Cancel: 'إلغاء',
  Customer: 'العميل',
  'Select customer': 'اختر العميل',
  Balance: 'الرصيد',
  Credit: 'آجل',
  Cash: 'نقدي',
  'After This Bill': 'بعد هذه الفاتورة',
  Remaining: 'المتبقي',
  Item: 'الصنف',
  'Select product': 'اختر المنتج',
  'Weight kg': 'الوزن كجم',
  Price: 'السعر',
  'Remove Item': 'حذف الصنف',
  '+ Add Item': '+ إضافة صنف',
  Total: 'الإجمالي',
  Reset: 'إعادة ضبط',
  'Create Invoice': 'إنشاء فاتورة',
  'Processing...': 'جاري المعالجة...',
  'Customer name': 'اسم العميل',
  Mobile: 'الموبايل',
  Address: 'العنوان',
  'Credit limit': 'حد الائتمان',
  'Create Customer': 'إنشاء عميل',
  'Customer list': 'قائمة العملاء',
  Payments: 'المدفوعات',
  'Payment amount': 'مبلغ الدفع',
  'Record Cash Payment': 'تسجيل دفع نقدي',
  'Create KNET Link': 'إنشاء رابط كي نت',
  'Create Card Link': 'إنشاء رابط بطاقة',
  'Open KNET Link': 'فتح رابط كي نت',
  'Open Card Link': 'فتح رابط البطاقة',
  'Share on WhatsApp': 'مشاركة واتساب',
  'Recent payments': 'آخر المدفوعات',
  'Reverse payment': 'عكس الدفع',
  'Reversal reason': 'سبب العكس',
  'Reverse Selected Payment': 'عكس الدفع المحدد',
  'Stock & Buying': 'المخزون والشراء',
  'Stock Lookup': 'البحث في المخزون',
  'Low Stock': 'مخزون منخفض',
  'Add product': 'إضافة منتج',
  'Product name': 'اسم المنتج',
  SKU: 'رمز المنتج',
  'Selling price': 'سعر البيع',
  'Low stock kg': 'حد المخزون كجم',
  'Create Product': 'إنشاء منتج',
  'Stock adjustment': 'تعديل المخزون',
  Wastage: 'هالك',
  Adjustment: 'تعديل',
  'Quantity kg': 'الكمية كجم',
  Note: 'ملاحظة',
  'Record Movement': 'تسجيل الحركة',
  'Current stock': 'المخزون الحالي',
  'Reorder suggestions': 'اقتراحات إعادة الطلب',
  'Purchase Entry': 'إدخال مشتريات',
  'Supplier invoice no.': 'رقم فاتورة المورد',
  'Cost per kg': 'التكلفة لكل كجم',
  'Record Purchase': 'تسجيل شراء',
  'Recent purchases': 'آخر المشتريات',
  'Open PDF': 'فتح PDF',
  'Upload Receipt': 'رفع إيصال',
  'Open Receipt': 'فتح الإيصال',
  'Supplier name': 'اسم المورد',
  'Add Supplier': 'إضافة مورد',
  'Supplier payment': 'دفع مورد',
  'Reference no.': 'رقم المرجع',
  'Record Supplier Payment': 'تسجيل دفع مورد',
  'Supplier directory': 'دليل الموردين',
  'Invoice History': 'سجل الفواتير',
  Details: 'التفاصيل',
  'Void invoice': 'إلغاء الفاتورة',
  'Void reason': 'سبب الإلغاء',
  'Void Selected Invoice': 'إلغاء الفاتورة المحددة',
  'Invoice Detail': 'تفاصيل الفاتورة',
  'Back to History': 'رجوع للسجل',
  Previous: 'السابق',
  'Grand Total': 'الإجمالي الكلي',
  Due: 'المستحق',
  Paid: 'المدفوع',
  Status: 'الحالة',
  'Line items': 'بنود الفاتورة',
  'Delivery receipt': 'إيصال التسليم',
  'Void This Invoice': 'إلغاء هذه الفاتورة',
  'Counted cash': 'النقد المعدود',
  'Counted KNET': 'كي نت المعدود',
  Notes: 'ملاحظات',
  Variance: 'الفرق',
  'Submit Shift Close': 'إرسال إغلاق الوردية',
  'KNET Reconcile': 'مطابقة كي نت',
  Pending: 'معلق',
  Completed: 'مكتمل',
  Failed: 'فشل',
  'Recent sessions': 'آخر الجلسات',
  'Customer Ledger': 'دفتر العميل',
  'Business Reports': 'تقارير الأعمال',
  'Staff Activity': 'نشاط الموظفين',
  'Users & Roles': 'المستخدمون والصلاحيات',
  Staff: 'موظف',
  'Create User': 'إنشاء مستخدم',
  'Current users': 'المستخدمون الحاليون',
  'Native App Status': 'حالة التطبيق',
  'Server URL / IP': 'رابط أو عنوان الخادم',
  'KWD to USD rate': 'سعر الدينار مقابل الدولار',
  'Current Rate': 'السعر الحالي',
  'Currency Example': 'مثال العملة',
  'Save Rate': 'حفظ السعر',
  Backend: 'الخادم',
  Products: 'المنتجات',
  'Reload Data': 'إعادة تحميل البيانات',
  'Show Native Note': 'عرض ملاحظة التطبيق',
  'Backend online': 'الخادم متصل',
  'Backend offline': 'الخادم غير متصل',
  Live: 'مباشر',
  Mock: 'تجريبي',
  Unlimited: 'غير محدود',
};

const LanguageContext = React.createContext<{
  language: Language;
  t: (text: string) => string;
}>({
  language: 'en',
  t: text => text,
});

function translate(language: Language, text: string) {
  return language === 'ar' ? ARABIC_LABELS[text] ?? text : text;
}

function useLanguage() {
  return useContext(LanguageContext);
}

function TextInput(props: TextInputProps) {
  const { language, t } = useLanguage();
  return (
    <RNTextInput
      {...props}
      placeholder={props.placeholder ? t(props.placeholder) : props.placeholder}
      placeholderTextColor={props.placeholderTextColor ?? '#64748b'}
      selectionColor="#e71932"
      textAlign={props.textAlign ?? (language === 'ar' ? 'right' : 'left')}
    />
  );
}

const emptySupplierForm = { name: '', mobile: '', address: '' };
const emptyPurchaseForm = { supplierId: '', invoiceNo: '', pieces: '', weight: '', costPerKg: '' };
const emptyExpenseForm = { title: '', category: 'misc', amount: '' };
const emptyShiftForm = { countedCash: '', countedKnet: '', notes: '' };
const emptyUserForm = { username: '', password: '', role: 'staff' as Role };
const emptyStockForm = { type: 'wastage' as 'wastage' | 'adjustment', quantity: '', note: '' };
const emptyCustomerForm = { name: '', mobile: '', address: '', creditLimit: '' };
const emptyProductForm = { name: '', sku: '', price: '', lowStockKg: '' };
const emptySupplierPaymentForm = { amount: '', mode: 'cash', referenceNo: '', note: '' };
const emptyReverseForm = { paymentId: '', reason: '' };
const emptyVoidForm = { invoiceId: '', reason: '' };
const noEdit = 0;

function money(value: number | string | undefined | null) {
  return Number(value ?? 0).toFixed(3);
}

let currentKwdToUsdRate = Number(process.env.KWD_TO_USD_RATE ?? 3.25);

function currency(value: number | string | undefined | null) {
  const parts = splitCurrency(value);
  return `${parts.kwd}\n${parts.usd}`;
}

function splitCurrency(value: number | string | undefined | null) {
  const kwd = Number(value ?? 0);
  return {
    kwd: `KWD ${kwd.toFixed(3)}`,
    usd: `USD ${(kwd * currentKwdToUsdRate).toFixed(2)}`,
  };
}

function currencyInline(value: number | string | undefined | null) {
  const kwd = Number(value ?? 0);
  return `KWD ${kwd.toFixed(3)} | USD ${(kwd * currentKwdToUsdRate).toFixed(2)}`;
}

function invoiceLabel(invoice: Invoice) {
  return invoice.invoice_number || `#${invoice.id}`;
}

function customerName(customers: Customer[], id?: number | null) {
  return customers.find(customer => customer.id === id)?.name ?? `Customer #${id ?? '-'}`;
}

function compactPhone(value?: string | null) {
  return (value ?? '').replace(/[^\d]/g, '');
}

function isCurrencyValue(value?: string) {
  return Boolean(value?.startsWith('KWD ') && value.includes('\nUSD '));
}

function normalizeServerUrl(value: string) {
  const trimmed = value.trim().replace(/\/+$/, '');

  if (!trimmed) {
    return '';
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);

    const isLocalHost =
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1' ||
      parsed.hostname === '10.0.2.2' ||
      parsed.hostname.startsWith('192.168.') ||
      parsed.hostname.startsWith('10.') ||
      parsed.hostname.startsWith('172.');

    if (!parsed.port && isLocalHost) {
      parsed.port = '3003';
    }

    return parsed.toString().replace(/\/+$/, '');
  } catch {
    return withProtocol;
  }
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 8000) {
  return Promise.race([
    fetch(url, init),
    new Promise<Response>((_, reject) => {
      setTimeout(() => reject(new Error('Server connection timed out. Check Wi-Fi and backend IP.')), timeoutMs);
    }),
  ]);
}

function profileToForm(profile: InvoiceProfile): InvoiceProfileForm {
  return {
    id: profile.id,
    name: profile.name ?? '',
    invoiceTitle: profile.invoice_title ?? '',
    invoiceTitleAr: profile.invoice_title_ar ?? '',
    companyName: profile.company_name ?? '',
    companyNameAr: profile.company_name_ar ?? '',
    companyActivity: profile.company_activity ?? '',
    companyActivityAr: profile.company_activity_ar ?? '',
    companyAddress: profile.company_address ?? '',
    companyPhone: profile.company_phone ?? '',
    companyEmail: profile.company_email ?? '',
    contactNames: profile.contact_names ?? '',
  };
}

export default function App() {
  const [apiUrl, setApiUrl] = useState(DEFAULT_API);
  const [language, setLanguage] = useState<Language>('en');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [screen, setScreen] = useState<Screen>('billing');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [health, setHealth] = useState<HealthState | null>(null);
  const [currencyRate, setCurrencyRate] = useState(currentKwdToUsdRate);
  const [currencyRateInput, setCurrencyRateInput] = useState(String(currentKwdToUsdRate));
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [invoiceProfiles, setInvoiceProfiles] = useState<InvoiceProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null);
  const [profileForm, setProfileForm] = useState<InvoiceProfileForm>(profileToForm(defaultInvoiceProfile));
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [report, setReport] = useState<ReportData | null>(null);
  const [historicReport, setHistoricReport] = useState<HistoricReport | null>(null);
  const [inventorySummary, setInventorySummary] = useState<InventorySummary | null>(null);
  const [reorderSuggestions, setReorderSuggestions] = useState<ReorderSuggestion[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [shiftSummary, setShiftSummary] = useState<ShiftSummary | null>(null);
  const [statementRows, setStatementRows] = useState<StatementRow[]>([]);
  const [creditSummary, setCreditSummary] = useState<CreditSummary | null>(null);
  const [knetReconciliation, setKnetReconciliation] = useState<KnetReconciliation | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);
  const [invoiceForm, setInvoiceForm] = useState(emptyInvoiceForm);
  const [invoiceCurrency, setInvoiceCurrency] = useState<TransactionCurrency>('KWD');
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItemForm[]>([
    { productId: null, pieces: '', weight: '', price: '' },
  ]);
  const [supplierForm, setSupplierForm] = useState(emptySupplierForm);
  const [purchaseCurrency, setPurchaseCurrency] = useState<TransactionCurrency>('KWD');
  const [purchaseForm, setPurchaseForm] = useState(emptyPurchaseForm);
  const [expenseForm, setExpenseForm] = useState(emptyExpenseForm);
  const [shiftForm, setShiftForm] = useState(emptyShiftForm);
  const [userForm, setUserForm] = useState(emptyUserForm);
  const [stockForm, setStockForm] = useState(emptyStockForm);
  const [customerForm, setCustomerForm] = useState(emptyCustomerForm);
  const [productForm, setProductForm] = useState(emptyProductForm);
  const [supplierPaymentForm, setSupplierPaymentForm] = useState(emptySupplierPaymentForm);
  const [reverseForm, setReverseForm] = useState(emptyReverseForm);
  const [voidForm, setVoidForm] = useState(emptyVoidForm);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentInvoiceId, setPaymentInvoiceId] = useState<number | null>(null);
  const [paymentInvoiceIds, setPaymentInvoiceIds] = useState<number[]>([]);
  const [selectedInvoiceDetail, setSelectedInvoiceDetail] = useState<InvoiceDetail | null>(null);
  const [invoiceDetailLoading, setInvoiceDetailLoading] = useState(false);
  const [lastKnetUrl, setLastKnetUrl] = useState('');
  const [lastPaymentKind, setLastPaymentKind] = useState<'knet' | 'card'>('knet');
  const [editingCustomerId, setEditingCustomerId] = useState<number>(noEdit);
  const [customerEditForm, setCustomerEditForm] = useState(emptyCustomerForm);
  const [editingProductId, setEditingProductId] = useState<number>(noEdit);
  const [productEditForm, setProductEditForm] = useState(emptyProductForm);
  const [editingSupplierId, setEditingSupplierId] = useState<number>(noEdit);
  const [supplierEditForm, setSupplierEditForm] = useState(emptySupplierForm);
  const [editingPurchaseId, setEditingPurchaseId] = useState<number>(noEdit);
  const [purchaseEditCurrency, setPurchaseEditCurrency] = useState<TransactionCurrency>('KWD');
  const [purchaseEditForm, setPurchaseEditForm] = useState(emptyPurchaseForm);
  const [editingUserId, setEditingUserId] = useState<number>(noEdit);
  const [userEditForm, setUserEditForm] = useState(emptyUserForm);

  const selectedCustomer = customers.find(customer => customer.id === selectedCustomerId) ?? null;
  const selectedProduct = products.find(product => product.id === selectedProductId) ?? null;
  const selectedSupplier = suppliers.find(supplier => supplier.id === selectedSupplierId) ?? null;
  const selectedProfile =
    invoiceProfiles.find(profile => profile.id === selectedProfileId) ??
    invoiceProfiles.find(profile => profile.is_default) ??
    invoiceProfiles[0] ??
    defaultInvoiceProfile;
  const toBaseKwd = (value: number, selectedCurrency: TransactionCurrency) =>
    selectedCurrency === 'USD' ? value / currencyRate : value;
  const displayUnitPrice = (value: number, selectedCurrency: TransactionCurrency) =>
    selectedCurrency === 'USD' ? value * currencyRate : value;
  const invoiceTotal = invoiceItems.reduce(
    (sum, item) =>
      sum + Number(item.weight || 0) * toBaseKwd(Number(item.price || 0), invoiceCurrency),
    0,
  );
  const customerBalance = Number(selectedCustomer?.balance ?? 0);
  const creditLimit = Number(selectedCustomer?.credit_limit ?? 0);
  const projectedBalance = customerBalance + invoiceTotal;
  const remainingCredit = creditLimit > 0 ? creditLimit - projectedBalance : null;
  const isCreditLimitExceeded = invoiceForm.type === 'credit' && creditLimit > 0 && projectedBalance > creditLimit;
  const unpaidInvoices = invoices.filter(invoice => Number(invoice.outstanding_amount ?? 0) > 0);
  const customerUnpaidInvoices = unpaidInvoices.filter(
    invoice => !selectedCustomerId || invoice.customer_id === selectedCustomerId
  );
  const selectedPaymentInvoices = customerUnpaidInvoices.filter(invoice => paymentInvoiceIds.includes(invoice.id));
  const selectedPaymentTotal = selectedPaymentInvoices.reduce(
    (sum, invoice) => sum + Number(invoice.outstanding_amount ?? invoice.total ?? 0),
    0
  );
  const isAdmin = user?.role === 'admin';
  const navGroups: Array<{
    key: string;
    label: string;
    adminOnly?: boolean;
    items: Array<{ screen: Screen; label: string; adminOnly?: boolean }>;
  }> = [
    {
      key: 'front',
      label: 'Front Counter',
      items: [
        { screen: 'billing', label: 'Billing' },
        { screen: 'invoices', label: 'History' },
        { screen: 'customers', label: 'Customers' },
        { screen: 'payments', label: 'Collections' },
        { screen: 'statement', label: 'Statement' },
        { screen: 'shift', label: 'Shift Close' },
      ],
    },
    {
      key: 'stock',
      label: 'Stock',
      items: [
        { screen: 'stock', label: 'Stock' },
        { screen: 'purchases', label: 'Purchases', adminOnly: true },
        { screen: 'suppliers', label: 'Suppliers', adminOnly: true },
      ],
    },
    {
      key: 'finance',
      label: 'Finance',
      adminOnly: true,
      items: [
        { screen: 'dashboard', label: 'Dashboard' },
        { screen: 'reports', label: 'Reports' },
        { screen: 'expenses', label: 'Expenses' },
        { screen: 'knet', label: 'KNET' },
      ],
    },
    {
      key: 'admin',
      label: 'Admin',
      adminOnly: true,
      items: [
        { screen: 'activity', label: 'Activity' },
        { screen: 'admin', label: 'System' },
        { screen: 'users', label: 'Users' },
      ],
    },
  ];
  const visibleNavGroups = navGroups.filter(group => !group.adminOnly || isAdmin);
  const activeNavGroup =
    visibleNavGroups.find(group => group.items.some(item => item.screen === screen)) ??
    visibleNavGroups[0];
  const activeNavItems = activeNavGroup.items.filter(item => !item.adminOnly || isAdmin);
  const languageContextValue = useMemo(
    () => ({
      language,
      t: (text: string) => translate(language, text),
    }),
    [language],
  );
  const { t } = languageContextValue;

  const apiFetch = useCallback(async (path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);

    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(`${apiUrl}${path}`, {
      ...init,
      headers,
    });

    if (response.status === 401) {
      setToken('');
      setUser(null);
      throw new Error('Session expired. Please log in again.');
    }

    if (!response.ok) {
      let message = 'Request failed.';

      try {
        const data = (await response.json()) as { message?: string | string[] };
        message = Array.isArray(data.message) ? data.message.join(', ') : data.message || message;
      } catch {
        message = `${message} (${response.status})`;
      }

      throw new Error(message);
    }

    return response;
  }, [apiUrl, token]);

  const loadHealth = useCallback(async () => {
    try {
      const response = await fetchWithTimeout(`${apiUrl}/health`, {}, 5000);
      setHealth((await response.json()) as HealthState);
    } catch {
      setHealth(null);
    }
  }, [apiUrl]);

  const applyCurrencyRate = useCallback((rate: number) => {
    if (!Number.isFinite(rate) || rate <= 0) {
      return;
    }

    currentKwdToUsdRate = rate;
    setCurrencyRate(rate);
    setCurrencyRateInput(String(rate));
  }, []);

  const loadCurrencyRate = useCallback(async () => {
    try {
      const response = await fetchWithTimeout(`${apiUrl}/settings/currency-rate`, {}, 5000);
      if (!response.ok) {
        throw new Error(`Currency rate request failed with ${response.status}`);
      }
      const data = (await response.json()) as { kwd_to_usd_rate?: number };
      applyCurrencyRate(Number(data.kwd_to_usd_rate));
    } catch {
      applyCurrencyRate(currentKwdToUsdRate);
    }
  }, [apiUrl, applyCurrencyRate]);

  const loadData = useCallback(async () => {
    if (!token) {
      await Promise.all([loadHealth(), loadCurrencyRate()]);
      return;
    }

    setRefreshing(true);

    try {
      const [
        customerRes,
        productRes,
        profileRes,
        invoiceRes,
        paymentRes,
        dashboardRes,
        reportRes,
        historicRes,
        inventorySummaryRes,
        reorderRes,
        shiftRes,
        creditRes,
      ] = await Promise.all([
        apiFetch('/customers'),
        apiFetch('/products'),
        apiFetch('/invoice-profiles'),
        apiFetch('/invoices'),
        apiFetch('/payments'),
        apiFetch('/invoices/dashboard'),
        apiFetch('/invoices/profit'),
        apiFetch('/invoices/historic-report'),
        apiFetch('/inventory/summary'),
        apiFetch('/inventory/reorder-suggestions'),
        apiFetch('/shift-close/summary'),
        apiFetch('/customers/credit-summary'),
      ]);

      const [
        customerData,
        productData,
        profileData,
        invoiceData,
        paymentData,
        dashboardData,
        reportData,
        historicData,
        inventorySummaryData,
        reorderData,
        shiftData,
        creditData,
      ] = await Promise.all([
        customerRes.json() as Promise<Customer[]>,
        productRes.json() as Promise<Product[]>,
        profileRes.json() as Promise<InvoiceProfile[]>,
        invoiceRes.json() as Promise<Invoice[]>,
        paymentRes.json() as Promise<PaymentRecord[]>,
        dashboardRes.json() as Promise<DashboardData>,
        reportRes.json() as Promise<ReportData>,
        historicRes.json() as Promise<HistoricReport>,
        inventorySummaryRes.json() as Promise<InventorySummary>,
        reorderRes.json() as Promise<{ suggestions?: ReorderSuggestion[] }>,
        shiftRes.json() as Promise<ShiftSummary>,
        creditRes.json() as Promise<CreditSummary>,
      ]);

      setCustomers(customerData);
      setProducts(productData);
      setInvoiceProfiles(profileData.length ? profileData : [defaultInvoiceProfile]);
      setSelectedProfileId(current => current ?? profileData.find(profile => profile.is_default)?.id ?? profileData[0]?.id ?? null);
      setProfileForm(current => (current.id ? current : profileToForm(profileData.find(profile => profile.is_default) ?? profileData[0] ?? defaultInvoiceProfile)));
      setInvoices(invoiceData);
      setPayments(paymentData);
      setDashboard(dashboardData);
      setReport(reportData);
      setHistoricReport(historicData);
      setInventorySummary(inventorySummaryData);
      setReorderSuggestions(reorderData.suggestions ?? []);
      setShiftSummary(shiftData);
      setCreditSummary(creditData);
      setSelectedCustomerId(current => current ?? customerData[0]?.id ?? null);
      setSelectedProductId(current => current ?? productData[0]?.id ?? null);

      if (user?.role === 'admin') {
        const [supplierRes, purchaseRes, expenseRes, auditRes, userRes, knetRes] = await Promise.all([
          apiFetch('/suppliers'),
          apiFetch('/purchases'),
          apiFetch('/expenses'),
          apiFetch('/audit'),
          apiFetch('/users'),
          apiFetch('/payments/knet/reconciliation'),
        ]);
        const [supplierData, purchaseData, expenseData, auditData, userData, knetData] = await Promise.all([
          supplierRes.json() as Promise<Supplier[]>,
          purchaseRes.json() as Promise<Purchase[]>,
          expenseRes.json() as Promise<Expense[]>,
          auditRes.json() as Promise<AuditLog[]>,
          userRes.json() as Promise<UserRecord[]>,
          knetRes.json() as Promise<KnetReconciliation>,
        ]);

        setSuppliers(supplierData);
        setPurchases(purchaseData);
        setExpenses(expenseData);
        setAuditLogs(auditData);
        setUsers(userData);
        setKnetReconciliation(knetData);
        setSelectedSupplierId(current => current ?? supplierData[0]?.id ?? null);
      }

      if (selectedCustomerId) {
        const statementRes = await apiFetch(`/ledger/statement/${selectedCustomerId}`);
        setStatementRows((await statementRes.json()) as StatementRow[]);
      }

      await Promise.all([loadHealth(), loadCurrencyRate()]);
      setStatus('');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not load mobile data.');
    } finally {
      setRefreshing(false);
    }
  }, [apiFetch, loadCurrencyRate, loadHealth, selectedCustomerId, token, user?.role]);

  function applyServerUrl(value: string) {
    const nextUrl = normalizeServerUrl(value);
    setApiUrl(nextUrl);
    setHealth(null);
    setStatus('');
  }

  function editServerUrl(value: string) {
    setApiUrl(value);
    setHealth(null);
    setStatus('');
  }

  useEffect(() => {
    Promise.all([loadHealth(), loadCurrencyRate()]).catch(() => setHealth(null));
  }, [loadCurrencyRate, loadHealth]);

  useEffect(() => {
    loadData().catch(error => {
      setStatus(error instanceof Error ? error.message : 'Could not load mobile data.');
    });
  }, [loadData]);

  async function login() {
    if (!username.trim() || !password.trim()) {
      setStatus('Enter username and password.');
      return;
    }

    const nextApiUrl = normalizeServerUrl(apiUrl);

    if (!nextApiUrl) {
      setStatus('Enter backend server URL or IP.');
      return;
    }

    setBusy(true);
    setStatus('');
    setApiUrl(nextApiUrl);

    try {
      const healthResponse = await fetchWithTimeout(`${nextApiUrl}/health`, {}, 6000);

      if (!healthResponse.ok) {
        throw new Error(`Backend found but health check failed (${healthResponse.status}).`);
      }

      const response = await fetchWithTimeout(`${nextApiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      }, 8000);

      const data = (await response.json()) as {
        access_token?: string;
        user?: AuthUser;
        message?: string;
      };

      if (!response.ok || !data.access_token || !data.user) {
        throw new Error(data.message || 'Login failed.');
      }

      setToken(data.access_token);
      setUser(data.user);
      setScreen('billing');
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Login failed.';
      setStatus(
        `${detail} Server: ${nextApiUrl}. For a real phone, use your Mac Wi-Fi IP with port 3003.`,
      );
    } finally {
      setBusy(false);
    }
  }

  async function updateCurrencyRate() {
    const nextRate = Number(currencyRateInput);

    if (!Number.isFinite(nextRate) || nextRate <= 0) {
      setStatus('Enter a valid KWD to USD rate.');
      return;
    }

    setBusy(true);
    setStatus('');

    try {
      const response = await apiFetch('/settings/currency-rate', {
        method: 'PATCH',
        body: JSON.stringify({ kwd_to_usd_rate: nextRate }),
      });
      const data = (await response.json()) as { kwd_to_usd_rate?: number };
      applyCurrencyRate(Number(data.kwd_to_usd_rate));
      setStatus('Currency rate updated.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not update currency rate.');
    } finally {
      setBusy(false);
    }
  }

  function updateInvoiceItem(index: number, patch: Partial<InvoiceItemForm>) {
    setInvoiceItems(current =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }

        const next = { ...item, ...patch };
        if (patch.productId !== undefined) {
          const product = products.find(record => record.id === patch.productId);
          next.price =
            product?.price_per_kg !== undefined
              ? displayUnitPrice(Number(product.price_per_kg), invoiceCurrency).toFixed(3)
              : next.price;
        }
        return next;
      }),
    );
  }

  function addInvoiceItem() {
    setInvoiceItems(current => [...current, { productId: null, pieces: '', weight: '', price: '' }]);
  }

  function removeInvoiceItem(index: number) {
    setInvoiceItems(current => (current.length > 1 ? current.filter((_, itemIndex) => itemIndex !== index) : current));
  }

  function resetInvoiceForm() {
    setInvoiceForm(emptyInvoiceForm);
    setInvoiceItems([{ productId: selectedProductId, pieces: '', weight: '', price: String(selectedProduct?.price_per_kg ?? '') }]);
  }

  function editSelectedProfile() {
    setProfileForm(profileToForm(selectedProfile));
    setProfileEditorOpen(true);
  }

  function addInvoiceProfile() {
    setProfileForm(profileToForm({ ...defaultInvoiceProfile, id: undefined, name: '' }));
    setProfileEditorOpen(true);
  }

  async function saveInvoiceProfile() {
    const payload = {
      name: profileForm.name.trim(),
      invoice_title: profileForm.invoiceTitle.trim(),
      invoice_title_ar: profileForm.invoiceTitleAr.trim() || undefined,
      company_name: profileForm.companyName.trim(),
      company_name_ar: profileForm.companyNameAr.trim() || undefined,
      company_activity: profileForm.companyActivity.trim() || undefined,
      company_activity_ar: profileForm.companyActivityAr.trim() || undefined,
      company_address: profileForm.companyAddress.trim(),
      company_phone: profileForm.companyPhone.trim(),
      company_email: profileForm.companyEmail.trim() || undefined,
      contact_names: profileForm.contactNames.trim() || undefined,
      is_default: true,
    };

    if (!payload.name || !payload.invoice_title || !payload.company_name || !payload.company_address || !payload.company_phone) {
      setStatus('Profile name, invoice title, company name, address, and phone are required.');
      return;
    }

    setBusy(true);
    setStatus('');

    try {
      const response = await apiFetch(profileForm.id ? `/invoice-profiles/${profileForm.id}` : '/invoice-profiles', {
        method: profileForm.id ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      });
      const saved = (await response.json()) as InvoiceProfile;
      setSelectedProfileId(saved.id ?? null);
      setProfileEditorOpen(false);
      setStatus(`Invoice profile ${saved.name} saved.`);
      await loadData();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not save invoice profile.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteSelectedProfile() {
    if (!selectedProfile.id) {
      return;
    }

    setBusy(true);
    setStatus('');

    try {
      await apiFetch(`/invoice-profiles/${selectedProfile.id}`, { method: 'DELETE' });
      setSelectedProfileId(null);
      setStatus('Invoice profile deleted.');
      await loadData();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not delete invoice profile.');
    } finally {
      setBusy(false);
    }
  }

  async function createInvoice() {
    const validItems = invoiceItems
      .map(item => ({
        product_id: item.productId,
        pieces: item.pieces ? Number(item.pieces) : undefined,
        weight: Number(item.weight),
        price_per_kg: Number(item.price),
      }))
      .filter(item => item.product_id && item.weight > 0 && item.price_per_kg >= 0);

    if (!selectedCustomerId || validItems.length === 0) {
      setStatus('Select a customer and enter at least one valid item.');
      return;
    }

    if (
      !invoiceForm.invoiceNumber.trim() ||
      !selectedProfile.invoice_title.trim() ||
      !selectedProfile.company_name.trim() ||
      !selectedProfile.company_address.trim() ||
      !selectedProfile.company_phone.trim()
    ) {
      setStatus('Invoice number and saved company profile details are required.');
      return;
    }

    if (isCreditLimitExceeded) {
      setStatus('Credit limit exceeded for this customer.');
      return;
    }

    setBusy(true);
    setStatus('');

    try {
      const response = await apiFetch('/invoices', {
        method: 'POST',
        body: JSON.stringify({
          customer_id: selectedCustomerId,
          type: invoiceForm.type,
          transaction_currency: invoiceCurrency,
          exchange_rate: currencyRate,
          invoice_number: invoiceForm.invoiceNumber.trim(),
          invoice_title: selectedProfile.invoice_title.trim(),
          invoice_title_ar: selectedProfile.invoice_title_ar?.trim() || undefined,
          company_name: selectedProfile.company_name.trim(),
          company_name_ar: selectedProfile.company_name_ar?.trim() || undefined,
          company_activity: selectedProfile.company_activity?.trim() || undefined,
          company_activity_ar: selectedProfile.company_activity_ar?.trim() || undefined,
          company_address: selectedProfile.company_address.trim(),
          company_phone: selectedProfile.company_phone.trim(),
          company_email: selectedProfile.company_email?.trim() || undefined,
          contact_names: selectedProfile.contact_names?.trim() || undefined,
          items: validItems,
        }),
      });

      const invoice = (await response.json()) as Invoice;
      setStatus(`Invoice ${invoiceLabel(invoice)} created.`);
      setInvoiceForm(current => ({
        ...current,
        invoiceNumber: '',
      }));
      setInvoiceCurrency('KWD');
      setInvoiceItems([{ productId: selectedProductId, pieces: '', weight: '', price: String(selectedProduct?.price_per_kg ?? '') }]);
      await loadData();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not create invoice.');
    } finally {
      setBusy(false);
    }
  }

  async function recordCashPayment() {
    if (!selectedCustomerId || !paymentAmount.trim()) {
      setStatus('Select customer and enter amount.');
      return;
    }

    setBusy(true);
    setStatus('');

    try {
      await apiFetch('/payments', {
        method: 'POST',
        body: JSON.stringify({
          customer_id: selectedCustomerId,
          invoice_id: paymentInvoiceId ?? undefined,
          amount: Number(paymentAmount),
          mode: 'cash',
        }),
      });

      setPaymentAmount('');
      setStatus('Cash payment recorded.');
      await loadData();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not record payment.');
    } finally {
      setBusy(false);
    }
  }

  async function reversePayment() {
    if (!reverseForm.paymentId) {
      setStatus('Choose a payment to reverse.');
      return;
    }

    setBusy(true);
    setStatus('');

    try {
      await apiFetch(`/payments/${reverseForm.paymentId}/reverse`, {
        method: 'POST',
        body: JSON.stringify({ reason: reverseForm.reason.trim() || undefined }),
      });
      setReverseForm(emptyReverseForm);
      setStatus('Payment reversed.');
      await loadData();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not reverse payment.');
    } finally {
      setBusy(false);
    }
  }

  function togglePaymentInvoice(invoice: Invoice) {
    setLastKnetUrl('');
    setPaymentInvoiceIds(current => {
      const nextIds = current.includes(invoice.id)
        ? current.filter(id => id !== invoice.id)
        : [...current, invoice.id];
      const nextInvoices = customerUnpaidInvoices.filter(item => nextIds.includes(item.id));
      const nextAmount = nextInvoices.reduce(
        (sum, item) => sum + Number(item.outstanding_amount ?? item.total ?? 0),
        0
      );

      setPaymentAmount(nextIds.length ? nextAmount.toFixed(3) : '');
      setPaymentInvoiceId(nextIds.length === 1 ? nextIds[0] : null);

      return nextIds;
    });
  }

  async function createOnlinePaymentLink(kind: 'knet' | 'card') {
    if (!paymentInvoiceIds.length || !selectedPaymentTotal) {
      setStatus('Select one or more invoices before creating a payment link.');
      return;
    }

    setBusy(true);
    setStatus('');

    try {
      const response = await apiFetch(`/payments/${kind}`, {
        method: 'POST',
        body: JSON.stringify({
          invoice_id: paymentInvoiceIds.length === 1 ? paymentInvoiceIds[0] : undefined,
          invoice_ids: paymentInvoiceIds,
          amount: Number(selectedPaymentTotal.toFixed(3)),
        }),
      });

      const data = (await response.json()) as KnetLink;
      const url = data.url || data.payment_url || '';
      setLastKnetUrl(url);
      setLastPaymentKind(kind);
      setPaymentAmount(selectedPaymentTotal.toFixed(3));
      setStatus(url ? `${kind === 'card' ? 'Card' : 'KNET'} link ready.` : `${kind === 'card' ? 'Card' : 'KNET'} link created.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : `Could not create ${kind === 'card' ? 'card' : 'KNET'} link.`);
    } finally {
      setBusy(false);
    }
  }

  async function shareKnetWhatsApp() {
    if (!lastKnetUrl) {
      setStatus('Create a payment link first.');
      return;
    }

    const amount = currencyInline(selectedPaymentTotal || Number(paymentAmount));
    const labels = selectedPaymentInvoices.map(invoice => invoiceLabel(invoice)).join(', ');
    const phone = compactPhone(selectedCustomer?.mobile);
    const message = `Hello ${selectedCustomer?.name ?? ''}, please pay ${amount} for invoice${
      selectedPaymentInvoices.length === 1 ? '' : 's'
    } ${labels}: ${lastKnetUrl}`;
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;

    await Linking.openURL(url);
  }

  async function createSupplier() {
    if (!supplierForm.name.trim()) {
      setStatus('Supplier name is required.');
      return;
    }

    setBusy(true);
    setStatus('');

    try {
      await apiFetch('/suppliers', {
        method: 'POST',
        body: JSON.stringify({
          name: supplierForm.name.trim(),
          mobile: supplierForm.mobile.trim() || undefined,
          address: supplierForm.address.trim() || undefined,
        }),
      });
      setSupplierForm(emptySupplierForm);
      setStatus('Supplier created.');
      await loadData();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not create supplier.');
    } finally {
      setBusy(false);
    }
  }

  function startEditSupplier(supplier: Supplier) {
    setEditingSupplierId(supplier.id);
    setSupplierEditForm({
      name: supplier.name,
      mobile: supplier.mobile ?? '',
      address: supplier.address ?? '',
    });
  }

  async function saveSupplierEdit() {
    if (!editingSupplierId || !supplierEditForm.name.trim()) {
      setStatus('Supplier name is required.');
      return;
    }

    setBusy(true);
    setStatus('');

    try {
      await apiFetch(`/suppliers/${editingSupplierId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: supplierEditForm.name.trim(),
          mobile: supplierEditForm.mobile.trim() || undefined,
          address: supplierEditForm.address.trim() || undefined,
        }),
      });
      setEditingSupplierId(noEdit);
      setSupplierEditForm(emptySupplierForm);
      setStatus('Supplier updated.');
      await loadData();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not update supplier.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteSelectedSupplier() {
    if (!selectedSupplier) {
      setStatus('Select a supplier to delete.');
      return;
    }

    Alert.alert(
      'Delete supplier',
      `Delete ${selectedSupplier.name}? Suppliers with purchases, payments, or balances cannot be deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            setStatus('');

            try {
              await apiFetch(`/suppliers/${selectedSupplier.id}`, { method: 'DELETE' });
              setSelectedSupplierId(null);
              setStatus('Supplier deleted.');
              await loadData();
            } catch (error) {
              setStatus(error instanceof Error ? error.message : 'Could not delete supplier.');
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  }

  async function createCustomer() {
    if (!customerForm.name.trim()) {
      setStatus('Customer name is required.');
      return;
    }

    setBusy(true);
    setStatus('');

    try {
      await apiFetch('/customers', {
        method: 'POST',
        body: JSON.stringify({
          name: customerForm.name.trim(),
          mobile: customerForm.mobile.trim() || undefined,
          address: customerForm.address.trim() || undefined,
          credit_limit: customerForm.creditLimit ? Number(customerForm.creditLimit) : undefined,
        }),
      });
      setCustomerForm(emptyCustomerForm);
      setStatus('Customer created.');
      await loadData();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not create customer.');
    } finally {
      setBusy(false);
    }
  }

  function startEditCustomer(customer: Customer) {
    setEditingCustomerId(customer.id);
    setCustomerEditForm({
      name: customer.name,
      mobile: customer.mobile ?? '',
      address: customer.address ?? '',
      creditLimit: String(customer.credit_limit ?? ''),
    });
  }

  async function saveCustomerEdit() {
    if (!editingCustomerId || !customerEditForm.name.trim()) {
      setStatus('Customer name is required.');
      return;
    }

    setBusy(true);
    setStatus('');

    try {
      await apiFetch(`/customers/${editingCustomerId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: customerEditForm.name.trim(),
          mobile: customerEditForm.mobile.trim() || undefined,
          address: customerEditForm.address.trim() || undefined,
          credit_limit: customerEditForm.creditLimit ? Number(customerEditForm.creditLimit) : 0,
        }),
      });
      setEditingCustomerId(noEdit);
      setCustomerEditForm(emptyCustomerForm);
      setStatus('Customer updated.');
      await loadData();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not update customer.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteCustomer(customerId: number) {
    setBusy(true);
    setStatus('');

    try {
      await apiFetch(`/customers/${customerId}`, { method: 'DELETE' });
      setSelectedCustomerId(current => (current === customerId ? null : current));
      setStatus('Customer deleted.');
      await loadData();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not delete customer.');
    } finally {
      setBusy(false);
    }
  }

  async function createProduct() {
    if (!productForm.name.trim()) {
      setStatus('Product name is required. Selling price can be added later.');
      return;
    }

    setBusy(true);
    setStatus('');

    try {
      const response = await apiFetch('/products', {
        method: 'POST',
        body: JSON.stringify({
          name: productForm.name.trim(),
          sku: productForm.sku.trim() || undefined,
          price_per_kg: productForm.price ? Number(productForm.price) : undefined,
          low_stock_kg: productForm.lowStockKg ? Number(productForm.lowStockKg) : undefined,
        }),
      });
      const product = await response.json() as Product;
      setProductForm(emptyProductForm);
      setSelectedProductId(product.id);
      setStatus('Product created. Selling price can be set after buying.');
      await loadData();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not create product.');
    } finally {
      setBusy(false);
    }
  }

  function startEditProduct(product: Product) {
    setEditingProductId(product.id);
    setProductEditForm({
      name: product.name,
      sku: product.sku ?? '',
      price: String(product.price_per_kg ?? ''),
      lowStockKg: String(product.low_stock_kg ?? ''),
    });
  }

  async function saveProductEdit() {
    if (!editingProductId || !productEditForm.name.trim()) {
      setStatus('Product name is required.');
      return;
    }

    setBusy(true);
    setStatus('');

    try {
      await apiFetch(`/products/${editingProductId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: productEditForm.name.trim(),
          sku: productEditForm.sku.trim() || undefined,
          price_per_kg: Number(productEditForm.price || 0),
          low_stock_kg: Number(productEditForm.lowStockKg || 0),
        }),
      });
      setEditingProductId(noEdit);
      setProductEditForm(emptyProductForm);
      setStatus('Product updated.');
      await loadData();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not update product.');
    } finally {
      setBusy(false);
    }
  }

  async function recordSupplierPayment() {
    if (!selectedSupplierId || !supplierPaymentForm.amount.trim()) {
      setStatus('Choose supplier and enter payment amount.');
      return;
    }

    setBusy(true);
    setStatus('');

    try {
      await apiFetch('/supplier-payments', {
        method: 'POST',
        body: JSON.stringify({
          supplier_id: selectedSupplierId,
          amount: Number(supplierPaymentForm.amount),
          mode: supplierPaymentForm.mode,
          reference_no: supplierPaymentForm.referenceNo.trim() || undefined,
          note: supplierPaymentForm.note.trim() || undefined,
        }),
      });
      setSupplierPaymentForm(emptySupplierPaymentForm);
      setStatus('Supplier payment recorded.');
      await loadData();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not record supplier payment.');
    } finally {
      setBusy(false);
    }
  }

  async function recordPurchase() {
    if (!selectedSupplierId || !selectedProductId || !purchaseForm.weight.trim()) {
      setStatus('Choose supplier, product, and weight.');
      return;
    }

    setBusy(true);
    setStatus('');

    try {
      await apiFetch('/purchases', {
        method: 'POST',
        body: JSON.stringify({
          supplier_id: selectedSupplierId,
          invoice_no: purchaseForm.invoiceNo.trim() || undefined,
          transaction_currency: purchaseCurrency,
          exchange_rate: currencyRate,
          items: [
            {
              product_id: selectedProductId,
              pieces: purchaseForm.pieces ? Number(purchaseForm.pieces) : undefined,
              weight: Number(purchaseForm.weight),
              cost_per_kg: Number(purchaseForm.costPerKg || 0),
            },
          ],
        }),
      });
      setPurchaseForm(emptyPurchaseForm);
      setPurchaseCurrency('KWD');
      setStatus('Purchase recorded and stock updated.');
      await loadData();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not record purchase.');
    } finally {
      setBusy(false);
    }
  }

  async function startEditPurchase(purchase: Purchase) {
    setBusy(true);
    setStatus('');

    try {
      const response = await apiFetch(`/purchases/${purchase.id}`);
      const detail = (await response.json()) as PurchaseDetail;
      const firstItem = detail.items[0];
      const nextCurrency = detail.transaction_currency ?? 'KWD';
      const nextRate = Number(detail.exchange_rate ?? currencyRate);
      const storedCost = Number(firstItem?.cost_per_kg ?? 0);
      const displayCost = nextCurrency === 'USD' ? storedCost * nextRate : storedCost;

      setEditingPurchaseId(detail.id);
      setSelectedSupplierId(detail.supplier_id);
      setSelectedProductId(firstItem?.product_id ?? selectedProductId);
      setPurchaseEditCurrency(nextCurrency);
      setPurchaseEditForm({
        supplierId: String(detail.supplier_id),
        invoiceNo: detail.invoice_no ?? '',
        pieces: firstItem?.pieces ? String(firstItem.pieces) : '',
        weight: firstItem?.weight ? String(firstItem.weight) : '',
        costPerKg: displayCost ? displayCost.toFixed(3) : '',
      });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not open purchase edit.');
    } finally {
      setBusy(false);
    }
  }

  async function savePurchaseEdit() {
    if (!editingPurchaseId || !selectedSupplierId || !selectedProductId || !purchaseEditForm.weight.trim()) {
      setStatus('Choose supplier, product, and weight for the purchase edit.');
      return;
    }

    setBusy(true);
    setStatus('');

    try {
      await apiFetch(`/purchases/${editingPurchaseId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          supplier_id: selectedSupplierId,
          invoice_no: purchaseEditForm.invoiceNo.trim() || undefined,
          transaction_currency: purchaseEditCurrency,
          exchange_rate: currencyRate,
          items: [
            {
              product_id: selectedProductId,
              pieces: purchaseEditForm.pieces ? Number(purchaseEditForm.pieces) : undefined,
              weight: Number(purchaseEditForm.weight),
              cost_per_kg: Number(purchaseEditForm.costPerKg || 0),
            },
          ],
        }),
      });
      setEditingPurchaseId(noEdit);
      setPurchaseEditForm(emptyPurchaseForm);
      setPurchaseEditCurrency('KWD');
      setStatus('Purchase updated.');
      await loadData();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not update purchase.');
    } finally {
      setBusy(false);
    }
  }

  async function recordExpense() {
    if (!expenseForm.title.trim() || !expenseForm.amount.trim()) {
      setStatus('Enter expense title and amount.');
      return;
    }

    setBusy(true);
    setStatus('');

    try {
      await apiFetch('/expenses', {
        method: 'POST',
        body: JSON.stringify({
          title: expenseForm.title.trim(),
          category: expenseForm.category,
          amount: Number(expenseForm.amount),
        }),
      });
      setExpenseForm(emptyExpenseForm);
      setStatus('Expense recorded.');
      await loadData();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not record expense.');
    } finally {
      setBusy(false);
    }
  }

  async function recordStockMovement() {
    if (!selectedProductId || !stockForm.quantity.trim()) {
      setStatus('Choose product and enter quantity.');
      return;
    }

    setBusy(true);
    setStatus('');

    try {
      await apiFetch('/inventory/adjustments', {
        method: 'POST',
        body: JSON.stringify({
          product_id: selectedProductId,
          type: stockForm.type,
          quantity_kg: Number(stockForm.quantity),
          note: stockForm.note.trim() || undefined,
        }),
      });
      setStockForm(emptyStockForm);
      setStatus('Stock movement recorded.');
      await loadData();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not record stock movement.');
    } finally {
      setBusy(false);
    }
  }

  async function submitShiftClose() {
    if (!shiftForm.countedCash.trim()) {
      setStatus('Enter counted cash.');
      return;
    }

    setBusy(true);
    setStatus('');

    try {
      await apiFetch('/shift-close', {
        method: 'POST',
        body: JSON.stringify({
          date: new Date().toISOString().slice(0, 10),
          counted_cash: Number(shiftForm.countedCash),
          counted_knet: Number(shiftForm.countedKnet || 0),
          notes: shiftForm.notes.trim() || undefined,
        }),
      });
      setShiftForm(emptyShiftForm);
      setStatus('Shift close submitted.');
      await loadData();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not submit shift close.');
    } finally {
      setBusy(false);
    }
  }

  async function createUser() {
    if (!userForm.username.trim() || userForm.password.length < 6) {
      setStatus('Enter username and a password with at least 6 characters.');
      return;
    }

    setBusy(true);
    setStatus('');

    try {
      await apiFetch('/users', {
        method: 'POST',
        body: JSON.stringify(userForm),
      });
      setUserForm(emptyUserForm);
      setStatus('User created.');
      await loadData();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not create user.');
    } finally {
      setBusy(false);
    }
  }

  function startEditUser(item: UserRecord) {
    setEditingUserId(item.id);
    setUserEditForm({ username: item.username, password: '', role: item.role });
  }

  async function saveUserEdit() {
    if (!editingUserId || !userEditForm.username.trim()) {
      setStatus('Username is required.');
      return;
    }

    setBusy(true);
    setStatus('');

    try {
      await apiFetch(`/users/${editingUserId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          username: userEditForm.username.trim(),
          password: userEditForm.password.trim() || undefined,
          role: userEditForm.role,
        }),
      });
      setEditingUserId(noEdit);
      setUserEditForm(emptyUserForm);
      setStatus('User updated.');
      await loadData();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not update user.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteUser(userId: number) {
    setBusy(true);
    setStatus('');

    try {
      await apiFetch(`/users/${userId}`, { method: 'DELETE' });
      setEditingUserId(current => (current === userId ? noEdit : current));
      setStatus('User deleted.');
      await loadData();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not delete user.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteProduct(product: Product | null) {
    if (!product) {
      setStatus('Choose product to delete.');
      return;
    }

    setBusy(true);
    setStatus('');

    try {
      await apiFetch(`/products/${product.id}`, { method: 'DELETE' });
      setSelectedProductId(current => (current === product.id ? null : current));
      setStatus(`${product.name} deleted.`);
      await loadData();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not delete product.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteSelectedProduct() {
    await deleteProduct(selectedProduct);
  }

  async function voidInvoice() {
    if (!voidForm.invoiceId) {
      setStatus('Choose an invoice to void.');
      return;
    }

    setBusy(true);
    setStatus('');

    try {
      await apiFetch(`/invoices/${voidForm.invoiceId}/void`, {
        method: 'POST',
        body: JSON.stringify({ reason: voidForm.reason.trim() || undefined }),
      });
      setVoidForm(emptyVoidForm);
      setStatus('Invoice voided.');
      await loadData();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not void invoice.');
    } finally {
      setBusy(false);
    }
  }

  async function openInvoiceDetail(invoiceId: number) {
    setInvoiceDetailLoading(true);
    setStatus('');

    try {
      const response = await apiFetch(`/invoices/${invoiceId}`);
      const detail = (await response.json()) as InvoiceDetail;
      setSelectedInvoiceDetail(detail);
      setVoidForm(current => ({ ...current, invoiceId: String(invoiceId) }));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not load invoice detail.');
    } finally {
      setInvoiceDetailLoading(false);
    }
  }

  function closeInvoiceDetail() {
    setSelectedInvoiceDetail(null);
  }

  function openAuthenticatedPath(path: string) {
    const separator = path.includes('?') ? '&' : '?';
    Linking.openURL(`${apiUrl}${path}${separator}token=${encodeURIComponent(token)}`).catch(() => {
      setStatus('Could not open file link.');
    });
  }

  async function pickReceiptFile() {
    const [file] = await pick({
      type: [types.pdf, types.images],
      allowMultiSelection: false,
    });

    return file;
  }

  async function uploadPickedFile(path: string, fieldName: string, file: DocumentPickerResponse) {
    const formData = new FormData();
    formData.append(fieldName, {
      uri: file.uri,
      name: file.name || 'receipt',
      type: file.type || 'application/octet-stream',
    } as unknown as Blob);

    await apiFetch(path, {
      method: 'POST',
      body: formData,
    });
  }

  async function uploadInvoiceDeliveryReceipt(invoiceId: number) {
    setBusy(true);
    setStatus('');

    try {
      const file = await pickReceiptFile();
      await uploadPickedFile(`/invoices/${invoiceId}/delivery-receipt`, 'receipt', file);
      setStatus('Delivery receipt uploaded.');
      await loadData();
    } catch (error) {
      if (isErrorWithCode(error) && error.code === errorCodes.OPERATION_CANCELED) {
        setStatus('');
      } else {
        setStatus(error instanceof Error ? error.message : 'Could not upload delivery receipt.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function uploadPurchaseReceipt(purchaseId: number) {
    setBusy(true);
    setStatus('');

    try {
      const file = await pickReceiptFile();
      await uploadPickedFile(`/purchases/${purchaseId}/receipt`, 'receipt', file);
      setStatus('Purchase receipt uploaded.');
      await loadData();
    } catch (error) {
      if (isErrorWithCode(error) && error.code === errorCodes.OPERATION_CANCELED) {
        setStatus('');
      } else {
        setStatus(error instanceof Error ? error.message : 'Could not upload purchase receipt.');
      }
    } finally {
      setBusy(false);
    }
  }

  if (!user) {
    return (
      <LanguageContext.Provider value={languageContextValue}>
      <SafeAreaProvider>
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="dark-content" />
        <ScrollView contentContainerStyle={styles.loginContainer}>
          <View style={styles.brandCard}>
            <Image source={meatenaLogo} style={styles.logoBox} resizeMode="cover" />
            <View style={styles.flex}>
              <Text style={styles.kicker}>{t('Meatena')}</Text>
              <Text style={styles.title}>{t('Butchery Operations')}</Text>
              <Text style={styles.muted}>Cloud connected operations app.</Text>
            </View>
            <LanguageToggle language={language} onChange={setLanguage} />
          </View>

          <View style={styles.card}>
            <Text style={styles.subhead}>{t('Login')}</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="Username"
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              secureTextEntry
            />
            <PrimaryButton title={busy ? 'Signing in...' : 'Login'} onPress={login} disabled={busy} />
            <HealthBadge health={health} />
            {status ? <Text style={styles.error}>{status}</Text> : null}
          </View>
        </ScrollView>
      </SafeAreaView>
      </SafeAreaProvider>
      </LanguageContext.Provider>
    );
  }

  return (
    <LanguageContext.Provider value={languageContextValue}>
    <SafeAreaProvider>
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <Image source={meatenaLogo} style={styles.logoSmall} resizeMode="cover" />
        <View style={styles.flex}>
          <Text style={styles.kicker}>{t('Meatena')}</Text>
          <Text style={styles.headerTitle}>{t('Butchery Operations')}</Text>
          <Text style={styles.muted}>
            {user.username} | {user.role}
          </Text>
        </View>
        <LanguageToggle language={language} onChange={setLanguage} />
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={() => {
            setToken('');
            setUser(null);
          }}>
          <Text style={styles.logoutText}>{t('Logout')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.navPanel}>
        <View style={styles.navMainRow}>
          {visibleNavGroups.map(group => {
            const firstItem = group.items.find(item => !item.adminOnly || isAdmin);
            return (
              <TouchableOpacity
                key={group.key}
                style={[
                  styles.navMainButton,
                  activeNavGroup.key === group.key ? styles.navMainButtonActive : null,
                ]}
                onPress={() => {
                  if (firstItem) {
                    setScreen(firstItem.screen);
                  }
                }}>
                <Text
                  style={[
                    styles.navMainText,
                    activeNavGroup.key === group.key ? styles.navMainTextActive : null,
                  ]}>
                  {t(group.label)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={styles.navSubGrid}>
          {activeNavItems.map(item => (
            <TouchableOpacity
              key={item.screen}
              style={[styles.navSubButton, screen === item.screen ? styles.navSubButtonActive : null]}
              onPress={() => setScreen(item.screen)}>
              <Text style={[styles.navSubText, screen === item.screen ? styles.navSubTextActive : null]}>
                {t(item.label)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} />}>
        {status ? <Text style={status.includes('created') || status.includes('recorded') || status.includes('ready') ? styles.success : styles.error}>{status}</Text> : null}
        {screen === 'dashboard' ? renderDashboard() : null}
        {screen === 'billing' ? renderBilling() : null}
        {screen === 'customers' ? renderCustomers() : null}
        {screen === 'payments' ? renderPayments() : null}
        {screen === 'stock' ? renderStock() : null}
        {screen === 'purchases' ? renderPurchases() : null}
        {screen === 'suppliers' ? renderSuppliers() : null}
        {screen === 'invoices' ? renderInvoices() : null}
        {screen === 'shift' ? renderShiftClose() : null}
        {screen === 'knet' ? renderKnet() : null}
        {screen === 'statement' ? renderStatement() : null}
        {screen === 'expenses' ? renderExpenses() : null}
        {screen === 'reports' ? renderReports() : null}
        {screen === 'activity' ? renderActivity() : null}
        {screen === 'admin' ? renderAdmin() : null}
        {screen === 'users' ? renderUsers() : null}
      </ScrollView>
    </SafeAreaView>
    </SafeAreaProvider>
    </LanguageContext.Provider>
  );

  function renderDashboard() {
    const lowStockItems = inventorySummary?.lowStockItems?.length
      ? inventorySummary.lowStockItems
      : products
          .filter(product => product.low_stock)
          .map(product => ({
            id: product.id,
            name: product.name,
            sku: product.sku,
            stock_kg: product.stock_kg,
            low_stock_kg: undefined,
          }));

    return (
      <>
        <View style={styles.card}>
          <Text style={styles.kicker}>Business Snapshot</Text>
          <Text style={styles.screenTitle}>Meatena dashboard</Text>
          <Text style={styles.mutedDark}>
            Watch daily sales, collections, outstanding balances, and stock without leaving the mobile app.
          </Text>
        </View>

        <View style={styles.metricGrid}>
          <Metric label="Today Sales" value={currency(dashboard?.todaySales)} tone="red" />
          <Metric label="Collection" value={currency(dashboard?.todayCollection)} tone="green" />
          <Metric label="Outstanding" value={currency(dashboard?.outstanding ?? creditSummary?.total_outstanding)} tone="amber" />
          <Metric label="Invoices" value={String(dashboard?.invoiceCount ?? 0)} tone="blue" />
        </View>

        <View style={styles.metricGrid}>
          <Metric label="Sales" value={currency(report?.sales)} tone="dark" />
          <Metric label="Expenses" value={currency(report?.expenseTotal ?? report?.expenses)} tone="red" />
          <Metric label="Profit" value={currency(report?.profit)} tone="green" />
        </View>

        <View style={styles.card}>
          <Text style={styles.kicker}>Inventory Snapshot</Text>
          <View style={styles.metricGrid}>
            <Metric
              label="Retail Stock Value"
              value={currency(inventorySummary?.totals?.estimatedRetailValue ?? inventorySummary?.totals?.stockValue)}
            />
            <Metric label="Low Stock Items" value={String(inventorySummary?.totals?.lowStockCount ?? lowStockItems.length)} />
            <Metric label="Out Of Stock" value={String(inventorySummary?.totals?.outOfStockCount ?? 0)} />
            <Metric label="Stock KG" value={money(inventorySummary?.totals?.totalStockKg)} />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.kicker}>Restock Watch</Text>
          <Text style={styles.sectionTitle}>Lowest stock items</Text>
          {lowStockItems.slice(0, 5).map(item => (
            <Row
              key={item.id}
              title={item.name}
              subtitle={`${item.sku || 'No SKU'}${item.low_stock_kg !== undefined ? ` | Min ${money(item.low_stock_kg)} kg` : ''}`}
              right={`${money(item.stock_kg)} kg`}
              danger
              onPress={() => {
                setSelectedProductId(item.id);
                setScreen('stock');
              }}
            />
          ))}
          {!lowStockItems.length ? <Text style={styles.success}>No low-stock items right now.</Text> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.kicker}>Performance Note</Text>
          <Text style={styles.sectionTitle}>Keep billing moving during rush hours.</Text>
          <Text style={styles.mutedDark}>
            Use billing for multi-item entry, then jump to collections or statements when customers need updates.
          </Text>
        </View>
      </>
    );
  }

  function renderBilling() {
    return (
      <>
        <View style={styles.card}>
          <Text style={styles.kicker}>POS Billing</Text>
          <Text style={styles.screenTitle}>Fast counter invoice screen</Text>
          <Text style={styles.mutedDark}>
            Keep customer balance and item entry visible together for faster billing during rush hours.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Invoice Details</Text>
          <TextInput
            style={styles.input}
            value={invoiceForm.invoiceNumber}
            onChangeText={value => setInvoiceForm(current => ({ ...current, invoiceNumber: value }))}
            placeholder="Invoice number"
          />
          <Text style={styles.subhead}>Invoice profile</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectorRow}>
            {invoiceProfiles.map(profile => (
              <Pill
                key={profile.id ?? profile.name}
                label={profile.is_default ? `${profile.name} *` : profile.name}
                active={selectedProfile.id === profile.id}
                onPress={() => {
                  setSelectedProfileId(profile.id ?? null);
                  setProfileForm(profileToForm(profile));
                }}
              />
            ))}
          </ScrollView>
          <View style={styles.row}>
            <View style={styles.flex}>
              <Text style={styles.rowTitle}>{selectedProfile.company_name}</Text>
              <Text style={styles.rowSubtitle}>
                {selectedProfile.invoice_title}
                {selectedProfile.invoice_title_ar ? ` | ${selectedProfile.invoice_title_ar}` : ''}
              </Text>
              <Text style={styles.rowSubtitle}>
                {selectedProfile.company_address} | {selectedProfile.company_phone}
              </Text>
              {selectedProfile.company_email || selectedProfile.contact_names ? (
                <Text style={styles.rowSubtitle}>
                  {[selectedProfile.company_email, selectedProfile.contact_names].filter(Boolean).join(' | ')}
                </Text>
              ) : null}
            </View>
          </View>
          {isAdmin ? (
            <>
              <View style={styles.twoCols}>
                <SecondaryButton title="Add Profile" onPress={addInvoiceProfile} disabled={busy} />
                <SecondaryButton title="Edit Profile" onPress={editSelectedProfile} disabled={busy} />
                <SecondaryButton title="Delete Profile" onPress={deleteSelectedProfile} disabled={busy} />
              </View>
              {profileEditorOpen ? (
                <View style={styles.lineItem}>
                  <Text style={styles.subhead}>Profile setup</Text>
                  <TextInput style={styles.input} value={profileForm.name} onChangeText={value => setProfileForm(current => ({ ...current, name: value }))} placeholder="Profile name" />
                  <TextInput style={styles.input} value={profileForm.invoiceTitle} onChangeText={value => setProfileForm(current => ({ ...current, invoiceTitle: value }))} placeholder="Invoice title" />
                  <TextInput style={styles.input} value={profileForm.invoiceTitleAr} onChangeText={value => setProfileForm(current => ({ ...current, invoiceTitleAr: value }))} placeholder="Invoice title Arabic" />
                  <TextInput style={styles.input} value={profileForm.companyName} onChangeText={value => setProfileForm(current => ({ ...current, companyName: value }))} placeholder="Company name" />
                  <TextInput style={styles.input} value={profileForm.companyNameAr} onChangeText={value => setProfileForm(current => ({ ...current, companyNameAr: value }))} placeholder="Company name Arabic" />
                  <TextInput style={styles.input} value={profileForm.companyActivity} onChangeText={value => setProfileForm(current => ({ ...current, companyActivity: value }))} placeholder="Company activity" />
                  <TextInput style={styles.input} value={profileForm.companyActivityAr} onChangeText={value => setProfileForm(current => ({ ...current, companyActivityAr: value }))} placeholder="Company activity Arabic" />
                  <TextInput style={styles.input} value={profileForm.companyAddress} onChangeText={value => setProfileForm(current => ({ ...current, companyAddress: value }))} placeholder="Company address" />
                  <TextInput style={styles.input} value={profileForm.companyPhone} onChangeText={value => setProfileForm(current => ({ ...current, companyPhone: value }))} placeholder="Company phone" keyboardType="phone-pad" />
                  <TextInput style={styles.input} value={profileForm.companyEmail} onChangeText={value => setProfileForm(current => ({ ...current, companyEmail: value }))} placeholder="Company email" keyboardType="email-address" autoCapitalize="none" />
                  <TextInput style={styles.input} value={profileForm.contactNames} onChangeText={value => setProfileForm(current => ({ ...current, contactNames: value }))} placeholder="Contact names" />
                  <View style={styles.twoCols}>
                    <PrimaryButton title="Save Profile" onPress={saveInvoiceProfile} disabled={busy} />
                    <SecondaryButton title="Cancel" onPress={() => setProfileEditorOpen(false)} disabled={busy} />
                  </View>
                </View>
              ) : null}
            </>
          ) : null}

          <Text style={styles.subhead}>Customer</Text>
          <CustomerPicker customers={customers} value={selectedCustomerId} onChange={setSelectedCustomerId} />
          <View style={styles.metricGrid}>
            <Metric label="Balance" value={currency(selectedCustomerId ? customerBalance : 0)} />
            <Metric label="Credit" value={creditLimit > 0 ? currency(creditLimit) : 'Unlimited'} />
            <Metric label="After This Bill" value={currency(projectedBalance)} tone={isCreditLimitExceeded ? 'red' : undefined} />
            <Metric label="Remaining" value={remainingCredit === null ? 'Unlimited' : currency(remainingCredit)} />
          </View>

          <View style={styles.twoCols}>
            <Pill
              label="Credit"
              active={invoiceForm.type === 'credit'}
              onPress={() => setInvoiceForm(current => ({ ...current, type: 'credit' }))}
            />
            <Pill
              label="Cash"
              active={invoiceForm.type === 'cash'}
              onPress={() => setInvoiceForm(current => ({ ...current, type: 'cash' }))}
            />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Billing</Text>
          <View style={styles.lineItem}>
            <Text style={styles.subhead}>Billing context</Text>
            <View style={styles.lineItemHeader}>
              <View style={styles.flex}>
                <Text style={styles.rowTitle}>
                  {invoiceForm.invoiceNumber.trim() || 'Invoice number not entered'}
                </Text>
                <Text style={styles.rowSubtitle}>
                  {selectedCustomer?.name ?? 'No customer selected'}
                </Text>
              </View>
              <MoneyText value={currency(selectedCustomerId ? customerBalance : 0)} />
            </View>
          </View>
          <Text style={styles.subhead}>Billing currency</Text>
          <View style={styles.twoCols}>
            <Pill label="KWD" active={invoiceCurrency === 'KWD'} onPress={() => setInvoiceCurrency('KWD')} />
            <Pill label="USD" active={invoiceCurrency === 'USD'} onPress={() => setInvoiceCurrency('USD')} />
          </View>
          <Text style={styles.mutedDark}>1 KWD = {currencyRate.toFixed(3)} USD</Text>
          {invoiceItems.map((item, index) => {
            const lineAmount =
              Number(item.weight || 0) * toBaseKwd(Number(item.price || 0), invoiceCurrency);
            return (
              <View key={index} style={styles.lineItem}>
                <View style={styles.lineItemHeader}>
                  <Text style={styles.rowTitle}>Item {index + 1}</Text>
                  <Text style={styles.rowRight}>{currency(lineAmount)}</Text>
                </View>
                <ProductPicker
                  products={products}
                  value={item.productId}
                  onChange={productId => {
                    setSelectedProductId(productId);
                    updateInvoiceItem(index, { productId });
                  }}
                />
                <View style={styles.formGrid}>
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Pieces</Text>
                  <TextInput
                      style={styles.input}
                    value={item.pieces}
                    onChangeText={value => updateInvoiceItem(index, { pieces: value })}
                      placeholder="Enter pieces"
                    keyboardType="number-pad"
                  />
                  </View>
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Weight kg</Text>
                  <TextInput
                      style={styles.input}
                    value={item.weight}
                    onChangeText={value => updateInvoiceItem(index, { weight: value })}
                      placeholder="Enter weight kg"
                    keyboardType="decimal-pad"
                  />
                  </View>
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Price</Text>
                  <TextInput
                      style={styles.input}
                    value={item.price}
                    onChangeText={value => updateInvoiceItem(index, { price: value })}
                      placeholder={`Enter price ${invoiceCurrency}`}
                    keyboardType="decimal-pad"
                  />
                  </View>
                </View>
                {invoiceItems.length > 1 ? (
                  <SecondaryButton title="Remove Item" onPress={() => removeInvoiceItem(index)} disabled={busy} />
                ) : null}
              </View>
            );
          })}

          <View style={styles.billingFooter}>
            <SecondaryButton title="+ Add Item" onPress={addInvoiceItem} disabled={busy} />
            <View style={styles.totalBox}>
              <Text style={styles.kicker}>Total</Text>
              <Text style={styles.totalValue}>{currency(invoiceTotal)}</Text>
            </View>
          </View>

          <View style={styles.twoColsEven}>
            <SecondaryButton title="Reset" onPress={resetInvoiceForm} disabled={busy} />
            <PrimaryButton
              title={busy ? 'Processing...' : 'Create Invoice'}
              onPress={createInvoice}
              disabled={busy || isCreditLimitExceeded}
            />
          </View>
        </View>
      </>
    );
  }

  function renderCustomers() {
    return (
      <View style={styles.card}>
        <Text style={styles.kicker}>Front Counter</Text>
        <Text style={styles.screenTitle}>Customers</Text>
        <TextInput
          style={styles.input}
          value={customerForm.name}
          onChangeText={value => setCustomerForm(current => ({ ...current, name: value }))}
          placeholder="Customer name"
        />
        <TextInput
          style={styles.input}
          value={customerForm.mobile}
          onChangeText={value => setCustomerForm(current => ({ ...current, mobile: value }))}
          placeholder="Mobile"
          keyboardType="phone-pad"
        />
        <TextInput
          style={styles.input}
          value={customerForm.address}
          onChangeText={value => setCustomerForm(current => ({ ...current, address: value }))}
          placeholder="Address"
        />
        <TextInput
          style={styles.input}
          value={customerForm.creditLimit}
          onChangeText={value => setCustomerForm(current => ({ ...current, creditLimit: value }))}
          placeholder="Credit limit"
          keyboardType="decimal-pad"
        />
        <PrimaryButton title="Create Customer" onPress={createCustomer} disabled={busy} />
        <Text style={styles.subhead}>Customer list</Text>
        {customers.map(customer => (
          <View key={customer.id} style={styles.stackItem}>
            <Row
              title={customer.name}
              subtitle={`${customer.mobile || 'No mobile'} | ${customer.address || 'No address'}`}
              right={customer.balance !== undefined ? currency(customer.balance) : selectedCustomerId === customer.id ? 'Selected' : ''}
              onPress={() => setSelectedCustomerId(customer.id)}
            />
            {editingCustomerId === customer.id ? (
              <View style={styles.inlineEditor}>
                <Text style={styles.subhead}>Edit customer</Text>
                <TextInput
                  style={styles.input}
                  value={customerEditForm.name}
                  onChangeText={value => setCustomerEditForm(current => ({ ...current, name: value }))}
                  placeholder="Customer name"
                />
                <TextInput
                  style={styles.input}
                  value={customerEditForm.mobile}
                  onChangeText={value => setCustomerEditForm(current => ({ ...current, mobile: value }))}
                  placeholder="Mobile"
                  keyboardType="phone-pad"
                />
                <TextInput
                  style={styles.input}
                  value={customerEditForm.address}
                  onChangeText={value => setCustomerEditForm(current => ({ ...current, address: value }))}
                  placeholder="Address"
                />
                <TextInput
                  style={styles.input}
                  value={customerEditForm.creditLimit}
                  onChangeText={value => setCustomerEditForm(current => ({ ...current, creditLimit: value }))}
                  placeholder="Credit limit"
                  keyboardType="decimal-pad"
                />
                <View style={styles.twoCols}>
                  <PrimaryButton title="Save Customer" onPress={saveCustomerEdit} disabled={busy} />
                  <SecondaryButton title="Cancel" onPress={() => setEditingCustomerId(noEdit)} disabled={busy} />
                </View>
              </View>
            ) : (
              <View style={styles.twoCols}>
                <SecondaryButton title="Edit Customer" onPress={() => startEditCustomer(customer)} disabled={busy} />
                {isAdmin ? <SecondaryButton title="Delete Customer" onPress={() => deleteCustomer(customer.id)} disabled={busy} /> : null}
              </View>
            )}
          </View>
        ))}
      </View>
    );
  }

  function renderPayments() {
    return (
      <View style={styles.card}>
        <Text style={styles.kicker}>Collections</Text>
        <Text style={styles.screenTitle}>Payments</Text>
        <CustomerPicker
          customers={customers}
          value={selectedCustomerId}
          onChange={value => {
            setSelectedCustomerId(value);
            setPaymentInvoiceId(null);
            setPaymentInvoiceIds([]);
            setPaymentAmount('');
            setLastKnetUrl('');
          }}
        />
        <InvoiceMultiPicker
          invoices={customerUnpaidInvoices}
          values={paymentInvoiceIds}
          onToggle={togglePaymentInvoice}
          onClear={() => {
            setPaymentInvoiceId(null);
            setPaymentInvoiceIds([]);
            setPaymentAmount('');
            setLastKnetUrl('');
          }}
        />
        {paymentInvoiceIds.length ? (
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>
              {paymentInvoiceIds.length} invoice{paymentInvoiceIds.length === 1 ? '' : 's'} selected
            </Text>
            <Text style={styles.infoText}>{currencyInline(selectedPaymentTotal)}</Text>
          </View>
        ) : null}
        <TextInput
          style={styles.input}
          value={paymentAmount}
          onChangeText={setPaymentAmount}
          placeholder="Payment amount"
          keyboardType="decimal-pad"
        />
        <PrimaryButton
          title={paymentInvoiceIds.length > 1 ? 'Cash needs one invoice' : 'Record Cash Payment'}
          onPress={recordCashPayment}
          disabled={busy || paymentInvoiceIds.length > 1}
        />
        <SecondaryButton title="Create KNET Link" onPress={() => createOnlinePaymentLink('knet')} disabled={busy} />
        <SecondaryButton title="Create Card Link" onPress={() => createOnlinePaymentLink('card')} disabled={busy} />
        {lastKnetUrl ? (
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>{lastPaymentKind === 'card' ? 'Card' : 'KNET'} link ready</Text>
            <Text style={styles.infoText}>{lastKnetUrl}</Text>
            <SecondaryButton title={`Open ${lastPaymentKind === 'card' ? 'Card' : 'KNET'} Link`} onPress={() => Linking.openURL(lastKnetUrl)} />
          </View>
        ) : (
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>WhatsApp sharing</Text>
            <Text style={styles.infoText}>Create a debit, credit, or KNET payment link first.</Text>
          </View>
        )}
        <SecondaryButton title="Share on WhatsApp" onPress={shareKnetWhatsApp} disabled={busy} />
        <Text style={styles.subhead}>Recent payments</Text>
        {payments.slice(0, 8).map(payment => (
          <View key={payment.id} style={styles.stackItem}>
            <Row
              title={`Payment #${payment.id}`}
              subtitle={`${customerName(customers, payment.customer_id)} | ${payment.mode} | ${payment.status ?? 'active'}`}
              right={currency(payment.amount)}
              onPress={() => setReverseForm(current => ({ ...current, paymentId: String(payment.id) }))}
            />
          </View>
        ))}
        {isAdmin ? (
          <>
            <Text style={styles.subhead}>Reverse payment</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectorRow}>
              {payments.filter(payment => payment.status !== 'reversed').slice(0, 10).map(payment => (
                <Pill
                  key={payment.id}
                  label={`#${payment.id}`}
                  active={reverseForm.paymentId === String(payment.id)}
                  onPress={() => setReverseForm(current => ({ ...current, paymentId: String(payment.id) }))}
                />
              ))}
            </ScrollView>
            <TextInput
              style={styles.input}
              value={reverseForm.reason}
              onChangeText={value => setReverseForm(current => ({ ...current, reason: value }))}
              placeholder="Reversal reason"
            />
            <SecondaryButton title="Reverse Selected Payment" onPress={reversePayment} disabled={busy} />
          </>
        ) : null}
      </View>
    );
  }

  function renderStock() {
    return (
      <View style={styles.card}>
        <Text style={styles.kicker}>Stock & Buying</Text>
        <Text style={styles.screenTitle}>Stock Lookup</Text>
        <View style={styles.metricGrid}>
          <Metric label="Stock KG" value={money(inventorySummary?.totals?.totalStockKg)} />
          <Metric label="Pieces" value={String(inventorySummary?.totals?.totalStockPieces ?? 0)} />
          <Metric label="Low Stock" value={String(inventorySummary?.totals?.lowStockCount ?? 0)} />
        </View>
        {isAdmin ? (
          <>
            <Text style={styles.subhead}>Add product</Text>
            <TextInput
              style={styles.input}
              value={productForm.name}
              onChangeText={value => setProductForm(current => ({ ...current, name: value }))}
              placeholder="Product name"
            />
            <TextInput
              style={styles.input}
              value={productForm.sku}
              onChangeText={value => setProductForm(current => ({ ...current, sku: value }))}
              placeholder="SKU"
            />
            <TextInput
              style={styles.input}
              value={productForm.price}
              onChangeText={value => setProductForm(current => ({ ...current, price: value }))}
              placeholder="Selling price optional"
              keyboardType="decimal-pad"
            />
            <TextInput
              style={styles.input}
              value={productForm.lowStockKg}
              onChangeText={value => setProductForm(current => ({ ...current, lowStockKg: value }))}
              placeholder="Low stock kg"
              keyboardType="decimal-pad"
            />
            <PrimaryButton title="Create Product" onPress={createProduct} disabled={busy} />
          </>
        ) : null}
        <Text style={styles.subhead}>Stock adjustment</Text>
        <ProductPicker products={products} value={selectedProductId} onChange={setSelectedProductId} />
        <View style={styles.twoCols}>
          <Pill label="Wastage" active={stockForm.type === 'wastage'} onPress={() => setStockForm(current => ({ ...current, type: 'wastage' }))} />
          <Pill label="Adjustment" active={stockForm.type === 'adjustment'} onPress={() => setStockForm(current => ({ ...current, type: 'adjustment' }))} />
        </View>
        <TextInput
          style={styles.input}
          value={stockForm.quantity}
          onChangeText={value => setStockForm(current => ({ ...current, quantity: value }))}
          placeholder="Quantity kg"
          keyboardType="decimal-pad"
        />
        <TextInput
          style={styles.input}
          value={stockForm.note}
          onChangeText={value => setStockForm(current => ({ ...current, note: value }))}
          placeholder="Note"
        />
        <PrimaryButton title="Record Movement" onPress={recordStockMovement} disabled={busy} />
        {isAdmin && selectedProduct ? (
          <SecondaryButton title={`Delete ${selectedProduct.name}`} onPress={deleteSelectedProduct} disabled={busy} />
        ) : null}
        <Text style={styles.subhead}>Current stock</Text>
        {products.map(product => (
          <View key={product.id} style={styles.stackItem}>
            <Row
              title={product.name}
              subtitle={`Pieces ${product.stock_pieces ?? 0} | Weight ${money(product.stock_kg)} kg | Price ${currencyInline(product.price_per_kg)} | SKU ${product.sku || '-'}`}
              right={`${product.stock_pieces ?? 0} pcs\n${money(product.stock_kg)} kg`}
              danger={Boolean(product.low_stock)}
              onPress={() => setSelectedProductId(product.id)}
            />
            {editingProductId === product.id ? (
              <View style={styles.inlineEditor}>
                <Text style={styles.subhead}>Edit product</Text>
                <TextInput
                  style={styles.input}
                  value={productEditForm.name}
                  onChangeText={value => setProductEditForm(current => ({ ...current, name: value }))}
                  placeholder="Product name"
                />
                <TextInput
                  style={styles.input}
                  value={productEditForm.sku}
                  onChangeText={value => setProductEditForm(current => ({ ...current, sku: value }))}
                  placeholder="SKU"
                />
                <TextInput
                  style={styles.input}
                  value={productEditForm.price}
                  onChangeText={value => setProductEditForm(current => ({ ...current, price: value }))}
                  placeholder="Selling price"
                  keyboardType="decimal-pad"
                />
                <TextInput
                  style={styles.input}
                  value={productEditForm.lowStockKg}
                  onChangeText={value => setProductEditForm(current => ({ ...current, lowStockKg: value }))}
                  placeholder="Low stock kg"
                  keyboardType="decimal-pad"
                />
                <View style={styles.twoCols}>
                  <PrimaryButton title="Save Product" onPress={saveProductEdit} disabled={busy} />
                  <SecondaryButton title="Cancel" onPress={() => setEditingProductId(noEdit)} disabled={busy} />
                </View>
              </View>
            ) : isAdmin ? (
              <View style={styles.twoCols}>
                <SecondaryButton title="Edit Product" onPress={() => startEditProduct(product)} disabled={busy} />
                <SecondaryButton
                  title="Delete Product"
                  onPress={() => deleteProduct(product)}
                  disabled={busy}
                />
              </View>
            ) : null}
          </View>
        ))}
        {isAdmin ? (
          <>
            <Text style={styles.subhead}>Reorder suggestions</Text>
            {reorderSuggestions.slice(0, 6).map(item => (
              <Row
                key={item.product_id}
                title={item.product_name}
                subtitle={`Stock ${money(item.stock_kg)}`}
                right={`${money(item.suggested_purchase_kg ?? item.suggestedPurchaseKg)} kg`}
              />
            ))}
            {!reorderSuggestions.length ? <Text style={styles.mutedDark}>No reorder suggestions.</Text> : null}
          </>
        ) : null}
      </View>
    );
  }

  function renderPurchases() {
    return (
      <View style={styles.card}>
        <Text style={styles.kicker}>Stock & Buying</Text>
        <Text style={styles.screenTitle}>Purchase Entry</Text>
        {isAdmin ? (
          <View style={styles.lineItem}>
            <Text style={styles.subhead}>New product</Text>
            <Text style={styles.mutedDark}>
              Selling price is optional. Set it later after purchase cost and margin are clear.
            </Text>
            <TextInput
              style={styles.input}
              value={productForm.name}
              onChangeText={value => setProductForm(current => ({ ...current, name: value }))}
              placeholder="Product name"
            />
            <TextInput
              style={styles.input}
              value={productForm.sku}
              onChangeText={value => setProductForm(current => ({ ...current, sku: value }))}
              placeholder="SKU"
            />
            <View style={styles.twoColsEven}>
              <TextInput
                style={[styles.input, styles.flex]}
                value={productForm.price}
                onChangeText={value => setProductForm(current => ({ ...current, price: value }))}
                placeholder="Selling price optional"
                keyboardType="decimal-pad"
              />
              <TextInput
                style={[styles.input, styles.flex]}
                value={productForm.lowStockKg}
                onChangeText={value => setProductForm(current => ({ ...current, lowStockKg: value }))}
                placeholder="Low stock kg"
                keyboardType="decimal-pad"
              />
            </View>
            <SecondaryButton title="Add Product To Purchase" onPress={createProduct} disabled={busy} />
          </View>
        ) : null}
        <SupplierPicker suppliers={suppliers} value={selectedSupplierId} onChange={setSelectedSupplierId} />
        <ProductPicker products={products} value={selectedProductId} onChange={setSelectedProductId} />
        <Text style={styles.subhead}>Purchase currency</Text>
        <View style={styles.twoCols}>
          <Pill label="KWD" active={purchaseCurrency === 'KWD'} onPress={() => setPurchaseCurrency('KWD')} />
          <Pill label="USD" active={purchaseCurrency === 'USD'} onPress={() => setPurchaseCurrency('USD')} />
        </View>
        <Text style={styles.mutedDark}>1 KWD = {currencyRate.toFixed(3)} USD</Text>
        <TextInput
          style={styles.input}
          value={purchaseForm.invoiceNo}
          onChangeText={value => setPurchaseForm(current => ({ ...current, invoiceNo: value }))}
          placeholder="Supplier invoice no."
        />
        <TextInput
          style={styles.input}
          value={purchaseForm.pieces}
          onChangeText={value => setPurchaseForm(current => ({ ...current, pieces: value }))}
          placeholder="Pieces"
          keyboardType="number-pad"
        />
        <TextInput
          style={styles.input}
          value={purchaseForm.weight}
          onChangeText={value => setPurchaseForm(current => ({ ...current, weight: value }))}
          placeholder="Weight kg"
          keyboardType="decimal-pad"
        />
        <TextInput
          style={styles.input}
          value={purchaseForm.costPerKg}
          onChangeText={value => setPurchaseForm(current => ({ ...current, costPerKg: value }))}
          placeholder={`Cost per kg ${purchaseCurrency}`}
          keyboardType="decimal-pad"
        />
        <PrimaryButton title="Record Purchase" onPress={recordPurchase} disabled={busy} />
        <Text style={styles.subhead}>Recent purchases</Text>
        {purchases.slice(0, 8).map(purchase => (
          <View key={purchase.id} style={styles.stackItem}>
            <Row
              title={`Purchase #${purchase.id}`}
              subtitle={`${suppliers.find(supplier => supplier.id === purchase.supplier_id)?.name ?? 'Supplier'} | ${purchase.invoice_no || 'No invoice'}`}
              right={currency(purchase.total_amount)}
            />
            {editingPurchaseId === purchase.id ? (
              <View style={styles.inlineEditor}>
                <Text style={styles.subhead}>Edit purchase</Text>
                <SupplierPicker suppliers={suppliers} value={selectedSupplierId} onChange={setSelectedSupplierId} />
                <ProductPicker products={products} value={selectedProductId} onChange={setSelectedProductId} />
                <View style={styles.twoCols}>
                  <Pill label="KWD" active={purchaseEditCurrency === 'KWD'} onPress={() => setPurchaseEditCurrency('KWD')} />
                  <Pill label="USD" active={purchaseEditCurrency === 'USD'} onPress={() => setPurchaseEditCurrency('USD')} />
                </View>
                <TextInput
                  style={styles.input}
                  value={purchaseEditForm.invoiceNo}
                  onChangeText={value => setPurchaseEditForm(current => ({ ...current, invoiceNo: value }))}
                  placeholder="Supplier invoice no."
                />
                <TextInput
                  style={styles.input}
                  value={purchaseEditForm.pieces}
                  onChangeText={value => setPurchaseEditForm(current => ({ ...current, pieces: value }))}
                  placeholder="Pieces"
                  keyboardType="number-pad"
                />
                <TextInput
                  style={styles.input}
                  value={purchaseEditForm.weight}
                  onChangeText={value => setPurchaseEditForm(current => ({ ...current, weight: value }))}
                  placeholder="Weight kg"
                  keyboardType="decimal-pad"
                />
                <TextInput
                  style={styles.input}
                  value={purchaseEditForm.costPerKg}
                  onChangeText={value => setPurchaseEditForm(current => ({ ...current, costPerKg: value }))}
                  placeholder={`Cost per kg ${purchaseEditCurrency}`}
                  keyboardType="decimal-pad"
                />
                <View style={styles.twoCols}>
                  <PrimaryButton title="Save Purchase" onPress={savePurchaseEdit} disabled={busy} />
                  <SecondaryButton title="Cancel" onPress={() => setEditingPurchaseId(noEdit)} disabled={busy} />
                </View>
              </View>
            ) : (
              <View style={styles.twoCols}>
                <SecondaryButton title="Edit Purchase" onPress={() => startEditPurchase(purchase)} disabled={busy} />
                <SecondaryButton title="Open PDF" onPress={() => openAuthenticatedPath(`/purchases/${purchase.id}/pdf`)} />
                <SecondaryButton title="Upload Receipt" onPress={() => uploadPurchaseReceipt(purchase.id)} disabled={busy} />
                {purchase.receipt_file_name ? (
                  <SecondaryButton title="Open Receipt" onPress={() => openAuthenticatedPath(`/purchases/${purchase.id}/receipt`)} />
                ) : null}
              </View>
            )}
          </View>
        ))}
      </View>
    );
  }

  function renderSuppliers() {
    return (
      <View style={styles.card}>
        <Text style={styles.kicker}>Stock & Buying</Text>
        <Text style={styles.screenTitle}>Suppliers</Text>
        <TextInput
          style={styles.input}
          value={supplierForm.name}
          onChangeText={value => setSupplierForm(current => ({ ...current, name: value }))}
          placeholder="Supplier name"
        />
        <TextInput
          style={styles.input}
          value={supplierForm.mobile}
          onChangeText={value => setSupplierForm(current => ({ ...current, mobile: value }))}
          placeholder="Mobile"
          keyboardType="phone-pad"
        />
        <TextInput
          style={styles.input}
          value={supplierForm.address}
          onChangeText={value => setSupplierForm(current => ({ ...current, address: value }))}
          placeholder="Address"
        />
        <PrimaryButton title="Add Supplier" onPress={createSupplier} disabled={busy} />
        <Text style={styles.subhead}>Supplier payment</Text>
        <SupplierPicker suppliers={suppliers} value={selectedSupplierId} onChange={setSelectedSupplierId} />
        <TextInput
          style={styles.input}
          value={supplierPaymentForm.amount}
          onChangeText={value => setSupplierPaymentForm(current => ({ ...current, amount: value }))}
          placeholder="Payment amount"
          keyboardType="decimal-pad"
        />
        <View style={styles.twoCols}>
          {['cash', 'bank', 'knet', 'other'].map(mode => (
            <Pill
              key={mode}
              label={mode}
              active={supplierPaymentForm.mode === mode}
              onPress={() => setSupplierPaymentForm(current => ({ ...current, mode }))}
            />
          ))}
        </View>
        <TextInput
          style={styles.input}
          value={supplierPaymentForm.referenceNo}
          onChangeText={value => setSupplierPaymentForm(current => ({ ...current, referenceNo: value }))}
          placeholder="Reference no."
        />
        <TextInput
          style={styles.input}
          value={supplierPaymentForm.note}
          onChangeText={value => setSupplierPaymentForm(current => ({ ...current, note: value }))}
          placeholder="Note"
        />
        <SecondaryButton title="Record Supplier Payment" onPress={recordSupplierPayment} disabled={busy} />
        <Text style={styles.subhead}>Supplier directory</Text>
        {suppliers.map(supplier => (
          <View key={supplier.id} style={styles.stackItem}>
            <Row
              title={supplier.name}
              subtitle={`${supplier.mobile || 'No mobile'} | ${supplier.address || 'No address'}`}
              right={supplier.balance !== undefined ? currency(supplier.balance) : undefined}
              onPress={() => setSelectedSupplierId(supplier.id)}
            />
            {editingSupplierId === supplier.id ? (
              <View style={styles.inlineEditor}>
                <Text style={styles.subhead}>Edit supplier</Text>
                <TextInput
                  style={styles.input}
                  value={supplierEditForm.name}
                  onChangeText={value => setSupplierEditForm(current => ({ ...current, name: value }))}
                  placeholder="Supplier name"
                />
                <TextInput
                  style={styles.input}
                  value={supplierEditForm.mobile}
                  onChangeText={value => setSupplierEditForm(current => ({ ...current, mobile: value }))}
                  placeholder="Mobile"
                  keyboardType="phone-pad"
                />
                <TextInput
                  style={styles.input}
                  value={supplierEditForm.address}
                  onChangeText={value => setSupplierEditForm(current => ({ ...current, address: value }))}
                  placeholder="Address"
                />
                <View style={styles.twoCols}>
                  <PrimaryButton title="Save Supplier" onPress={saveSupplierEdit} disabled={busy} />
                  <SecondaryButton title="Cancel" onPress={() => setEditingSupplierId(noEdit)} disabled={busy} />
                </View>
              </View>
            ) : (
              <View style={styles.twoCols}>
                <SecondaryButton title="Edit Supplier" onPress={() => startEditSupplier(supplier)} disabled={busy} />
                {selectedSupplierId === supplier.id ? (
                  <SecondaryButton title="Delete Supplier" onPress={deleteSelectedSupplier} disabled={busy} />
                ) : null}
              </View>
            )}
          </View>
        ))}
      </View>
    );
  }

  function renderInvoices() {
    if (selectedInvoiceDetail) {
      return renderInvoiceDetail(selectedInvoiceDetail);
    }

    return (
      <View style={styles.card}>
        <Text style={styles.kicker}>Front Counter</Text>
        <Text style={styles.screenTitle}>Invoice History</Text>
        {invoiceDetailLoading ? <Text style={styles.mutedDark}>Loading invoice detail...</Text> : null}
        {invoices.slice(0, 12).map(invoice => (
          <View key={invoice.id} style={styles.stackItem}>
            <Row
              title={`Invoice ${invoiceLabel(invoice)}`}
              subtitle={`${customerName(customers, invoice.customer_id)} | ${invoice.payment_status ?? 'open'} | ${invoice.status ?? 'active'}`}
              right={currency(invoice.grand_total)}
              onPress={() => openInvoiceDetail(invoice.id)}
            />
            <View style={styles.twoCols}>
              <SecondaryButton title="Details" onPress={() => openInvoiceDetail(invoice.id)} disabled={invoiceDetailLoading} />
              <SecondaryButton title="Open PDF" onPress={() => openAuthenticatedPath(`/invoices/${invoice.id}/pdf`)} />
              <SecondaryButton title="Upload Receipt" onPress={() => uploadInvoiceDeliveryReceipt(invoice.id)} disabled={busy} />
              <SecondaryButton
                title="Statement"
                onPress={() => {
                  setSelectedCustomerId(invoice.customer_id ?? null);
                  setScreen('statement');
                }}
              />
              {invoice.delivery_receipt_original_name ? (
                <SecondaryButton title="Open Receipt" onPress={() => openAuthenticatedPath(`/invoices/${invoice.id}/delivery-receipt`)} />
              ) : null}
            </View>
          </View>
        ))}
        {isAdmin ? (
          <>
            <Text style={styles.subhead}>Void invoice</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectorRow}>
              {invoices.filter(invoice => invoice.status !== 'void').slice(0, 12).map(invoice => (
                <Pill
                  key={invoice.id}
                  label={invoiceLabel(invoice)}
                  active={voidForm.invoiceId === String(invoice.id)}
                  onPress={() => setVoidForm(current => ({ ...current, invoiceId: String(invoice.id) }))}
                />
              ))}
            </ScrollView>
            <TextInput
              style={styles.input}
              value={voidForm.reason}
              onChangeText={value => setVoidForm(current => ({ ...current, reason: value }))}
              placeholder="Void reason"
            />
            <SecondaryButton title="Void Selected Invoice" onPress={voidInvoice} disabled={busy} />
          </>
        ) : null}
      </View>
    );
  }

  function renderInvoiceDetail(invoice: InvoiceDetail) {
    const isVoid = invoice.status === 'void';
    const isUnpaid = invoice.payment_status === 'unpaid';

    return (
      <View style={styles.card}>
        <Text style={styles.kicker}>Invoice Detail</Text>
        <Text style={styles.screenTitle}>Invoice {invoiceLabel(invoice)}</Text>
        <SecondaryButton title="Back to History" onPress={closeInvoiceDetail} />
        <View style={styles.metricGrid}>
          <Metric label="Total" value={currency(invoice.total)} />
          <Metric label="Previous" value={currency(invoice.previous_balance)} />
          <Metric label="Grand Total" value={currency(invoice.grand_total)} />
          <Metric label="Due" value={currency(invoice.outstanding_amount)} />
        </View>
        <Row
          title={invoice.customer?.name ?? customerName(customers, invoice.customer_id)}
          subtitle={`${invoice.customer?.mobile || 'No mobile'} | ${invoice.type ?? 'invoice'} | ${invoice.date ? new Date(invoice.date).toLocaleString() : 'No date'}`}
          right={isVoid ? 'Void' : invoice.payment_status ?? 'open'}
          danger={!isVoid && invoice.payment_status !== 'paid'}
        />
        <View style={styles.metricGrid}>
          <Metric label="Paid" value={currency(invoice.paid_amount)} />
          <Metric label="Payments" value={String(invoice.payment_count ?? 0)} />
          <Metric label="Status" value={isVoid ? 'Void' : invoice.payment_status ?? 'open'} />
        </View>
        {invoice.void_reason ? (
          <Row
            title="Void reason"
            subtitle={`${invoice.void_reason}${invoice.voided_at ? ` | ${new Date(invoice.voided_at).toLocaleString()}` : ''}`}
            danger
          />
        ) : null}
        <Text style={styles.subhead}>Line items</Text>
        {invoice.items.map(item => (
          <Row
            key={item.id}
            title={item.product_name || (item.product_id ? `Product #${item.product_id}` : 'Custom item')}
            subtitle={`${item.pieces ?? 1} pcs | ${money(item.weight)} kg x ${currencyInline(item.price_per_kg)}`}
            right={currency(item.amount)}
          />
        ))}
        {!invoice.items.length ? <Text style={styles.mutedDark}>No line items found.</Text> : null}
        <Text style={styles.subhead}>Delivery receipt</Text>
        <Row
          title={invoice.delivery_receipt_original_name || 'Not uploaded'}
          subtitle={invoice.delivery_receipt_uploaded_at ? `Uploaded ${new Date(invoice.delivery_receipt_uploaded_at).toLocaleString()}` : 'No delivery receipt uploaded'}
          right={invoice.delivery_receipt_original_name ? 'Ready' : undefined}
        />
        <View style={styles.twoCols}>
          <SecondaryButton title="Open PDF" onPress={() => openAuthenticatedPath(`/invoices/${invoice.id}/pdf`)} />
          {!isVoid ? <SecondaryButton title="Upload Receipt" onPress={() => uploadInvoiceDeliveryReceipt(invoice.id)} disabled={busy} /> : null}
          {invoice.delivery_receipt_original_name ? (
            <SecondaryButton title="Open Receipt" onPress={() => openAuthenticatedPath(`/invoices/${invoice.id}/delivery-receipt`)} />
          ) : null}
          <SecondaryButton
            title="Statement"
            onPress={() => {
              setSelectedCustomerId(invoice.customer_id ?? null);
              setSelectedInvoiceDetail(null);
              setScreen('statement');
            }}
          />
        </View>
        <Text style={styles.subhead}>Payments</Text>
        {invoice.payments.map(payment => (
          <Row
            key={payment.id}
            title={`Payment #${payment.id}`}
            subtitle={`${payment.mode} | ${payment.status ?? 'active'}${payment.reversal_reason ? ` | ${payment.reversal_reason}` : ''}`}
            right={currency(payment.amount)}
          />
        ))}
        {!invoice.payments.length ? <Text style={styles.mutedDark}>No linked payments.</Text> : null}
        {isAdmin && !isVoid && isUnpaid ? (
          <>
            <Text style={styles.subhead}>Void invoice</Text>
            <TextInput
              style={styles.input}
              value={voidForm.reason}
              onChangeText={value => setVoidForm(current => ({ ...current, reason: value }))}
              placeholder="Void reason"
            />
            <SecondaryButton title="Void This Invoice" onPress={voidInvoice} disabled={busy} />
          </>
        ) : null}
      </View>
    );
  }

  function renderShiftClose() {
    const totals = shiftSummary?.totals;
    const variance =
      Number(shiftForm.countedCash || 0) +
      Number(shiftForm.countedKnet || 0) -
      Number(totals?.totalCollection ?? 0);

    return (
      <View style={styles.card}>
        <Text style={styles.kicker}>Finance</Text>
        <Text style={styles.screenTitle}>Shift Close</Text>
        <View style={styles.metricGrid}>
          <Metric label="Cash" value={currency(totals?.cashCollection)} />
          <Metric label="KNET" value={currency(totals?.knetCollection)} />
          <Metric label="Total" value={currency(totals?.totalCollection)} />
          <Metric label="Payments" value={String(totals?.paymentCount ?? 0)} />
        </View>
        <TextInput
          style={styles.input}
          value={shiftForm.countedCash}
          onChangeText={value => setShiftForm(current => ({ ...current, countedCash: value }))}
          placeholder="Counted cash"
          keyboardType="decimal-pad"
        />
        <TextInput
          style={styles.input}
          value={shiftForm.countedKnet}
          onChangeText={value => setShiftForm(current => ({ ...current, countedKnet: value }))}
          placeholder="Counted KNET"
          keyboardType="decimal-pad"
        />
        <TextInput
          style={styles.input}
          value={shiftForm.notes}
          onChangeText={value => setShiftForm(current => ({ ...current, notes: value }))}
          placeholder="Notes"
        />
        <Metric label="Variance" value={currency(variance)} />
        <PrimaryButton title="Submit Shift Close" onPress={submitShiftClose} disabled={busy} />
      </View>
    );
  }

  function renderKnet() {
    return (
      <View style={styles.card}>
        <Text style={styles.kicker}>Finance</Text>
        <Text style={styles.screenTitle}>KNET Reconcile</Text>
        <HealthBadge health={health} />
        <View style={styles.metricGrid}>
          <Metric label="Pending" value={String(knetReconciliation?.pending ?? 0)} />
          <Metric label="Completed" value={String(knetReconciliation?.completed ?? 0)} />
          <Metric label="Failed" value={String(knetReconciliation?.failed ?? 0)} />
        </View>
        <Text style={styles.subhead}>Recent sessions</Text>
        {(knetReconciliation?.sessions ?? []).slice(0, 8).map((session, index) => (
          <Row
            key={`${session.id ?? index}`}
            title={`KNET ${session.id ?? index + 1}`}
            subtitle={`Invoice #${session.invoice_id ?? '-'} | ${session.status ?? 'pending'}`}
            right={currency(session.amount)}
          />
        ))}
      </View>
    );
  }

  function renderStatement() {
    const balance = statementRows[statementRows.length - 1]?.balance ?? 0;

    return (
      <View style={styles.card}>
        <Text style={styles.kicker}>Finance</Text>
        <Text style={styles.screenTitle}>Customer Ledger</Text>
        <CustomerPicker customers={customers} value={selectedCustomerId} onChange={setSelectedCustomerId} />
        <Metric label="Balance" value={currency(balance)} />
        <Text style={styles.subhead}>Statement</Text>
        {statementRows.slice(-10).reverse().map((row, index) => (
          <Row
            key={`${row.id ?? index}`}
            title={row.description || row.date || `Entry ${index + 1}`}
            subtitle={`Debit ${currencyInline(row.debit)} | Credit ${currencyInline(row.credit)}`}
            right={currency(row.balance)}
          />
        ))}
        {!statementRows.length ? <Text style={styles.mutedDark}>No ledger entries for this customer.</Text> : null}
      </View>
    );
  }

  function renderExpenses() {
    return (
      <View style={styles.card}>
        <Text style={styles.kicker}>Finance</Text>
        <Text style={styles.screenTitle}>Expenses</Text>
        <TextInput
          style={styles.input}
          value={expenseForm.title}
          onChangeText={value => setExpenseForm(current => ({ ...current, title: value }))}
          placeholder="Title"
        />
        <View style={styles.twoCols}>
          {(['rent', 'salary', 'fuel', 'transport', 'misc'] as const).map(category => (
            <Pill
              key={category}
              label={category}
              active={expenseForm.category === category}
              onPress={() => setExpenseForm(current => ({ ...current, category }))}
            />
          ))}
        </View>
        <TextInput
          style={styles.input}
          value={expenseForm.amount}
          onChangeText={value => setExpenseForm(current => ({ ...current, amount: value }))}
          placeholder="Amount"
          keyboardType="decimal-pad"
        />
        <PrimaryButton title="Record Expense" onPress={recordExpense} disabled={busy} />
        <Text style={styles.subhead}>Recent expenses</Text>
        {expenses.slice(0, 8).map(expense => (
          <Row
            key={expense.id}
            title={expense.title}
            subtitle={expense.category}
            right={currency(expense.amount)}
          />
        ))}
      </View>
    );
  }

  function renderReports() {
    return (
      <View style={styles.card}>
        <Text style={styles.kicker}>Reports</Text>
        <Text style={styles.screenTitle}>Business Reports</Text>
        <View style={styles.metricGrid}>
          <Metric label="Sales" value={currency(report?.sales)} />
          <Metric label="Expenses" value={currency(report?.expenses)} />
          <Metric label="Profit" value={currency(report?.profit)} />
          <Metric label="Outstanding" value={currency(creditSummary?.total_outstanding)} />
        </View>
        <Text style={styles.subhead}>Historic Report</Text>
        <View style={styles.metricGrid}>
          <Metric label="Sales" value={currency(historicReport?.totals.salesTotal)} />
          <Metric label="Collections" value={currency(historicReport?.totals.netCollection)} />
          <Metric label="Expenses" value={currency(historicReport?.totals.expenseTotal)} />
          <Metric label="Purchases" value={currency(historicReport?.totals.purchaseTotal)} />
          <Metric label="Profit" value={currency(historicReport?.totals.grossProfit)} />
          <Metric label="KNET" value={currency(historicReport?.totals.knetCollection)} />
        </View>
        {historicReport ? (
          <>
            <Text style={styles.mutedDark}>
              {historicReport.range.from} to {historicReport.range.to} | Invoices {historicReport.totals.invoiceCount} | Payments {historicReport.totals.paymentCount}
            </Text>
            <Text style={styles.subhead}>Recent invoices</Text>
            {historicReport.invoices.slice(0, 5).map(invoice => (
              <Row
                key={invoice.id}
                title={`${invoice.invoice_number} · ${invoice.customer_name}`}
                subtitle={`${invoice.type} · ${new Date(invoice.date).toLocaleDateString()}`}
                right={currency(invoice.total)}
              />
            ))}
            <Text style={styles.subhead}>Recent payments</Text>
            {historicReport.payments.slice(0, 5).map(payment => (
              <Row
                key={payment.id}
                title={payment.customer_name}
                subtitle={`${payment.mode} · ${new Date(payment.date).toLocaleDateString()}`}
                right={currency(payment.amount)}
              />
            ))}
            <Text style={styles.subhead}>Stock movement</Text>
            {historicReport.stockMovements.slice(0, 5).map(movement => (
              <Row
                key={movement.id}
                title={movement.product_name}
                subtitle={`${movement.type} · ${new Date(movement.date).toLocaleDateString()}`}
                right={`${Number(movement.quantity_kg).toFixed(3)} kg`}
              />
            ))}
          </>
        ) : (
          <Text style={styles.mutedDark}>Historic report not loaded.</Text>
        )}
        <Text style={styles.subhead}>Collections</Text>
        {customers
          .filter(customer => Number(customer.credit_limit ?? 0) >= 0)
          .slice(0, 6)
          .map(customer => (
            <Row
              key={customer.id}
              title={customer.name}
              subtitle={customer.mobile || 'No mobile'}
              right={selectedCustomerId === customer.id ? 'Active' : undefined}
              onPress={() => {
                setSelectedCustomerId(customer.id);
                setScreen('statement');
              }}
            />
          ))}
      </View>
    );
  }

  function renderActivity() {
    return (
      <View style={styles.card}>
        <Text style={styles.kicker}>Reports</Text>
        <Text style={styles.screenTitle}>Staff Activity</Text>
        {auditLogs.slice(0, 15).map(log => (
          <Row
            key={log.id}
            title={log.action}
            subtitle={`${log.entity} | ${log.username || 'system'}`}
            right={log.created_at ? new Date(log.created_at).toLocaleDateString() : undefined}
          />
        ))}
        {!auditLogs.length ? <Text style={styles.mutedDark}>No activity loaded.</Text> : null}
      </View>
    );
  }

  function renderUsers() {
    return (
      <View style={styles.card}>
        <Text style={styles.kicker}>Admin</Text>
        <Text style={styles.screenTitle}>Users & Roles</Text>
        <TextInput
          style={styles.input}
          value={userForm.username}
          onChangeText={value => setUserForm(current => ({ ...current, username: value }))}
          placeholder="Username"
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          value={userForm.password}
          onChangeText={value => setUserForm(current => ({ ...current, password: value }))}
          placeholder="Password"
          secureTextEntry
        />
        <View style={styles.twoCols}>
          <Pill label="Staff" active={userForm.role === 'staff'} onPress={() => setUserForm(current => ({ ...current, role: 'staff' }))} />
          <Pill label="Admin" active={userForm.role === 'admin'} onPress={() => setUserForm(current => ({ ...current, role: 'admin' }))} />
        </View>
        <PrimaryButton title="Create User" onPress={createUser} disabled={busy} />
        <Text style={styles.subhead}>Current users</Text>
        {users.map(item => (
          <View key={item.id} style={styles.stackItem}>
            <Row title={item.username} subtitle={item.role} />
            {editingUserId === item.id ? (
              <View style={styles.inlineEditor}>
                <Text style={styles.subhead}>Edit user</Text>
                <TextInput
                  style={styles.input}
                  value={userEditForm.username}
                  onChangeText={value => setUserEditForm(current => ({ ...current, username: value }))}
                  placeholder="Username"
                  autoCapitalize="none"
                />
                <TextInput
                  style={styles.input}
                  value={userEditForm.password}
                  onChangeText={value => setUserEditForm(current => ({ ...current, password: value }))}
                  placeholder="New password optional"
                  secureTextEntry
                />
                <View style={styles.twoCols}>
                  <Pill label="Staff" active={userEditForm.role === 'staff'} onPress={() => setUserEditForm(current => ({ ...current, role: 'staff' }))} />
                  <Pill label="Admin" active={userEditForm.role === 'admin'} onPress={() => setUserEditForm(current => ({ ...current, role: 'admin' }))} />
                </View>
                <View style={styles.twoCols}>
                  <PrimaryButton title="Save User" onPress={saveUserEdit} disabled={busy} />
                  <SecondaryButton title="Cancel" onPress={() => setEditingUserId(noEdit)} disabled={busy} />
                </View>
              </View>
            ) : (
              <View style={styles.twoCols}>
                <SecondaryButton title="Edit User" onPress={() => startEditUser(item)} disabled={busy} />
                <SecondaryButton title="Delete User" onPress={() => deleteUser(item.id)} disabled={busy} />
              </View>
            )}
          </View>
        ))}
      </View>
    );
  }

  function renderAdmin() {
    return (
      <View style={styles.card}>
        <Text style={styles.kicker}>Admin</Text>
        <Text style={styles.screenTitle}>Native App Status</Text>
        <HealthBadge health={health} />
        <Text style={styles.subhead}>Server URL / IP</Text>
        <TextInput
          style={styles.input}
          value={apiUrl}
          onChangeText={editServerUrl}
          onBlur={() => applyServerUrl(apiUrl)}
          placeholder="Backend URL or IP"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <View style={styles.presetGrid}>
          {SERVER_PRESETS.map(preset => (
            <TouchableOpacity
              key={preset.label}
              style={styles.presetButton}
              onPress={() => applyServerUrl(preset.value)}>
              <Text style={styles.presetTitle}>{preset.label}</Text>
              <Text style={styles.presetCaption}>{preset.caption}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Metric label="Backend" value={apiUrl || 'Not set'} />
        <Text style={styles.subhead}>KWD to USD rate</Text>
        <TextInput
          style={styles.input}
          value={currencyRateInput}
          onChangeText={setCurrencyRateInput}
          placeholder="KWD to USD rate"
          keyboardType="decimal-pad"
        />
        <Metric label="Current Rate" value={String(currencyRate)} />
        <Metric label="Currency Example" value={currency(1)} />
        <SecondaryButton title="Save Rate" onPress={updateCurrencyRate} disabled={busy} />
        <Metric label="Customers" value={String(customers.length)} />
        <Metric label="Products" value={String(products.length)} />
        <Metric label="Invoices" value={String(invoices.length)} />
        <SecondaryButton
          title="Reload Data"
          onPress={() => {
            loadData().catch(error => {
              setStatus(error instanceof Error ? error.message : 'Could not load mobile data.');
            });
          }}
        />
        <SecondaryButton
          title="Show Native Note"
          onPress={() => Alert.alert('Native app', 'This app is separate from Expo and uses bare React Native.')}
        />
      </View>
    );
  }
}

function PrimaryButton({ title, onPress, disabled }: { title: string; onPress: () => void; disabled?: boolean }) {
  const { t } = useLanguage();
  return (
    <TouchableOpacity style={[styles.primaryButton, disabled ? styles.disabledButton : null]} onPress={onPress} disabled={disabled}>
      <Text style={styles.primaryText}>{t(title)}</Text>
    </TouchableOpacity>
  );
}

function SecondaryButton({ title, onPress, disabled }: { title: string; onPress: () => void; disabled?: boolean }) {
  const { t } = useLanguage();
  return (
    <TouchableOpacity style={[styles.secondaryButton, disabled ? styles.disabledButton : null]} onPress={onPress} disabled={disabled}>
      <Text style={styles.secondaryText}>{t(title)}</Text>
    </TouchableOpacity>
  );
}

function Pill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { t } = useLanguage();
  return (
    <TouchableOpacity style={[styles.pill, active ? styles.pillActive : null]} onPress={onPress}>
      <Text style={[styles.pillText, active ? styles.pillTextActive : null]}>{t(label)}</Text>
    </TouchableOpacity>
  );
}

function CustomerPicker({
  customers,
  value,
  onChange,
}: {
  customers: Customer[];
  value: number | null;
  onChange: (value: number) => void;
}) {
  const { t } = useLanguage();
  return (
    <View>
      <Text style={styles.subhead}>{t('Select customer')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectorRow}>
        {customers.map(customer => (
          <Pill
            key={customer.id}
            label={customer.name}
            active={value === customer.id}
            onPress={() => onChange(customer.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function ProductPicker({
  products,
  value,
  onChange,
}: {
  products: Product[];
  value: number | null;
  onChange: (value: number) => void;
}) {
  const { t } = useLanguage();
  return (
    <View>
      <Text style={styles.subhead}>{t('Select product')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectorRow}>
        {products.map(product => (
          <Pill
            key={product.id}
            label={product.name}
            active={value === product.id}
            onPress={() => onChange(product.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function SupplierPicker({
  suppliers,
  value,
  onChange,
}: {
  suppliers: Supplier[];
  value: number | null;
  onChange: (value: number) => void;
}) {
  const { t } = useLanguage();
  return (
    <View>
      <Text style={styles.subhead}>{t('Select supplier')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectorRow}>
        {suppliers.map(supplier => (
          <Pill
            key={supplier.id}
            label={supplier.name}
            active={value === supplier.id}
            onPress={() => onChange(supplier.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function InvoiceMultiPicker({
  invoices,
  values,
  onToggle,
  onClear,
}: {
  invoices: Invoice[];
  values: number[];
  onToggle: (invoice: Invoice) => void;
  onClear: () => void;
}) {
  const { t } = useLanguage();
  return (
    <View>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.subhead}>{t('Select invoices')}</Text>
        {values.length ? (
          <TouchableOpacity onPress={onClear}>
            <Text style={styles.linkText}>{t('Clear')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectorRow}>
        {invoices.map(invoice => (
          <Pill
            key={invoice.id}
            label={`${invoiceLabel(invoice)} | ${currencyInline(invoice.outstanding_amount)}`}
            active={values.includes(invoice.id)}
            onPress={() => onToggle(invoice)}
          />
        ))}
        {!invoices.length ? (
          <Text style={styles.mutedText}>{t('No unpaid invoices')}</Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Row({
  title,
  subtitle,
  right,
  danger,
  onPress,
}: {
  title: string;
  subtitle: string;
  right?: string;
  danger?: boolean;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity style={[styles.row, danger ? styles.rowDanger : null]} onPress={onPress} disabled={!onPress}>
      <View style={styles.flex}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSubtitle}>{subtitle}</Text>
      </View>
      {right ? <MoneyText value={right} danger={danger} /> : null}
    </TouchableOpacity>
  );
}

function MoneyText({ value, danger }: { value: string; danger?: boolean }) {
  if (!isCurrencyValue(value)) {
    return <Text style={danger ? styles.dangerText : styles.rowRight}>{value}</Text>;
  }

  const [kwd, usd] = value.split('\n');
  return (
    <View style={styles.rowMoney}>
      <Text style={danger ? styles.dangerText : styles.rowRight} numberOfLines={1} adjustsFontSizeToFit>
        {kwd}
      </Text>
      <Text style={danger ? styles.dangerSubText : styles.rowUsd} numberOfLines={1} adjustsFontSizeToFit>
        {usd}
      </Text>
    </View>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: 'red' | 'green' | 'amber' | 'blue' | 'dark' }) {
  const { t } = useLanguage();
  const currencyValue = isCurrencyValue(value) ? value.split('\n') : null;
  return (
    <View
      style={[
        styles.metric,
        tone === 'red' ? styles.metricRed : null,
        tone === 'green' ? styles.metricGreen : null,
        tone === 'amber' ? styles.metricAmber : null,
        tone === 'blue' ? styles.metricBlue : null,
        tone === 'dark' ? styles.metricDark : null,
      ]}>
      <Text style={[styles.kicker, tone && tone !== 'amber' ? styles.metricKickerTint : null]}>{t(label)}</Text>
      {currencyValue ? (
        <View style={styles.metricMoney}>
          <Text style={[styles.metricValue, tone && tone !== 'amber' ? styles.metricValueTint : null]} numberOfLines={1} adjustsFontSizeToFit>
            {currencyValue[0]}
          </Text>
          <Text style={[styles.metricUsd, tone && tone !== 'amber' ? styles.metricValueTint : null]} numberOfLines={1} adjustsFontSizeToFit>
            {currencyValue[1]}
          </Text>
        </View>
      ) : (
        <Text style={[styles.metricValue, tone && tone !== 'amber' ? styles.metricValueTint : null]}>{t(value)}</Text>
      )}
    </View>
  );
}

function HealthBadge({ health }: { health: HealthState | null }) {
  const { t } = useLanguage();
  const ready = health?.dependencies.database.status === 'ok';
  const knet = health?.dependencies.knet.status === 'configured' ? 'Live' : 'Mock';

  return (
    <View style={styles.health}>
      <View style={[styles.dot, ready ? styles.dotReady : styles.dotDown]} />
      <Text style={styles.healthText}>
        {t(ready ? 'Backend online' : 'Backend offline')} | {t('KNET')} {t(knet)}
      </Text>
    </View>
  );
}

function LanguageToggle({ language, onChange }: { language: Language; onChange: (language: Language) => void }) {
  return (
    <TouchableOpacity
      style={styles.languageButton}
      onPress={() => onChange(language === 'en' ? 'ar' : 'en')}>
      <Text style={styles.languageText}>{language === 'en' ? 'عربي' : 'EN'}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f7f2ef',
  },
  loginContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: 18,
    padding: 20,
  },
  brandCard: {
    alignItems: 'center',
    backgroundColor: '#161616',
    borderRadius: 28,
    flexDirection: 'row',
    gap: 14,
    padding: 18,
  },
  logoBox: {
    borderRadius: 18,
    height: 70,
    width: 70,
  },
  logoSmall: {
    borderRadius: 14,
    height: 48,
    width: 48,
  },
  flex: {
    flex: 1,
  },
  card: {
    backgroundColor: 'white',
    borderColor: '#e5ddda',
    borderRadius: 26,
    borderWidth: 1,
    gap: 12,
    marginBottom: 18,
    padding: 18,
  },
  header: {
    alignItems: 'center',
    backgroundColor: '#151515',
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  headerTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: '900',
  },
  title: {
    color: 'white',
    fontSize: 24,
    fontWeight: '900',
  },
  screenTitle: {
    color: '#101827',
    fontSize: 30,
    fontWeight: '900',
  },
  sectionTitle: {
    color: '#101827',
    fontSize: 24,
    fontWeight: '900',
  },
  kicker: {
    color: '#777',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  muted: {
    color: '#9b9b9b',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 3,
  },
  mutedDark: {
    color: '#666',
    fontSize: 14,
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderRadius: 18,
    borderWidth: 1,
    color: '#101827',
    fontSize: 16,
    fontWeight: '800',
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#e71932',
    borderRadius: 18,
    padding: 16,
  },
  primaryText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '900',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#101010',
    borderRadius: 18,
    padding: 16,
  },
  secondaryText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '900',
  },
  disabledButton: {
    opacity: 0.5,
  },
  logoutButton: {
    borderColor: '#8f1d2d',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  logoutText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '900',
  },
  languageButton: {
    alignItems: 'center',
    backgroundColor: '#262626',
    borderColor: '#444',
    borderRadius: 999,
    borderWidth: 1,
    minWidth: 54,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  languageText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '900',
  },
  navPanel: {
    backgroundColor: '#f7f2ef',
    borderBottomColor: '#ebe4e0',
    borderBottomWidth: 1,
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  navMainRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  navMainButton: {
    alignItems: 'center',
    backgroundColor: 'white',
    borderColor: '#dfdad7',
    borderRadius: 999,
    borderWidth: 1,
    flexGrow: 1,
    minHeight: 44,
    minWidth: '22%',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  navMainButtonActive: {
    backgroundColor: '#101010',
    borderColor: '#101010',
  },
  navMainText: {
    color: '#666',
    fontSize: 13,
    fontWeight: '900',
  },
  navMainTextActive: {
    color: 'white',
  },
  navSubGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  navSubButton: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: '#e5ddda',
    borderRadius: 16,
    borderWidth: 1,
    flexBasis: '31%',
    flexGrow: 1,
    minHeight: 42,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  navSubButtonActive: {
    backgroundColor: '#e71932',
    borderColor: '#e71932',
  },
  navSubText: {
    color: '#5f5f5f',
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
  },
  navSubTextActive: {
    color: 'white',
  },
  selectorRow: {
    gap: 8,
    paddingVertical: 4,
  },
  stackItem: {
    gap: 8,
  },
  inlineEditor: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderRadius: 18,
    borderWidth: 1,
    gap: 10,
    padding: 12,
  },
  formGrid: {
    gap: 10,
  },
  fieldBlock: {
    gap: 6,
  },
  fieldLabel: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  sectionHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  linkText: {
    color: '#e71932',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  mutedText: {
    color: '#777',
    fontSize: 13,
    fontWeight: '800',
    paddingVertical: 14,
  },
  infoBox: {
    backgroundColor: '#fff5f5',
    borderColor: '#ffd0d0',
    borderRadius: 18,
    borderWidth: 1,
    gap: 4,
    padding: 14,
  },
  infoTitle: {
    color: '#101827',
    fontSize: 15,
    fontWeight: '900',
  },
  infoText: {
    color: '#15803d',
    fontSize: 15,
    fontWeight: '900',
  },
  pill: {
    alignItems: 'center',
    backgroundColor: 'white',
    borderColor: '#dfdad7',
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 15,
    paddingVertical: 8,
  },
  pillActive: {
    backgroundColor: '#111',
    borderColor: '#111',
  },
  pillText: {
    color: '#666',
    fontWeight: '900',
  },
  pillTextActive: {
    color: 'white',
  },
  content: {
    flex: 1,
    paddingHorizontal: 14,
  },
  twoCols: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  twoColsEven: {
    flexDirection: 'row',
    gap: 10,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  lineItem: {
    backgroundColor: '#fbf8f7',
    borderColor: '#e5ddda',
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
    padding: 14,
  },
  lineItemHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  billingFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  totalBox: {
    alignItems: 'flex-end',
    flex: 1,
    minWidth: 140,
  },
  totalValue: {
    color: '#15803d',
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 29,
    textAlign: 'right',
  },
  subhead: {
    color: '#777',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.6,
    marginTop: 6,
    textTransform: 'uppercase',
  },
  row: {
    alignItems: 'center',
    backgroundColor: '#f9f7f6',
    borderColor: '#e5ddda',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  rowDanger: {
    backgroundColor: '#fff1f2',
    borderColor: '#fecdd3',
  },
  rowTitle: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '900',
  },
  rowSubtitle: {
    color: '#666',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 3,
  },
  rowRight: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 17,
    textAlign: 'right',
  },
  rowMoney: {
    alignItems: 'flex-end',
    flexShrink: 0,
    maxWidth: 118,
  },
  rowUsd: {
    color: '#777',
    fontSize: 11,
    fontWeight: '900',
    lineHeight: 14,
    marginTop: 2,
    textAlign: 'right',
  },
  dangerText: {
    color: '#e71932',
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 17,
    textAlign: 'right',
  },
  dangerSubText: {
    color: '#be123c',
    fontSize: 11,
    fontWeight: '900',
    lineHeight: 14,
    marginTop: 2,
    textAlign: 'right',
  },
  metric: {
    backgroundColor: '#f9f7f6',
    borderRadius: 18,
    minWidth: 130,
    padding: 16,
  },
  metricRed: {
    backgroundColor: '#e71932',
  },
  metricGreen: {
    backgroundColor: '#15803d',
  },
  metricAmber: {
    backgroundColor: '#fde68a',
  },
  metricBlue: {
    backgroundColor: '#1d4ed8',
  },
  metricDark: {
    backgroundColor: '#1f2937',
  },
  metricKickerTint: {
    color: 'rgba(255,255,255,0.78)',
  },
  metricValue: {
    color: '#111827',
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 26,
    marginTop: 4,
  },
  metricMoney: {
    marginTop: 4,
  },
  metricUsd: {
    color: '#555',
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 17,
    marginTop: 2,
  },
  metricValueTint: {
    color: 'white',
  },
  health: {
    alignItems: 'center',
    backgroundColor: '#f6f6f6',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
    padding: 10,
  },
  dot: {
    borderRadius: 999,
    height: 10,
    width: 10,
  },
  dotReady: {
    backgroundColor: '#10b981',
  },
  dotDown: {
    backgroundColor: '#ef4444',
  },
  healthText: {
    color: '#555',
    fontSize: 12,
    fontWeight: '900',
  },
  helpText: {
    color: '#666',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
  presetGrid: {
    gap: 10,
  },
  presetButton: {
    backgroundColor: '#f9f7f6',
    borderColor: '#e5ddda',
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
  },
  presetTitle: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '900',
  },
  presetCaption: {
    color: '#777',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  success: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
    borderRadius: 18,
    borderWidth: 1,
    color: '#047857',
    fontWeight: '800',
    marginBottom: 12,
    padding: 12,
  },
  error: {
    backgroundColor: '#fff1f2',
    borderColor: '#fecdd3',
    borderRadius: 18,
    borderWidth: 1,
    color: '#be123c',
    fontWeight: '800',
    marginTop: 8,
    padding: 12,
  },
});
