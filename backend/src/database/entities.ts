import { AuditLog } from '../audit/audit-log.entity';
import { AppSetting } from '../app-setting/app-setting.entity';
import { Customer } from '../customer/customer.entity';
import { Expense } from '../expense/expense.entity';
import { Ledger } from '../ledger/ledger.entity';
import { InvoiceItem } from '../invoice/invoice-item.entity';
import { Invoice } from '../invoice/invoice.entity';
import { InvoiceProfile } from '../invoice-profile/invoice-profile.entity';
import { KnetPaymentSession } from '../payment/knet-payment-session.entity';
import { Payment } from '../payment/payment.entity';
import { Product } from '../product/product.entity';
import { PurchaseItem } from '../purchase/purchase-item.entity';
import { Purchase } from '../purchase/purchase.entity';
import { StockMovement } from '../inventory/stock-movement.entity';
import { ShiftClose } from '../shift-close/shift-close.entity';
import { Shipment } from '../shipment/shipment.entity';
import { SupplierPayment } from '../supplier-payment/supplier-payment.entity';
import { Supplier } from '../supplier/supplier.entity';
import { User } from '../user/user.entity';

export const billingEntities = [
  Customer,
  AppSetting,
  AuditLog,
  Expense,
  Invoice,
  InvoiceItem,
  InvoiceProfile,
  KnetPaymentSession,
  Ledger,
  Payment,
  Product,
  Purchase,
  PurchaseItem,
  ShiftClose,
  Shipment,
  StockMovement,
  Supplier,
  SupplierPayment,
  User,
];
