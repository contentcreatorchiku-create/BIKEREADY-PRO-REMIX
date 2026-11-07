import React, { useState, useEffect, useRef } from 'react';
import { User, Shop, JobCard, InventoryItem, Customer, StaffAttendance } from '../types/supabase';
import { supabaseService, formatCCTVTimestamp, generateWhatsAppLink } from '../utils/supabaseService';
import { notify } from './NotificationModal';
import { QuickJobBar } from './QuickJobBar';
import {
  Wrench,
  Search,
  Plus,
  Mic,
  MicOff,
  Lock,
  History,
  CheckCircle2,
  Clock,
  Sparkles,
  Package,
  AlertCircle,
  FileText,
  ChevronRight,
  ShieldAlert,
  Send,
  Printer,
  CheckCircle,
  Trash2,
  Edit2,
  AlertTriangle,
  X,
  Edit,
  Check,
  Bell,
} from 'lucide-react';

interface MechanicDashboardProps {
  currentUser: User;
  currentShop: Shop;
  onRefreshData: () => void;
  onOpenInvoiceModal?: (jobCard: JobCard) => void;
}

export const MechanicDashboard: React.FC<MechanicDashboardProps> = ({
  currentUser,
  currentShop,
  onRefreshData,
  onOpenInvoiceModal,
}) => {
  const [activeTab, setActiveTab] = useState<'cards' | 'new_card'>(() => {
    try {
      const saved = localStorage.getItem('bikeready_mech_active_tab');
      if (saved === 'cards' || saved === 'new_card') return saved;
      return 'cards';
    } catch {
      return 'cards';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('bikeready_mech_active_tab', activeTab);
    } catch {}
  }, [activeTab]);

  const [cardFilter, setCardFilter] = useState<'pending' | 'drafts' | 'completed'>(() => {
    try {
      const saved = localStorage.getItem('bikeready_mech_card_filter');
      if (saved === 'pending' || saved === 'drafts' || saved === 'completed') return saved;
      return 'drafts';
    } catch {
      return 'drafts';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('bikeready_mech_card_filter', cardFilter);
    } catch {}
  }, [cardFilter]);

  const [todayAttendance, setTodayAttendance] = useState<StaffAttendance | null>(null);
  const [jobCards, setJobCards] = useState<JobCard[]>([]);
  const [selectedCard, setSelectedCard] = useState<JobCard | null>(null);
  const [loading, setLoading] = useState(false);
  const isInitialLoad = useRef(true);

  // New Job Card Intake State with full DMS specs
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [bikeNumber, setBikeNumber] = useState('');
  const [bikeModel, setBikeModel] = useState('');
  const [fuelLevel, setFuelLevel] = useState<'Empty' | '25%' | '50%' | '75%' | 'Full'>('50%');
  const [odometerKm, setOdometerKm] = useState<number | ''>('');
  const [advancePaid, setAdvancePaid] = useState<number | ''>('');
  const [estimatedCost, setEstimatedCost] = useState<number | ''>('');
  const [selectedQuickChips, setSelectedQuickChips] = useState<string[]>([]);
  const [customerComplaints, setCustomerComplaints] = useState('');
  const [mechanicNotes, setMechanicNotes] = useState('');
  const [historyCards, setHistoryCards] = useState<JobCard[]>([]);
  const [searchingHistory, setSearchingHistory] = useState(false);
  const [creatingCard, setCreatingCard] = useState(false);

  // In-Place Item Price Editing
  const [editingItemPriceId, setEditingItemPriceId] = useState<string | null>(null);
  const [editingItemPriceVal, setEditingItemPriceVal] = useState<number>(0);

  // Edit Complaints / Notes Modal
  const [showEditComplaintsModal, setShowEditComplaintsModal] = useState(false);
  const [editCardComplaints, setEditCardComplaints] = useState('');
  const [editCardMechNotes, setEditCardMechNotes] = useState('');
  const [isSavingComplaints, setIsSavingComplaints] = useState(false);

  // Inventory & Part Adding
  const [searchQuery, setSearchQuery] = useState('');
  const [invPage, setInvPage] = useState(1);
  const [invItems, setInvItems] = useState<InventoryItem[]>([]);
  const [invTotal, setInvTotal] = useState(0);
  const [loadingInv, setLoadingInv] = useState(false);

  // Manual Item
  const [manualName, setManualName] = useState('');
  const [manualPrice, setManualPrice] = useState<number | ''>('');
  const [manualQty, setManualQty] = useState<number>(1);
  const [showManualForm, setShowManualForm] = useState(false);

  // Voice Typing
  const [isListening, setIsListening] = useState(false);
  const [activeVoiceField, setActiveVoiceField] = useState<'search' | 'bike' | 'name' | 'complaints' | null>(null);
  const recognitionRef = useRef<any>(null);

  const isTempMgr =
    currentUser.is_temp_manager &&
    currentUser.temp_manager_expires_at &&
    new Date(currentUser.temp_manager_expires_at).getTime() > Date.now();

  // Load Job Cards
  const loadJobCards = async (showSpinner = false) => {
    if (showSpinner || isInitialLoad.current) {
      setLoading(true);
    }
    try {
      const cards = await supabaseService.getJobCards(currentShop.id);
      setJobCards(cards);
      // Keep selected card fresh
      if (selectedCard) {
        const fresh = cards.find((c) => c.id === selectedCard.id);
        if (fresh) setSelectedCard(fresh);
      }
    } finally {
      if (showSpinner || isInitialLoad.current) {
        setLoading(false);
        isInitialLoad.current = false;
      }
    }
  };

  useEffect(() => {
    loadJobCards();
    supabaseService.getTodayAttendance(currentShop.id, currentUser.id).then(setTodayAttendance);

    // Auto-poll every 5 seconds for newly allotted job cards from Owner/Manager
    const pollTimer = setInterval(() => {
      loadJobCards(false);
    }, 5000);

    return () => clearInterval(pollTimer);
  }, [currentShop.id, currentUser.id]);

  const handlePunchIn = async () => {
    const att = await supabaseService.punchIn(
      currentShop.id,
      currentUser.id,
      currentUser.full_name,
      currentUser.role
    );
    setTodayAttendance(att);
    onRefreshData();
  };

  const handlePunchOut = async () => {
    if (todayAttendance) {
      await supabaseService.punchOut(todayAttendance.id);
      const fresh = await supabaseService.getTodayAttendance(currentShop.id, currentUser.id);
      setTodayAttendance(fresh);
      onRefreshData();
    }
  };

  // Load Paginated Inventory (20 items/page)
  const loadInventory = async (page: number, search: string) => {
    setLoadingInv(true);
    try {
      const res = await supabaseService.getInventory(currentShop.id, page, 20, search);
      setInvItems(res.items);
      setInvTotal(res.totalCount);
    } finally {
      setLoadingInv(false);
    }
  };

  useEffect(() => {
    if (selectedCard && !selectedCard.is_locked_for_mechanic) {
      loadInventory(invPage, searchQuery);
    }
  }, [selectedCard?.id, invPage, searchQuery]);

  // Voice typing initialization via Web Speech API
  const startVoiceFor = (field: 'search' | 'bike' | 'name' | 'complaints') => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      notify.alert('Voice speech typing is not supported on this browser. Please type manually.', 'Speech Input', 'info');
      return;
    }
    if (isListening && activeVoiceField === field) {
      try {
        recognitionRef.current?.stop();
      } catch {}
      setIsListening(false);
      setActiveVoiceField(null);
      return;
    }
    try {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'hi-IN';
      rec.onresult = (e: any) => {
        const transcript = e.results[0][0]?.transcript || '';
        if (field === 'search') {
          setSearchQuery(transcript);
          setInvPage(1);
        } else if (field === 'bike') {
          handleBikeNumberChange(transcript.toUpperCase().replace(/\s+/g, ''));
        } else if (field === 'name') {
          setCustomerName(transcript);
        } else if (field === 'complaints') {
          setCustomerComplaints((prev) => (prev ? `${prev}\n• ${transcript}` : `• ${transcript}`));
        }
        setIsListening(false);
        setActiveVoiceField(null);
      };
      rec.onerror = () => {
        setIsListening(false);
        setActiveVoiceField(null);
      };
      rec.onend = () => {
        setIsListening(false);
        setActiveVoiceField(null);
      };
      recognitionRef.current = rec;
      rec.start();
      setIsListening(true);
      setActiveVoiceField(field);
    } catch {
      setIsListening(false);
      setActiveVoiceField(null);
    }
  };

  const toggleVoiceListening = () => {
    startVoiceFor('search');
  };

  // Instant Past Service History Lookup on Bike Number change (Strict 9+ char + 4-digit exact match)
  const handleBikeNumberChange = async (val: string) => {
    const upper = val.toUpperCase();
    setBikeNumber(upper);
    const clean = upper.replace(/[^A-Z0-9]/gi, '');

    // Auto-fill ONLY when complete vehicle registration (at least 9 chars and ending with 4 digits)
    if (clean.length >= 9 && /[0-9]{4}$/.test(clean)) {
      setSearchingHistory(true);
      try {
        const hist = await supabaseService.getVehiclePastHistory(currentShop.id, upper);
        const exactMatches = (hist || []).filter((h) => {
          const hClean = (h.bike_number || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
          return hClean === clean;
        });

        if (exactMatches.length > 0) {
          setHistoryCards(exactMatches);
          const top = exactMatches[0];
          if (top.bike_model) setBikeModel(top.bike_model);
          if (top.customer?.customer_name) setCustomerName(top.customer.customer_name);
          if (top.customer?.phone) setCustomerPhone(top.customer.phone);
          if (top.customer?.address) setCustomerAddress(top.customer.address);
        } else {
          setHistoryCards([]);
        }
      } finally {
        setSearchingHistory(false);
      }
    } else {
      setHistoryCards([]);
    }
  };

  // Create New Draft Card with full DMS specs
  const handleCreateDraftCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bikeNumber.trim()) {
      notify.alert('Bike Number is required.', 'Input Required', 'error');
      return;
    }

    setCreatingCard(true);
    try {
      const combinedComplaints = [
        ...selectedQuickChips,
        customerComplaints.trim(),
      ].filter(Boolean).join('\n• ');
      const finalComplaints = combinedComplaints
        ? combinedComplaints.startsWith('• ')
          ? combinedComplaints
          : '• ' + combinedComplaints
        : undefined;

      const card = await supabaseService.createDraftJobCard(
        currentShop.id,
        currentUser.id,
        customerName,
        customerPhone,
        bikeNumber,
        Number(odometerKm) || 0,
        {
          bikeModel: bikeModel.trim() || undefined,
          fuelLevel,
          advancePaid: Number(advancePaid) || 0,
          estimatedCost: Number(estimatedCost) || 0,
          customerComplaints: finalComplaints,
          mechanicNotes: mechanicNotes.trim() || undefined,
          customerAddress: customerAddress.trim() || undefined,
        }
      );

      if (card) {
        setCustomerName('');
        setCustomerPhone('');
        setCustomerAddress('');
        setBikeNumber('');
        setBikeModel('');
        setFuelLevel('50%');
        setOdometerKm('');
        setAdvancePaid('');
        setEstimatedCost('');
        setSelectedQuickChips([]);
        setCustomerComplaints('');
        setMechanicNotes('');
        setHistoryCards([]);
        await loadJobCards();
        setSelectedCard(card);
        setActiveTab('cards');
      }
    } finally {
      setCreatingCard(false);
    }
  };

  // Unit Price Editing for items on this card
  const handleUpdateItemUnitPrice = async (itemId: string, newPrice: number) => {
    if (!selectedCard) return;
    await supabaseService.updateJobCardItemPrice(itemId, newPrice, selectedCard.id);
    setEditingItemPriceId(null);
    await loadJobCards();
    const fresh = await supabaseService.getJobCardById(selectedCard.id);
    if (fresh) setSelectedCard(fresh);
  };

  // Delete item from job card
  const handleDeleteCardItem = async (itemId: string, itemName: string) => {
    if (!selectedCard) return;
    const ok = await notify.confirm(`Remove "${itemName}" from this job card?`, 'Remove Item');
    if (!ok) return;
    await supabaseService.deleteJobCardItem(itemId, selectedCard.id);
    await loadJobCards();
    const fresh = await supabaseService.getJobCardById(selectedCard.id);
    if (fresh) setSelectedCard(fresh);
  };

  // Cancel / Delete Entire Draft Job Card
  const handleDeleteSelectedJobCard = async () => {
    if (!selectedCard) return;
    const ok = await notify.confirm(
      `Permanently cancel and delete Job Card ${selectedCard.bike_number}? This will return all parts to stock and free the card.`,
      'Cancel Job Card'
    );
    if (!ok) return;

    const success = await supabaseService.deleteJobCard(selectedCard.id);
    if (success) {
      setSelectedCard(null);
      await loadJobCards();
      notify.success('Job Card cancelled and deleted.');
    }
  };

  // Save Edit Complaints & Notes Modal
  const handleSaveComplaintsAndNotes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCard) return;
    setIsSavingComplaints(true);
    try {
      const ok = await supabaseService.updateJobCardComplaints(
        selectedCard.id,
        editCardComplaints,
        editCardMechNotes
      );
      if (ok) {
        notify.success('Complaints & Notes updated successfully!');
        setShowEditComplaintsModal(false);
        await loadJobCards();
        const fresh = await supabaseService.getJobCardById(selectedCard.id);
        if (fresh) setSelectedCard(fresh);
      } else {
        notify.error('Failed to update complaints and notes.');
      }
    } finally {
      setIsSavingComplaints(false);
    }
  };

  // 1-Tap Quick Part Add (e.g. ₹5 Bolt, ₹10 Washer)
  const handleQuickAddPart = async (name: string, price: number) => {
    if (!selectedCard || selectedCard.is_locked_for_mechanic) return;
    await supabaseService.addPartToJobCard(currentShop.id, selectedCard.id, {
      itemName: name,
      unitPrice: price,
      isUnlisted: false,
      addedByName: currentUser.full_name,
      quantity: 1,
    });
    await loadJobCards();
  };

  // Add inventory part (increments quantity if already exists!)
  const handleAddInventoryPart = async (item: InventoryItem) => {
    if (!selectedCard || selectedCard.is_locked_for_mechanic) return;
    await supabaseService.addPartToJobCard(currentShop.id, selectedCard.id, {
      partId: item.id,
      itemName: item.part_name,
      unitPrice: item.unit_price,
      isUnlisted: false,
      addedByName: currentUser.full_name,
      quantity: 1,
    });
    await loadJobCards();
  };

  // Add Manual Item (Workers only enter part name & qty; price is hidden and set by Manager)
  const handleAddManualItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCard || !manualName.trim()) return;

    const isRestrictedWorker = !isTempMgr && currentUser.role === 'mechanic';
    const effectivePrice = isRestrictedWorker ? 0 : Number(manualPrice) || 0;

    await supabaseService.addPartToJobCard(currentShop.id, selectedCard.id, {
      itemName: manualName.trim(),
      unitPrice: effectivePrice,
      isUnlisted: true,
      pricePendingInspection: isRestrictedWorker,
      addedByName: currentUser.full_name,
      quantity: manualQty || 1,
    });

    setManualName('');
    setManualPrice('');
    setManualQty(1);
    setShowManualForm(false);
    await loadJobCards();
    notify.success(
      isRestrictedWorker
        ? `Added "${manualName.trim()}". Price will be inspected & set by Manager.`
        : `Added "${manualName.trim()}" to card.`
    );
  };

  // Submit & Send for Inspection
  const handleSubmitAndLock = async () => {
    if (!selectedCard) return;
    const confirmed = await notify.confirm(
      'काम पूरा हो गया? यह जॉब कार्ड चेकिंग (Inspection) और बिलिंग के लिए मैनेजर को भेजा जाएगा।\n\n(Mark work complete and send for inspection & billing?)',
      'काम पूरा — चेकिंग के लिए भेजें'
    );
    if (!confirmed) return;

    await supabaseService.setJobCardInspectionStatus(selectedCard.id, 'ready_for_inspection');
    const ok = await supabaseService.submitAndLockJobCard(selectedCard.id);
    if (ok) {
      notify.success('✅ काम पूरा हुआ! जॉब कार्ड चेकिंग और बिलिंग के लिए मैनेजर को भेज दिया गया।');
      await loadJobCards();
      onRefreshData();
    }
  };

  const handleApplyStandardPackage = async () => {
    if (!selectedCard) return;
    const ok = await supabaseService.applyStandardServicePackage(
      currentShop.id,
      selectedCard.id,
      currentUser.full_name
    );
    if (ok) {
      await loadJobCards();
      const fresh = await supabaseService.getJobCardById(selectedCard.id);
      if (fresh) setSelectedCard(fresh);
      onRefreshData();
    }
  };

  const handleSendWhatsAppQuotation = () => {
    if (!selectedCard) return;
    const url = supabaseService.generateWhatsAppQuotation(currentShop, selectedCard);
    window.open(url, '_blank');
  };

  const isOwner = currentUser.role === 'owner';
  const isOnDuty = isOwner || (!!todayAttendance && !todayAttendance.punch_out_time);

  // New Assigned Job Card Alert for this mechanic
  const unnotifiedAssignedCard = jobCards.find(
    (c) => c.mechanic_id === currentUser.id && c.mechanic_notified === false && c.status !== 'completed'
  );

  return (
    <div className="space-y-4 pb-24">
      {/* FULL-SCREEN ALERT MODAL WHEN NEW JOB CARD IS ASSIGNED */}
      {unnotifiedAssignedCard && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-amber-500 w-full max-w-md rounded-3xl p-6 shadow-2xl text-center space-y-4 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Bell className="w-9 h-9 animate-bounce text-amber-400" />
            </div>
            <div>
              <span className="px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-black uppercase tracking-wider">
                🔔 नया काम मिला है! (New Job Assigned)
              </span>
              <h3 className="text-xl font-black font-mono text-slate-100 uppercase mt-2">
                {unnotifiedAssignedCard.bike_number}
              </h3>
              <p className="text-xs text-slate-300 font-semibold mt-1">
                Customer: {unnotifiedAssignedCard.customer?.customer_name || 'Walk-in'} • {unnotifiedAssignedCard.customer?.phone || 'No phone'}
              </p>
            </div>

            <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 text-left text-xs space-y-1">
              <span className="text-[11px] font-bold text-amber-400 uppercase">काम की लिस्ट (Work to do):</span>
              <p className="text-slate-200 whitespace-pre-line font-medium">
                {unnotifiedAssignedCard.customer_complaints || 'General Inspection & Servicing'}
              </p>
            </div>

            <button
              type="button"
              onClick={async () => {
                await supabaseService.setMechanicNotified(unnotifiedAssignedCard.id);
                await loadJobCards();
                setSelectedCard(unnotifiedAssignedCard);
                notify.success(`काम शुरू हुआ! (Started work on ${unnotifiedAssignedCard.bike_number})`);
              }}
              className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-sm rounded-2xl shadow-xl shadow-amber-500/25 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Wrench className="w-5 h-5" /> 🛠️ Accept &amp; Start Work (काम शुरू करें)
            </button>
          </div>
        </div>
      )}

      {/* 4-Hour Temporary Manager Alert Banner */}
      {isTempMgr && (
        <div className="p-3 rounded-2xl bg-sky-950/70 border border-sky-600 text-sky-200 text-xs flex flex-wrap items-center justify-between gap-2 shadow-lg">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-sky-400 shrink-0 animate-pulse" />
            <div>
              <span className="font-bold text-sky-100">
                Temporary Manager Privilege Granted by Owner!
              </span>
              <p className="text-[11px] text-sky-300">
                You have temporary approval and billing powers until{' '}
                {new Date(currentUser.temp_manager_expires_at!).toLocaleTimeString()}.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Daily Duty Punch In/Out Banner (Hidden for Workshop Owner) */}
      {!isOwner && (
        !todayAttendance ? (
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-950/90 to-slate-900 border border-emerald-600/80 shadow-lg flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                <CheckCircle2 className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <span className="font-bold text-slate-100 text-sm">
                  Good Day, {currentUser.full_name}! Start Your Workshop Duty
                </span>
                <p className="text-[11px] text-slate-400">
                  1-tap punch in records exact CCTV timestamp for today's attendance &amp; payroll.
                </p>
              </div>
            </div>

            <button
              onClick={handlePunchIn}
              className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition flex items-center gap-1.5"
            >
              <CheckCircle className="w-4 h-4" /> 🟢 Punch In / Start Today's Duty
            </button>
          </div>
        ) : !todayAttendance.punch_out_time ? (
          <div className="p-3 rounded-2xl bg-slate-900 border border-emerald-800/60 shadow-md flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <div>
                <span className="font-bold text-emerald-300">
                  🟢 On Duty: Punched In at {formatCCTVTimestamp(todayAttendance.punch_in_time)}
                </span>
                <p className="text-[11px] text-slate-400">
                  CCTV verified attendance active. Click Punch Out at end of your shift.
                </p>
              </div>
            </div>

            <button
              onClick={handlePunchOut}
              className="px-3.5 py-1.5 rounded-xl bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-700/80 font-bold text-xs transition flex items-center gap-1.5"
            >
              <Clock className="w-3.5 h-3.5 text-rose-400" /> 🔴 End Duty / Punch Out
            </button>
          </div>
        ) : (
          <div className="p-3 rounded-2xl bg-slate-900 border border-amber-600/60 text-xs flex items-center justify-between text-slate-300">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                🔒 Duty Completed for Today • In: {formatCCTVTimestamp(todayAttendance.punch_in_time).substring(11)} | Out: {formatCCTVTimestamp(todayAttendance.punch_out_time).substring(11)}
              </span>
            </div>
            <span className="text-[10px] text-amber-300 font-bold">Shift Closed</span>
          </div>
        )
      )}

      {/* Quick Job / Express Cash Bar */}
      <QuickJobBar
        currentUser={currentUser}
        currentShop={currentShop}
        isOnDuty={isOnDuty}
        onJobRecorded={() => {
          onRefreshData();
          loadJobCards();
        }}
      />

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setActiveTab('cards');
              setSelectedCard(null);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'cards' && !selectedCard
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Active Job Cards ({jobCards.filter((c) => c.status !== 'completed').length})
          </button>
          <button
            onClick={() => {
              if (!isOnDuty) {
                notify.alert("🔒 Punch In for Today's Duty to start working.", "Duty Attendance Required", "error");
                return;
              }
              setCustomerName('');
              setCustomerPhone('');
              setCustomerAddress('');
              setBikeNumber('');
              setBikeModel('');
              setFuelLevel('50%');
              setOdometerKm('');
              setAdvancePaid('');
              setEstimatedCost('');
              setSelectedQuickChips([]);
              setCustomerComplaints('');
              setMechanicNotes('');
              setHistoryCards([]);
              setActiveTab('new_card');
              setSelectedCard(null);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'new_card'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            New Intake Card
          </button>
        </div>

        <div className="text-xs text-slate-400">
          Mechanic Desk: <strong className="text-slate-200">{currentUser.full_name}</strong>
        </div>
      </div>

      {/* VIEW 1: NEW JOB CARD INTAKE */}
      {activeTab === 'new_card' && !selectedCard && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl max-w-2xl mx-auto">
          <div className="flex items-center gap-2.5 mb-4 border-b border-slate-800 pb-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
              <Wrench className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">
                Customer &amp; Vehicle Intake
              </h2>
              <p className="text-xs text-slate-400">
                Live lookup of previous service visits by bike registration number
              </p>
            </div>
          </div>

          <form onSubmit={handleCreateDraftCard} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-300">
                    Bike Number (Registration) *
                  </label>
                  <button
                    type="button"
                    onClick={() => startVoiceFor('bike')}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1 border transition ${
                      isListening && activeVoiceField === 'bike'
                        ? 'bg-rose-500 text-white border-rose-400 animate-pulse'
                        : 'bg-slate-800 text-amber-300 border-amber-500/30 hover:bg-slate-700'
                    }`}
                  >
                    <Mic className="w-3 h-3" />
                    <span>{isListening && activeVoiceField === 'bike' ? 'Listening...' : '🎤 Speak'}</span>
                  </button>
                </div>
                <input
                  type="text"
                  required
                  placeholder="e.g. MH 02 CB 1234"
                  value={bikeNumber}
                  onChange={(e) => handleBikeNumberChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 font-mono font-bold uppercase text-sm focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Current Odometer (KM)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 18500"
                  value={odometerKm}
                  onChange={(e) =>
                    setOdometerKm(e.target.value === '' ? '' : Number(e.target.value))
                  }
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Instant Past Service History Lookup Result */}
            {bikeNumber.length >= 4 && (
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5" /> Past Service Records for {bikeNumber}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {historyCards.length} record(s) found
                  </span>
                </div>

                {searchingHistory ? (
                  <p className="text-xs text-slate-500">Searching workshop database...</p>
                ) : historyCards.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    No prior records found. First visit for this bike!
                  </p>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {historyCards.slice(0, 3).map((h) => (
                      <div
                        key={h.id}
                        className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs flex items-center justify-between"
                      >
                        <div>
                          <span className="font-semibold text-slate-200">
                            {new Date(h.created_at).toLocaleDateString()} — {h.odometer_km} KM
                          </span>
                          <p className="text-[11px] text-slate-400">
                            Status: <span className="uppercase">{h.status}</span> | Labour ₹{h.labour_charge}
                          </p>
                        </div>
                        <span className="font-mono font-bold text-amber-400">
                          ₹{h.total_bill}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Bike Brand &amp; Model
                </label>
                <input
                  type="text"
                  placeholder="e.g. Honda Activa 6G, Pulsar 150"
                  value={bikeModel}
                  onChange={(e) => setBikeModel(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Fuel Gauge Level
                </label>
                <div className="grid grid-cols-5 gap-1 pt-0.5">
                  {(['Empty', '25%', '50%', '75%', 'Full'] as const).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setFuelLevel(lvl)}
                      className={`py-2 rounded-lg text-[10px] font-bold border transition ${
                        fuelLevel === lvl
                          ? 'bg-amber-500 text-slate-950 border-amber-400'
                          : 'bg-slate-950 text-slate-400 border-slate-800'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-300">
                    Customer Name
                  </label>
                  <button
                    type="button"
                    onClick={() => startVoiceFor('name')}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1 border transition ${
                      isListening && activeVoiceField === 'name'
                        ? 'bg-rose-500 text-white border-rose-400 animate-pulse'
                        : 'bg-slate-800 text-amber-300 border-amber-500/30 hover:bg-slate-700'
                    }`}
                  >
                    <Mic className="w-3 h-3" />
                    <span>{isListening && activeVoiceField === 'name' ? 'Listening...' : '🎤 Speak'}</span>
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Walk-in or Full Name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Mobile Number (For WhatsApp Invoice)
                </label>
                <input
                  type="tel"
                  maxLength={10}
                  placeholder="10-digit mobile"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Customer Address / Area (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Market Road, Shop #12"
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Advance Paid (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 500"
                  value={advancePaid}
                  onChange={(e) => setAdvancePaid(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl font-mono text-emerald-400 font-bold text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Estimated Cost (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 1500"
                  value={estimatedCost}
                  onChange={(e) => setEstimatedCost(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl font-mono text-amber-300 font-bold text-xs"
                />
              </div>
            </div>

            {/* 8 Large Visual Touch Cards (Bilingual & Low-Literacy Friendly) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span>8 1-Touch Problem Cards (काम का 1-टच कार्ड):</span>
                </label>
                <span className="text-[10px] text-slate-400">Tap to toggle</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: '🛢️ Full Servicing', hi: 'पूरी सर्विसिंग' },
                  { label: '🛑 Brake Work', hi: 'ब्रेक काम' },
                  { label: '⛓️ Chain Set', hi: 'चेन काम' },
                  { label: '⚡ Self / Battery', hi: 'सेल्फ / बैटरी' },
                  { label: '🔧 Clutch / Gear', hi: 'क्लच / गियर' },
                  { label: '💨 Smoke / Mileage', hi: 'धुआं / माइलेज' },
                  { label: '🛞 Puncture / Air', hi: 'पंचर / हवा' },
                  { label: '💧 Foam Wash', hi: 'फोम वॉश' },
                ].map((chip) => {
                  const isSel = selectedQuickChips.includes(chip.label);
                  return (
                    <button
                      key={chip.label}
                      type="button"
                      onClick={() =>
                        setSelectedQuickChips((prev) =>
                          isSel ? prev.filter((c) => c !== chip.label) : [...prev, chip.label]
                        )
                      }
                      className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                        isSel
                          ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold shadow-md shadow-amber-500/20'
                          : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <span className="text-xs font-bold block">{chip.label}</span>
                      <span className={`text-[10px] ${isSel ? 'text-slate-900 font-semibold' : 'text-slate-500'}`}>
                        {chip.hi}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-300">
                  Detailed Customer Instructions &amp; Complaints
                </label>
                <button
                  type="button"
                  onClick={() => startVoiceFor('complaints')}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1 border transition ${
                    isListening && activeVoiceField === 'complaints'
                      ? 'bg-rose-500 text-white border-rose-400 animate-pulse'
                      : 'bg-slate-800 text-amber-300 border-amber-500/30 hover:bg-slate-700'
                  }`}
                >
                  <Mic className="w-3 h-3" />
                  <span>{isListening && activeVoiceField === 'complaints' ? 'Listening...' : '🎤 Speak Problem'}</span>
                </button>
              </div>
              <textarea
                rows={2}
                placeholder="e.g. Rear brake pads grinding, engine misfiring when accelerating in 3rd gear..."
                value={customerComplaints}
                onChange={(e) => setCustomerComplaints(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Mechanic Initial Inspection Notes
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Scratches on front right visor, chain sprocket worn out, clutch cable loose..."
                value={mechanicNotes}
                onChange={(e) => setMechanicNotes(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-amber-500"
              />
            </div>

            <button
              type="submit"
              disabled={creatingCard || !bikeNumber.trim()}
              className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-sm shadow-lg shadow-amber-500/20 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {creatingCard ? 'Starting Job Card...' : 'Start Draft Job Card & Add Parts'}
            </button>
          </form>
        </div>
      )}

      {/* VIEW 2: JOB CARDS LIST */}
      {activeTab === 'cards' && !selectedCard && (
        <div className="space-y-3">
          {/* Card Filter Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-900 p-1.5 rounded-xl border border-slate-800 overflow-x-auto">
            <button
              onClick={() => setCardFilter('drafts')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                cardFilter === 'drafts'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              🟢 Active / In Progress ({jobCards.filter((c) => c.status === 'pending' || c.status === 'in_progress' || c.status === 'draft').length})
            </button>
            <button
              onClick={() => setCardFilter('pending')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                cardFilter === 'pending'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Pending Review ({jobCards.filter((c) => c.status === 'submitted' || c.status === 'approved').length})
            </button>
            <button
              onClick={() => setCardFilter('completed')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                cardFilter === 'completed'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Completed Bills ({jobCards.filter((c) => c.status === 'completed').length})
            </button>
          </div>

          {jobCards.filter((c) => {
            if (cardFilter === 'drafts') return c.status === 'pending' || c.status === 'in_progress' || c.status === 'draft';
            if (cardFilter === 'pending') return c.status === 'submitted' || c.status === 'approved';
            return c.status === 'completed';
          }).length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-400 text-xs">
              <Package className="w-8 h-8 mx-auto text-slate-600 mb-2" />
              No job cards in this section.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {jobCards
                .filter((c) => {
                  if (cardFilter === 'drafts') return c.status === 'pending' || c.status === 'in_progress' || c.status === 'draft';
                  if (cardFilter === 'pending') return c.status === 'submitted' || c.status === 'approved';
                  return c.status === 'completed';
                })
                .map((card) => {
                  const isInProgress = card.status === 'pending' || card.status === 'in_progress' || card.status === 'draft';
                  const isSub = card.status === 'submitted' || card.status === 'approved';
                  const isComp = card.status === 'completed';

                  return (
                    <div
                      key={card.id}
                      className="bg-slate-900 border border-slate-800 hover:border-slate-700 p-4 rounded-2xl transition shadow-md flex flex-col justify-between"
                    >
                      <div onClick={() => setSelectedCard(card)} className="cursor-pointer">
                        <div className="flex items-center justify-between mb-2">
                          <span className="px-2 py-0.5 rounded font-mono font-bold text-xs uppercase bg-slate-950 border border-slate-800 text-amber-400">
                            {card.bike_number}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              isInProgress
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-600/40'
                                : isSub
                                ? 'bg-sky-500/20 text-sky-300 border border-sky-600/40'
                                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-600/40'
                            }`}
                          >
                            {isInProgress ? '🟢 WORK IN PROGRESS' : card.status}
                          </span>
                        </div>

                        <h4 className="text-sm font-bold text-slate-100">
                          {card.customer?.customer_name || 'Walk-in Customer'}
                        </h4>
                        <p className="text-xs text-slate-400">
                          {card.customer?.phone || 'No Phone'} • {card.odometer_km} KM
                        </p>

                        <div className="mt-3 text-xs text-slate-400 flex items-center justify-between">
                          <span>Items: {card.items?.length || 0}</span>
                          <span className="font-mono font-bold text-amber-400 text-sm">
                            ₹{card.total_bill}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between text-[11px]">
                        {isComp ? (
                          <div className="w-full flex items-center justify-between gap-1.5">
                            <button
                              onClick={() => onOpenInvoiceModal?.(card)}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs flex items-center gap-1 border border-slate-700 transition"
                            >
                              <FileText className="w-3.5 h-3.5" /> View Invoice PDF
                            </button>
                            {card.customer?.phone && (
                              <a
                                href={generateWhatsAppLink(
                                  card.customer.phone,
                                  `Hello ${card.customer.customer_name}, your vehicle ${card.bike_number} is ready at ${currentShop.shop_name}! Total Bill: Rs. ${card.total_bill}. UPI: ${currentShop.upi_id}`
                                )}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2 py-1.5 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 font-bold text-xs flex items-center gap-1 border border-emerald-700/60 transition"
                              >
                                <Send className="w-3.5 h-3.5" /> WhatsApp
                              </a>
                            )}
                          </div>
                        ) : (
                          <>
                            <span className="text-slate-400">
                              {isInProgress ? '🟢 Work in Progress' : '🔒 Locked (Submitted)'}
                            </span>
                            <button
                              onClick={() => setSelectedCard(card)}
                              className="text-amber-400 font-semibold flex items-center gap-1 hover:underline"
                            >
                              View Card <ChevronRight className="w-3 h-3" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* VIEW 3: SELECTED JOB CARD WORKBENCH */}
      {selectedCard && (
        <div className="space-y-4">
          {/* Header Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedCard(null)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                ← Back
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-base text-amber-400 uppercase">
                    {selectedCard.bike_number}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      selectedCard.status === 'draft'
                        ? 'bg-amber-500/20 text-amber-300'
                        : selectedCard.status === 'submitted'
                        ? 'bg-sky-500/20 text-sky-300'
                        : 'bg-emerald-500/20 text-emerald-300'
                    }`}
                  >
                    {selectedCard.status}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Customer: {selectedCard.customer?.customer_name || 'Walk-in'} • Odo: {selectedCard.odometer_km} KM
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-[10px] uppercase text-slate-400 block font-semibold">
                  Card Total
                </span>
                <span className="font-mono font-bold text-lg text-amber-400">
                  ₹{selectedCard.total_bill}
                </span>
              </div>

              {!selectedCard.is_locked_for_mechanic ? (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleApplyStandardPackage}
                    disabled={selectedCard.items?.some((it) => it.item_name.includes('Standard Service') || it.item_name.includes('Package') || it.item_name.includes('10W-30'))}
                    className="px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold text-xs transition flex items-center gap-1.5 disabled:opacity-40"
                    title={
                      selectedCard.items?.some((it) => it.item_name.includes('Standard Service') || it.item_name.includes('Package') || it.item_name.includes('10W-30'))
                        ? 'Standard Service Package already applied to this card'
                        : '1-Tap Standard Service: Synthetic Oil + Filter + Chain + Brake + Rs. 250 Labour'
                    }
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" /> ⚡ + Standard Package
                  </button>

                  <button
                    onClick={handleSendWhatsAppQuotation}
                    className="px-3 py-2 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-600/50 font-bold text-xs transition flex items-center gap-1.5"
                    title="Send Estimate / Quotation to Customer on WhatsApp"
                  >
                    <Send className="w-3.5 h-3.5 text-emerald-400" /> 📋 Estimate WhatsApp
                  </button>

                  <button
                    onClick={handleSubmitAndLock}
                    className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md transition flex items-center gap-1.5"
                    title="Mark work complete and send for manager inspection & billing"
                  >
                    <CheckCircle2 className="w-4 h-4" /> 🚀 Send for Inspection (काम पूरा — चेकिंग के लिए भेजें)
                  </button>

                  <button
                    type="button"
                    onClick={handleDeleteSelectedJobCard}
                    className="p-2.5 rounded-xl bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800 text-xs font-bold transition flex items-center gap-1"
                    title="Cancel & Delete Draft Card"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" /> Cancel Card
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleSendWhatsAppQuotation}
                    className="px-3 py-2 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-600/50 font-bold text-xs transition flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5 text-emerald-400" /> 📋 Estimate WhatsApp
                  </button>
                  <div className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-sky-300 text-xs font-semibold flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5" /> Submitted to Manager for Billing
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* READ-ONLY BANNER IF LOCKED */}
          {selectedCard.is_locked_for_mechanic && (
            <div className="p-3.5 rounded-2xl bg-sky-950/60 border border-sky-800/80 text-sky-200 text-xs flex items-center gap-2">
              <Lock className="w-4 h-4 shrink-0 text-sky-400" />
              <span>
                <strong>Job Card Locked:</strong> Handed over to Manager for final price review, outside work, and customer billing.
              </span>
            </div>
          )}

          {/* CUSTOMER REPORTED PROBLEMS (KAAM KI LIST) & VEHICLE METRICS BANNER */}
          <div className="bg-gradient-to-r from-amber-950/60 via-slate-900 to-slate-900 border-2 border-amber-500/60 rounded-2xl p-4 shadow-xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400 animate-pulse" />
                <h4 className="text-xs font-black uppercase text-amber-300 tracking-wider">
                  🚨 Customer Reported Problems (Kaam Ki List) &amp; Vehicle Intake
                </h4>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditCardComplaints(selectedCard.customer_complaints || '');
                  setEditCardMechNotes(selectedCard.mechanic_notes || '');
                  setShowEditComplaintsModal(true);
                }}
                className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-bold flex items-center gap-1 transition"
              >
                <Edit className="w-3 h-3" /> ✏️ Edit Complaints / Notes
              </button>
            </div>

            {/* Quick Metrics Badges: Bike Model, Fuel, Advance, Estimated, Odometer */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {selectedCard.bike_model && (
                <span className="px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-semibold flex items-center gap-1">
                  🏍️ Model: <strong className="text-amber-400">{selectedCard.bike_model}</strong>
                </span>
              )}
              <span className="px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-semibold flex items-center gap-1">
                ⛽ Fuel: <strong className="text-emerald-400">{selectedCard.fuel_level || '50%'}</strong>
              </span>
              <span className="px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-semibold flex items-center gap-1">
                💰 Advance Paid: <strong className="text-emerald-400 font-mono">₹{selectedCard.advance_paid || 0}</strong>
              </span>
              {selectedCard.estimated_cost ? (
                <span className="px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-semibold flex items-center gap-1">
                  ⏱️ Estimate: <strong className="text-amber-300 font-mono">₹{selectedCard.estimated_cost}</strong>
                </span>
              ) : null}
              {selectedCard.odometer_km ? (
                <span className="px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-semibold flex items-center gap-1">
                  🛣️ Odometer: <strong className="text-slate-300 font-mono">{selectedCard.odometer_km} KM</strong>
                </span>
              ) : null}
            </div>

            {/* Complaints description & notes */}
            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800/80 space-y-1.5 text-xs">
              <div className="text-slate-300">
                <span className="font-bold text-amber-400">Customer Voice / Problems: </span>
                <span className="text-slate-200 font-medium whitespace-pre-line">{selectedCard.customer_complaints || 'General Service & Checkup'}</span>
              </div>
              {selectedCard.mechanic_notes && (
                <div className="text-slate-400 pt-1 border-t border-slate-800">
                  <span className="font-bold text-sky-400">Mechanic Inspection Notes: </span>
                  <span className="text-slate-300 whitespace-pre-line">{selectedCard.mechanic_notes}</span>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* LEFT: JOB CARD ITEMS LIST (lg: 7 cols) */}
            <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                    Parts &amp; Consumables on this Card
                  </h3>
                  <span className="text-xs text-slate-400">
                    {selectedCard.items?.length || 0} item(s)
                  </span>
                </div>

                {(!selectedCard.items || selectedCard.items.length === 0) ? (
                  <div className="py-8 text-center text-xs text-slate-500">
                    No parts added yet. Use the parts catalog on the right or 1-tap chips below.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedCard.items.map((it) => (
                      <div
                        key={it.id}
                        className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-100">{it.item_name}</span>
                            {it.is_unlisted_manual && (
                              <span className="px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-700 text-[10px]">
                                Manual
                              </span>
                            )}
                            {it.warranty_months > 0 && (
                              <span className="px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-700 text-[10px]">
                                {it.warranty_months}M Warranty
                              </span>
                            )}
                          </div>

                          {editingItemPriceId === it.id ? (
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="text-[11px] text-slate-400">Unit ₹:</span>
                              <input
                                type="number"
                                min="0"
                                autoFocus
                                value={editingItemPriceVal}
                                onChange={(e) => setEditingItemPriceVal(Number(e.target.value) || 0)}
                                className="w-20 px-2 py-0.5 bg-slate-900 border border-amber-500 rounded text-xs font-mono font-bold text-amber-300"
                              />
                              <button
                                onClick={() => handleUpdateItemUnitPrice(it.id, editingItemPriceVal)}
                                className="p-1 rounded bg-amber-500 text-slate-950 font-bold"
                                title="Save Price"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => setEditingItemPriceId(null)}
                                className="p-1 rounded bg-slate-800 text-slate-400 hover:text-slate-200"
                                title="Cancel"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[11px] text-slate-400">
                                Added by: {it.added_by_name} • Unit: ₹{it.unit_price}
                              </span>
                              {!selectedCard.is_locked_for_mechanic && (
                                <button
                                  onClick={() => {
                                    setEditingItemPriceId(it.id);
                                    setEditingItemPriceVal(it.unit_price || 0);
                                  }}
                                  className="text-[10px] text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-0.5 underline"
                                  title="Edit Item Unit Price"
                                >
                                  <Edit2 className="w-2.5 h-2.5" /> Edit Rate
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5 bg-slate-900 px-2 py-1 rounded-lg border border-slate-800">
                            {!selectedCard.is_locked_for_mechanic && (
                              <button
                                onClick={async () => {
                                  await supabaseService.updateJobCardItemQuantity(
                                    it.id,
                                    selectedCard.id,
                                    (it.quantity || 1) - 1
                                  );
                                  await loadJobCards();
                                }}
                                className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center justify-center text-xs"
                              >
                                -
                              </button>
                            )}
                            <span className="font-mono font-bold text-slate-100 px-1">
                              {it.quantity}
                            </span>
                            {!selectedCard.is_locked_for_mechanic && (
                              <button
                                onClick={async () => {
                                  await supabaseService.updateJobCardItemQuantity(
                                    it.id,
                                    selectedCard.id,
                                    (it.quantity || 1) + 1
                                  );
                                  await loadJobCards();
                                }}
                                className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center justify-center text-xs"
                              >
                                +
                              </button>
                            )}
                          </div>

                          <span className="font-mono font-bold text-amber-400 text-sm min-w-[50px] text-right">
                            ₹{(it.unit_price || 0) * (it.quantity || 1)}
                          </span>

                          {!selectedCard.is_locked_for_mechanic && (
                            <button
                              onClick={() => handleDeleteCardItem(it.id, it.item_name)}
                              className="p-1 rounded text-rose-400 hover:text-rose-300 hover:bg-rose-950/60 transition"
                              title="Delete Item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Fee breakdown at bottom */}
              <div className="mt-4 pt-3 border-t border-slate-800 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Shop Consumables &amp; Cleaning:</span>
                  <span className="font-mono text-slate-200">
                    ₹{selectedCard.consumable_charge}
                  </span>
                </div>
                {selectedCard.labour_charge > 0 && (
                  <div className="flex justify-between text-slate-400">
                    <span>Labour Charge (Set by Manager):</span>
                    <span className="font-mono text-slate-200">
                      ₹{selectedCard.labour_charge}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-xs font-bold text-slate-300 pt-1 border-t border-slate-800/60">
                  <span>Gross Total Bill:</span>
                  <span className="font-mono text-amber-400">
                    ₹{selectedCard.total_bill}
                  </span>
                </div>
                {Number(selectedCard.advance_paid || 0) > 0 && (
                  <div className="flex justify-between text-xs font-medium text-emerald-400">
                    <span>Advance Received at Intake:</span>
                    <span className="font-mono">
                      -₹{selectedCard.advance_paid}
                    </span>
                  </div>
                )}
                {Number(selectedCard.advance_paid || 0) > 0 && (
                  <div className="flex justify-between text-xs font-bold text-slate-100">
                    <span>Net Balance to Collect:</span>
                    <span className="font-mono text-emerald-400">
                      ₹{Math.max(0, (selectedCard.total_bill || 0) - (selectedCard.advance_paid || 0))}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT: INVENTORY SEARCH, 1-TAP BOLT/WASHER & MANUAL ITEM (lg: 5 cols) */}
            {!selectedCard.is_locked_for_mechanic ? (
              <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-amber-400" /> Add Workshop Inventory
                  </h3>
                  <button
                    onClick={() => setShowManualForm(!showManualForm)}
                    className="text-xs text-amber-400 hover:text-amber-300 font-semibold"
                  >
                    {showManualForm ? 'Hide Manual' : '+ Manual Item'}
                  </button>
                </div>

                {/* 1-Tap Quick Hardware Chips */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400 font-semibold">1-Tap:</span>
                  <button
                    onClick={() => handleQuickAddPart('Heavy Duty 8mm Flange Bolt', 5)}
                    className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-600/40 text-xs font-bold transition"
                  >
                    + ₹5 Bolt
                  </button>
                  <button
                    onClick={() => handleQuickAddPart('Copper Drain Plug Washer', 10)}
                    className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-600/40 text-xs font-bold transition"
                  >
                    + ₹10 Washer
                  </button>
                </div>

                {/* Manual Item Intake Form */}
                {showManualForm && (
                  <form
                    onSubmit={handleAddManualItem}
                    className="p-3 bg-slate-950 rounded-xl border border-amber-500/40 space-y-2.5 animate-in fade-in duration-150"
                  >
                    <div className="flex items-center justify-between text-xs font-bold text-amber-400">
                      <span>Add Custom / Outside Spare Part</span>
                      {!isTempMgr && currentUser.role === 'mechanic' && (
                        <span className="text-[10px] text-amber-300 font-normal">
                          🔒 Price set by Manager during inspection
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      required
                      placeholder="Part name (e.g. Side mirror clamp, Custom bushing)"
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                    />
                    <div className="flex items-center gap-2">
                      <div className="w-24">
                        <label className="block text-[10px] text-slate-400 mb-0.5">Quantity:</label>
                        <input
                          type="number"
                          min="1"
                          value={manualQty}
                          onChange={(e) => setManualQty(Math.max(1, Number(e.target.value) || 1))}
                          className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono font-bold text-slate-100 text-center"
                        />
                      </div>

                      {!isTempMgr && currentUser.role === 'mechanic' ? (
                        <div className="flex-1 flex items-end">
                          <button
                            type="submit"
                            className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs transition"
                          >
                            + Add Part to Job
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex-1">
                            <label className="block text-[10px] text-slate-400 mb-0.5">Unit Price (₹):</label>
                            <input
                              type="number"
                              placeholder="Price ₹"
                              value={manualPrice}
                              onChange={(e) =>
                                setManualPrice(e.target.value === '' ? '' : Number(e.target.value))
                              }
                              className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                            />
                          </div>
                          <div className="flex items-end">
                            <button
                              type="submit"
                              className="px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded-lg text-xs hover:bg-amber-400 transition shrink-0"
                            >
                              Add
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </form>
                )}

                {/* Search & Voice Input */}
                <div className="relative flex items-center gap-1.5">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search parts catalog..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setInvPage(1);
                      }}
                      className="w-full pl-8 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  {/* Web Speech API Microphone (🎤) Button */}
                  <button
                    type="button"
                    onClick={toggleVoiceListening}
                    title="Voice search spare parts"
                    className={`p-2 rounded-xl border transition ${
                      isListening
                        ? 'bg-rose-500 text-white border-rose-400 animate-pulse'
                        : 'bg-slate-950 text-slate-300 border-slate-700 hover:bg-slate-800'
                    }`}
                  >
                    {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>
                </div>

                {/* Paginated Inventory List (20 items/page to prevent memory leaks) */}
                <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-1">
                  {loadingInv ? (
                    <div className="py-6 text-center text-xs text-slate-500">
                      Loading inventory parts...
                    </div>
                  ) : invItems.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-500">
                      No matching inventory items.
                    </div>
                  ) : (
                    invItems.map((item) => (
                      <div
                        key={item.id}
                        className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800/80 border border-slate-800/80 flex items-center justify-between gap-2 text-xs transition"
                      >
                        <div>
                          <div className="font-semibold text-slate-200">
                            {item.part_name}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {item.part_category} • Stock:{' '}
                            <strong className={item.stock_quantity < 5 ? 'text-rose-400' : 'text-slate-300'}>
                              {item.stock_quantity}
                            </strong>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-amber-400">
                            ₹{item.unit_price}
                          </span>
                          <button
                            onClick={() => handleAddInventoryPart(item)}
                            className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" /> Add
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Pagination Controls */}
                {invTotal > 20 && (
                  <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800">
                    <span>
                      Page {invPage} of {Math.ceil(invTotal / 20)}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        disabled={invPage <= 1}
                        onClick={() => setInvPage((p) => Math.max(1, p - 1))}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40"
                      >
                        Prev
                      </button>
                      <button
                        disabled={invPage >= Math.ceil(invTotal / 20)}
                        onClick={() => setInvPage((p) => p + 1)}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-5 text-center text-xs text-slate-400 flex flex-col items-center justify-center">
                <Lock className="w-8 h-8 text-sky-400 mb-2" />
                <span className="font-bold text-slate-200">Job Card Submitted</span>
                <p className="mt-1">
                  Items are locked. The manager will complete outside lathe/welding work, apply customer credit limits, and finalize payment collection.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* EDIT COMPLAINTS & NOTES MODAL */}
      {showEditComplaintsModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Edit className="w-4 h-4 text-amber-400" /> ✏️ Edit Customer Complaints &amp; Notes
              </h3>
              <button
                type="button"
                onClick={() => setShowEditComplaintsModal(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveComplaintsAndNotes} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Customer Reported Problems &amp; Kaam Ki List
                </label>
                <textarea
                  rows={4}
                  placeholder="e.g. Engine oil change, rear brake shoe, chain sprocket loose..."
                  value={editCardComplaints}
                  onChange={(e) => setEditCardComplaints(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Mechanic Inspection &amp; Observation Notes
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Scratches on fuel tank, fork bent slightly, battery voltage 11.8V..."
                  value={editCardMechNotes}
                  onChange={(e) => setEditCardMechNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowEditComplaintsModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingComplaints}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition disabled:opacity-50"
                >
                  {isSavingComplaints ? 'Saving...' : 'Save Updates'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
