"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchJson, fetchJsonOrThrow, getAuthUser } from "../../lib/auth";
import { Money } from "../../lib/currency";

type StockItem = {
  id: number;
  name: string;
  name_ar?: string | null;
  sku?: string;
  price_per_kg: number;
  stock_kg: number;
  stock_pieces?: number;
  low_stock_kg: number;
  low_stock: boolean;
};

type Movement = {
  id: number;
  product_id: number;
  type: string;
  quantity_kg: number;
  balance_after_kg: number;
  date: string;
  note?: string;
  reference_type?: string | null;
  reference_id?: number | null;
};

type InventorySummary = {
  totals: {
    productCount: number;
    totalStockKg: number;
    totalStockPieces?: number;
    estimatedRetailValue: number;
    lowStockCount: number;
    outOfStockCount: number;
  };
  lowStockItems: StockItem[];
};

type ReorderSuggestion = {
  product_id: number;
  name: string;
  sku?: string | null;
  stock_kg: number;
  low_stock_kg: number;
  target_stock_kg: number;
  suggested_purchase_kg: number;
  estimated_retail_value: number;
  priority: "out_of_stock" | "low_stock";
};

type ReorderSuggestionResponse = {
  totals: {
    suggestionCount: number;
    suggestedPurchaseKg: number;
    estimatedRetailValue: number;
  };
  suggestions: ReorderSuggestion[];
};

const emptyProduct = { name: "", name_ar: "", sku: "", price_per_kg: "", low_stock_kg: "" };
const emptyAdjustment = { product_id: "", type: "wastage", quantity_kg: "", note: "" };
const emptyEditProduct = { id: 0, name: "", name_ar: "", sku: "", price_per_kg: "", low_stock_kg: "" };
const emptyEditMovement = {
  id: 0,
  product_id: "",
  type: "adjustment",
  quantity_kg: "",
  date: "",
  note: "",
};

function EditIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      <path
        d="M5 19h4l10-10a2.8 2.8 0 0 0-4-4L5 15v4Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path
        d="M13.5 6.5 17.5 10.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      <path
        d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function toDateTimeLocal(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function toIsoDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function canEditMovement(movement: Movement) {
  return !movement.reference_type || movement.reference_type === "stock_movement_reversal";
}

function movementSourceLabel(movement: Movement) {
  if (!movement.reference_type) {
    return "Manual";
  }

  if (movement.reference_type === "invoice") {
    return `Invoice #${movement.reference_id ?? ""}`.trim();
  }

  if (movement.reference_type === "purchase") {
    return `Purchase #${movement.reference_id ?? ""}`.trim();
  }

  if (movement.reference_type === "invoice_void") {
    return `Invoice void #${movement.reference_id ?? ""}`.trim();
  }

  if (movement.reference_type === "purchase_edit") {
    return `Purchase edit #${movement.reference_id ?? ""}`.trim();
  }

  return movement.reference_type.replace(/_/g, " ");
}

export default function InventoryPage() {
  const isAdmin = getAuthUser()?.role === "admin";
  const [stock, setStock] = useState<StockItem[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [reorder, setReorder] = useState<ReorderSuggestionResponse | null>(null);
  const [product, setProduct] = useState(emptyProduct);
  const [editingProduct, setEditingProduct] = useState(emptyEditProduct);
  const [editingMovement, setEditingMovement] = useState(emptyEditMovement);
  const [adjustment, setAdjustment] = useState(emptyAdjustment);
  const [status, setStatus] = useState("");
  const [statusType, setStatusType] = useState<"success" | "error">("success");
  const [loading, setLoading] = useState(false);

  const productNameById = useMemo(
    () => new Map(stock.map((item) => [item.id, item.name])),
    [stock]
  );
  const loadInventory = async (preserveStatus = false) => {
    if (!preserveStatus) {
      setStatus("");
    }

    try {
      const [stockData, movementData] = await Promise.all([
        fetchJson<StockItem[]>("/inventory/stock"),
        fetchJson<Movement[]>("/inventory/movements"),
      ]);
      setStock(Array.isArray(stockData) ? stockData : []);
      setMovements(Array.isArray(movementData) ? movementData : []);
      Promise.all([
        fetchJson<InventorySummary>("/inventory/summary"),
        fetchJson<ReorderSuggestionResponse>("/inventory/reorder-suggestions"),
      ])
        .then(([summaryData, reorderData]) => {
          setSummary(summaryData);
          setReorder(reorderData);
        })
        .catch(() => undefined);
    } catch (error) {
      setStatusType("error");
      setStatus(error instanceof Error ? error.message : "Could not load inventory.");
    }
  };

  useEffect(() => {
    Promise.all([
      fetchJson<StockItem[]>("/inventory/stock"),
      fetchJson<Movement[]>("/inventory/movements"),
      fetchJson<InventorySummary>("/inventory/summary"),
      fetchJson<ReorderSuggestionResponse>("/inventory/reorder-suggestions"),
    ])
      .then(([stockData, movementData, summaryData, reorderData]) => {
        setStock(Array.isArray(stockData) ? stockData : []);
        setMovements(Array.isArray(movementData) ? movementData : []);
        setSummary(summaryData);
        setReorder(reorderData);
      })
      .catch((error: Error) => {
        setStatusType("error");
        setStatus(error.message || "Could not load inventory.");
      });
  }, []);

  const createProduct = async () => {
    if (!product.name.trim()) {
      setStatusType("error");
      setStatus("Product name is required.");
      return;
    }

    setLoading(true);
    setStatus("");

    try {
      await fetchJsonOrThrow("/products", {
        method: "POST",
        body: JSON.stringify({
          name: product.name,
          name_ar: product.name_ar.trim() || undefined,
          sku: product.sku || undefined,
          price_per_kg: product.price_per_kg ? Number(product.price_per_kg) : undefined,
          low_stock_kg: product.low_stock_kg ? Number(product.low_stock_kg) : undefined,
        }),
      });
      setProduct(emptyProduct);
      setStatusType("success");
      setStatus("Product added to inventory.");
      await loadInventory(true);
    } catch (error) {
      setStatusType("error");
      setStatus(error instanceof Error ? error.message : "Could not create product.");
    } finally {
      setLoading(false);
    }
  };

  const createAdjustment = async () => {
    if (!adjustment.product_id || !Number(adjustment.quantity_kg)) {
      setStatusType("error");
      setStatus("Choose a product and enter a quantity.");
      return;
    }

    setLoading(true);
    setStatus("");

    try {
      await fetchJsonOrThrow("/inventory/adjustments", {
        method: "POST",
        body: JSON.stringify({
          product_id: Number(adjustment.product_id),
          type: adjustment.type,
          quantity_kg: Number(adjustment.quantity_kg),
          note: adjustment.note || undefined,
        }),
      });
      setAdjustment(emptyAdjustment);
      setStatusType("success");
      setStatus("Stock movement recorded.");
      await loadInventory(true);
    } catch (error) {
      setStatusType("error");
      setStatus(error instanceof Error ? error.message : "Could not adjust stock.");
    } finally {
      setLoading(false);
    }
  };

  const deleteProduct = async (item: StockItem) => {
    if (!isAdmin) {
      return;
    }

    if (
      !window.confirm(
        `Delete product "${item.name}"? Products with stock or transaction history cannot be deleted.`
      )
    ) {
      return;
    }

    setLoading(true);
    setStatus("");

    try {
      const response = await fetchJsonOrThrow<{ message: string }>(`/products/${item.id}`, {
        method: "DELETE",
      });
      setStatusType("success");
      setStatus(response.message);
      await loadInventory(true);
    } catch (error) {
      setStatusType("error");
      setStatus(error instanceof Error ? error.message : "Could not delete product.");
    } finally {
      setLoading(false);
    }
  };

  const startEditProduct = (item: StockItem) => {
    setEditingProduct({
      id: item.id,
      name: item.name,
      name_ar: item.name_ar || "",
      sku: item.sku || "",
      price_per_kg: Number(item.price_per_kg).toFixed(3),
      low_stock_kg: Number(item.low_stock_kg).toFixed(3),
    });
    setStatus("");
  };

  const updateProduct = async () => {
    if (!editingProduct.id) {
      return;
    }

    if (!editingProduct.name.trim()) {
      setStatusType("error");
      setStatus("Product name is required.");
      return;
    }

    setLoading(true);
    setStatus("");

    try {
      await fetchJsonOrThrow(`/products/${editingProduct.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editingProduct.name.trim(),
          name_ar: editingProduct.name_ar.trim() || undefined,
          sku: editingProduct.sku.trim() || undefined,
          price_per_kg: Number(editingProduct.price_per_kg),
          low_stock_kg: Number(editingProduct.low_stock_kg || 0),
        }),
      });
      setEditingProduct(emptyEditProduct);
      setStatusType("success");
      setStatus("Product pricing updated.");
      await loadInventory(true);
    } catch (error) {
      setStatusType("error");
      setStatus(error instanceof Error ? error.message : "Could not update product.");
    } finally {
      setLoading(false);
    }
  };

  const startEditMovement = (movement: Movement) => {
    setEditingMovement({
      id: movement.id,
      product_id: String(movement.product_id),
      type: movement.type,
      quantity_kg: Math.abs(Number(movement.quantity_kg)).toFixed(3),
      date: toDateTimeLocal(movement.date),
      note: movement.note || "",
    });
    setStatus("");
  };

  const updateMovement = async () => {
    if (!editingMovement.id) {
      return;
    }

    if (!editingMovement.product_id || !Number(editingMovement.quantity_kg)) {
      setStatusType("error");
      setStatus("Choose product and enter quantity.");
      return;
    }

    setLoading(true);
    setStatus("");

    try {
      await fetchJsonOrThrow(`/inventory/movements/${editingMovement.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          product_id: Number(editingMovement.product_id),
          type: editingMovement.type,
          quantity_kg: Number(editingMovement.quantity_kg),
          date: editingMovement.date ? toIsoDateTime(editingMovement.date) : undefined,
          note: editingMovement.note.trim() || undefined,
        }),
      });
      setEditingMovement(emptyEditMovement);
      setStatusType("success");
      setStatus("Stock movement updated and balances recalculated.");
      await loadInventory(true);
    } catch (error) {
      setStatusType("error");
      setStatus(error instanceof Error ? error.message : "Could not update stock movement.");
    } finally {
      setLoading(false);
    }
  };

  const deleteMovement = async (movement: Movement) => {
    const productName = productNameById.get(movement.product_id) ?? `Product #${movement.product_id}`;

    if (
      !window.confirm(
        `Delete this movement for ${productName}?\n\nThis will recalculate the stock balance.`
      )
    ) {
      return;
    }

    setLoading(true);
    setStatus("");

    try {
      const response = await fetchJsonOrThrow<{ message: string }>(
        `/inventory/movements/${movement.id}`,
        { method: "DELETE" }
      );
      setEditingMovement(emptyEditMovement);
      setStatusType("success");
      setStatus(response.message);
      await loadInventory(true);
    } catch (error) {
      setStatusType("error");
      setStatus(error instanceof Error ? error.message : "Could not delete stock movement.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="panel p-6 md:p-8">
        <p className="soft-label">Inventory Control</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
          Stock balances and movements
        </h1>
        <p className="mt-2 text-base leading-7 text-slate-600">
          Track inward stock, sale deductions, wastage, and low-stock thresholds.
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

      {summary ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-3xl bg-slate-950 p-5 text-white">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/60">
              Products
            </p>
            <p className="mt-3 text-3xl font-black">{summary.totals.productCount}</p>
          </div>
          <div className="rounded-3xl bg-emerald-50 p-5 text-emerald-800">
            <p className="soft-label text-emerald-700">Stock KG</p>
            <p className="mt-3 text-3xl font-black">
              {Number(summary.totals.totalStockKg).toFixed(3)}
            </p>
            <p className="mt-1 text-sm font-black text-emerald-700">
              {Number(summary.totals.totalStockPieces ?? 0)} pcs
            </p>
          </div>
          <div className="rounded-3xl bg-blue-50 p-5 text-blue-800">
            <p className="soft-label text-blue-700">Retail Value</p>
            <p className="mt-3 text-3xl font-black">
              <Money value={summary.totals.estimatedRetailValue} />
            </p>
          </div>
          <div className="rounded-3xl bg-amber-50 p-5 text-amber-800">
            <p className="soft-label text-amber-700">Low Stock</p>
            <p className="mt-3 text-3xl font-black">{summary.totals.lowStockCount}</p>
          </div>
          <div className="rounded-3xl bg-red-50 p-5 text-red-800">
            <p className="soft-label text-red-700">Out</p>
            <p className="mt-3 text-3xl font-black">{summary.totals.outOfStockCount}</p>
          </div>
        </section>
      ) : null}

      <div className={isAdmin ? "grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]" : "grid gap-6"}>
        <section className="panel p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-950">Current Stock</h2>
            <span className="status-pill bg-black/5 text-slate-700">{stock.length} items</span>
          </div>
          <div className="mb-2 hidden grid-cols-[minmax(160px,1fr)_80px_150px_150px_70px_100px] gap-3 px-5 text-xs font-black uppercase tracking-[0.16em] text-slate-400 md:grid">
            <span>Item</span>
            <span className="text-right">Pieces</span>
            <span className="text-right">Weight</span>
            <span className="text-right">Price</span>
            <span className="text-right">Alert</span>
            <span className="text-right">Actions</span>
          </div>
          <div className="space-y-3">
            {stock.map((item) => (
              <div key={item.id} className="rounded-3xl border border-black/8 bg-white px-5 py-4">
                {editingProduct.id === item.id ? (
                  <div className="space-y-5">
                    <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="soft-label">Edit product details</p>
                        <h3 className="mt-1 text-xl font-black text-slate-950">{item.name}</h3>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                        <div className="rounded-2xl bg-slate-50 px-4 py-3">
                          <p className="soft-label">Pieces</p>
                          <p className="mt-1 font-black text-slate-950">{Number(item.stock_pieces ?? 0)}</p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 px-4 py-3">
                          <p className="soft-label">Weight</p>
                          <p className="mt-1 whitespace-nowrap font-black text-slate-950">
                            {Number(item.stock_kg).toFixed(3)} kg
                          </p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 px-4 py-3">
                          <p className="soft-label">Alert</p>
                          <p className={item.low_stock ? "mt-1 font-black text-red-600" : "mt-1 font-black text-emerald-700"}>
                            {item.low_stock ? "Low" : "OK"}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 px-4 py-3">
                          <p className="soft-label">Current price</p>
                          <p className="mt-1 font-black text-slate-950">
                            <Money value={item.price_per_kg} className="items-start" />
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <label className="space-y-2">
                        <span className="soft-label">Product name</span>
                        <input
                          className="field"
                          placeholder="Product name"
                          value={editingProduct.name}
                          onChange={(event) =>
                            setEditingProduct((current) => ({ ...current, name: event.target.value }))
                          }
                        />
                      </label>
                      <label className="space-y-2">
                        <span className="soft-label">Arabic description</span>
                        <input
                          className="field"
                          dir="rtl"
                          placeholder="Arabic description"
                          value={editingProduct.name_ar}
                          onChange={(event) =>
                            setEditingProduct((current) => ({ ...current, name_ar: event.target.value }))
                          }
                        />
                      </label>
                      <label className="space-y-2">
                        <span className="soft-label">SKU</span>
                        <input
                          className="field"
                          placeholder="SKU"
                          value={editingProduct.sku}
                          onChange={(event) =>
                            setEditingProduct((current) => ({ ...current, sku: event.target.value }))
                          }
                        />
                      </label>
                      <label className="space-y-2">
                        <span className="soft-label">Selling price per kg</span>
                        <input
                          className="field"
                          placeholder="Selling price"
                          value={editingProduct.price_per_kg}
                          onChange={(event) =>
                            setEditingProduct((current) => ({
                              ...current,
                              price_per_kg: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label className="space-y-2 lg:max-w-sm">
                        <span className="soft-label">Low stock alert kg</span>
                        <input
                          className="field"
                          placeholder="Low stock kg"
                          value={editingProduct.low_stock_kg}
                          onChange={(event) =>
                            setEditingProduct((current) => ({
                              ...current,
                              low_stock_kg: event.target.value,
                            }))
                          }
                        />
                      </label>
                    </div>

                    <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-4">
                      <button className="btn-primary px-5" onClick={() => void updateProduct()} disabled={loading}>
                        Save Product
                      </button>
                      <button className="btn-secondary px-5" onClick={() => setEditingProduct(emptyEditProduct)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                <div className="grid gap-3 md:grid-cols-[minmax(160px,1fr)_80px_150px_150px_70px_100px] md:items-center">
                  <div className="min-w-0">
                    <p className="break-words text-lg font-bold leading-tight text-slate-950">
                      {item.name}
                    </p>
                    <p className="mt-2 break-words text-sm font-semibold text-slate-500">
                      {item.sku || "No SKU"}
                    </p>
                    {item.name_ar ? (
                      <p className="mt-1 break-words text-sm font-semibold text-slate-500" dir="rtl">
                        {item.name_ar}
                      </p>
                    ) : null}
                  </div>
                  <div className="text-left md:text-right">
                    <p className="soft-label md:hidden">Pieces</p>
                    <p className="text-lg font-black tabular-nums text-slate-950">
                      {Number(item.stock_pieces ?? 0)}
                    </p>
                  </div>
                  <div className="text-left md:text-right">
                    <p className="soft-label md:hidden">Weight</p>
                    <p className="whitespace-nowrap text-lg font-black tabular-nums text-slate-950">
                      {Number(item.stock_kg).toFixed(3)} kg
                    </p>
                  </div>
                  <div className="text-left md:text-right">
                    <p className="soft-label md:hidden">Price</p>
                    <p className="text-base font-black text-slate-950">
                      <Money value={item.price_per_kg} className="items-start md:items-end" />
                    </p>
                  </div>
                  <div className="text-left md:text-right">
                    <p className="soft-label md:hidden">Alert</p>
                    <p className={item.low_stock ? "text-lg font-black text-red-600" : "text-lg font-black text-emerald-700"}>
                      {item.low_stock ? "Low" : "OK"}
                    </p>
                  </div>
                  {isAdmin ? (
                    <div className="flex flex-wrap gap-2 md:justify-end">
                      <button
                        aria-label={`Edit ${item.name}`}
                        className="grid h-11 w-11 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={() => startEditProduct(item)}
                        disabled={loading}
                        title="Edit"
                      >
                        <EditIcon />
                      </button>
                      <button
                        aria-label={`Delete ${item.name}`}
                        className="grid h-11 w-11 place-items-center rounded-2xl border border-red-100 bg-red-50 text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={() => void deleteProduct(item)}
                        disabled={loading}
                        title="Delete"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  ) : (
                    <div className="hidden md:block" />
                  )}
                </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {isAdmin ? (
          <section className="space-y-6">
            <div className="panel p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="soft-label">Purchase Planning</p>
                  <h2 className="mt-2 text-xl font-bold text-slate-950">Reorder suggestions</h2>
                </div>
                <span className="status-pill bg-amber-100 text-amber-800">
                  {reorder?.totals.suggestionCount ?? 0} items
                </span>
              </div>

              {reorder?.suggestions.length ? (
                <div className="mt-5 space-y-3">
                  <div className="rounded-3xl bg-amber-50 p-4">
                    <p className="soft-label text-amber-700">Suggested KG</p>
                    <p className="mt-2 text-3xl font-black text-amber-800">
                      {Number(reorder.totals.suggestedPurchaseKg).toFixed(3)}
                    </p>
                  </div>
                  {reorder.suggestions.map((item) => (
                    <div key={item.product_id} className="rounded-2xl border border-amber-100 bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-bold text-slate-950">{item.name}</p>
                          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                            {item.priority === "out_of_stock" ? "Out of stock" : "Low stock"}
                          </p>
                        </div>
                        <p className="text-right text-lg font-black text-amber-700">
                          {Number(item.suggested_purchase_kg).toFixed(3)} kg
                        </p>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-xs font-semibold text-slate-500">
                        <span>Stock {Number(item.stock_kg).toFixed(3)}</span>
                        <span>Alert {Number(item.low_stock_kg).toFixed(3)}</span>
                        <span>Target {Number(item.target_stock_kg).toFixed(3)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">
                  No reorder suggestions. Stock is above alert levels.
                </p>
              )}
            </div>

            <div className="panel p-6">
              <p className="soft-label">Product Master</p>
              <h2 className="mt-2 text-xl font-bold text-slate-950">Add product</h2>
              <div className="mt-5 space-y-3">
                <input className="field" placeholder="Product name" value={product.name} onChange={(e) => setProduct((current) => ({ ...current, name: e.target.value }))} />
                <input className="field" dir="rtl" placeholder="Arabic description" value={product.name_ar} onChange={(e) => setProduct((current) => ({ ...current, name_ar: e.target.value }))} />
                <input className="field" placeholder="SKU" value={product.sku} onChange={(e) => setProduct((current) => ({ ...current, sku: e.target.value }))} />
                <input className="field" placeholder="Selling price optional" value={product.price_per_kg} onChange={(e) => setProduct((current) => ({ ...current, price_per_kg: e.target.value }))} />
                <input className="field" placeholder="Low stock kg" value={product.low_stock_kg} onChange={(e) => setProduct((current) => ({ ...current, low_stock_kg: e.target.value }))} />
                <button className="btn-primary w-full" onClick={createProduct} disabled={loading}>Add Product</button>
              </div>
            </div>

            <div className="panel p-6">
              <p className="soft-label">Wastage / Adjustment</p>
              <h2 className="mt-2 text-xl font-bold text-slate-950">Record movement</h2>
              <div className="mt-5 space-y-3">
                <select className="field" value={adjustment.product_id} onChange={(e) => setAdjustment((current) => ({ ...current, product_id: e.target.value }))}>
                  <option value="">Select product</option>
                  {stock.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
                <select className="field" value={adjustment.type} onChange={(e) => setAdjustment((current) => ({ ...current, type: e.target.value }))}>
                  <option value="wastage">Wastage</option>
                  <option value="adjustment">Adjustment</option>
                </select>
                <input className="field" placeholder="Quantity kg" value={adjustment.quantity_kg} onChange={(e) => setAdjustment((current) => ({ ...current, quantity_kg: e.target.value }))} />
                <input className="field" placeholder="Note" value={adjustment.note} onChange={(e) => setAdjustment((current) => ({ ...current, note: e.target.value }))} />
                <button className="btn-secondary w-full" onClick={createAdjustment} disabled={loading}>Record Movement</button>
              </div>
            </div>
          </section>
        ) : null}
      </div>

      <section className="panel p-6">
        <h2 className="mb-4 text-xl font-bold text-slate-950">Recent Movements</h2>
        <div className="space-y-2">
          {movements.slice(0, 12).map((movement) => (
            <div key={movement.id} className="rounded-2xl bg-slate-50 p-4 text-sm">
              {editingMovement.id === movement.id ? (
                <div className="grid gap-3 md:grid-cols-[1.2fr_0.8fr_0.8fr_1fr_1fr_auto] md:items-center">
                  <select
                    className="field"
                    value={editingMovement.product_id}
                    onChange={(event) =>
                      setEditingMovement((current) => ({
                        ...current,
                        product_id: event.target.value,
                      }))
                    }
                  >
                    {stock.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                  <select
                    className="field"
                    value={editingMovement.type}
                    onChange={(event) =>
                      setEditingMovement((current) => ({ ...current, type: event.target.value }))
                    }
                  >
                    <option value="purchase">Purchase</option>
                    <option value="sale">Sale</option>
                    <option value="wastage">Wastage</option>
                    <option value="adjustment">Adjustment</option>
                  </select>
                  <input
                    className="field"
                    placeholder="Quantity kg"
                    value={editingMovement.quantity_kg}
                    onChange={(event) =>
                      setEditingMovement((current) => ({
                        ...current,
                        quantity_kg: event.target.value,
                      }))
                    }
                  />
                  <input
                    className="field"
                    type="datetime-local"
                    value={editingMovement.date}
                    onChange={(event) =>
                      setEditingMovement((current) => ({ ...current, date: event.target.value }))
                    }
                  />
                  <input
                    className="field"
                    placeholder="Note"
                    value={editingMovement.note}
                    onChange={(event) =>
                      setEditingMovement((current) => ({ ...current, note: event.target.value }))
                    }
                  />
                  <div className="flex gap-2">
                    <button className="btn-primary px-4" onClick={() => void updateMovement()} disabled={loading}>
                      Save
                    </button>
                    <button className="btn-secondary px-4" onClick={() => setEditingMovement(emptyEditMovement)}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-[1.4fr_0.8fr_0.9fr_1.1fr_1.1fr_auto] md:items-center">
                  <div className="font-bold text-slate-950">{productNameById.get(movement.product_id) ?? `Product #${movement.product_id}`}</div>
                  <div className="text-slate-700">
                    <span className="block capitalize">{movement.type}</span>
                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                      {movementSourceLabel(movement)}
                    </span>
                  </div>
                  <div>{Number(movement.quantity_kg).toFixed(3)} kg</div>
                  <div>{Number(movement.balance_after_kg).toFixed(3)} kg balance</div>
                  <div className="text-slate-500">{new Date(movement.date).toLocaleString()}</div>
                  {isAdmin && canEditMovement(movement) ? (
                    <div className="flex flex-wrap gap-2 md:justify-end">
                      <button
                        type="button"
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-800 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={() => startEditMovement(movement)}
                        disabled={loading}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="rounded-2xl border border-red-100 bg-red-50 px-4 py-2 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={() => void deleteMovement(movement)}
                        disabled={loading}
                      >
                        Delete
                      </button>
                    </div>
                  ) : isAdmin ? (
                    <span className="text-right text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                      Edit source
                    </span>
                  ) : (
                    <span />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
