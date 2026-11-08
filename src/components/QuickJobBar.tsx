import React, { useState, useEffect } from 'react';
import { User, Shop, QuickJob } from '../types/supabase';
import { supabaseService, formatCCTVTimestamp, generateUpiPayload } from '../utils/supabaseService';
import { notify } from './NotificationModal';
import QRCode from 'qrcode';
import {
  Zap,
  Wind,
  Wrench,
  Droplets,
  Plus,
  QrCode,
  Banknote,
  AlertTriangle,
  History,
  X,
  CheckCircle2,
  Minus,
  Sparkles,
  Settings,
  Trash2,
  Edit2,
  Save,
} from 'lucide-react';

interface QuickJobBarProps {
  currentUser: User;
  currentShop: Shop;
  onJobRecorded: () => void;
  isOnDuty?: boolean;
}

export interface QuickServiceDef {
  id: string;
  name: string;
  defaultPrice: number;
}

const DEFAULT_SERVICES: QuickServiceDef[] = [
  { id: 'air', name: 'Air Check (Both Tyres)', defaultPrice: 10 },
  { id: 'chain', name: 'Chain Tight / Lube', defaultPrice: 30 },
  { id: 'puncture', name: 'Puncture Repair', defaultPrice: 50 },
  { id: 'wash', name: 'Quick Foam Wash', defaultPrice: 100 },
];

export const getQuickServiceIcon = (name: string) => {
  const n = name.toLowerCase();
  if (n.includes('air') || n.includes('nitrogen') || n.includes('tyre') || n.includes('tire')) return Wind;
  if (n.includes('wash') || n.includes('foam') || n.includes('clean')) return Droplets;
  if (n.includes('chain') || n.includes('puncture') || n.includes('brake') || n.includes('clutch') || n.includes('oil')) return Wrench;
  return Zap;
};

export const QuickJobBar: React.FC<QuickJobBarProps> = ({
  currentUser,
  currentShop,
  onJobRecorded,
  isOnDuty = true,
}) => {
  const isOwner = currentUser.role === 'owner' || currentUser.phone === '9999999999';

  // Dynamic quick services loaded from local storage for this shop
  const [services, setServices] = useState<QuickServiceDef[]>(() => {
    try {
      const saved = localStorage.getItem(`bikeready_quick_services_${currentShop.id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_SERVICES;
  });

  const saveServices = (newServices: QuickServiceDef[]) => {
    setServices(newServices);
    try {
      localStorage.setItem(`bikeready_quick_services_${currentShop.id}`, JSON.stringify(newServices));
    } catch {}
  };

  // Manage Services Modal (Owner Only)
  const [showManageServicesModal, setShowManageServicesModal] = useState(false);
  const [newServiceName, setNewServiceName] = useState('');
  const [newServicePrice, setNewServicePrice] = useState<number | ''>(50);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [editingPriceVal, setEditingPriceVal] = useState<number | ''>('');

  const [selectedService, setSelectedService] = useState<QuickServiceDef | null>(null);
  const [customServiceName, setCustomServiceName] = useState('');
  const [quickBikeNote, setQuickBikeNote] = useState('');
  const [price, setPrice] = useState<number>(10);
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [paymentMode, setPaymentMode] = useState<'cash' | 'upi'>('cash');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditLogs, setAuditLogs] = useState<QuickJob[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  const isLocked = !isOwner && !isOnDuty;

  // When selected service changes, reset price
  const handleSelectService = (srv: QuickServiceDef) => {
    if (isLocked) {
      notify.alert("🔒 Punch In for Today's Duty to start working.", "Duty Attendance Required", "error");
      return;
    }
    setSelectedService(srv);
    setIsCustomMode(false);
    setPrice(srv.defaultPrice);
    setPaymentMode('cash');
    setQuickBikeNote('');
    setSuccessMsg('');
  };

  const handleOpenCustom = () => {
    if (isLocked) {
      notify.alert("🔒 Punch In for Today's Duty to start working.", "Duty Attendance Required", "error");
      return;
    }
    setSelectedService(null);
    setIsCustomMode(true);
    setCustomServiceName('');
    setPrice(50);
    setPaymentMode('cash');
    setQuickBikeNote('');
    setSuccessMsg('');
  };

  // Generate QR code whenever price or payment mode changes
  useEffect(() => {
    if (paymentMode === 'upi' && (selectedService || isCustomMode) && price > 0) {
      const upiPayload = generateUpiPayload(
        currentShop.upi_id,
        currentShop.shop_name,
        price,
        selectedService?.name || customServiceName || 'Express Service'
      );
      QRCode.toDataURL(upiPayload, { width: 220, margin: 1 })
        .then(setQrDataUrl)
        .catch(console.error);
    } else {
      setQrDataUrl('');
    }
  }, [paymentMode, price, selectedService, isCustomMode, currentShop, customServiceName]);

  const handleAdjustPrice = (delta: number) => {
    setPrice((prev) => Math.max(10, prev + delta));
  };

  const handleCompleteQuickJob = async () => {
    const rawName = isCustomMode
      ? customServiceName.trim() || 'Express Service'
      : selectedService?.name || 'Quick Service';
    const sName = quickBikeNote.trim() ? `${rawName} (${quickBikeNote.trim()})` : rawName;
    const defPrice = isCustomMode ? price : (selectedService?.defaultPrice || price);

    setIsSubmitting(true);
    try {
      const res = await supabaseService.recordQuickJob(
        currentShop.id,
        currentUser.id,
        currentUser.full_name,
        sName,
        defPrice,
        price,
        paymentMode
      );

      if (res) {
        setSuccessMsg(`₹${price} recorded via ${paymentMode.toUpperCase()}!`);
        onJobRecorded();
        setTimeout(() => {
          setSelectedService(null);
          setIsCustomMode(false);
          setQuickBikeNote('');
          setSuccessMsg('');
        }, 1400);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateServicePreset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newServiceName.trim()) return;
    const finalPrice = Number(newServicePrice) || 50;
    const newService: QuickServiceDef = {
      id: `srv_${Date.now()}`,
      name: newServiceName.trim(),
      defaultPrice: finalPrice,
    };
    const updated = [...services, newService];
    saveServices(updated);
    setNewServiceName('');
    setNewServicePrice(50);
    notify.success(`Quick service "${newService.name}" created at ₹${finalPrice}!`);
  };

  const handleUpdatePresetPrice = (id: string, priceVal: number) => {
    if (priceVal <= 0) return;
    const updated = services.map((s) => (s.id === id ? { ...s, defaultPrice: priceVal } : s));
    saveServices(updated);
    setEditingServiceId(null);
    notify.success('Service price updated!');
  };

  const handleDeleteServicePreset = async (id: string, name: string) => {
    const ok = await notify.confirm(
      `Delete Quick Service "${name}"? It will no longer appear on the 1-tap service bar.`
    );
    if (!ok) return;
    const updated = services.filter((s) => s.id !== id);
    saveServices(updated);
    if (selectedService?.id === id) {
      setSelectedService(null);
    }
    notify.success(`Deleted quick service "${name}".`);
  };

  const handleDeleteRecordedQuickJob = async (jobId: string, serviceName: string) => {
    const ok = await notify.confirm(
      `Delete & reverse Quick Service "${serviceName}"? This will reverse the money from today's Galla tally.`
    );
    if (!ok) return;
    const success = await supabaseService.deleteQuickJob(jobId);
    if (success) {
      setAuditLogs((prev) => prev.filter((item) => item.id !== jobId));
      onJobRecorded();
      notify.success('Quick job deleted & reversed from ledger!');
    } else {
      notify.error('Failed to delete quick job.');
    }
  };

  const handleOpenAudit = async () => {
    setShowAuditModal(true);
    setLoadingAudit(true);
    try {
      const logs = await supabaseService.getQuickJobs(currentShop.id);
      setAuditLogs(logs);
    } finally {
      setLoadingAudit(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
              Quick Job / Express Cash ({services.length} Services)
            </h3>
            <p className="text-[11px] text-slate-400">
              No ₹20 consumable fee. Instant cash/UPI with audit tracking.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {isOwner && (
            <button
              onClick={() => setShowManageServicesModal(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold border border-amber-500/40 transition"
              title="Owner: Add, set price, or delete Quick Job options"
            >
              <Settings className="w-3.5 h-3.5 text-amber-400" />
              <span>⚙️ Manage Services</span>
            </button>
          )}

          {(isOwner || (currentUser.role === 'manager' && !currentUser.is_temp_manager)) && (
            <button
              onClick={handleOpenAudit}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition"
            >
              <History className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Anti-Misuse</span> Audit
            </button>
          )}
        </div>
      </div>

      {isLocked && (
        <div className="p-3 mb-2.5 rounded-xl bg-rose-950/80 border border-rose-600/80 text-rose-200 text-xs font-bold flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping shrink-0" />
          <span>🔒 Punch In for Today's Duty to start working. Quick Job express billing is locked.</span>
        </div>
      )}

      {/* 1-Tap Service Chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
        {services.map((srv) => {
          const IconComp = getQuickServiceIcon(srv.name);
          const isSelected = selectedService?.id === srv.id;
          return (
            <button
              key={srv.id}
              onClick={() => handleSelectService(srv)}
              className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between min-h-[58px] relative group ${
                isSelected
                  ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold shadow-md shadow-amber-500/20'
                  : 'bg-slate-950 hover:bg-slate-800/80 border-slate-800 text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <IconComp className={`w-4 h-4 ${isSelected ? 'text-slate-950' : 'text-amber-400'}`} />
                <span className={`text-xs font-mono font-bold ${isSelected ? 'text-slate-950' : 'text-amber-400'}`}>
                  ₹{srv.defaultPrice}
                </span>
              </div>
              <span className="text-xs font-semibold truncate mt-1">
                {srv.name}
              </span>
            </button>
          );
        })}

        <button
          onClick={handleOpenCustom}
          className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between min-h-[58px] ${
            isCustomMode
              ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold shadow-md shadow-amber-500/20'
              : 'bg-slate-950 hover:bg-slate-800/80 border-dashed border-slate-700 text-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <Plus className={`w-4 h-4 ${isCustomMode ? 'text-slate-950' : 'text-slate-400'}`} />
            <span className="text-[10px] uppercase font-bold text-slate-400">Flex</span>
          </div>
          <span className="text-xs font-semibold truncate mt-1">+ Custom Job</span>
        </button>
      </div>

      {/* Selected Action Panel / Modifiers */}
      {(selectedService || isCustomMode) && (
        <div className="mt-3 p-3.5 rounded-xl bg-slate-950 border border-slate-700/80 animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-amber-400">
                {isCustomMode ? 'Custom Express Service' : selectedService?.name}
              </span>
              {!isCustomMode && price !== selectedService?.defaultPrice && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-700 font-bold">
                  Price Modified (Audited)
                </span>
              )}
            </div>
            <button
              onClick={() => {
                setSelectedService(null);
                setIsCustomMode(false);
              }}
              className="text-slate-400 hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {isCustomMode && (
            <div className="mb-3">
              <input
                type="text"
                placeholder="Service name (e.g., Clutch adjustment, Mirror fit)"
                value={customServiceName}
                onChange={(e) => setCustomServiceName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-500"
              />
            </div>
          )}

          <div className="mb-3">
            <input
              type="text"
              placeholder="Optional Bike Number / Note (e.g. MH 12 AB 1234)"
              value={quickBikeNote}
              onChange={(e) => setQuickBikeNote(e.target.value.toUpperCase())}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-slate-100 placeholder:font-sans placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Quick Price Adjuster Buttons */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="text-xs text-slate-400 font-medium">Price Modifiers:</span>
            <button
              onClick={() => handleAdjustPrice(-10)}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-bold border border-slate-700"
            >
              -10
            </button>
            <button
              onClick={() => handleAdjustPrice(10)}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-bold border border-slate-700"
            >
              +10
            </button>
            <button
              onClick={() => handleAdjustPrice(20)}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-bold border border-slate-700"
            >
              +20
            </button>

            <div className="flex items-center gap-1 ml-auto">
              <span className="text-xs text-slate-400">Total:</span>
              <div className="relative">
                <span className="absolute left-2.5 top-1.5 text-xs text-amber-400 font-bold">₹</span>
                <input
                  type="number"
                  min="0"
                  step="5"
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  className="w-24 pl-6 pr-2 py-1 bg-slate-900 border border-amber-500/50 rounded-lg text-sm font-mono font-bold text-amber-300 text-right focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Payment Mode Selector */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <button
              onClick={() => setPaymentMode('cash')}
              className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition ${
                paymentMode === 'cash'
                  ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                  : 'bg-slate-900 text-slate-300 border-slate-800'
              }`}
            >
              <Banknote className="w-4 h-4" />
              Cash Collected
            </button>
            <button
              onClick={() => setPaymentMode('upi')}
              className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition ${
                paymentMode === 'upi'
                  ? 'bg-indigo-500 text-slate-100 border-indigo-400'
                  : 'bg-slate-900 text-slate-300 border-slate-800'
              }`}
            >
              <QrCode className="w-4 h-4" />
              UPI Dynamic QR
            </button>
          </div>

          {/* Dynamic UPI QR Code */}
          {paymentMode === 'upi' && qrDataUrl && (
            <div className="mb-3 p-3 bg-white rounded-xl flex flex-col items-center justify-center text-slate-900 shadow-inner">
              <img src={qrDataUrl} alt="UPI QR" className="w-36 h-36" />
              <p className="text-[11px] font-mono font-bold mt-1">
                Scan to Pay ₹{price} ({currentShop.upi_id})
              </p>
            </div>
          )}

          {/* Confirm Button */}
          {successMsg ? (
            <div className="p-2.5 bg-emerald-950 border border-emerald-700 text-emerald-300 rounded-xl text-xs font-bold text-center flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              {successMsg}
            </div>
          ) : (
            <button
              onClick={handleCompleteQuickJob}
              disabled={isSubmitting || price <= 0}
              className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-sm shadow-lg shadow-amber-500/20 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                'Recording...'
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Collect ₹{price} &amp; Complete Express Job
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Anti-Misuse Audit Modal */}
      {showAuditModal && (
        <div data-modal-open="true" className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">
                    Quick Jobs Anti-Misuse Audit Log
                  </h3>
                  <p className="text-xs text-slate-400">
                    Highlights price modifications in RED with worker name &amp; CCTV timestamp
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAuditModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1">
              {loadingAudit ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  Loading audit trails...
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No quick jobs recorded yet today.
                </div>
              ) : (
                <div className="space-y-2">
                  {auditLogs.map((log) => {
                    const isMod = log.is_price_modified;
                    return (
                      <div
                        key={log.id}
                        className={`p-3 rounded-xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                          isMod
                            ? 'bg-rose-950/40 border-rose-700/80 text-rose-200'
                            : 'bg-slate-950 border-slate-800 text-slate-300'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-100 text-sm">
                              {log.service_name}
                            </span>
                            {isMod && (
                              <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white font-mono font-bold text-[10px]">
                                MODIFIED (Default ₹{log.default_price})
                              </span>
                            )}
                            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px] uppercase">
                              {log.payment_mode}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-1 flex flex-wrap items-center gap-3">
                            <span>
                              Worker: <strong className="text-slate-200">{log.worker_name}</strong>
                            </span>
                            <span>CCTV Time: {formatCCTVTimestamp(log.created_at)}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 sm:self-center">
                          <div className="text-right font-mono font-bold text-base">
                            <span className={isMod ? 'text-rose-400 font-black' : 'text-emerald-400'}>
                              ₹{log.final_price}
                            </span>
                          </div>
                          {isOwner && (
                            <button
                              type="button"
                              onClick={() => handleDeleteRecordedQuickJob(log.id, log.service_name)}
                              className="px-2.5 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-[11px] font-bold transition flex items-center gap-1 shrink-0"
                              title="Delete & reverse quick job from drawer and ledger"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                              <span>Delete</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-3 border-t border-slate-800 bg-slate-950 text-right">
              <button
                onClick={() => setShowAuditModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
              >
                Close Audit Log
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Owner: Manage Quick Services Modal */}
      {showManageServicesModal && (
        <div data-modal-open="true" className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden max-h-[88vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                  <Settings className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                    Manage Quick Job Services
                  </h3>
                  <p className="text-xs text-slate-400">
                    Create new quick services, set prices, and delete unwanted options
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowManageServicesModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-5 flex-1">
              {/* Form: Add New Quick Service */}
              <form onSubmit={handleCreateServicePreset} className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> + Create New Quick Service
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Service Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Nitrogen Air, Spark Plug Clean, Bulb"
                      value={newServiceName}
                      onChange={(e) => setNewServiceName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Price (₹) *
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      step="5"
                      value={newServicePrice}
                      onChange={(e) => setNewServicePrice(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono font-bold text-amber-300 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs shadow-md transition flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add to Service Bar
                  </button>
                </div>
              </form>

              {/* Active Services List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Active Services ({services.length})
                  </h4>
                  <span className="text-[10px] text-slate-500">
                    Changes reflect immediately on the workbench
                  </span>
                </div>

                <div className="space-y-2">
                  {services.map((srv) => {
                    const IconComp = getQuickServiceIcon(srv.name);
                    const isEditing = editingServiceId === srv.id;

                    return (
                      <div
                        key={srv.id}
                        className="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between gap-3 text-xs hover:border-slate-700 transition"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
                            <IconComp className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-slate-200 block truncate">
                              {srv.name}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              ID: {srv.id}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {isEditing ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-amber-400">₹</span>
                              <input
                                type="number"
                                min="1"
                                step="5"
                                value={editingPriceVal}
                                onChange={(e) => setEditingPriceVal(e.target.value === '' ? '' : Number(e.target.value))}
                                className="w-20 px-2 py-1 bg-slate-900 border border-amber-500 rounded-lg text-xs font-mono font-bold text-amber-300 text-right"
                              />
                              <button
                                type="button"
                                onClick={() => handleUpdatePresetPrice(srv.id, Number(editingPriceVal))}
                                className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 text-xs font-bold"
                                title="Save new price"
                              >
                                <Save className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingServiceId(null)}
                                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-200 text-xs"
                                title="Cancel"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-700 text-amber-300 font-mono font-bold text-xs">
                                ₹{srv.defaultPrice}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingServiceId(srv.id);
                                  setEditingPriceVal(srv.defaultPrice);
                                }}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700 transition"
                                title="Edit default price"
                              >
                                <Edit2 className="w-3.5 h-3.5 text-amber-400" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteServicePreset(srv.id, srv.name)}
                                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs transition"
                                title="Delete this quick service"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                Tip: You can set any price for these services when billing.
              </span>
              <button
                type="button"
                onClick={() => setShowManageServicesModal(false)}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
