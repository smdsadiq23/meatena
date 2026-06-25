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
  const ledgerRows: PartnerLedgerRow[] = rows.map((row) => ({
    date: row.date,
    description: row.description || (row.type === 'purchase' ? 'Purchase' : 'Payment'),
    ref: row.reference,
    weight: row.weight,
    debit: Number(row.charge ?? 0),
    credit: Number(row.payment ?? 0),
    balance: Number(row.balance),
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
      currency: normalizeCurrency(selectedCurrency),
      kwdToUsdRate,
      footerText: 'javedmeatsupply@gmail.com',
    },
    res,
  );
}
