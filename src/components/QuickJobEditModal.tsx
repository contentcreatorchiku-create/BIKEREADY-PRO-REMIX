import React, { useState, useEffect } from 'react';
import { JobCard, Shop, User, JobCardItem, JobCardStatus } from '../types/supabase';
import { supabaseService } from '../utils/supabaseService';
import { notify } from './NotificationModal';
import {
  X,
  Edit,
  Save,
  Plus,
  Trash2,
  CheckCircle,
  AlertTriangle,
  User as UserIcon,
  Phone,
  Bike,
  Gauge,
  IndianRupee,
  ShieldCheck,
  Calculator,
} from 'lucide-react';

interface QuickJobEditModalProps {
  isOpen: boolean;
  jobCard: JobCard | null;
  currentShop: Shop | null;
  currentUser: User | null;
  onClose: () => void;
  onSaveSuccess: (updatedCard: JobCard) => void;
}

export const QuickJobEditModal: React.FC<QuickJobEditModalProps> = ({
  isOpen,
  jobCard,
  currentShop,
  currentUser,
  onClose,
  onSaveSuccess,
}) => {
  // STRICT SECURITY CHECK: Only Workshop Owner can ever view or execute Quick Job Edit
  const isOwner = currentUser?.role === 'owner' || currentUser?.phone === '9999999999';

  if (!isOpen || !jobCard || !currentShop || !currentUser || !isOwner) return null;

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [bikeNumber, setBikeNumber] = useState('');
  const [bikeModel, setBikeModel] = useState('');
  const [odometerKm, setOdometerKm] = useState<number>(0);
  const [status, setStatus] = useState<JobCardStatus>('in_progress');

  // Items list
  const [items, setItems] = useState<
    Array<{
      id?: string;
      part_id?: string | null;
      item_name: string;
      quantity: number;
      unit_price: number;
      is_unlisted_manual?: boolean;
      warranty_months?: number;
    }>
  >([]);

  // New Item Input row
  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState<number>(1);
  const [newItemPrice, setNewItemPrice] = useState<number>(0);

  // Labour, Consumables & Lathe Charges
  const [labourCharge, setLabourCharge] = useState<number>(0);
  const [consumableCharge, setConsumableCharge] = useState<number>(20);
  const [outsideWorkCustomerPrice, setOutsideWorkCustomerPrice] = useState<number>(0);
  const [outsideWorkShopCost, setOutsideWorkShopCost] = useState<number>(0);
  const [outsideWorkDesc, setOutsideWorkDesc] = useState('');
  const [extraDiscount, setExtraDiscount] = useState<number>(0);

  // Payment Breakdown
  const [advancePaid, setAdvancePaid] = useState<number>(0);
  const [cashCollected, setCashCollected] = useState<number>(0);
  const [upiCollected, setUpiCollected] = useState<number>(0);
  const [transferredToKhata, setTransferredToKhata] = useState<number>(0);
  const [upiRefNumber, setUpiRefNumber] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (jobCard) {
      setCustomerName(jobCard.customer?.customer_name || jobCard.customer_name || '');
      setCustomerPhone(jobCard.customer?.phone || jobCard.customer_phone || '');
      setBikeNumber(jobCard.bike_number || '');
      setBikeModel(
        (jobCard as any).bike_model ||
        jobCard.customer?.bike_model ||
        ''
      );
      setOdometerKm(Number(jobCard.odometer_km || 0));
      setStatus(jobCard.status || 'in_progress');

      // Map items
      const existingItems = (jobCard.items || []).map((it) => ({
        id: it.id,
        part_id: it.part_id,
        item_name: it.item_name,
        quantity: Number(it.quantity || 1),
        unit_price: Number(it.unit_price || 0),
        is_unlisted_manual: it.is_unlisted_manual,
        warranty_months: it.warranty_months,
      }));
      setItems(existingItems);

      setLabourCharge(Number(jobCard.labour_charge || 0));
      setConsumableCharge(Number(jobCard.consumable_charge !== undefined ? jobCard.consumable_charge : 20));
      setOutsideWorkCustomerPrice(Number(jobCard.outside_work_customer_price || 0));
      setOutsideWorkShopCost(Number(jobCard.outside_work_shop_cost || 0));
      setOutsideWorkDesc(jobCard.outside_work_desc || '');
      setExtraDiscount(Number(jobCard.extra_discount || 0));

      setAdvancePaid(Number(jobCard.advance_paid || 0));
      setCashCollected(Number(jobCard.cash_collected ?? jobCard.mandatory_cash_to_collect ?? 0));
      setUpiCollected(Number(jobCard.upi_collected || 0));
      setTransferredToKhata(Number(jobCard.transferred_to_khata || 0));
      setUpiRefNumber(jobCard.upi_ref_number || '');
    }
  }, [jobCard]);

  if (!isOpen || !jobCard || !isOwner) return null;

  // Live Calculations
  const partsSubtotal = Math.round(
    (items.reduce((s, it) => s + (Number(it.unit_price) || 0) * (Number(it.quantity) || 1), 0) +
      Number.EPSILON) *
      100
  ) / 100;

  const subtotal = Math.round(
    (partsSubtotal +
      Number(labourCharge || 0) +
      Number(consumableCharge || 0) +
      Number(outsideWorkCustomerPrice || 0) +
      Number.EPSILON) *
      100
  ) / 100;

  const grossTotal = Math.max(0, Math.round((subtotal - Number(extraDiscount || 0) + Number.EPSILON) * 100) / 100);
  const netPayable = Math.max(0, Math.round((grossTotal - Number(advancePaid || 0) + Number.EPSILON) * 100) / 100);
  const deliveryPaid = Math.round((Number(cashCollected || 0) + Number(upiCollected || 0) + Number.EPSILON) * 100) / 100;
  const autoCalculatedKhata = Math.max(0, Math.round((netPayable - deliveryPaid + Number.EPSILON) * 100) / 100);

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;
    setItems((prev) => [
      ...prev,
      {
        id: `manual_${Date.now()}`,
        item_name: newItemName.trim(),
        quantity: Math.max(1, Number(newItemQty) || 1),
        unit_price: Math.max(0, Number(newItemPrice) || 0),
        is_unlisted_manual: true,
      },
    ]);
    setNewItemName('');
    setNewItemQty(1);
    setNewItemPrice(0);
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleUpdateItem = (index: number, field: string, val: any) => {
    setItems((prev) =>
      prev.map((it, idx) => {
        if (idx !== index) return it;
        return {
          ...it,
          [field]: field === 'quantity' || field === 'unit_price' ? Number(val) : val,
        };
      })
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bikeNumber.trim()) {
      notify.error('Bike number is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await supabaseService.ownerQuickEditJobCard(
        jobCard.id,
        currentShop.id,
        {
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim(),
          bike_number: bikeNumber.trim().toUpperCase(),
          bike_model: bikeModel.trim(),
          odometer_km: Number(odometerKm || 0),
          status,
          items,
          labour_charge: Number(labourCharge || 0),
          consumable_charge: Number(consumableCharge || 0),
          outside_work_customer_price: Number(outsideWorkCustomerPrice || 0),
          outside_work_shop_cost: Number(outsideWorkShopCost || 0),
          outside_work_desc: outsideWorkDesc.trim(),
          extra_discount: Number(extraDiscount || 0),
          advance_paid: Number(advancePaid || 0),
          cash_collected: Number(cashCollected || 0),
          upi_collected: Number(upiCollected || 0),
          transferred_to_khata: Number(transferredToKhata !== undefined ? transferredToKhata : autoCalculatedKhata),
          upi_ref_number: upiRefNumber.trim() || null,
        },
        currentUser.full_name
      );

      if (res.success && res.jobCard) {
        notify.success('Job Card & Billing updated successfully by Owner!', 'Owner Override Saved');
        onSaveSuccess(res.jobCard);
        onClose();
      } else {
        notify.error(res.error || 'Failed to update Job Card');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      data-modal-open="true"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150"
    >
      <div className="bg-slate-900 border-2 border-amber-500/60 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-slate-900 via-amber-950/40 to-slate-900 border-b border-amber-500/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40">
              <Edit className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-100 text-sm sm:text-base">
                  Owner Quick Job Edit &amp; Master Override
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-amber-500 text-slate-950">
                  Owner Only
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                JC #{jobCard.id.slice(-6).toUpperCase()} • Full control on rates, items, payments &amp; Khata with instant sync
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
          {/* SECTION 1: Customer & Bike Details */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <h4 className="font-bold text-amber-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Bike className="w-4 h-4 text-amber-400" />
              <span>Customer &amp; Vehicle Master Info</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 font-semibold mb-1">
                  Customer Name
                </label>
                <div className="relative">
                  <UserIcon className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full pl-8 pr-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 font-bold focus:border-amber-400"
                    placeholder="Customer Name"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 font-semibold mb-1">
                  Mobile Number
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full pl-8 pr-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg font-mono text-slate-100 font-bold focus:border-amber-400"
                    placeholder="10-digit Phone"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 font-semibold mb-1">
                  Bike Number
                </label>
                <input
                  type="text"
                  required
                  value={bikeNumber}
                  onChange={(e) => setBikeNumber(e.target.value.toUpperCase())}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg font-mono font-bold text-amber-300 uppercase focus:border-amber-400"
                  placeholder="e.g. MP09AB1234"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 font-semibold mb-1">
                  Odometer (KM)
                </label>
                <div className="relative">
                  <Gauge className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                  <input
                    type="number"
                    min="0"
                    value={odometerKm}
                    onChange={(e) => setOdometerKm(Number(e.target.value))}
                    className="w-full pl-8 pr-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg font-mono text-slate-200 focus:border-amber-400"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: Parts & Labour Itemized List */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-amber-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Calculator className="w-4 h-4 text-amber-400" />
                <span>Parts &amp; Labour Items ({items.length})</span>
              </h4>
              <span className="font-mono text-slate-300 font-bold">
                Parts Subtotal: ₹{partsSubtotal}
              </span>
            </div>

            {/* Existing Items Table */}
            <div className="overflow-x-auto rounded-lg border border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-slate-400 text-[10px] uppercase border-b border-slate-800">
                  <tr>
                    <th className="p-2">Item Name / Part</th>
                    <th className="p-2 w-24">Qty</th>
                    <th className="p-2 w-28">Rate (₹)</th>
                    <th className="p-2 w-28 text-right">Total (₹)</th>
                    <th className="p-2 w-12 text-center">Del</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-3 text-center text-slate-500">
                        No parts or items recorded yet. Use form below to add.
                      </td>
                    </tr>
                  ) : (
                    items.map((it, idx) => (
                      <tr key={it.id || idx} className="hover:bg-slate-900/40">
                        <td className="p-2">
                          <input
                            type="text"
                            value={it.item_name}
                            onChange={(e) => handleUpdateItem(idx, 'item_name', e.target.value)}
                            className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded font-semibold text-slate-200"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            min="1"
                            value={it.quantity}
                            onChange={(e) => handleUpdateItem(idx, 'quantity', e.target.value)}
                            className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded font-mono text-center text-slate-200"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            min="0"
                            value={it.unit_price}
                            onChange={(e) => handleUpdateItem(idx, 'unit_price', e.target.value)}
                            className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded font-mono text-right text-amber-300 font-bold"
                          />
                        </td>
                        <td className="p-2 text-right font-mono font-bold text-slate-200">
                          ₹{(Number(it.unit_price) || 0) * (Number(it.quantity) || 1)}
                        </td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="p-1 rounded text-rose-400 hover:text-rose-200 hover:bg-rose-950/60"
                            title="Delete Item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Add New Item Row */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80">
              <input
                type="text"
                placeholder="+ Part or Labour Name"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                className="flex-1 min-w-[160px] px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 text-xs"
              />
              <input
                type="number"
                min="1"
                placeholder="Qty"
                value={newItemQty}
                onChange={(e) => setNewItemQty(Number(e.target.value))}
                className="w-16 px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg font-mono text-center text-xs"
              />
              <input
                type="number"
                min="0"
                placeholder="Rate (₹)"
                value={newItemPrice || ''}
                onChange={(e) => setNewItemPrice(Number(e.target.value))}
                className="w-24 px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg font-mono text-right font-bold text-amber-300 text-xs"
              />
              <button
                type="button"
                onClick={handleAddItem}
                className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Item
              </button>
            </div>
          </div>

          {/* SECTION 3: Additional Charges, Discounts & Status */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <h4 className="font-bold text-slate-300 uppercase tracking-wider text-[11px]">
              Labour, Consumables &amp; Discounts
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              <div>
                <label className="block text-[10px] text-slate-400 font-semibold mb-1">
                  Labour Charge (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  value={labourCharge}
                  onChange={(e) => setLabourCharge(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg font-mono font-bold text-slate-100"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 font-semibold mb-1">
                  Consumables (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  value={consumableCharge}
                  onChange={(e) => setConsumableCharge(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg font-mono text-slate-100"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 font-semibold mb-1">
                  Outside Lathe Customer (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  value={outsideWorkCustomerPrice}
                  onChange={(e) => setOutsideWorkCustomerPrice(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg font-mono text-slate-100"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 font-semibold mb-1">
                  Discount (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  value={extraDiscount}
                  onChange={(e) => setExtraDiscount(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg font-mono text-rose-400 font-bold"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 font-semibold mb-1">
                  Job Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as JobCardStatus)}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 font-bold capitalize"
                >
                  <option value="in_progress">In Progress</option>
                  <option value="submitted">Submitted</option>
                  <option value="approved">Approved</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </div>
          </div>

          {/* SECTION 4: Payment Breakdown & Settlement Math */}
          <div className="p-4 rounded-xl bg-slate-950 border-2 border-emerald-500/40 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-emerald-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <IndianRupee className="w-4 h-4 text-emerald-400" />
                <span>Payment Settlement &amp; Udhaar Ledger Math</span>
              </h4>
              <span className="font-mono text-xs text-amber-300 font-black">
                Gross Bill Total: ₹{grossTotal}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[10px] text-slate-400 font-semibold mb-1">
                  Advance Paid at Intake (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  value={advancePaid}
                  onChange={(e) => setAdvancePaid(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg font-mono text-blue-400 font-bold"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 font-semibold mb-1">
                  Cash Paid at Delivery (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  value={cashCollected}
                  onChange={(e) => setCashCollected(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg font-mono text-emerald-400 font-bold"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 font-semibold mb-1">
                  UPI Paid at Delivery (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  value={upiCollected}
                  onChange={(e) => setUpiCollected(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg font-mono text-cyan-400 font-bold"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[10px] text-rose-400 font-semibold">
                    Transferred to Khata (₹)
                  </label>
                  <button
                    type="button"
                    onClick={() => setTransferredToKhata(autoCalculatedKhata)}
                    className="text-[9px] text-amber-400 hover:underline font-bold"
                    title="Auto set to Gross - (Advance + Delivery)"
                  >
                    Auto ({autoCalculatedKhata})
                  </button>
                </div>
                <input
                  type="number"
                  min="0"
                  value={transferredToKhata}
                  onChange={(e) => setTransferredToKhata(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-rose-800 rounded-lg font-mono text-rose-400 font-black text-sm"
                />
              </div>
            </div>

            {/* Tally Summary Pill */}
            <div className="flex flex-wrap items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800 font-mono text-[11px]">
              <span className="text-slate-400">
                Gross: <strong className="text-white">₹{grossTotal}</strong> • Paid Overall:{' '}
                <strong className="text-emerald-400">
                  ₹{advancePaid + cashCollected + upiCollected}
                </strong>
              </span>
              <span className="text-slate-400">
                Khata Balance:{' '}
                <strong className={transferredToKhata > 0 ? 'text-rose-400' : 'text-emerald-400'}>
                  ₹{transferredToKhata}
                </strong>
              </span>
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 font-semibold hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold flex items-center gap-2 shadow-lg shadow-amber-500/20 transition disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSubmitting ? 'Saving Override...' : 'Save & Reconcile Tally'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
