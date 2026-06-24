"use client";

import { useEffect, useMemo, useState } from "react";
import {
  apiFetch,
  downloadAuthenticatedFile,
  fetchJson,
  fetchJsonOrThrow,
  getErrorMessage,
} from "../../lib/auth";
import { Money, setDisplayCurrency, useCurrencyRate } from "../../lib/currency";

type Supplier = {
  id: number;
  name: string;
};

type Product = {
  id: number;
  name: string;
  name_ar?: string | null;
};

type Purchase = {
  id: number;
  supplier_id: number;
  invoice_no?: string;
  transaction_currency?: "KWD" | "USD";
  exchange_rate?: number | string;
  subtotal?: number | string;
  discount_percent?: number | string;
  discount_amount?: number | string;
  advance_paid?: number | string;
  balance_due?: number | string;
  total: number;
  date: string;
  receipt_original_name?: string | null;
  receipt_file_name?: string | null;
  receipt_uploaded_at?: string | null;
};

type PurchaseDetail = Purchase & {
  items: Array<{
    id: number;
    purchase_id: number;
    product_id: number;
    pieces?: number | string | null;
    weight: number | string;
    cost_per_kg: number | string;
    amount: number | string;
  }>;
};

type PurchaseItem = {
  product_id: string;
  pieces: string;
  weight: string;
  cost_per_kg: string;
};

const emptyItem = { product_id: "", pieces: "", weight: "", cost_per_kg: "" };
const emptyProduct = { name: "", name_ar: "", sku: "", price_per_kg: "", low_stock_kg: "" };

export default function PurchasesPage() {
  const currencyRate = useCurrencyRate();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [discountPercent, setDiscountPercent] = useState("");
  const [advancePaid, setAdvancePaid] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [purchaseCurrency, setPurchaseCurrency] = useState<"KWD" | "USD">("KWD");
  const [productForm, setProductForm] = useState(emptyProduct);
  const [items, setItems] = useState<PurchaseItem[]>([emptyItem]);
  const [editingPurchaseId, setEditingPurchaseId] = useState<number | null>(null);
  const [editSupplierId, setEditSupplierId] = useState("");
  const [editInvoiceNo, setEditInvoiceNo] = useState("");
  const [editDiscountPercent, setEditDiscountPercent] = useState("");
  const [editAdvancePaid, setEditAdvancePaid] = useState("");
  const [editPurchaseCurrency, setEditPurchaseCurrency] = useState<"KWD" | "USD">("KWD");
  const [editExchangeRate, setEditExchangeRate] = useState(currencyRate);
  const [editItems, setEditItems] = useState<PurchaseItem[]>([emptyItem]);
  const [status, setStatus] = useState("");
  const [statusType, setStatusType] = useState<"success" | "error">("success");
  const [loading, setLoading] = useState(false);

  const supplierNameById = useMemo(
    () => new Map(suppliers.map((supplier) => [supplier.id, supplier.name])),
    [suppliers]
  );

  const loadPurchases = async (preserveStatus = false) => {
    if (!preserveStatus) {
      setStatus("");
    }

    try {
      const [supplierData, productData, purchaseData] = await Promise.all([
        fetchJson<Supplier[]>("/suppliers"),
        fetchJson<Product[]>("/products"),
        fetchJson<Purchase[]>("/purchases"),
      ]);
      setSuppliers(Array.isArray(supplierData) ? supplierData : []);
      setProducts(Array.isArray(productData) ? productData : []);
      setPurchases(Array.isArray(purchaseData) ? purchaseData : []);
    } catch (error) {
      setStatusType("error");
      setStatus(error instanceof Error ? error.message : "Could not load purchases.");
    }
  };

  useEffect(() => {
    Promise.all([
      fetchJson<Supplier[]>("/suppliers"),
      fetchJson<Product[]>("/products"),
      fetchJson<Purchase[]>("/purchases"),
    ])
      .then(([supplierData, productData, purchaseData]) => {
        setSuppliers(Array.isArray(supplierData) ? supplierData : []);
        setProducts(Array.isArray(productData) ? productData : []);
        setPurchases(Array.isArray(purchaseData) ? purchaseData : []);
      })
      .catch((error: Error) => {
        setStatusType("error");
        setStatus(error.message || "Could not load purchases.");
      });
  }, []);

  const toBaseKwd = (value: number, currency: "KWD" | "USD", rate = currencyRate) =>
    currency === "USD" ? value / rate : value;

  const total = items.reduce(
    (sum, item) =>
      sum +
      Number(item.weight || 0) *
        toBaseKwd(Number(item.cost_per_kg || 0), purchaseCurrency),
    0
  );
  const parsedDiscountPercent = Number(discountPercent || 0);
  const discountAmount = Number.isFinite(parsedDiscountPercent)
    ? Math.max((total * parsedDiscountPercent) / 100, 0)
    : Number.NaN;
  const netTotal = Number.isFinite(discountAmount) ? Math.max(total - discountAmount, 0) : total;
  const advancePaidBase = toBaseKwd(Number(advancePaid || 0), purchaseCurrency);
  const balanceDue = Math.max(netTotal - advancePaidBase, 0);

  const editTotal = editItems.reduce(
    (sum, item) =>
      sum +
      Number(item.weight || 0) *
        toBaseKwd(Number(item.cost_per_kg || 0), editPurchaseCurrency, editExchangeRate),
    0
  );
  const parsedEditDiscountPercent = Number(editDiscountPercent || 0);
  const editDiscountAmount = Number.isFinite(parsedEditDiscountPercent)
    ? Math.max((editTotal * parsedEditDiscountPercent) / 100, 0)
    : Number.NaN;
  const editNetTotal = Number.isFinite(editDiscountAmount)
    ? Math.max(editTotal - editDiscountAmount, 0)
    : editTotal;
  const editAdvancePaidBase = toBaseKwd(
    Number(editAdvancePaid || 0),
    editPurchaseCurrency,
    editExchangeRate,
  );
  const editBalanceDue = Math.max(editNetTotal - editAdvancePaidBase, 0);

  const updateItem = (
    index: number,
    field: keyof PurchaseItem,
    value: string,
    mode: "create" | "edit" = "create"
  ) => {
    const setter = mode === "edit" ? setEditItems : setItems;
    setter((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      )
    );
  };

  const validateRows = (rows: PurchaseItem[]) =>
    rows.every((item) => item.product_id && Number(item.weight) > 0);

  const createProductForPurchase = async () => {
    if (!productForm.name.trim()) {
      setStatusType("error");
      setStatus("Product name is required.");
      return;
    }

    setLoading(true);
    setStatus("");

    try {
      const product = await fetchJsonOrThrow<Product>("/products", {
        method: "POST",
        body: JSON.stringify({
          name: productForm.name.trim(),
          name_ar: productForm.name_ar.trim() || undefined,
          sku: productForm.sku.trim() || undefined,
          price_per_kg: productForm.price_per_kg
            ? Number(productForm.price_per_kg)
            : undefined,
          low_stock_kg: productForm.low_stock_kg
            ? Number(productForm.low_stock_kg)
            : undefined,
        }),
      });

      setProducts((current) => [...current, product].sort((a, b) => a.name.localeCompare(b.name)));
      setItems((current) => {
        const emptyIndex = current.findIndex((row) => !row.product_id);

        if (emptyIndex === -1) {
          return [...current, { ...emptyItem, product_id: String(product.id) }];
        }

        return current.map((item, index) =>
          index === emptyIndex ? { ...item, product_id: String(product.id) } : item
        );
      });
      setProductForm(emptyProduct);
      setStatusType("success");
      setStatus("Product created. You can now receive it in this purchase.");
    } catch (error) {
      setStatusType("error");
      setStatus(error instanceof Error ? error.message : "Could not create product.");
    } finally {
      setLoading(false);
    }
  };

  const recordPurchase = async () => {
    if (!supplierId || !validateRows(items)) {
      setStatusType("error");
      setStatus("Choose supplier, product, and weight for every purchase row.");
      return;
    }

    if (!Number.isFinite(parsedDiscountPercent) || parsedDiscountPercent < 0 || parsedDiscountPercent > 100) {
      setStatusType("error");
      setStatus("Enter a discount percent between 0 and 100.");
      return;
    }

    if (!Number.isFinite(advancePaidBase) || advancePaidBase < 0 || advancePaidBase > netTotal) {
      setStatusType("error");
      setStatus("Advance paid must be between zero and the purchase total.");
      return;
    }

    setLoading(true);
    setStatus("");

    try {
      const result = await fetchJsonOrThrow<{ purchase: Purchase }>("/purchases", {
        method: "POST",
        body: JSON.stringify({
          supplier_id: Number(supplierId),
          invoice_no: invoiceNo || undefined,
          transaction_currency: purchaseCurrency,
          exchange_rate: currencyRate,
          discount_percent: Number(discountPercent || 0),
          advance_paid: Number(advancePaid || 0),
          items: items.map((item) => ({
            product_id: Number(item.product_id),
            pieces: item.pieces ? Number(item.pieces) : undefined,
            weight: Number(item.weight),
            cost_per_kg: Number(item.cost_per_kg || 0),
          })),
        }),
      });

      if (receiptFile) {
        const formData = new FormData();
        formData.append("receipt", receiptFile);
        const receiptResponse = await apiFetch(`/purchases/${result.purchase.id}/receipt`, {
          method: "POST",
          body: formData,
        });

        if (!receiptResponse.ok) {
          throw new Error(await getErrorMessage(receiptResponse));
        }
      }

      setInvoiceNo("");
      setDiscountPercent("");
      setAdvancePaid("");
      setReceiptFile(null);
      setPurchaseCurrency("KWD");
      setDisplayCurrency("KWD");
      setItems([emptyItem]);
      setStatusType("success");
      setStatus(
        receiptFile
          ? "Purchase recorded, stock updated, and receipt uploaded."
          : "Purchase recorded and stock updated."
      );
      await loadPurchases(true);
    } catch (error) {
      setStatusType("error");
      setStatus(error instanceof Error ? error.message : "Could not record purchase.");
    } finally {
      setLoading(false);
    }
  };

  const startEditPurchase = async (purchase: Purchase) => {
    setLoading(true);
    setStatus("");

    try {
      const detail = await fetchJsonOrThrow<PurchaseDetail>(`/purchases/${purchase.id}`);
      setEditingPurchaseId(purchase.id);
      setEditSupplierId(String(detail.supplier_id));
      setEditInvoiceNo(detail.invoice_no || "");
      setEditDiscountPercent(detail.discount_percent ? String(detail.discount_percent) : "");
      setEditAdvancePaid(
        detail.advance_paid
          ? String(
              detail.transaction_currency === "USD"
                ? Number(detail.advance_paid) * Number(detail.exchange_rate ?? currencyRate)
                : detail.advance_paid
            )
          : ""
      );
      setEditPurchaseCurrency(detail.transaction_currency ?? "KWD");
      setDisplayCurrency(detail.transaction_currency ?? "KWD");
      setEditExchangeRate(Number(detail.exchange_rate ?? currencyRate));
      setEditItems(
        detail.items.length
          ? detail.items.map((item) => ({
              product_id: String(item.product_id),
              pieces: item.pieces ? String(item.pieces) : "",
              weight: String(item.weight),
              cost_per_kg: String(
                detail.transaction_currency === "USD"
                  ? Number(item.cost_per_kg) * Number(detail.exchange_rate ?? currencyRate)
                  : item.cost_per_kg
              ),
            }))
          : [emptyItem]
      );
    } catch (error) {
      setStatusType("error");
      setStatus(error instanceof Error ? error.message : "Could not open purchase edit.");
    } finally {
      setLoading(false);
    }
  };

  const savePurchaseEdit = async () => {
    if (!editingPurchaseId) {
      return;
    }

    if (!editSupplierId || !validateRows(editItems)) {
      setStatusType("error");
      setStatus("Choose supplier, product, and weight for every edited row.");
      return;
    }

    if (
      !Number.isFinite(parsedEditDiscountPercent) ||
      parsedEditDiscountPercent < 0 ||
      parsedEditDiscountPercent > 100
    ) {
      setStatusType("error");
      setStatus("Enter a discount percent between 0 and 100.");
      return;
    }

    if (!Number.isFinite(editAdvancePaidBase) || editAdvancePaidBase < 0 || editAdvancePaidBase > editNetTotal) {
      setStatusType("error");
      setStatus("Advance paid must be between zero and the purchase total.");
      return;
    }

    setLoading(true);
    setStatus("");

    try {
      await fetchJsonOrThrow(`/purchases/${editingPurchaseId}`, {
        method: "PATCH",
        body: JSON.stringify({
          supplier_id: Number(editSupplierId),
          invoice_no: editInvoiceNo || undefined,
          transaction_currency: editPurchaseCurrency,
          exchange_rate: editExchangeRate,
          discount_percent: Number(editDiscountPercent || 0),
          advance_paid: Number(editAdvancePaid || 0),
          items: editItems.map((item) => ({
            product_id: Number(item.product_id),
            pieces: item.pieces ? Number(item.pieces) : undefined,
            weight: Number(item.weight),
            cost_per_kg: Number(item.cost_per_kg || 0),
          })),
        }),
      });
      setEditingPurchaseId(null);
      setEditSupplierId("");
      setEditInvoiceNo("");
      setEditDiscountPercent("");
      setEditAdvancePaid("");
      setEditPurchaseCurrency("KWD");
      setDisplayCurrency("KWD");
      setEditExchangeRate(currencyRate);
      setEditItems([emptyItem]);
      setStatusType("success");
      setStatus("Purchase updated. Stock and supplier balance were recalculated.");
      await loadPurchases(true);
    } catch (error) {
      setStatusType("error");
      setStatus(error instanceof Error ? error.message : "Could not update purchase.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="panel p-6 md:p-8">
        <p className="soft-label">Purchase Entry</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
          Receive stock from suppliers
        </h1>
        <p className="mt-2 text-base leading-7 text-slate-600">
          Purchases increase inventory and supplier balance in one workflow.
        </p>
      </section>

      {status ? (
        <div
          className={`rounded-2xl px-4 py-3 text-sm font-medium ${
            statusType === "error"
              ? "border border-red-100 bg-red-50 text-red-700"
              : "border border-emerald-100 bg-emerald-50 text-emerald-700"
          }`}
        >
          {status}
        </div>
      ) : null}

      <section className="panel p-6">
        <div className="mb-6 rounded-3xl bg-slate-50 p-5">
          <p className="soft-label">New Product</p>
          <h2 className="mt-2 text-xl font-bold text-slate-950">
            Create product before receiving stock
          </h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Selling price is optional. Set it later after purchase cost and margin are clear.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-5">
            <input
              className="field bg-white"
              placeholder="Product name"
              value={productForm.name}
              onChange={(event) =>
                setProductForm((current) => ({ ...current, name: event.target.value }))
              }
            />
            <input
              className="field bg-white"
              dir="rtl"
              placeholder="Arabic description"
              value={productForm.name_ar}
              onChange={(event) =>
                setProductForm((current) => ({ ...current, name_ar: event.target.value }))
              }
            />
            <input
              className="field bg-white"
              placeholder="SKU"
              value={productForm.sku}
              onChange={(event) =>
                setProductForm((current) => ({ ...current, sku: event.target.value }))
              }
            />
            <input
              className="field bg-white"
              placeholder="Selling price optional"
              value={productForm.price_per_kg}
              onChange={(event) =>
                setProductForm((current) => ({ ...current, price_per_kg: event.target.value }))
              }
            />
            <input
              className="field bg-white"
              placeholder="Low stock kg"
              value={productForm.low_stock_kg}
              onChange={(event) =>
                setProductForm((current) => ({ ...current, low_stock_kg: event.target.value }))
              }
            />
          </div>
          <button
            className="btn-secondary mt-4 px-5"
            onClick={() => void createProductForPurchase()}
            disabled={loading}
          >
            Add Product To Purchase List
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <select className="field" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">Select supplier</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
            ))}
          </select>
          <input className="field" placeholder="Supplier invoice no." value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <input
            className="field"
            inputMode="decimal"
            placeholder="Discount %"
            value={discountPercent}
            onChange={(e) => setDiscountPercent(e.target.value)}
          />
          <input
            className="field"
            inputMode="decimal"
            placeholder={`Advance paid (${purchaseCurrency})`}
            value={advancePaid}
            onChange={(e) => setAdvancePaid(e.target.value)}
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className="soft-label">Purchase Currency</p>
          {(["KWD", "USD"] as const).map((currency) => (
            <button
              key={currency}
              type="button"
              className={purchaseCurrency === currency ? "btn-primary px-5" : "btn-secondary px-5"}
              onClick={() => {
                setPurchaseCurrency(currency);
                setDisplayCurrency(currency);
              }}
            >
              {currency}
            </button>
          ))}
        </div>

        <div className="mt-4 rounded-3xl border border-dashed border-black/15 bg-slate-50 p-5">
          <p className="soft-label">Delivery Receipt</p>
          <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <input
              className="field bg-white"
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              onChange={(event) => setReceiptFile(event.target.files?.[0] ?? null)}
            />
            <div className="text-sm font-semibold text-slate-600">
              {receiptFile ? receiptFile.name : "PDF, JPG, PNG, WEBP up to 10 MB"}
            </div>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {items.map((item, index) => (
            <div key={index} className="grid gap-3 md:grid-cols-[1.3fr_0.7fr_1fr_1fr_auto]">
              <select className="field" value={item.product_id} onChange={(e) => updateItem(index, "product_id", e.target.value)}>
                <option value="">Select product</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>{product.name}</option>
                ))}
              </select>
              <input className="field" placeholder="Pieces" value={item.pieces} onChange={(e) => updateItem(index, "pieces", e.target.value)} />
              <input className="field" placeholder="Weight kg" value={item.weight} onChange={(e) => updateItem(index, "weight", e.target.value)} />
              <input className="field" placeholder={`Cost per kg (${purchaseCurrency})`} value={item.cost_per_kg} onChange={(e) => updateItem(index, "cost_per_kg", e.target.value)} />
              <button className="h-[58px] w-[58px] rounded-2xl bg-red-600 font-semibold text-white" onClick={() => setItems((current) => current.length === 1 ? [emptyItem] : current.filter((_, itemIndex) => itemIndex !== index))}>X</button>
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <button className="btn-secondary" onClick={() => setItems((current) => [...current, emptyItem])} disabled={loading}>Add Row</button>
          <div className="text-right">
            {discountAmount > 0 || advancePaidBase > 0 ? (
              <p className="mb-2 text-sm font-bold text-slate-500">
                Subtotal <Money value={total} /> | Discount <Money value={discountAmount} /> | Advance{" "}
                <Money value={advancePaidBase} />
              </p>
            ) : null}
            <p className="soft-label">Supplier Credit Balance</p>
            <p className="text-3xl font-black text-green-600"><Money value={balanceDue} /></p>
            <p className="mt-1 text-sm font-bold text-slate-500">
              Net purchase <Money value={netTotal} />
            </p>
            <p className="mt-1 text-sm font-bold text-slate-500">
              Entering prices in {purchaseCurrency}
            </p>
          </div>
        </div>

        <button className="btn-primary mt-5 w-full" onClick={recordPurchase} disabled={loading}>
          {loading ? "Processing..." : "Record Purchase"}
        </button>
      </section>

      <section className="panel p-6">
        <h2 className="mb-4 text-xl font-bold text-slate-950">Recent Purchases</h2>
        <div className="space-y-3">
          {purchases.map((purchase) => (
            <div key={purchase.id} className="rounded-3xl bg-slate-50 p-4">
              {editingPurchaseId === purchase.id ? (
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <select className="field bg-white" value={editSupplierId} onChange={(e) => setEditSupplierId(e.target.value)}>
                      <option value="">Select supplier</option>
                      {suppliers.map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                      ))}
                    </select>
                    <input className="field bg-white" placeholder="Supplier invoice no." value={editInvoiceNo} onChange={(e) => setEditInvoiceNo(e.target.value)} />
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <input
                      className="field bg-white"
                      inputMode="decimal"
                      placeholder="Discount %"
                      value={editDiscountPercent}
                      onChange={(e) => setEditDiscountPercent(e.target.value)}
                    />
                    <input
                      className="field bg-white"
                      inputMode="decimal"
                      placeholder={`Advance paid (${editPurchaseCurrency})`}
                      value={editAdvancePaid}
                      onChange={(e) => setEditAdvancePaid(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="soft-label">Purchase Currency</p>
                    {(["KWD", "USD"] as const).map((currency) => (
                      <button
                        key={currency}
                        type="button"
                        className={editPurchaseCurrency === currency ? "btn-primary px-5" : "btn-secondary px-5"}
                        onClick={() => {
                          setEditPurchaseCurrency(currency);
                          setEditExchangeRate(currencyRate);
                          setDisplayCurrency(currency);
                        }}
                      >
                        {currency}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-3">
                    {editItems.map((item, index) => (
                      <div key={index} className="grid gap-3 md:grid-cols-[1.3fr_0.7fr_1fr_1fr_auto]">
                        <select className="field bg-white" value={item.product_id} onChange={(e) => updateItem(index, "product_id", e.target.value, "edit")}>
                          <option value="">Select product</option>
                          {products.map((product) => (
                            <option key={product.id} value={product.id}>{product.name}</option>
                          ))}
                        </select>
                        <input className="field bg-white" placeholder="Pieces" value={item.pieces} onChange={(e) => updateItem(index, "pieces", e.target.value, "edit")} />
                        <input className="field bg-white" placeholder="Weight kg" value={item.weight} onChange={(e) => updateItem(index, "weight", e.target.value, "edit")} />
                        <input className="field bg-white" placeholder={`Cost per kg (${editPurchaseCurrency})`} value={item.cost_per_kg} onChange={(e) => updateItem(index, "cost_per_kg", e.target.value, "edit")} />
                        <button className="h-[58px] w-[58px] rounded-2xl bg-red-600 font-semibold text-white" onClick={() => setEditItems((current) => current.length === 1 ? [emptyItem] : current.filter((_, itemIndex) => itemIndex !== index))}>X</button>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <button className="btn-secondary" onClick={() => setEditItems((current) => [...current, emptyItem])} disabled={loading}>Add Row</button>
                    <div className="text-right">
                      <p className="soft-label">Edited Supplier Credit Balance</p>
                      <p className="text-2xl font-black text-green-600"><Money value={editBalanceDue} /></p>
                      <p className="mt-1 text-sm font-bold text-slate-500">
                        Net purchase <Money value={editNetTotal} /> | Advance <Money value={editAdvancePaidBase} />
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button className="btn-primary px-5" onClick={() => void savePurchaseEdit()} disabled={loading}>
                      Save Purchase
                    </button>
                    <button className="btn-secondary px-5" onClick={() => setEditingPurchaseId(null)} disabled={loading}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid gap-3 text-sm md:grid-cols-[1fr_1fr_0.8fr_1fr_1fr_auto_auto] md:items-center">
                  <div className="font-bold text-slate-950">Purchase #{purchase.id}</div>
                  <div>{supplierNameById.get(purchase.supplier_id) ?? `Supplier #${purchase.supplier_id}`}</div>
                  <div>
                    <Money value={purchase.total} />
                    <p className="mt-1 text-xs font-black uppercase tracking-[0.12em] text-slate-400">
                      Entered {purchase.transaction_currency ?? "KWD"}
                    </p>
                    <p className="mt-1 text-xs font-bold text-slate-500">
                      Advance <Money value={purchase.advance_paid ?? 0} /> | Credit{" "}
                      <Money value={purchase.balance_due ?? purchase.total} />
                    </p>
                  </div>
                  <div className="text-slate-500">{new Date(purchase.date).toLocaleString()}</div>
                  <div>
                    {purchase.receipt_file_name ? (
                      <button
                        className="rounded-2xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700"
                        onClick={() =>
                          void downloadAuthenticatedFile(
                            `/purchases/${purchase.id}/receipt`,
                            purchase.receipt_original_name || `purchase-${purchase.id}-receipt`
                          ).catch((error: Error) => {
                            setStatusType("error");
                            setStatus(error.message || "Could not download receipt.");
                          })
                        }
                      >
                        Receipt
                      </button>
                    ) : (
                      <span className="rounded-2xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                        No receipt
                      </span>
                    )}
                  </div>
                  <button
                    className="btn-secondary px-3 py-2 text-xs"
                    onClick={() => void startEditPurchase(purchase)}
                    disabled={loading}
                  >
                    Edit
                  </button>
                  <button
                    className="btn-secondary px-3 py-2 text-xs"
                    onClick={() =>
                      void downloadAuthenticatedFile(
                        `/purchases/${purchase.id}/pdf`,
                        `purchase-${purchase.id}.pdf`
                      ).catch((error: Error) => {
                        setStatusType("error");
                        setStatus(error.message || "Could not download purchase PDF.");
                      })
                    }
                  >
                    PDF
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
