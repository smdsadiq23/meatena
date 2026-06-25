import type { Response } from 'express';
import {
  generatePartnerLedgerPDF,
  type PartnerLedgerRow,
  type StatementCurrency,
} from '../common/pdf/partner-ledger-pdf';
import type { Supplier } from './supplier.entity';
import type { SupplierStatementRow } from './supplier.service';

type SupplierStatementTotals = {
  charges: number;
  payments: number;
  closing_balance: number;
  charges_kwd?: number;
  payments_kwd?: number;
  closing_balance_kwd?: number;
  charges_usd?: number;
  payments_usd?: number;
  closing_balance_usd?: number;
};

function normalizeCurrency(value?: string): StatementCurrency {
  return value === 'USD' ? 'USD' : 'KWD';
}

export function generateSupplierStatementPDF(
  supplier: Supplier,
  rows: SupplierStatementRow[],
  totals: SupplierStatementTotals,
  res: Response,
  kwdToUsdRate?: number,
  selectedCurrency?: string,
) {
  const currency = normalizeCurrency(selectedCurrency);
  const ledgerRows: PartnerLedgerRow[] = rows
    .filter((row) => row.transaction_currency === currency)
    .map((row) => ({
      date: row.date,
      description: row.description || (row.type === 'purchase' ? 'Purchase' : 'Payment'),
      ref: row.reference,
      weight: row.weight,
      debit: currency === 'USD' ? Number(row.charge_usd ?? 0) : Number(row.charge_kwd ?? 0),
      credit: currency === 'USD' ? Number(row.payment_usd ?? 0) : Number(row.payment_kwd ?? 0),
      balance: currency === 'USD' ? Number(row.balance_usd ?? 0) : Number(row.balance_kwd ?? 0),
    }));

  const dates = rows.map((row) => row.date).sort();
  generatePartnerLedgerPDF(
    {
      filename: `supplier-ledger-${supplier.id}.pdf`,
      title: 'Supplier Ledger',
      partnerName: supplier.name,
      partnerAccount: 'Payable Accounts',
      startDate: dates[0],
      endDate: dates.at(-1),
      rows: ledgerRows,
      currency,
      kwdToUsdRate: currency === 'USD' ? 1 : kwdToUsdRate,
      footerText: 'javedmeatsupply@gmail.com',
    },
    res,
  );
}
