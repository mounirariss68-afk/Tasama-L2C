/**
 * The ERP connector — fictional, two dialects. Every write Mizan makes goes
 * through here and is logged in the trail with the call it would have made.
 * Tasama runs Oracle Fusion Cloud for corporate finance and is introducing
 * Odoo for the operations team, so both are offered; Settings picks one.
 */
import type { ErpSystem, Invoice, Journal } from './types';

export const ERP_LABEL: Record<ErpSystem, string> = { oracle: 'Oracle Fusion Cloud ERP', odoo: 'Odoo 19' };

export type ErpCall = { method: string; path: string; body: unknown; note: string };

export function invoiceCall(erp: ErpSystem, inv: Invoice, client: { name: string; vatNo: string | null; code: string }, po: string): ErpCall {
  if (erp === 'oracle') {
    return {
      method: 'POST', path: '/fscmRestApi/resources/11.13.18.05/receivablesInvoices',
      body: { BusinessUnit: 'TASAMA BU', TransactionSource: 'MIZAN', TransactionType: 'Invoice', BillToCustomerNumber: client.code, BillToCustomerName: client.name, TransactionDate: inv.date, DueDate: inv.dueDate, InvoiceCurrencyCode: inv.currency, PurchaseOrder: po.replace('DEMO-', ''), TaxRegistrationNumber: client.vatNo, receivablesInvoiceLines: [{ LineNumber: 1, Description: inv.description, Quantity: 1, UnitSellingPrice: inv.net, TaxClassificationCode: 'KSA VAT 15%' }] },
      note: 'Oracle AR invoice; ZATCA clearance runs on the posted transaction through the existing point-to-point integration.',
    };
  }
  return {
    method: 'POST', path: '/json/2/account.move/create',
    body: { move_type: 'out_invoice', partner_id: `${client.code} ${client.name}`, invoice_date: inv.date, invoice_date_due: inv.dueDate, currency_id: inv.currency, ref: po.replace('DEMO-', ''), l10n_sa_confirmation_datetime: null, invoice_line_ids: [[0, 0, { name: inv.description, quantity: 1, price_unit: inv.net, tax_ids: [[6, 0, ['VAT 15%']]] }]] },
    note: 'Odoo customer invoice; l10n_sa_edi handles the ZATCA submission on confirm.',
  };
}

export function creditMemoCall(erp: ErpSystem, inv: Invoice, amount: number, reason: string): ErpCall {
  return erp === 'oracle'
    ? { method: 'POST', path: '/fscmRestApi/resources/11.13.18.05/receivablesCreditMemos', body: { TransactionSource: 'MIZAN', OriginalTransactionNumber: inv.id.replace('DEMO-', ''), CreditMemoAmount: amount, Reason: reason }, note: 'Credit memo against the original transaction (ZATCA type 381).' }
    : { method: 'POST', path: '/json/2/account.move/create', body: { move_type: 'out_refund', reversed_entry_id: inv.id, amount_total: amount, ref: reason }, note: 'Odoo credit note referencing the original invoice.' };
}

export function receiptCall(erp: ErpSystem, args: { clientCode: string; amount: number; currency: string; date: string; invoiceIds: string[]; bankAccount: string }): ErpCall {
  return erp === 'oracle'
    ? { method: 'POST', path: '/fscmRestApi/resources/11.13.18.05/standardReceipts', body: { ReceiptMethod: 'Bank transfer', Amount: args.amount, CurrencyCode: args.currency, ReceiptDate: args.date, CustomerNumber: args.clientCode, RemittanceBankAccount: args.bankAccount, standardReceiptApplications: args.invoiceIds.map((id) => ({ TransactionNumber: id.replace('DEMO-', '') })) }, note: 'Standard receipt with applications to the invoices.' }
    : { method: 'POST', path: '/json/2/account.payment/create', body: { payment_type: 'inbound', partner_type: 'customer', partner_id: args.clientCode, amount: args.amount, currency_id: args.currency, date: args.date, journal_id: args.bankAccount, reconciled_invoice_ids: args.invoiceIds }, note: 'Inbound payment reconciled to the invoices.' };
}

export function journalCall(erp: ErpSystem, j: Journal): ErpCall {
  return erp === 'oracle'
    ? { method: 'POST', path: '/fscmRestApi/resources/11.13.18.05/erpintegrations', body: { OperationName: 'importBulkData', JobName: 'GL Journal Import', Document: { JournalName: j.id.replace('DEMO-', ''), Period: j.period, Source: 'MIZAN', Lines: j.lines.map((l) => ({ Account: l.account.split(' ')[0], EnteredDr: l.dr || null, EnteredCr: l.cr || null, Description: j.description })) } }, note: 'GL journal import (FBDI) through the ERP integration service.' }
    : { method: 'POST', path: '/json/2/account.move/create', body: { move_type: 'entry', ref: j.id, date: `${j.period}-30`, line_ids: j.lines.map((l) => [0, 0, { account_id: l.account.split(' ')[0], debit: l.dr, credit: l.cr, name: j.kind }]) }, note: 'Miscellaneous journal entry.' };
}

export function vendorInvoiceCall(erp: ErpSystem, v: { vendorName: string; invoiceRef: string; total: number; net: number; currency: string; vendorPOId?: string; issueDate: string }): ErpCall {
  return erp === 'oracle'
    ? { method: 'POST', path: '/fscmRestApi/resources/11.13.18.05/invoices', body: { InvoiceNumber: v.invoiceRef, Supplier: v.vendorName, InvoiceAmount: v.total, InvoiceCurrency: v.currency, InvoiceDate: v.issueDate, invoiceLines: [{ LineNumber: 1, LineAmount: v.net, PurchaseOrderNumber: v.vendorPOId }] }, note: 'Payables invoice matched to the purchase order.' }
    : { method: 'POST', path: '/json/2/account.move/create', body: { move_type: 'in_invoice', partner_id: v.vendorName, ref: v.invoiceRef, invoice_date: v.issueDate, purchase_id: v.vendorPOId, amount_total: v.total }, note: 'Vendor bill linked to the purchase order.' };
}

export function erpRef(erp: ErpSystem, kind: 'AR' | 'AP' | 'GL' | 'RCPT', n: number) {
  return erp === 'oracle' ? `${kind === 'AR' ? 'ARTRX' : kind === 'AP' ? 'APINV' : kind === 'GL' ? 'GLJE' : 'ARRCT'}-${(300100 + n).toString()}` : `${kind === 'AR' ? 'INV/2026/' : kind === 'AP' ? 'BILL/2026/' : kind === 'GL' ? 'MISC/2026/' : 'BNK1/2026/'}${String(n).padStart(4, '0')}`;
}
