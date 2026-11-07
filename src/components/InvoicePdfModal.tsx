import React, { useEffect, useState } from 'react';
import { JobCard, Shop } from '../types/supabase';
import {
  formatSimpleDate,
  getNextServiceDate,
  generateUpiPayload,
  generateWhatsAppLink,
  generateItemizedWhatsAppBill,
  generateSmsLink,
  generateSimpleSmsText,
} from '../utils/supabaseService';
import QRCode from 'qrcode';
import jsPDF from 'jspdf';
import {
  X,
  Printer,
  Download,
  Send,
  MessageSquare,
  ShieldCheck,
  QrCode,
  CheckCircle2,
  Calendar,
  Building,
  Copy,
  Check,
} from 'lucide-react';

interface InvoicePdfModalProps {
  jobCard: JobCard | null;
  shop: Shop | null;
  isOpen: boolean;
  onClose: () => void;
}

export const InvoicePdfModal: React.FC<InvoicePdfModalProps> = ({
  jobCard,
  shop,
  isOpen,
  onClose,
}) => {
  const [qrUrl, setQrUrl] = useState<string>('');
  const [generatingPdf, setGeneratingPdf] = useState(false);

  useEffect(() => {
    if (jobCard && shop) {
      const upiStr = generateUpiPayload(
        shop.upi_id,
        shop.shop_name,
        jobCard.total_bill,
        `Invoice ${jobCard.bike_number}`
      );
      QRCode.toDataURL(upiStr, { width: 160, margin: 1 })
        .then(setQrUrl)
        .catch(console.error);
    }
  }, [jobCard, shop]);

  if (!isOpen || !jobCard || !shop) return null;

  const invoiceDate = formatSimpleDate(jobCard.billed_at || jobCard.created_at);
  const nextService = getNextServiceDate(jobCard.billed_at || jobCard.created_at);

  const partsTotal = Math.round(((jobCard.items || []).reduce(
    (sum, it) => sum + (Number(it.unit_price) || 0) * (Number(it.quantity) || 1),
    0
  ) + Number.EPSILON) * 100) / 100;
  const labour = Math.round((Number(jobCard.labour_charge || 0) + Number.EPSILON) * 100) / 100;
  const outside = Math.round((Number(jobCard.outside_work_customer_price || 0) + Number.EPSILON) * 100) / 100;
  const consumable = Math.round((Number(jobCard.consumable_charge || 0) + Number.EPSILON) * 100) / 100;
  const discount = Math.round((Number(jobCard.extra_discount || 0) + Number.EPSILON) * 100) / 100;

  const subtotal = Math.round((partsTotal + labour + outside + consumable + Number.EPSILON) * 100) / 100;
  const grossBillTotal = Number(jobCard.total_bill) > 0 ? Number(jobCard.total_bill) : Math.max(0, subtotal - discount);
  const advancePaid = Math.round((Number(jobCard.advance_paid || 0) + Number.EPSILON) * 100) / 100;
  const netPayable = Math.max(0, Math.round((grossBillTotal - advancePaid + Number.EPSILON) * 100) / 100);

  const cashCollected = typeof jobCard.cash_collected === 'number'
    ? Number(jobCard.cash_collected)
    : Number(jobCard.mandatory_cash_to_collect || 0);
  const khataDue = Number(jobCard.transferred_to_khata || 0);
  const upiCollected = typeof jobCard.upi_collected === 'number'
    ? Number(jobCard.upi_collected)
    : Math.max(0, netPayable - cashCollected - khataDue);
  const totalPaid = Math.round((advancePaid + cashCollected + upiCollected + Number.EPSILON) * 100) / 100;

  // Generate jsPDF Document
  const handleDownloadPdf = () => {
    setGeneratingPdf(true);
    try {
      const doc = new jsPDF({
        unit: 'pt',
        format: 'a4',
      });

      // Header
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(0, 0, 595, 80, 'F');

      doc.setTextColor(245, 158, 11); // amber-500
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text(shop.shop_name.toUpperCase(), 40, 36);

      doc.setTextColor(203, 213, 225); // slate-300
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      const gstStr = shop.gst_number ? ` | GSTIN: ${shop.gst_number}` : '';
      doc.text(`Prop: ${shop.owner_name} | Contact: ${shop.owner_phone} | UPI: ${shop.upi_id}${gstStr}`, 40, 52);
      if (shop.shop_address) {
        doc.text(`Address: ${shop.shop_address}`, 40, 64);
      }

      // Invoice Details Bar
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`INVOICE / JOB CARD: ${jobCard.bike_number}`, 40, 106);
      doc.setFont('helvetica', 'normal');
      doc.text(`Date: ${invoiceDate}`, 40, 120);
      doc.text(`Next Service Due (+90 Days): ${nextService}`, 40, 134);

      doc.text(`Customer: ${jobCard.customer?.customer_name || 'Walk-in'}`, 340, 106);
      doc.text(`Mobile: ${jobCard.customer?.phone || 'N/A'}`, 340, 120);
      doc.text(`Odometer: ${jobCard.odometer_km} KM`, 340, 134);

      // Table Header
      let y = 160;
      doc.setFillColor(241, 245, 249);
      doc.rect(40, y, 515, 22, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('ITEM / SERVICE PARTICULARS', 48, y + 15);
      doc.text('WARRANTY', 290, y + 15);
      doc.text('QTY', 390, y + 15);
      doc.text('RATE (INR)', 435, y + 15);
      doc.text('AMOUNT (INR)', 495, y + 15);

      y += 28;
      doc.setFont('helvetica', 'normal');

      // Table Rows: Parts
      (jobCard.items || []).forEach((it) => {
        doc.text(it.item_name.substring(0, 36), 48, y);
        doc.text(it.warranty_months > 0 ? `${it.warranty_months} Mos` : 'Standard', 290, y);
        doc.text(String(it.quantity || 1), 395, y);
        doc.text(String(it.unit_price || 0), 445, y);
        doc.text(String((Number(it.unit_price) || 0) * (Number(it.quantity) || 1)), 505, y);
        y += 18;
      });

      // Outside Work (if any)
      if (outside > 0) {
        doc.text(
          `Outside Lathe / Machining: ${jobCard.outside_work_desc || 'Specialized Work'}`,
          48,
          y
        );
        doc.text('Specialized', 290, y);
        doc.text('1', 395, y);
        doc.text(String(outside), 445, y);
        doc.text(String(outside), 505, y);
        y += 18;
      }

      // Labour Charge
      if (labour > 0) {
        doc.text('Workshop Labour & Tuning Charges', 48, y);
        doc.text('—', 290, y);
        doc.text('1', 395, y);
        doc.text(String(labour), 445, y);
        doc.text(String(labour), 505, y);
        y += 18;
      }

      // Consumables Fee
      if (consumable > 0) {
        doc.text('Workshop Cleaning Solvents & Consumables', 48, y);
        doc.text('—', 290, y);
        doc.text('1', 395, y);
        doc.text(String(consumable), 445, y);
        doc.text(String(consumable), 505, y);
        y += 18;
      }

      // Extra Discount
      if (discount > 0) {
        doc.setTextColor(220, 38, 38);
        doc.text('Special Customer Discount', 48, y);
        doc.text(`-${discount}`, 505, y);
        doc.setTextColor(30, 41, 59);
        y += 18;
      }

      // Divider
      doc.setDrawColor(203, 213, 225);
      doc.line(40, y + 4, 555, y + 4);
      y += 18;

      // Subtotal & Financial Breakdown Box
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.text('Subtotal:', 340, y);
      doc.text(`INR ${subtotal}`, 490, y);
      y += 14;

      if (discount > 0) {
        doc.setTextColor(220, 38, 38);
        doc.text('Discount Applied:', 340, y);
        doc.text(`-INR ${discount}`, 490, y);
        doc.setTextColor(30, 41, 59);
        y += 14;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.text('GROSS TOTAL BILL:', 340, y);
      doc.text(`INR ${grossBillTotal}`, 490, y);
      y += 16;

      if (advancePaid > 0) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(16, 185, 129);
        doc.text('Less Advance Paid at Intake:', 340, y);
        doc.text(`-INR ${advancePaid}`, 490, y);
        doc.setTextColor(30, 41, 59);
        y += 14;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.text('NET PAYABLE AT DELIVERY:', 340, y);
        doc.text(`INR ${netPayable}`, 490, y);
        y += 16;
      }

      // Settlement Breakdown
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      if (advancePaid > 0) {
        doc.text(`• Advance Paid: INR ${advancePaid}`, 340, y);
        y += 12;
      }
      if (cashCollected > 0) {
        doc.text(`• Cash Collected at Handover: INR ${cashCollected}`, 340, y);
        y += 12;
      }
      if (upiCollected > 0) {
        doc.text(`• UPI Payment: INR ${upiCollected}${jobCard.upi_ref_number ? ` (Ref: ${jobCard.upi_ref_number})` : ''}`, 340, y);
        y += 12;
      }
      if (khataDue > 0) {
        doc.setTextColor(220, 38, 38);
        doc.text(`• Transferred to Customer Khata (Udhaar): INR ${khataDue}`, 340, y);
        doc.setTextColor(30, 41, 59);
        y += 12;
      }
      doc.setFont('helvetica', 'bold');
      doc.text(`• Total Paid for Job: INR ${totalPaid}`, 340, y);
      y += 14;

      // Gate Pass Badge on PDF
      doc.setFillColor(236, 253, 245);
      doc.setDrawColor(16, 185, 129);
      doc.roundedRect(40, y + 6, 260, 45, 6, 6, 'FD');
      doc.setTextColor(5, 150, 105);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('GATE PASS VERIFIED / HANDED OVER', 52, y + 24);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text('Vehicle road tested, verified & released to customer.', 52, y + 38);

      // Embed QR code image if available
      if (qrUrl) {
        doc.addImage(qrUrl, 'PNG', 440, y + 6, 70, 70);
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text(`Scan UPI: ${shop.upi_id}`, 430, y + 84);
      }

      // Footer
      doc.setTextColor(148, 163, 184);
      doc.setFontSize(8);
      const termsMsg = shop.invoice_terms || 'Thank you for trusting us with your motorcycle! Drive safely.';
      doc.text(termsMsg, 40, 780);

      doc.save(`Invoice_${jobCard.bike_number.replace(/\s+/g, '_')}.pdf`);
    } finally {
      setGeneratingPdf(false);
    }
  };

  // Itemized WhatsApp Message & URL
  const whatsappBillText = generateItemizedWhatsAppBill(shop, jobCard);
  const cleanPhone = (jobCard.customer?.phone || '').replace(/\D/g, '');
  const phoneWith91 = cleanPhone.startsWith('91') && cleanPhone.length > 10
    ? cleanPhone
    : cleanPhone.length === 10
    ? `91${cleanPhone}`
    : cleanPhone;

  const whatsappDirectUrl = phoneWith91
    ? `https://api.whatsapp.com/send?phone=${phoneWith91}&text=${encodeURIComponent(whatsappBillText)}`
    : `https://api.whatsapp.com/send?text=${encodeURIComponent(whatsappBillText)}`;

  const smsText = generateSimpleSmsText(shop, jobCard, 'bill');
  const smsDirectUrl = generateSmsLink(jobCard.customer?.phone || '', smsText);

  const [copiedBill, setCopiedBill] = useState(false);

  const handleCopyBill = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(whatsappBillText);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = whatsappBillText;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedBill(true);
      setTimeout(() => setCopiedBill(false), 2500);
      if (whatsappDirectUrl) {
        window.open(whatsappDirectUrl, '_blank', 'noopener,noreferrer');
      }
    } catch {
      if (whatsappDirectUrl) {
        window.open(whatsappDirectUrl, '_blank', 'noopener,noreferrer');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Top Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-100 text-sm">
              Official Workshop Invoice &amp; Gate Pass
            </span>
            <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-700 text-emerald-300 text-[10px] font-bold">
              CCTV Timestamps Hidden for Customer
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Invoice Container */}
        <div id="printable-invoice" className="p-6 bg-slate-950 text-slate-100 space-y-6">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 pb-5">
            <div>
              <h1 className="text-xl font-black text-amber-400 tracking-tight">
                {shop.shop_name}
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                Owner: {shop.owner_name} • Phone: {shop.owner_phone}
                {shop.gst_number && <span className="ml-2 font-mono text-slate-300">GSTIN: {shop.gst_number}</span>}
              </p>
              {shop.shop_address && (
                <p className="text-xs text-slate-400 mt-0.5">
                  Address: <span className="text-slate-300">{shop.shop_address}</span>
                </p>
              )}
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                UPI Payment ID: <strong className="text-amber-400">{shop.upi_id}</strong>
              </p>
            </div>

            <div className="text-right">
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 bg-slate-800 rounded text-slate-300">
                Job Card Invoice
              </span>
              <div className="text-sm font-mono font-bold text-amber-400 mt-1">
                {jobCard.bike_number}
              </div>
              <div className="text-xs text-slate-400">Date: {invoiceDate}</div>
              <div className="text-xs text-emerald-400 font-medium">
                Next Service: {nextService}
              </div>
            </div>
          </div>

          {/* Customer & Vehicle Info */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-900/60 rounded-xl border border-slate-800 text-xs">
            <div>
              <span className="text-[10px] text-slate-500 uppercase block">Customer</span>
              <span className="font-semibold text-slate-200">
                {jobCard.customer?.customer_name || 'Walk-in'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase block">Phone</span>
              <span className="font-mono text-slate-200">
                {jobCard.customer?.phone || 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase block">Vehicle Reg</span>
              <span className="font-mono font-bold text-amber-400">
                {jobCard.bike_number}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase block">Odometer</span>
              <span className="font-mono text-slate-200">
                {jobCard.odometer_km} KM
              </span>
            </div>
          </div>

          {/* Itemized Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px]">
                  <th className="py-2">Item Particulars</th>
                  <th className="py-2 text-center">Warranty</th>
                  <th className="py-2 text-center">Qty</th>
                  <th className="py-2 text-right">Unit Price</th>
                  <th className="py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {(jobCard.items || []).map((it) => (
                  <tr key={it.id} className="py-2">
                    <td className="py-2 font-medium text-slate-200">
                      {it.item_name}
                    </td>
                    <td className="py-2 text-center">
                      {it.warranty_months > 0 ? (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px]">
                          {it.warranty_months} Months
                        </span>
                      ) : (
                        <span className="text-slate-500 text-[10px]">Standard</span>
                      )}
                    </td>
                    <td className="py-2 text-center font-mono">{it.quantity}</td>
                    <td className="py-2 text-right font-mono text-slate-400">
                      ₹{it.unit_price}
                    </td>
                    <td className="py-2 text-right font-mono font-bold text-slate-200">
                      ₹{(it.unit_price || 0) * (it.quantity || 1)}
                    </td>
                  </tr>
                ))}

                {/* Outside Work */}
                {jobCard.outside_work_customer_price > 0 && (
                  <tr>
                    <td className="py-2 font-medium text-slate-200">
                      Outside Machining: {jobCard.outside_work_desc || 'Lathe Work'}
                    </td>
                    <td className="py-2 text-center text-slate-500 text-[10px]">Specialized</td>
                    <td className="py-2 text-center font-mono">1</td>
                    <td className="py-2 text-right font-mono text-slate-400">
                      ₹{jobCard.outside_work_customer_price}
                    </td>
                    <td className="py-2 text-right font-mono font-bold text-slate-200">
                      ₹{jobCard.outside_work_customer_price}
                    </td>
                  </tr>
                )}

                {/* Labour */}
                {jobCard.labour_charge > 0 && (
                  <tr>
                    <td className="py-2 font-medium text-slate-200">
                      Workshop Labour &amp; Mechanic Tuning
                    </td>
                    <td className="py-2 text-center text-slate-500 text-[10px]">—</td>
                    <td className="py-2 text-center font-mono">1</td>
                    <td className="py-2 text-right font-mono text-slate-400">
                      ₹{jobCard.labour_charge}
                    </td>
                    <td className="py-2 text-right font-mono font-bold text-slate-200">
                      ₹{jobCard.labour_charge}
                    </td>
                  </tr>
                )}

                {/* Consumables */}
                {jobCard.consumable_charge > 0 && (
                  <tr>
                    <td className="py-2 font-medium text-slate-200">
                      Consumables &amp; Cleaning Solvents
                    </td>
                    <td className="py-2 text-center text-slate-500 text-[10px]">—</td>
                    <td className="py-2 text-center font-mono">1</td>
                    <td className="py-2 text-right font-mono text-slate-400">
                      ₹{jobCard.consumable_charge}
                    </td>
                    <td className="py-2 text-right font-mono font-bold text-slate-200">
                      ₹{jobCard.consumable_charge}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Bottom Totals & Gate Pass */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-800">
            {/* Gate Pass Badge */}
            <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-600/50 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <span className="font-bold text-emerald-300 text-xs block">
                  GATE PASS VERIFIED / HANDED OVER
                </span>
                <p className="text-[11px] text-emerald-400/80 mt-0.5">
                  Road tested, inspected, accounts settled &amp; authorized for safe customer exit.
                </p>
              </div>
            </div>

            {/* Financial Summary & UPI QR */}
            <div className="flex flex-col sm:flex-row items-end sm:items-center justify-between gap-4 p-3 bg-slate-900/80 rounded-xl border border-slate-800">
              <div className="space-y-1 text-right sm:text-left text-xs w-full">
                <div className="flex justify-between gap-4 text-slate-400 text-[11px]">
                  <span>Subtotal:</span>
                  <span className="font-mono text-slate-200">₹{subtotal}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between gap-4 text-rose-400 text-[11px]">
                    <span>Discount:</span>
                    <span className="font-mono">-₹{discount}</span>
                  </div>
                )}
                <div className="flex justify-between gap-4 text-slate-200 font-bold border-t border-slate-800/80 pt-1">
                  <span>Gross Total Bill:</span>
                  <span className="font-mono text-amber-400 font-bold">₹{grossBillTotal}</span>
                </div>
                {advancePaid > 0 && (
                  <div className="flex justify-between gap-4 text-emerald-400 text-[11px]">
                    <span>Advance Paid (Intake):</span>
                    <span className="font-mono">-₹{advancePaid}</span>
                  </div>
                )}
                {advancePaid > 0 && (
                  <div className="flex justify-between gap-4 text-slate-100 font-extrabold text-xs border-t border-slate-800/80 pt-1">
                    <span>Net Paid/Due at Handover:</span>
                    <span className="font-mono text-white">₹{netPayable}</span>
                  </div>
                )}
                <div className="text-[10px] text-slate-400 border-t border-slate-800/80 pt-1">
                  <span>Settlement: </span>
                  {advancePaid > 0 && <span className="text-emerald-400">Adv: ₹{advancePaid} • </span>}
                  <span className="text-slate-300">Cash: ₹{cashCollected}</span> •{' '}
                  <span className="text-indigo-400">UPI: ₹{upiCollected}</span>
                  {khataDue > 0 && <span className="text-amber-400 font-bold"> • Udhar: ₹{khataDue}</span>}
                  {jobCard.upi_ref_number && (
                    <span className="block text-[10px] text-indigo-400 font-mono mt-0.5">
                      UPI Ref/UTR: {jobCard.upi_ref_number}
                    </span>
                  )}
                </div>
              </div>

              {qrUrl && (
                <div className="p-1.5 bg-white rounded-xl shadow-md text-center shrink-0 self-center">
                  <img src={qrUrl} alt="UPI QR" className="w-18 h-18 mx-auto" />
                  <span className="text-[8px] font-mono font-bold text-slate-900 block mt-0.5">
                    Scan UPI
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Action Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-slate-900 border-t border-slate-800 pb-24 sm:pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={whatsappDirectUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-lg shadow-emerald-600/20"
            >
              <Send className="w-4 h-4" /> 📲 Share Full Bill on WhatsApp (₹{grossBillTotal})
            </a>

            <button
              type="button"
              onClick={handleCopyBill}
              className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-emerald-600/50 text-emerald-300 font-bold text-xs flex items-center gap-1.5 transition"
              title="Copy formatted WhatsApp bill to clipboard"
            >
              {copiedBill ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copiedBill ? 'Copied to Clipboard!' : '📋 Copy Bill for WhatsApp'}</span>
            </button>

            {jobCard?.customer?.phone && (
              <a
                href={smsDirectUrl}
                className="px-3.5 py-2.5 rounded-xl bg-sky-600/30 hover:bg-sky-600/50 border border-sky-600/50 text-sky-200 font-bold text-xs flex items-center gap-1.5 transition"
                title="Send simple SMS"
              >
                <MessageSquare className="w-4 h-4" />
                <span>📩 Simple SMS</span>
              </a>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="px-3.5 py-2.5 rounded-xl border border-slate-700 text-slate-200 hover:bg-slate-800 text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <Printer className="w-4 h-4" /> Print
            </button>
            <button
              onClick={handleDownloadPdf}
              disabled={generatingPdf}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              {generatingPdf ? 'Generating PDF...' : 'Download Invoice PDF'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
