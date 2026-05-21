"use client";

import { KeyboardEvent, useEffect, useRef, useState } from "react";
import {
  downloadAuthenticatedFile,
  fetchJson,
  fetchJsonOrThrow,
} from "../../lib/auth";
import { formatDualCurrency, Money } from "../../lib/currency";
import { useLanguage } from "../../lib/use-language";
const DEFAULT_PRICE = "3.150";

type Customer = {
  id: number;
  name: string;
  mobile?: string;
  credit_limit?: number;
};

type Product = {
  id: number;
  name: string;
  price_per_kg: number;
  stock_kg: number;
};

type InvoiceItem = {
  productId: string;
  weight: string;
  price: string;
  amount: number;
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
};

const defaultInvoiceProfile: InvoiceProfile = {
  name: "Default",
  invoice_title: "Credit Invoice",
  invoice_title_ar: "",
  company_name: "Meatena Butchery Operations",
  company_name_ar: "",
  company_activity: "",
  company_activity_ar: "",
  company_address: "Kuwait",
  company_phone: "",
  is_default: true,
};

function profileToForm(profile: InvoiceProfile): InvoiceProfileForm {
  return {
    id: profile.id,
    name: profile.name ?? "",
    invoiceTitle: profile.invoice_title ?? "",
    invoiceTitleAr: profile.invoice_title_ar ?? "",
    companyName: profile.company_name ?? "",
    companyNameAr: profile.company_name_ar ?? "",
    companyActivity: profile.company_activity ?? "",
    companyActivityAr: profile.company_activity_ar ?? "",
    companyAddress: profile.company_address ?? "",
    companyPhone: profile.company_phone ?? "",
  };
}

export default function Invoice() {
  const { t } = useLanguage();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [balance, setBalance] = useState(0);
  const [invoiceId, setInvoiceId] = useState<number | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [draftInvoiceNumber, setDraftInvoiceNumber] = useState("");
  const [invoiceProfiles, setInvoiceProfiles] = useState<InvoiceProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null);
  const [profileForm, setProfileForm] = useState<InvoiceProfileForm>(
    profileToForm(defaultInvoiceProfile)
  );
  const [profileMode, setProfileMode] = useState<"list" | "edit">("list");
  const [status, setStatus] = useState("");
  const [statusType, setStatusType] = useState<"success" | "error">("success");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<InvoiceItem[]>([
    { productId: "", weight: "", price: DEFAULT_PRICE, amount: 0 },
  ]);
  const firstInputRef = useRef<HTMLInputElement>(null);
  const weightRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    fetchJson<Customer[]>("/customers")
      .then(setCustomers)
      .catch((error: Error) => {
        setStatusType("error");
        setStatus(error.message || "Could not load customers.");
      });

    fetchJson<Product[]>("/inventory/stock")
      .then(setProducts)
      .catch((error: Error) => {
        setStatusType("error");
        setStatus(error.message || "Could not load inventory.");
      });

    loadInvoiceProfiles();
  }, []);

  const selectedProfile =
    invoiceProfiles.find((profile) => profile.id === selectedProfileId) ??
    invoiceProfiles.find((profile) => profile.is_default) ??
    invoiceProfiles[0] ??
    defaultInvoiceProfile;

  useEffect(() => {
    if (!customerId) {
      return;
    }

    fetchJson<{ balance?: number }>(`/ledger/balance/${customerId}`)
      .then((data) => setBalance(Number(data.balance ?? 0)))
      .catch((error: Error) => {
        setStatusType("error");
        setStatus(error.message || "Could not load customer balance.");
      });
  }, [customerId]);

  useEffect(() => {
    firstInputRef.current?.focus();
  }, []);

  useEffect(() => {
    const emptyIndex = items.findIndex((item) => !item.weight);
    const indexToFocus = emptyIndex === -1 ? items.length - 1 : emptyIndex;
    weightRefs.current[indexToFocus]?.focus();
  }, [items]);

  const selectedCustomer = customers.find((customer) => String(customer.id) === customerId);
  const total = items.reduce((sum, item) => sum + item.amount, 0);
  const creditLimit = Number(selectedCustomer?.credit_limit ?? 0);
  const projectedBalance = balance + total;
  const remainingCredit =
    creditLimit > 0 ? Math.max(creditLimit - projectedBalance, 0) : null;
  const isCreditLimitExceeded = creditLimit > 0 && projectedBalance > creditLimit;

  const updateItem = (
    index: number,
    field: "productId" | "weight" | "price",
    value: string
  ) => {
    const nextItems = [...items];
    nextItems[index][field] = value;

    if (field === "productId") {
      const product = products.find((item) => String(item.id) === value);
      if (product) {
        nextItems[index].price = Number(product.price_per_kg).toFixed(3);
      }
    }

    nextItems[index].amount =
      Number(nextItems[index].weight || 0) * Number(nextItems[index].price || 0);
    setItems(nextItems);
  };

  const addRow = () => {
    setItems((current) => [
      ...current,
      { productId: "", weight: "", price: DEFAULT_PRICE, amount: 0 },
    ]);
  };

  const removeRow = (index: number) => {
    setItems((current) =>
      current.length === 1
        ? [{ productId: "", weight: "", price: DEFAULT_PRICE, amount: 0 }]
        : current.filter((_, itemIndex) => itemIndex !== index)
    );
  };

  const onWeightKeyDown = (event: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    document.getElementById(`price-${index}`)?.focus();
  };

  const onPriceKeyDown = (event: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();

    if (index === items.length - 1) {
      addRow();
      return;
    }

    weightRefs.current[index + 1]?.focus();
  };

  async function loadInvoiceProfiles() {
    try {
      const profiles = await fetchJson<InvoiceProfile[]>("/invoice-profiles");
      const nextProfiles = profiles.length ? profiles : [defaultInvoiceProfile];
      const nextSelected =
        nextProfiles.find((profile) => profile.is_default) ?? nextProfiles[0];

      setInvoiceProfiles(nextProfiles);
      setSelectedProfileId(nextSelected.id ?? null);
      setProfileForm(profileToForm(nextSelected));
      setProfileMode("list");
    } catch (error) {
      setStatusType("error");
      setStatus(error instanceof Error ? error.message : "Could not load invoice profiles.");
    }
  }

  function startNewProfile() {
    setProfileForm(profileToForm({ ...defaultInvoiceProfile, id: undefined, name: "" }));
    setProfileMode("edit");
  }

  function editSelectedProfile() {
    setProfileForm(profileToForm(selectedProfile));
    setProfileMode("edit");
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
      is_default: true,
    };

    if (
      !payload.name ||
      !payload.invoice_title ||
      !payload.company_name ||
      !payload.company_address ||
      !payload.company_phone
    ) {
      setStatusType("error");
      setStatus(t("Enter profile name, invoice title, company name, address, and phone."));
      return;
    }

    try {
      const saved = await fetchJsonOrThrow<InvoiceProfile>(
        profileForm.id ? `/invoice-profiles/${profileForm.id}` : "/invoice-profiles",
        {
          method: profileForm.id ? "PATCH" : "POST",
          body: JSON.stringify(payload),
        }
      );

      setStatusType("success");
      setStatus(`${t("Invoice profile")} ${saved.name} ${t("saved.")}`);
      await loadInvoiceProfiles();
      setSelectedProfileId(saved.id ?? null);
    } catch (error) {
      setStatusType("error");
      setStatus(error instanceof Error ? error.message : "Could not save invoice profile.");
    }
  }

  async function deleteSelectedProfile() {
    if (!selectedProfile.id) {
      return;
    }

    if (!window.confirm(`${t("Delete invoice profile")} "${selectedProfile.name}"?`)) {
      return;
    }

    try {
      await fetchJsonOrThrow(`/invoice-profiles/${selectedProfile.id}`, {
        method: "DELETE",
      });
      setStatusType("success");
      setStatus(t("Invoice profile deleted."));
      await loadInvoiceProfiles();
    } catch (error) {
      setStatusType("error");
      setStatus(error instanceof Error ? error.message : "Could not delete invoice profile.");
    }
  }

  const resetForm = () => {
    setItems([{ productId: "", weight: "", price: DEFAULT_PRICE, amount: 0 }]);
    setInvoiceId(null);
    setInvoiceNumber("");
    setDraftInvoiceNumber("");
    setStatus("");
    setStatusType("success");
  };

  const createInvoice = async () => {
    const requiredInvoiceFields = [
      { label: "invoice number", value: draftInvoiceNumber },
      { label: "invoice profile", value: selectedProfile.name },
      { label: "invoice title", value: selectedProfile.invoice_title },
      { label: "company name", value: selectedProfile.company_name },
      { label: "company address", value: selectedProfile.company_address },
      { label: "company phone", value: selectedProfile.company_phone },
    ];
    const missingField = requiredInvoiceFields.find((field) => !field.value.trim());

    if (missingField) {
      setStatusType("error");
      setStatus(`${t("Enter")} ${t(missingField.label)} ${t("before creating the invoice.")}`);
      return;
    }

    if (!customerId) {
      setStatusType("error");
      setStatus(t("Select a customer before creating the invoice."));
      return;
    }

    const hasInvalidItem = items.some((item) => !Number(item.weight) || !Number(item.price));

    if (hasInvalidItem) {
      setStatusType("error");
      setStatus(t("Enter a valid weight and price for each row."));
      return;
    }

    if (isCreditLimitExceeded) {
      setStatusType("error");
      setStatus(
        `${t("Credit limit exceeded. Projected balance")} ${formatDualCurrency(projectedBalance)} ${t("is above limit")} ${formatDualCurrency(creditLimit)}.`
      );
      return;
    }

    setLoading(true);
    setStatus("");

    try {
      const data = await fetchJsonOrThrow<{
        invoice: { id: number; invoice_number?: string };
      }>("/invoices", {
        method: "POST",
        body: JSON.stringify({
          customer_id: Number(customerId),
          type: "credit",
          invoice_number: draftInvoiceNumber.trim(),
          invoice_title: selectedProfile.invoice_title.trim(),
          invoice_title_ar: selectedProfile.invoice_title_ar?.trim() || undefined,
          company_name: selectedProfile.company_name.trim(),
          company_name_ar: selectedProfile.company_name_ar?.trim() || undefined,
          company_activity: selectedProfile.company_activity?.trim() || undefined,
          company_activity_ar: selectedProfile.company_activity_ar?.trim() || undefined,
          company_address: selectedProfile.company_address.trim(),
          company_phone: selectedProfile.company_phone.trim(),
          items: items.map((item) => ({
            product_id: item.productId ? Number(item.productId) : undefined,
            weight: Number(item.weight),
            price_per_kg: Number(item.price),
          })),
        }),
      });

      setInvoiceId(data.invoice.id);
      setInvoiceNumber(data.invoice.invoice_number ?? draftInvoiceNumber.trim());
      setStatusType("success");
      setStatus(
        `${t("Invoice")} ${data.invoice.invoice_number ?? draftInvoiceNumber.trim()} ${t("created successfully.")}`
      );
      setItems([{ productId: "", weight: "", price: DEFAULT_PRICE, amount: 0 }]);
      setDraftInvoiceNumber("");
      fetchJson<Product[]>("/inventory/stock").then(setProducts).catch(() => undefined);
      setTimeout(() => {
        firstInputRef.current?.focus();
      }, 100);

      const payload = await fetchJsonOrThrow<{ balance?: number }>(
        `/ledger/balance/${customerId}`
      );
      setBalance(Number(payload.balance ?? 0));
      alert(t("Invoice created successfully"));
    } catch (error) {
      setStatusType("error");
      setStatus(error instanceof Error ? error.message : "Invoice creation failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="panel p-6 md:p-8">
        <p className="soft-label">{t("POS Billing")}</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
          {t("Fast counter invoice screen")}
        </h1>
        <p className="mt-2 text-base leading-7 text-slate-600">
          {t("Keep customer balance and item entry visible together for faster billing during rush hours.")}
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <section className="panel p-5 md:p-6">
          <h2 className="mb-3 text-xl font-bold text-slate-950">{t("Invoice Details")}</h2>
          <div className="space-y-3">
            <input
              className="field"
              placeholder={t("Invoice number")}
              value={draftInvoiceNumber}
              onChange={(event) => setDraftInvoiceNumber(event.target.value)}
            />
            <select
              className="field"
              value={selectedProfile.id ?? ""}
              onChange={(event) => {
                const nextId = Number(event.target.value);
                const nextProfile = invoiceProfiles.find((profile) => profile.id === nextId);
                setSelectedProfileId(Number.isFinite(nextId) ? nextId : null);
                if (nextProfile) {
                  setProfileForm(profileToForm(nextProfile));
                }
              }}
            >
              {invoiceProfiles.map((profile) => (
                <option key={profile.id ?? profile.name} value={profile.id ?? ""}>
                  {profile.name} {profile.is_default ? `(${t("Default")})` : ""}
                </option>
              ))}
            </select>
            <div className="rounded-3xl bg-slate-100 p-5">
              <p className="soft-label">{t("Selected invoice profile")}</p>
              <div className="mt-2 text-lg font-bold text-slate-950">
                {selectedProfile.company_name}
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-600">
                {selectedProfile.invoice_title}
                {selectedProfile.invoice_title_ar ? ` | ${selectedProfile.invoice_title_ar}` : ""}
              </div>
              <div className="mt-1 text-sm text-slate-600">
                {selectedProfile.company_address} | {selectedProfile.company_phone}
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <button type="button" className="btn-secondary" onClick={startNewProfile}>
                {t("Add Profile")}
              </button>
              <button type="button" className="btn-secondary" onClick={editSelectedProfile}>
                {t("Edit Profile")}
              </button>
              <button type="button" className="btn-secondary" onClick={deleteSelectedProfile}>
                {t("Delete Profile")}
              </button>
            </div>
            {profileMode === "edit" ? (
              <div className="space-y-3 rounded-3xl border border-black/10 bg-white p-4">
                <p className="soft-label">{t("Profile setup")}</p>
                {[
                  ["name", "Profile name"],
                  ["invoiceTitle", "Invoice title"],
                  ["invoiceTitleAr", "Invoice title Arabic"],
                  ["companyName", "Company name"],
                  ["companyNameAr", "Company name Arabic"],
                  ["companyActivity", "Company activity"],
                  ["companyActivityAr", "Company activity Arabic"],
                  ["companyAddress", "Company address"],
                  ["companyPhone", "Company phone"],
                ].map(([key, placeholder]) => (
                  <input
                    key={key}
                    className="field"
                    placeholder={t(placeholder)}
                    value={String(profileForm[key as keyof InvoiceProfileForm] ?? "")}
                    onChange={(event) =>
                      setProfileForm((current) => ({
                        ...current,
                        [key]: event.target.value,
                      }))
                    }
                  />
                ))}
                <div className="grid gap-2 sm:grid-cols-2">
                  <button type="button" className="btn-primary" onClick={saveInvoiceProfile}>
                    {t("Save Profile")}
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => setProfileMode("list")}>
                    {t("Cancel")}
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="my-5 h-px bg-black/10" />

          <h2 className="mb-3 text-xl font-bold text-slate-950">{t("Customer")}</h2>

          <select
            className="field mb-3"
            onChange={(e) => setCustomerId(e.target.value)}
            value={customerId}
          >
            <option value="">{t("Select Customer")}</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name} {customer.mobile ? `(${customer.mobile})` : ""}
              </option>
            ))}
          </select>

          <div className="rounded-3xl bg-[linear-gradient(135deg,#fff1f2_0%,#ffe4e6_100%)] p-5">
            <p className="soft-label">{t("Balance")}</p>
            <div className="mt-2 text-3xl font-black tracking-tight text-red-700">
              <Money value={customerId ? balance : 0} />
            </div>
          </div>

          <div
            className={`mt-4 rounded-3xl p-5 ${
              isCreditLimitExceeded ? "bg-red-50" : "bg-emerald-50"
            }`}
          >
            <p className="soft-label">{t("Credit")}</p>
            <div
              className={`mt-2 text-2xl font-black tracking-tight ${
                isCreditLimitExceeded ? "text-red-700" : "text-emerald-700"
              }`}
            >
              {creditLimit > 0 ? <Money value={creditLimit} /> : t("Unlimited")}
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-600">
              {creditLimit > 0
                ? `${t("After this bill")}: ${formatDualCurrency(projectedBalance)} | ${t("Remaining")}: ${formatDualCurrency(remainingCredit)}`
                : `${t("After this bill")}: ${formatDualCurrency(projectedBalance)}`}
            </p>
          </div>

          <div className="mt-4 rounded-3xl bg-slate-100 p-5">
            <p className="soft-label">{t("Selected Customer")}</p>
            <div className="mt-2 text-lg font-bold text-slate-950">
              {selectedCustomer?.name ?? t("No customer selected")}
            </div>
            <div className="mt-1 text-sm text-slate-600">
              {selectedCustomer?.mobile ?? t("Mobile not available")}
            </div>
          </div>

          {status ? (
            <div
              className={`mt-4 rounded-2xl px-4 py-3 text-sm font-medium ${
                statusType === "error"
                  ? "border border-red-100 bg-red-50 text-red-700"
                  : "border border-emerald-100 bg-emerald-50 text-emerald-700"
              }`}
            >
              {status}
            </div>
          ) : null}

          {invoiceId ? (
            <button
              type="button"
              className="btn-secondary mt-4 block text-center"
              onClick={() =>
                void downloadAuthenticatedFile(
                  `/invoices/${invoiceId}/pdf`,
                  `${invoiceNumber || `invoice-${invoiceId}`}.pdf`
                ).catch((error: Error) => {
                  setStatusType("error");
                  setStatus(error.message || "Could not download invoice PDF.");
                  alert(error.message || "Something went wrong");
                })
              }
            >
              {t("Download PDF")} {invoiceNumber || `#${invoiceId}`}
            </button>
          ) : null}
        </section>

        <section className="panel xl:col-span-2 p-5 md:p-6">
          <h2 className="mb-3 text-xl font-bold text-slate-950">{t("Billing")}</h2>

          <div className="mb-2 grid grid-cols-[1.4fr_1fr_1fr_1fr_auto] gap-2 text-sm font-bold uppercase tracking-[0.14em] text-slate-600">
            <div>{t("Product")}</div>
            <div>{t("Weight")}</div>
            <div>{t("Price")}</div>
            <div>{t("Amount")}</div>
            <div />
          </div>

          <div className="space-y-2">
            {items.map((item, index) => (
              <div key={index} className="grid grid-cols-[1.4fr_1fr_1fr_1fr_auto] gap-2">
                <select
                  className="field"
                  value={item.productId}
                  onChange={(e) => updateItem(index, "productId", e.target.value)}
                >
                  <option value="">{t("Counter item")}</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} ({Number(product.stock_kg).toFixed(3)} kg)
                    </option>
                  ))}
                </select>

                <input
                  ref={(element) => {
                    if (index === 0) {
                      firstInputRef.current = element;
                    }
                    weightRefs.current[index] = element;
                  }}
                  className="field"
                  placeholder="kg"
                  value={item.weight}
                  onChange={(e) => updateItem(index, "weight", e.target.value)}
                  onKeyDown={(e) => onWeightKeyDown(e, index)}
                />

                <input
                  id={`price-${index}`}
                  className="field"
                  value={item.price}
                  onChange={(e) => updateItem(index, "price", e.target.value)}
                  onKeyDown={(e) => onPriceKeyDown(e, index)}
                />

                <div className="rounded-2xl bg-slate-100 px-4 py-4 text-lg font-bold text-slate-950">
                  <Money value={item.amount} />
                </div>

                <button
                  className="h-[58px] w-[58px] rounded-2xl bg-red-600 font-semibold text-white"
                  onClick={() => removeRow(index)}
                >
                  X
                </button>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button className="btn-primary" onClick={addRow} disabled={loading}>
              {t("+ Add Item")}
            </button>

            <div className="text-right">
              <div className="soft-label">{t("Total")}</div>
              <div className="text-3xl font-bold text-green-600">
                <Money value={total} />
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button className="btn-secondary" onClick={resetForm} disabled={loading}>
              {t("Reset")}
            </button>
            <button
              className="rounded-2xl bg-black py-4 text-lg font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
              onClick={createInvoice}
              disabled={loading || isCreditLimitExceeded}
            >
              {loading ? t("Processing...") : t("Create Invoice")}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
