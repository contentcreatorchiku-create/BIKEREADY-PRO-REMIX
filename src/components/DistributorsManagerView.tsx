import React, { useState } from 'react';
import { Shop, Distributor, InventoryItem } from '../types/supabase';
import { supabaseService, generateWhatsAppLink } from '../utils/supabaseService';
import { notify } from './NotificationModal';
import {
  Building2,
  Plus,
  Trash2,
  Send,
  Phone,
  Package,
  AlertTriangle,
  CheckCircle2,
  X,
  ExternalLink,
} from 'lucide-react';

interface DistributorsManagerViewProps {
  currentShop: Shop;
  distributors: Distributor[];
  inventory: InventoryItem[];
  onRefresh: () => void;
}

export const DistributorsManagerView: React.FC<DistributorsManagerViewProps> = ({
  currentShop,
  distributors,
  inventory,
  onRefresh,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [distributorName, setDistributorName] = useState('');
  const [distributorPhone, setDistributorPhone] = useState('');
  const [suppliedCategories, setSuppliedCategories] = useState('Engine Oil, Tyres, Genuine Parts');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreateDistributor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!distributorName.trim()) return;

    setIsSubmitting(true);
    try {
      await supabaseService.saveDistributor({
        shop_id: currentShop.id,
        distributor_name: distributorName.trim(),
        phone: distributorPhone.trim(),
        supplied_categories: suppliedCategories.trim() || 'All Parts',
      });
      setShowAddModal(false);
      setDistributorName('');
      setDistributorPhone('');
      onRefresh();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteDistributor = async (id: string, name: string) => {
    const ok = await notify.confirm(`Delete distributor "${name}"?`, 'Confirm Deletion');
    if (!ok) return;
    await supabaseService.deleteDistributor(id);
    notify.success(`Distributor "${name}" deleted.`);
    onRefresh();
  };

  // Group low stock items (< 5) by distributor
  const lowStockItems = inventory.filter((item) => (item.stock_quantity || 0) < 5);

  const lowStockByDistributor: Record<string, { distributor: Distributor | null; items: InventoryItem[] }> = {};

  // Initialize for all known distributors
  distributors.forEach((d) => {
    lowStockByDistributor[d.id] = { distributor: d, items: [] };
  });
  // Unassigned bucket
  lowStockByDistributor['unassigned'] = { distributor: null, items: [] };

  lowStockItems.forEach((it) => {
    if (it.distributor_id && lowStockByDistributor[it.distributor_id]) {
      lowStockByDistributor[it.distributor_id].items.push(it);
    } else {
      lowStockByDistributor['unassigned'].items.push(it);
    }
  });

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              Distributors &amp; Auto Spares Suppliers
            </h3>
            <p className="text-xs text-slate-400">
              Manage parts vendors, direct phone lines &amp; 1-click WhatsApp purchase orders
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition shadow-sm"
        >
          <Plus className="w-4 h-4" /> + Add Supplier / Distributor
        </button>
      </div>

      {/* SECTION 1: SUPPLIER-WISE WHATSAPP REORDER QUEUE */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            <span>Supplier-Wise WhatsApp Reorder Queue ({lowStockItems.length} Low-Stock Parts)</span>
          </h4>
          <span className="text-[11px] text-slate-400">Threshold: Stock &lt; 5 units</span>
        </div>

        {lowStockItems.length === 0 ? (
          <div className="p-4 bg-slate-900 border border-emerald-900/60 rounded-2xl text-xs text-emerald-400 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>All inventory parts are healthy and well-stocked (all ≥ 5 units). No reorders needed today!</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Object.entries(lowStockByDistributor)
              .filter(([_, group]) => group.items.length > 0)
              .map(([key, group]) => {
                const distName = group.distributor?.distributor_name || 'General Spares Distributor';
                const distPhone = group.distributor?.phone || currentShop.distributor_phone || currentShop.owner_phone;

                // Formulate PO text
                const poItemsText = group.items
                  .map((it) => `• ${it.part_name} (${it.part_category}) - Stock: ${it.stock_quantity} | Need: 10 units`)
                  .join('\n');

                const poMessage = `Namaste ${distName}!\nOrder from ${currentShop.shop_name} (${currentShop.owner_phone}):\n\n*PURCHASE ORDER (LOW STOCK):*\n${poItemsText}\n\nPlease confirm availability and dispatch earliest. Thank you!`;

                return (
                  <div
                    key={key}
                    className="p-4 bg-slate-900 border border-amber-600/60 rounded-2xl shadow-lg flex flex-col justify-between space-y-3"
                  >
                    <div>
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
                        <span className="font-bold text-slate-100 text-sm flex items-center gap-1.5">
                          <Building2 className="w-4 h-4 text-amber-400" />
                          {distName}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-950 text-rose-300 border border-rose-800">
                          {group.items.length} Parts Low
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        {group.items.map((it) => (
                          <div
                            key={it.id}
                            className="flex items-center justify-between text-xs bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800/80"
                          >
                            <span className="text-slate-200">{it.part_name}</span>
                            <div className="flex items-center gap-2 font-mono">
                              <span className="text-rose-400 font-bold">Qty: {it.stock_quantity}</span>
                              <span className="text-slate-500">|</span>
                              <span className="text-emerald-400">Order: 10</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <a
                      href={generateWhatsAppLink(distPhone, poMessage)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Order from {distName} on WhatsApp</span>
                    </a>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* SECTION 2: REGISTERED DISTRIBUTORS DIRECTORY */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Registered Suppliers Directory ({distributors.length})
        </h4>

        {distributors.length === 0 ? (
          <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-2xl text-xs text-slate-400 space-y-2">
            <Building2 className="w-8 h-8 mx-auto text-slate-600" />
            <p>No external suppliers added yet.</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-3.5 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs"
            >
              + Add First Distributor
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {distributors.map((d) => (
              <div
                key={d.id}
                className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col justify-between shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-slate-100 text-sm truncate">{d.distributor_name}</span>
                    <button
                      onClick={() => handleDeleteDistributor(d.id, d.distributor_name)}
                      className="text-slate-500 hover:text-rose-400 p-1"
                      title="Delete Distributor"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="text-xs text-slate-400 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="font-mono text-slate-300">{d.phone || 'No phone'}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="truncate">{d.supplied_categories || 'All Parts'}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between gap-2">
                  <a
                    href={`tel:${d.phone}`}
                    className="flex-1 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs text-center transition"
                  >
                    Call
                  </a>
                  <a
                    href={generateWhatsAppLink(
                      d.phone,
                      `Namaste ${d.distributor_name}! Inquiry from ${currentShop.shop_name} regarding auto parts stock & pricing.`
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs text-center flex items-center justify-center gap-1 transition"
                  >
                    <Send className="w-3 h-3" /> WhatsApp
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL: ADD DISTRIBUTOR */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-amber-400" /> + Add Auto Parts Supplier / Distributor
              </h4>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateDistributor} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Supplier / Agency Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mahavir Auto Spares, Gulf Oil Agency"
                  value={distributorName}
                  onChange={(e) => setDistributorName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  WhatsApp / Order Phone Number *
                </label>
                <input
                  type="tel"
                  required
                  maxLength={10}
                  placeholder="10 Digits"
                  value={distributorPhone}
                  onChange={(e) => setDistributorPhone(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Supplied Categories (comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="Engine Oil, Tyres, Electricals, Brake Pads"
                  value={suppliedCategories}
                  onChange={(e) => setSuppliedCategories(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold transition disabled:opacity-40"
                >
                  {isSubmitting ? 'Saving...' : 'Add Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
