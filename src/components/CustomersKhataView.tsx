import React, { useState, useEffect } from 'react';
import { Customer, Shop, User, TrustTier, CreditLedgerEntry, JobCard } from '../types/supabase';
import { supabaseService, generateWhatsAppLink, generateSmsLink, formatCCTVTimestamp } from '../utils/supabaseService';
import { CustomerBroadcastView } from './CustomerBroadcastView';
import { notify } from './NotificationModal';
import {
  Users,
  Search,
  Plus,
  Send,
  MessageSquare,
  Copy,
  CreditCard,
  Banknote,
  QrCode,
  ShieldAlert,
  ShieldCheck,
  CheckCircle,
  Phone,
  Bike,
  Edit,
  FileText,
  History,
  X,
  Clock,
  Wrench,
  MapPin,
  ArrowUpDown,
  Megaphone,
  Download,
  FileSpreadsheet,
  Printer,
} from 'lucide-react';
import { InvoicePdfModal } from './InvoicePdfModal';

interface CustomersKhataViewProps {
  currentShop: Shop;
  currentUser: User;
  onRefreshData: () => void;
  onOpenInvoiceModal?: (card: JobCard) => void;
}

export const CustomersKhataView: React.FC<CustomersKhataViewProps> = ({
  currentShop,
  currentUser,
  onRefreshData,
  onOpenInvoiceModal,
}) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [followupJobCards, setFollowupJobCards] = useState<JobCard[]>([]);
  const [search, setSearch] = useState('');
  const [viewInvoiceCard, setViewInvoiceCard] = useState<JobCard | null>(null);
  const [loading, setLoading] = useState(false);

  // Quick Filter & Sort State
  const [filterTab, setFilterTab] = useState<'all' | 'due' | 'cleared' | 'trusted'>('all');
  const [sortBy, setSortBy] = useState<'highest_due' | 'lowest_due' | 'alpha' | 'recent'>('highest_due');

  // Broadcast & Promo Modal State
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);

  // Payment Settlement Modal
  const [settlingCustomer, setSettlingCustomer] = useState<Customer | null>(null);
  const [settleAmount, setSettleAmount] = useState<number | ''>('');
  const [settleMode, setSettleMode] = useState<'cash' | 'upi'>('cash');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Customer Modal
  const [showNewModal, setShowNewModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAltPhone, setNewAltPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newBike, setNewBike] = useState('');
  const [newBikeModel, setNewBikeModel] = useState('');
  const [newTier, setNewTier] = useState<TrustTier>('new');
  const [newCreditLimit, setNewCreditLimit] = useState<number>(0);
  const [newNotes, setNewNotes] = useState('');

  // Edit Customer Modal
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAltPhone, setEditAltPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editBike, setEditBike] = useState('');
  const [editBikeModel, setEditBikeModel] = useState('');
  const [editTier, setEditTier] = useState<TrustTier>('new');
  const [editCreditLimit, setEditCreditLimit] = useState<number>(0);
  const [editNotes, setEditNotes] = useState('');

  // Customer 360 History Modal
  const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null);
  const [historyData, setHistoryData] = useState<{
    customer: Customer | null;
    jobCards: any[];
    ledgerEntries: CreditLedgerEntry[];
    metrics?: {
      totalVisits: number;
      totalGrossBilled: number;
      totalAdvancePaid: number;
      totalCashPaid: number;
      totalUpiPaid: number;
      totalUdhaarIncurred: number;
      totalUdhaarSettled: number;
      accurateCurrentDue: number;
    };
  } | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const data = await supabaseService.getCustomers(currentShop.id, search);
      setCustomers(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, [currentShop.id, search]);

  const handleSettlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlingCustomer || !settleAmount || Number(settleAmount) <= 0) return;

    setIsSubmitting(true);
    try {
      const ok = await supabaseService.recordUdhaarPayment(
        settlingCustomer.id,
        Number(settleAmount),
        settleMode,
        currentShop.id,
        currentUser.full_name
      );

      if (ok) {
        notify.success(`Recorded ₹${settleAmount} payment for ${settlingCustomer.customer_name}!`);
        setSettlingCustomer(null);
        setSettleAmount('');
        await loadCustomers();
        onRefreshData();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPhone.trim()) return;

    await supabaseService.createOrUpdateCustomer(currentShop.id, {
      customer_name: newName.trim(),
      phone: newPhone.trim(),
      alt_phone: newAltPhone.trim(),
      address: newAddress.trim(),
      bike_number: newBike.trim().toUpperCase(),
      bike_model: newBikeModel.trim(),
      trust_tier: newTier,
      credit_limit: newCreditLimit,
      absolute_max_limit: 5000,
      current_due: 0,
      notes: newNotes.trim(),
    });

    notify.success(`Customer profile "${newName}" created successfully!`);
    setNewName('');
    setNewPhone('');
    setNewAltPhone('');
    setNewAddress('');
    setNewBike('');
    setNewBikeModel('');
    setNewNotes('');
    setShowNewModal(false);
    await loadCustomers();
  };

  const handleOpenEdit = (c: Customer, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingCustomer(c);
    setEditName(c.customer_name);
    setEditPhone(c.phone);
    setEditAltPhone(c.alt_phone || '');
    setEditAddress(c.address || '');
    setEditBike(c.bike_number);
    setEditBikeModel(c.bike_model || '');
    setEditTier(c.trust_tier);
    setEditCreditLimit(c.credit_limit);
    setEditNotes(c.notes || '');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer) return;
    await supabaseService.updateCustomer(editingCustomer.id, {
      customer_name: editName.trim(),
      phone: editPhone.trim(),
      alt_phone: editAltPhone.trim(),
      address: editAddress.trim(),
      bike_number: editBike.trim().toUpperCase(),
      bike_model: editBikeModel.trim(),
      trust_tier: editTier,
      credit_limit: editCreditLimit,
      notes: editNotes.trim(),
    });
    notify.success('Customer profile updated!');
    setEditingCustomer(null);
    await loadCustomers();
  };

  const handleOpenHistory = async (c: Customer, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setHistoryCustomer(c);
    setLoadingHistory(true);
    try {
      const res = await supabaseService.getCustomer360History(currentShop.id, c.id);
      setHistoryData(res);
    } finally {
      setLoadingHistory(false);
    }
  };

  const totalOutstandingDue = customers.reduce((sum, c) => sum + Number(c.current_due || 0), 0);
  const totalCount = customers.length;
  const dueCount = customers.filter((c) => Number(c.current_due || 0) > 0).length;
  const clearedCount = customers.filter((c) => Number(c.current_due || 0) <= 0).length;
  const trustedCount = customers.filter((c) => c.trust_tier === 'trusted').length;

  const filteredCustomers = customers
    .filter((c) => {
      // Filter tab
      if (filterTab === 'due' && Number(c.current_due || 0) <= 0) return false;
      if (filterTab === 'cleared' && Number(c.current_due || 0) > 0) return false;
      if (filterTab === 'trusted' && c.trust_tier !== 'trusted') return false;

      // Instant search
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchesName = (c.customer_name || '').toLowerCase().includes(q);
        const matchesPhone = (c.phone || '').includes(q) || (c.alt_phone || '').includes(q);
        const matchesBike = (c.bike_number || '').toLowerCase().includes(q) || (c.bike_model || '').toLowerCase().includes(q);
        return matchesName || matchesPhone || matchesBike;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'highest_due') {
        return Number(b.current_due || 0) - Number(a.current_due || 0);
      }
      if (sortBy === 'lowest_due') {
        return Number(a.current_due || 0) - Number(b.current_due || 0);
      }
      if (sortBy === 'alpha') {
        return (a.customer_name || '').localeCompare(b.customer_name || '');
      }
      if (sortBy === 'recent') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      return 0;
    });

  return (
    <div className="space-y-4 pb-24">
      {/* Top Header Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              Customer Khata &amp; Udhaar Ledger
            </h2>
            <p className="text-xs text-slate-400">
              Total Outstanding Udhaar Across Workshop:{' '}
              <strong className="text-rose-400 font-mono font-bold text-sm">
                ₹{totalOutstandingDue}
              </strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowBroadcastModal(true)}
            className="px-3.5 py-2 rounded-xl bg-sky-950 hover:bg-sky-900 border border-sky-600/70 text-sky-300 font-bold text-xs flex items-center gap-1.5 transition shadow-sm"
          >
            <Megaphone className="w-4 h-4 text-sky-400" />
            <span>📢 Broadcast &amp; Offers</span>
          </button>

          <button
            onClick={() => setShowNewModal(true)}
            className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition shadow-sm"
          >
            <Plus className="w-4 h-4" /> Add Customer Profile
          </button>
        </div>
      </div>

      {/* QUICK FILTER PILLS & SORTING CONTROLS */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 p-2 rounded-2xl border border-slate-800">
        {/* Quick Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto max-w-full">
          <button
            type="button"
            onClick={() => setFilterTab('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              filterTab === 'all'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            All Customers ({totalCount})
          </button>

          <button
            type="button"
            onClick={() => setFilterTab('due')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1 ${
              filterTab === 'due'
                ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                : 'bg-slate-950 text-rose-400 hover:text-rose-300 border border-rose-900/50'
            }`}
          >
            <span>🔴 Pending Udhaar Only</span>
            <span className="font-mono text-[11px]">({dueCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterTab('cleared')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1 ${
              filterTab === 'cleared'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'bg-slate-950 text-emerald-400 hover:text-emerald-300 border border-emerald-900/50'
            }`}
          >
            <span>🟢 Cleared / Zero Due</span>
            <span className="font-mono text-[11px]">({clearedCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterTab('trusted')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1 ${
              filterTab === 'trusted'
                ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                : 'bg-slate-950 text-amber-400 hover:text-amber-300 border border-amber-900/50'
            }`}
          >
            <span>⭐ Trusted Tier</span>
            <span className="font-mono text-[11px]">({trustedCount})</span>
          </button>
        </div>

        {/* Sorting Dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400 font-semibold flex items-center gap-1 whitespace-nowrap">
            <ArrowUpDown className="w-3.5 h-3.5 text-amber-400" /> Sort by:
          </span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-200 font-semibold focus:outline-none focus:border-amber-500"
          >
            <option value="highest_due">Highest Udhaar First (Descending)</option>
            <option value="lowest_due">Lowest Udhaar First</option>
            <option value="alpha">Alphabetical (A - Z)</option>
            <option value="recent">Recently Active</option>
          </select>
        </div>
      </div>

      {/* FAST INSTANT SEARCH INPUT */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
        <input
          type="text"
          placeholder="Fast search by customer name, mobile number, or bike number..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-10 py-2.5 bg-slate-900 border border-slate-700 rounded-2xl text-xs text-slate-100 focus:outline-none focus:border-amber-500 placeholder:text-slate-500"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3.5 top-2.5 text-slate-400 hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Customers List */}
      {filteredCustomers.length === 0 ? (
        <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-2xl text-xs text-slate-400 space-y-2">
          <Users className="w-8 h-8 mx-auto text-slate-500" />
          <p className="font-bold text-slate-200">No Customers Matching Selected Criteria</p>
          <p className="text-slate-500">
            {search ? `No customer found for "${search}".` : 'Try clearing filters to see all customer records.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 w-full">
          {filteredCustomers.map((c) => {
          const isBlocked = c.trust_tier === 'blocked';
          const hasDue = c.current_due > 0;

          return (
            <div
              key={c.id}
              className={`p-4 rounded-2xl border transition shadow-md flex flex-col justify-between overflow-hidden ${
                isBlocked
                  ? 'bg-rose-950/20 border-rose-800/80'
                  : 'bg-slate-900 border-slate-800'
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center justify-between mb-2 gap-2">
                  <div
                    onClick={() => handleOpenHistory(c)}
                    className="font-bold text-slate-100 text-sm truncate cursor-pointer hover:text-amber-400 transition flex items-center gap-1.5"
                    title="Click to view Customer 360° History"
                  >
                    <span>{c.customer_name}</span>
                    <History className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => handleOpenEdit(c, e)}
                      className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                      title="Edit Customer"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
                        c.trust_tier === 'trusted'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : isBlocked
                          ? 'bg-rose-600 text-white'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {c.trust_tier}
                    </span>
                  </div>
                </div>

                <div className="space-y-1 text-xs text-slate-400">
                  <div className="flex items-center gap-1.5 truncate">
                    <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="truncate">{c.phone || 'No Phone'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-mono truncate">
                    <Bike className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="text-amber-300 uppercase font-bold truncate">
                      {c.bike_number || 'No Vehicle'}
                    </span>
                  </div>
                </div>

                {/* Due vs Limit Card */}
                <div className="mt-3 p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block">Credit Limit</span>
                    <span className="font-mono text-slate-300">₹{c.credit_limit}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 uppercase block">Current Due</span>
                    <span
                      className={`font-mono font-bold text-sm ${
                        hasDue ? 'text-rose-400' : 'text-emerald-400'
                      }`}
                    >
                      ₹{c.current_due}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions: 360 History, Settle Payment & WhatsApp Reminder */}
              <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleOpenHistory(c)}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1 transition"
                    title="View Customer Master Data Sheet & 360° History"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-amber-400" /> 📊 Customer Data Sheet
                  </button>

                  {hasDue ? (
                    <button
                      onClick={() => {
                        setSettlingCustomer(c);
                        setSettleAmount(c.current_due);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition flex items-center gap-1 shadow-sm"
                    >
                      <Banknote className="w-3.5 h-3.5" /> Settle
                    </button>
                  ) : (
                    <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> Clear
                    </span>
                  )}
                </div>

                {c.phone && hasDue && (() => {
                  const reminderMsg = `Namaste ${c.customer_name}! Friendly reminder from ${currentShop.shop_name}. Outstanding Udhaar amount is Rs. ${c.current_due}. Please pay via UPI ID: ${currentShop.upi_id || 'chaitanya180803-1@okaxis'}. Thank you!`;
                  return (
                    <div className="flex items-center gap-1">
                      <a
                        href={generateWhatsAppLink(c.phone, reminderMsg)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center justify-center min-w-[34px] min-h-[34px]"
                        title="Send WhatsApp payment reminder"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </a>
                      <a
                        href={generateSmsLink(c.phone, reminderMsg)}
                        className="p-2 rounded-xl bg-sky-600/30 hover:bg-sky-600/50 text-sky-200 text-xs font-bold transition flex items-center justify-center min-w-[34px] min-h-[34px] border border-sky-600/50"
                        title="Send SMS payment reminder"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </a>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(reminderMsg);
                          notify.success(`Payment reminder copied for ${c.customer_name}!`);
                        }}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition flex items-center justify-center min-w-[34px] min-h-[34px] border border-slate-700"
                        title="Copy reminder text"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })()}
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* SETTLE UDHAAR PAYMENT MODAL */}
      {settlingCustomer && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-sm rounded-2xl shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-slate-100 mb-1">
              Collect Udhaar Payment
            </h3>
            <p className="text-xs text-slate-400 mb-3">
              Customer: <strong className="text-slate-200">{settlingCustomer.customer_name}</strong> (Total Due: <strong className="text-rose-400 font-mono">₹{settlingCustomer.current_due}</strong>)
            </p>

            <form onSubmit={handleSettlePayment} className="space-y-4">
              {/* Quick Full / Partial Selectors */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSettleAmount(settlingCustomer.current_due)}
                  className="flex-1 py-1 px-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-xs border border-amber-500/40"
                >
                  Full (₹{settlingCustomer.current_due})
                </button>
                <button
                  type="button"
                  onClick={() => setSettleAmount(Math.round(settlingCustomer.current_due / 2))}
                  className="flex-1 py-1 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700"
                >
                  50% (₹{Math.round(settlingCustomer.current_due / 2)})
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Amount to Collect (₹)
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max={settlingCustomer.current_due}
                  value={settleAmount}
                  onChange={(e) =>
                    setSettleAmount(e.target.value === '' ? '' : Number(e.target.value))
                  }
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-base font-mono font-bold text-amber-300"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Collection Mode
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSettleMode('cash')}
                    className={`py-2.5 rounded-xl text-xs font-bold border transition ${
                      settleMode === 'cash'
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black'
                        : 'bg-slate-950 text-slate-300 border-slate-800'
                    }`}
                  >
                    Cash in Drawer
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettleMode('upi')}
                    className={`py-2.5 rounded-xl text-xs font-bold border transition ${
                      settleMode === 'upi'
                        ? 'bg-indigo-500 text-slate-100 border-indigo-400 font-black'
                        : 'bg-slate-950 text-slate-300 border-slate-800'
                    }`}
                  >
                    UPI Direct
                  </button>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  * Automatically synced into Today's Daily Galla Tally
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSettlingCustomer(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-xs font-semibold hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-md transition disabled:opacity-40"
                >
                  {isSubmitting ? 'Recording...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE NEW CUSTOMER MODAL */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl p-6">
            <h3 className="text-base font-bold text-slate-100 mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-400" /> Register Customer Profile
            </h3>

            <form onSubmit={handleCreateCustomer} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Customer Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Patil"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Primary Mobile *
                  </label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    placeholder="10 digits"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Alternate Mobile
                  </label>
                  <input
                    type="tel"
                    maxLength={10}
                    placeholder="Optional 10 digits"
                    value={newAltPhone}
                    onChange={(e) => setNewAltPhone(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Vehicle Reg. No.
                  </label>
                  <input
                    type="text"
                    placeholder="MH 02 CB 1234"
                    value={newBike}
                    onChange={(e) => setNewBike(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono font-bold text-amber-300 uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Bike Model / Make
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Hero Splendor+, Pulsar 150"
                    value={newBikeModel}
                    onChange={(e) => setNewBikeModel(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Complete Address / City
                </label>
                <input
                  type="text"
                  placeholder="e.g. Near Bus Stand, Gandhi Chowk, Pune"
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Trust Tier
                  </label>
                  <select
                    value={newTier}
                    onChange={(e) => {
                      const tier = e.target.value as TrustTier;
                      setNewTier(tier);
                      if (tier === 'trusted') setNewCreditLimit(3000);
                      else if (tier === 'regular') setNewCreditLimit(1500);
                      else setNewCreditLimit(0);
                    }}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100"
                  >
                    <option value="new">New (₹0 Credit)</option>
                    <option value="regular">Regular (₹1,500)</option>
                    <option value="trusted">Trusted (₹3,000)</option>
                    <option value="blocked">Blocked (No Credit)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Credit Limit (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="5000"
                    value={newCreditLimit}
                    onChange={(e) => setNewCreditLimit(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Notes / Remarks
                </label>
                <input
                  type="text"
                  placeholder="e.g. Reliable customer, pays on 1st of every month"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold"
                >
                  Create Customer Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT CUSTOMER MODAL */}
      {editingCustomer && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Edit className="w-4 h-4 text-amber-400" /> Edit Customer Profile
              </h3>
              <button
                onClick={() => setEditingCustomer(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Customer Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Primary Mobile *
                  </label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Alternate Mobile
                  </label>
                  <input
                    type="tel"
                    maxLength={10}
                    placeholder="Optional 10 digits"
                    value={editAltPhone}
                    onChange={(e) => setEditAltPhone(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Vehicle Reg. No.
                  </label>
                  <input
                    type="text"
                    value={editBike}
                    onChange={(e) => setEditBike(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono font-bold text-amber-300 uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Bike Model / Make
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Hero Splendor+, Pulsar"
                    value={editBikeModel}
                    onChange={(e) => setEditBikeModel(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Complete Address / City
                </label>
                <input
                  type="text"
                  placeholder="e.g. Near Bus Stand, Gandhi Chowk, Pune"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Trust Tier
                  </label>
                  <select
                    value={editTier}
                    onChange={(e) => {
                      const tier = e.target.value as TrustTier;
                      setEditTier(tier);
                      if (tier === 'trusted') setEditCreditLimit(3000);
                      else if (tier === 'regular') setEditCreditLimit(1500);
                      else setEditCreditLimit(0);
                    }}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100"
                  >
                    <option value="new">New (₹0 Credit)</option>
                    <option value="regular">Regular (₹1,500)</option>
                    <option value="trusted">Trusted (₹3,000)</option>
                    <option value="blocked">Blocked (No Credit)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Credit Limit (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="10000"
                    value={editCreditLimit}
                    onChange={(e) => setEditCreditLimit(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Notes / Remarks
                </label>
                <input
                  type="text"
                  placeholder="e.g. Regular customer notes"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingCustomer(null)}
                  className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CUSTOMER 360° HISTORY & MASTER DATA SHEET MODAL */}
      {historyCustomer && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 max-w-5xl w-full max-h-[92vh] overflow-y-auto shadow-2xl space-y-4">
            {/* Modal Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-amber-400" />
                    <span>Customer Master Data Sheet &amp; 360° Audit Dossier</span>
                  </h3>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 capitalize">
                    {historyCustomer.trust_tier} Trust
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  <strong className="text-slate-200">{historyCustomer.customer_name}</strong> • Phone: <span className="font-mono text-slate-300">{historyCustomer.phone || 'N/A'}</span>
                  {historyCustomer.alt_phone && <span> / <span className="font-mono text-slate-300">{historyCustomer.alt_phone}</span></span>} • Bike: <strong className="text-amber-300 font-mono">{historyCustomer.bike_number || 'N/A'}</strong>
                  {historyCustomer.bike_model && <span> ({historyCustomer.bike_model})</span>}
                </p>
              </div>

              {/* Action & Export Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    supabaseService.exportCustomerStatementPdf(
                      historyCustomer,
                      historyData?.jobCards || [],
                      historyData?.ledgerEntries || [],
                      historyData?.metrics,
                      currentShop
                    );
                    notify.success('Downloading Official Customer Statement PDF...');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
                  title="Download clean official PDF statement"
                >
                  <Printer className="w-3.5 h-3.5 text-amber-400" />
                  <span>📄 Download Statement PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    supabaseService.exportCustomerSheetCsv(
                      historyCustomer,
                      historyData?.jobCards || [],
                      historyData?.ledgerEntries || [],
                      historyData?.metrics,
                      currentShop.shop_name
                    );
                    notify.success('Exported Customer Sheet (.CSV) successfully!');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-emerald-950/80 hover:bg-emerald-900/80 text-emerald-200 border border-emerald-800 text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
                  title="Export full raw data sheet to Excel (.csv)"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                  <span>📊 Export Sheet (.CSV)</span>
                </button>

                <button
                  onClick={() => {
                    setHistoryCustomer(null);
                    setHistoryData(null);
                    loadCustomers();
                  }}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 ml-1 transition"
                  title="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* 6-BOX UNIFIED FINANCIAL SUMMARY BAR */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 p-3 bg-slate-950/90 rounded-2xl border border-slate-800 text-xs shadow-inner">
              <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800/80 text-center">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Total Visits / Bills</span>
                <span className="text-sm font-mono font-extrabold text-amber-400">
                  {historyData?.metrics?.totalVisits ?? (historyData?.jobCards?.filter((j: any) => j.status === 'completed').length || 0)}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800/80 text-center">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Total Gross Billed</span>
                <span className="text-sm font-mono font-extrabold text-slate-100">
                  ₹{historyData?.metrics?.totalGrossBilled ?? 0}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800/80 text-center">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Total Advance Paid</span>
                <span className="text-sm font-mono font-extrabold text-blue-400">
                  ₹{historyData?.metrics?.totalAdvancePaid ?? 0}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800/80 text-center">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Cash + UPI Paid</span>
                <span className="text-sm font-mono font-extrabold text-emerald-400">
                  ₹{((historyData?.metrics?.totalCashPaid ?? 0) + (historyData?.metrics?.totalUpiPaid ?? 0))}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800/80 text-center">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Total Udhaar Settled</span>
                <span className="text-sm font-mono font-extrabold text-emerald-300">
                  ₹{historyData?.metrics?.totalUdhaarSettled ?? 0}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800/80 text-center">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Net Udhaar Due</span>
                {(() => {
                  const verifiedDue = historyData?.metrics?.accurateCurrentDue ?? (
                    historyData?.customer?.current_due !== undefined
                      ? Number(historyData.customer.current_due)
                      : Number(historyCustomer.current_due || 0)
                  );
                  return (
                    <span className={`text-sm font-mono font-extrabold ${verifiedDue > 0 ? 'text-rose-400 animate-pulse' : 'text-emerald-400'}`}>
                      ₹{verifiedDue}
                    </span>
                  );
                })()}
              </div>
            </div>

            {/* 📋 COMPLETE CUSTOMER MASTER DATA SHEET */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-amber-400" />
                  <span>📋 Complete Customer Master Data Sheet (Bill-by-Bill Breakdown)</span>
                </h4>
                <span className="text-[10px] text-slate-400 font-mono">
                  {(historyData?.jobCards?.filter((j: any) => j.status === 'completed').length || 0)} Completed Bills
                </span>
              </div>

              {loadingHistory ? (
                <div className="py-6 text-center text-xs text-slate-400 bg-slate-950 rounded-2xl border border-slate-800">
                  Loading customer master data sheet...
                </div>
              ) : !historyData?.jobCards || historyData.jobCards.filter((j: any) => j.status === 'completed').length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-500 bg-slate-950/60 rounded-2xl border border-slate-800">
                  No finalized bills recorded yet for this customer.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950 shadow-md">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead className="bg-slate-900/90 text-slate-400 text-[10px] uppercase font-semibold border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Invoice / Job #</th>
                        <th className="py-2.5 px-3">Bike &amp; Odo</th>
                        <th className="py-2.5 px-3 max-w-[200px]">Parts &amp; Labour Summary</th>
                        <th className="py-2.5 px-3 text-right">Gross Bill</th>
                        <th className="py-2.5 px-3 text-right">Advance</th>
                        <th className="py-2.5 px-3 text-right">Cash Paid</th>
                        <th className="py-2.5 px-3 text-right">UPI Paid</th>
                        <th className="py-2.5 px-3 text-right">New Udhaar</th>
                        <th className="py-2.5 px-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-[11px]">
                      {historyData.jobCards
                        .filter((jc: any) => jc.status === 'completed')
                        .map((jc: any) => {
                          const partsSummary = (jc.items && jc.items.length > 0)
                            ? jc.items.map((it: any) => `${it.item_name} ×${it.quantity || 1}`).join(', ')
                            : 'Standard Service';
                          const invNum = jc.invoice_number || (jc.id ? `INV-${jc.id.slice(0, 6).toUpperCase()}` : 'INV-BILL');
                          return (
                            <tr key={jc.id} className="hover:bg-slate-900/50 transition">
                              <td className="py-2.5 px-3 font-mono text-[10px] text-slate-300">
                                {new Date(jc.billed_at || jc.created_at).toLocaleDateString()}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-[10px] font-bold text-amber-300">
                                {invNum}
                              </td>
                              <td className="py-2.5 px-3 text-[10px] font-mono text-slate-300">
                                {jc.bike_number || historyCustomer.bike_number}
                                <span className="text-slate-500 ml-1">({jc.odometer_km || 0} km)</span>
                              </td>
                              <td className="py-2.5 px-3 text-slate-300 max-w-[220px] truncate" title={`${partsSummary} | Labour: ₹${jc.labour_charge || 0}`}>
                                {partsSummary} <span className="text-slate-500">(Lab: ₹{jc.labour_charge || 0})</span>
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-100">
                                ₹{jc.total_bill || 0}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-blue-400">
                                {jc.advance_paid > 0 ? `₹${jc.advance_paid}` : '-'}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-emerald-400">
                                {jc.cash_collected > 0 ? `₹${jc.cash_collected}` : (jc.mandatory_cash_to_collect > 0 ? `₹${jc.mandatory_cash_to_collect}` : '-')}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-cyan-400">
                                {jc.upi_collected > 0 ? `₹${jc.upi_collected}` : '-'}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-400">
                                {jc.transferred_to_khata > 0 ? `₹${jc.transferred_to_khata}` : '-'}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (onOpenInvoiceModal) {
                                      onOpenInvoiceModal(jc);
                                    } else {
                                      setViewInvoiceCard(jc);
                                    }
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold flex items-center gap-1 mx-auto transition"
                                  title="View and download printable PDF invoice"
                                >
                                  <FileText className="w-3 h-3 text-amber-400" />
                                  <span>📄 PDF</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 💰 PAYMENT & SETTLEMENT HISTORY (AUDIT DOSSIER) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                  <span>💰 Payment &amp; Settlement History (Audit Dossier)</span>
                </h4>
                <span className="text-[10px] text-slate-400 font-mono">
                  {historyData?.ledgerEntries?.length || 0} Transactions
                </span>
              </div>

              {loadingHistory ? (
                <div className="py-4 text-center text-xs text-slate-400 bg-slate-950 rounded-xl border border-slate-800">
                  Loading payment history...
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/90 text-slate-400 text-[10px] uppercase font-semibold border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3">Date &amp; CCTV Time</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3">JC / Invoice #</th>
                        <th className="py-2.5 px-3">Ref / UTR</th>
                        <th className="py-2.5 px-3 text-right">Amount</th>
                        <th className="py-2.5 px-3 text-right">Balance After</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-[11px]">
                      {(!historyData?.ledgerEntries || historyData.ledgerEntries.length === 0) && (
                        <tr>
                          <td colSpan={6} className="py-4 text-center text-xs text-slate-500">
                            No payment or credit ledger records logged yet.
                          </td>
                        </tr>
                      )}
                      {(historyData?.ledgerEntries || []).map((entry: CreditLedgerEntry) => {
                        const isCredit = entry.transaction_type === 'udhaar_incurred';
                        return (
                          <tr key={entry.id} className="hover:bg-slate-900/40 transition">
                            <td className="py-2 px-3 font-mono text-[10px] text-slate-300 whitespace-nowrap">
                              {formatCCTVTimestamp(entry.created_at)}
                            </td>
                            <td className="py-2 px-3 whitespace-nowrap">
                              {entry.transaction_type === 'cash_paid' && (
                                <span className="inline-flex items-center gap-1 font-bold text-emerald-400 bg-emerald-950/70 border border-emerald-800/80 px-2 py-0.5 rounded text-[10px]">
                                  🟢 Cash Paid
                                </span>
                              )}
                              {entry.transaction_type === 'upi_received' && (
                                <span className="inline-flex items-center gap-1 font-bold text-cyan-400 bg-cyan-950/70 border border-cyan-800/80 px-2 py-0.5 rounded text-[10px]">
                                  🟢 UPI Received
                                </span>
                              )}
                              {entry.transaction_type === 'udhaar_incurred' && (
                                <span className="inline-flex items-center gap-1 font-bold text-rose-400 bg-rose-950/70 border border-rose-800/80 px-2 py-0.5 rounded text-[10px]">
                                  🔴 Udhaar Incurred
                                </span>
                              )}
                              {entry.transaction_type === 'udhaar_cleared' && (
                                <span className="inline-flex items-center gap-1 font-bold text-emerald-300 bg-emerald-950/70 border border-emerald-800/80 px-2 py-0.5 rounded text-[10px]">
                                  🟢 Udhaar Cleared
                                </span>
                              )}
                              {!['cash_paid', 'upi_received', 'udhaar_incurred', 'udhaar_cleared'].includes(entry.transaction_type) && (
                                <span className="inline-flex items-center gap-1 font-bold text-slate-300 bg-slate-850 px-2 py-0.5 rounded text-[10px] capitalize">
                                  {entry.transaction_type}
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 font-mono text-[10px] text-amber-300/90 whitespace-nowrap">
                              {entry.invoice_number || (entry.job_card_id ? entry.job_card_id.slice(0, 8).toUpperCase() : 'DIRECT')}
                            </td>
                            <td className="py-2 px-3 text-slate-400 font-mono text-[10px] truncate max-w-[120px]">
                              {entry.reference_no || entry.notes || 'N/A'}
                            </td>
                            <td className={`py-2 px-3 text-right font-mono font-bold whitespace-nowrap ${
                              isCredit ? 'text-rose-400' : 'text-emerald-400'
                            }`}>
                              ₹{Number(entry.amount || 0)}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-slate-200 whitespace-nowrap">
                              ₹{Number(entry.balance_after != null ? entry.balance_after : 0)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Service Timeline */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Workshop Job Cards Timeline
              </h4>

              {loadingHistory ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  Loading 360° service history...
                </div>
              ) : !historyData?.jobCards || historyData.jobCards.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500 bg-slate-950/60 rounded-2xl border border-slate-800">
                  No workshop job cards recorded for this customer yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {historyData.jobCards.map((jc: any) => (
                    <div
                      key={jc.id}
                      className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 text-xs space-y-2.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-200">
                            Visit: {new Date(jc.billed_at || jc.created_at).toLocaleDateString()}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            jc.status === 'completed'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}>
                            {jc.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400">
                          <span>Odometer: <strong className="text-amber-300">{jc.odometer_km || 0} KM</strong></span>
                          <span>•</span>
                          <span>Mech: {jc.mechanic?.full_name || 'Assigned'}</span>
                          {jc.status === 'completed' && (
                            <button
                              type="button"
                              onClick={() => {
                                if (onOpenInvoiceModal) {
                                  onOpenInvoiceModal(jc);
                                } else {
                                  setViewInvoiceCard(jc);
                                }
                              }}
                              className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold flex items-center gap-1.5 transition ml-2"
                              title="View and download printable PDF invoice"
                            >
                              <FileText className="w-3.5 h-3.5 text-amber-400" />
                              <span>📄 PDF Invoice</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Items table */}
                      {jc.items && jc.items.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-[10px] text-slate-400 font-semibold uppercase block">
                            Parts Replaced &amp; Services:
                          </span>
                          <div className="space-y-1">
                            {jc.items.map((it: any) => (
                              <div
                                key={it.id}
                                className="flex items-center justify-between text-[11px] bg-slate-900/60 px-2.5 py-1.5 rounded-lg border border-slate-800/60"
                              >
                                <span>
                                  {it.item_name} × {it.quantity || 1}
                                  {it.warranty_months > 0 && (
                                    <span className="ml-1.5 text-[9px] text-emerald-400 font-bold bg-emerald-950 px-1 py-0.2 rounded border border-emerald-800">
                                      {it.warranty_months}M Warranty
                                    </span>
                                  )}
                                </span>
                                <span className="font-mono font-bold text-amber-300">
                                  ₹{(it.unit_price || 0) * (it.quantity || 1)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Outside Work */}
                      {jc.outside_work_desc && (
                        <div className="text-[11px] text-slate-300 bg-slate-900/80 p-2 rounded-lg border border-slate-800 flex justify-between">
                          <span>Outside Lathe/Welding: {jc.outside_work_desc}</span>
                          <span className="font-mono font-bold text-amber-400">₹{jc.outside_work_customer_price || 0}</span>
                        </div>
                      )}

                      {/* Financials footer */}
                      <div className="flex flex-wrap items-center justify-between pt-1 border-t border-slate-800 text-[11px] font-mono">
                        <span className="text-slate-400">
                          Labour: ₹{jc.labour_charge || 0} • Consumables: ₹{jc.consumable_charge || 20}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-300 font-bold">Total Bill:</span>
                          <span className="text-amber-400 font-bold text-sm">₹{jc.total_bill || 0}</span>
                          {jc.transferred_to_khata > 0 && (
                            <span className="text-rose-400 font-bold">
                              (Khata: ₹{jc.transferred_to_khata})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => {
                  setHistoryCustomer(null);
                  setHistoryData(null);
                  loadCustomers();
                }}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition"
              >
                Close Customer Sheet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice PDF Modal for Direct Khata View Previews */}
      <InvoicePdfModal
        isOpen={!!viewInvoiceCard}
        jobCard={viewInvoiceCard}
        shop={currentShop}
        onClose={() => setViewInvoiceCard(null)}
      />

      {/* 📢 ALL-CUSTOMER BROADCAST & FESTIVAL PROMO ENGINE MODAL */}
      {showBroadcastModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 max-w-4xl w-full max-h-[92vh] overflow-y-auto shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-amber-400" />
                <span>Workshop Broadcast &amp; Festival Offer Center</span>
              </h3>
              <button
                onClick={() => setShowBroadcastModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <CustomerBroadcastView
              currentShop={currentShop}
              customers={customers}
              followupJobCards={followupJobCards}
              onRefresh={loadCustomers}
              onUpdateFollowupStatus={async (id, st) => {
                await supabaseService.updateFollowupStatus(id, st);
                await loadCustomers();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
