import type { Response } from 'express';
import type { Customer } from '../customer/customer.entity';
import {
  generatePartnerLedgerPDF,
  type PartnerLedgerRow,
  type StatementCurrency,
} from '../common/pdf/partner-ledger-pdf';

type StatementRow = {
  date: string;
  type: string;
  amount: number;
  balance: number;
};

function normalizeCurrency(value?: string): StatementCurrency {
  return value === 'USD' ? 'USD' : 'KWD';
}

function labelType(value: string) {
  return value
    .split(/[_-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function refForRow(row: StatementRow, index: number) {
  const type = labelType(row.type).toUpperCase().replace(/\s+/g, '');
  const year = new Date(row.date).getFullYear();
  const prefix = row.amount >= 0 ? 'INV' : 'PAY';
  return `${prefix}/${Number.isFinite(year) ? year : 'LEDGER'}/${String(index + 1).padStart(4, '0')}`;
}

export function generateStatementPDF(
  customer: Customer,
  rows: StatementRow[],
  res: Response,
  kwdToUsdRate?: number,
  selectedCurrency?: string,
) {
  const ledgerRows: PartnerLedgerRow[] = rows.map((row, index) => ({
    date: row.date,
    description: labelType(row.type),
    ref: refForRow(row, index),
    debit: row.amount >= 0 ? Number(row.amount) : 0,
    credit: row.amount < 0 ? Math.abs(Number(row.amount)) : 0,
    balance: Number(row.balance),
  }));

  const dates = rows.map((row) => row.date).sort();
  generatePartnerLedgerPDF(
    {
      filename: `statement-${customer.id}.pdf`,
      title: 'Partner Ledger',
      partnerName: customer.name,
      partnerAccount: 'Receivable Accounts',
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
