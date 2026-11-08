import React, { useState, useEffect, useRef } from 'react';
import {
  User,
  Shop,
  JobCard,
  JobCardItem,
  Customer,
  InventoryItem,
  TrustTier,
  StaffAttendance,
} from '../types/supabase';
import {
  supabaseService,
  formatCCTVTimestamp,
  formatSimpleDate,
  getNextServiceDate,
  generateWhatsAppLink,
  generateItemizedWhatsAppBill,
  generateUpiPayload,
  generateSmsLink,
  generateSimpleSmsText,
  formatIndianMobile,
} from '../utils/supabaseService';
import { notify } from './NotificationModal';
import { QuickJobBar } from './QuickJobBar';
import QRCode from 'qrcode';
import {
  Bell,
  CheckCircle2,
  Lock,
  ShieldCheck,
  AlertTriangle,
  Banknote,
  QrCode,
  CreditCard,
  Send,
  MessageSquare,
  Plus,
  Trash2,
  Clock,
  Sparkles,
  Eye,
  FileText,
  DollarSign,
  UserCheck,
  Building2,
  Wallet,
  ShieldAlert,
  KeyRound,
  CheckCircle,
  HelpCircle,
  Package,
  ChevronRight,
  Printer,
  Search,
  Copy,
  Check,
  Calendar,
  Edit,
  Filter,
  X,
  Mic,
  Wrench,
  AlertCircle,
} from 'lucide-react';

interface ManagerDashboardProps {
  currentUser: User;
  currentShop: Shop;
  onRefreshData: () => void;
  onOpenInvoiceModal: (jobCard: JobCard) => void;
  onOpenQuickEdit?: (card: JobCard) => void;
}

export const ManagerDashboard: React.FC<ManagerDashboardProps> = ({
  currentUser,
  currentShop,
  onRefreshData,
  onOpenInvoiceModal,
  onOpenQuickEdit,
}) => {
  const [jobCards, setJobCards] = useState<JobCard[]>([]);
  const [selectedCard, setSelectedCard] = useState<JobCard | null>(null);
  const [loading, setLoading] = useState(false);
  const isInitialLoad = useRef(true);
  const [cardFilter, setCardFilter] = useState<'pending' | 'drafts' | 'completed'>(() => {
    try {
      const saved = localStorage.getItem('bikeready_mgr_card_filter');
      if (saved === 'pending' || saved === 'drafts' || saved === 'completed') return saved;
      return 'pending';
    } catch {
      return 'pending';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('bikeready_mgr_card_filter', cardFilter);
    } catch {}
  }, [cardFilter]);

  // Duty Attendance State
  const [todayAttendance, setTodayAttendance] = useState<StaffAttendance | null>(null);
  const [pinPunchInput, setPinPunchInput] = useState('');
  const [pinPunchMsg, setPinPunchMsg] = useState<{ text: string; error?: boolean } | null>(null);

  // Billing Form State
  const [labourCharge, setLabourCharge] = useState<number>(0);
  const [consumableCharge, setConsumableCharge] = useState<number>(0);
  const [outsideDesc, setOutsideDesc] = useState<string>('');
  const [outsideShopCost, setOutsideShopCost] = useState<number>(0);
  const [outsideCustPrice, setOutsideCustPrice] = useState<number>(0);
  const [extraDiscount, setExtraDiscount] = useState<number>(0);

  // Payment Splitting & UTR
  const [paymentChoice, setPaymentChoice] = useState<'cash' | 'upi' | 'split_cash_upi' | 'split_credit'>('cash');
  const [cashToCollect, setCashToCollect] = useState<number>(0);
  const [khataAmount, setKhataAmount] = useState<number>(0);
  const [splitCashAmount, setSplitCashAmount] = useState<number>(0);
  const [splitUpiAmount, setSplitUpiAmount] = useState<number>(0);
  const [upiRefNumber, setUpiRefNumber] = useState<string>('');
  const [upiQrDataUrl, setUpiQrDataUrl] = useState<string>('');
  const [copiedUpi, setCopiedUpi] = useState(false);

  // Complaints & Follow-up Scheduling
  const [selectedComplaints, setSelectedComplaints] = useState<string[]>([]);
  const [followupDaysOption, setFollowupDaysOption] = useState<'none' | '3_days' | '7_days' | '15_days' | 'custom'>('none');
  const [customFollowupDate, setCustomFollowupDate] = useState<string>('');
  const [followupNote, setFollowupNote] = useState<string>('');

  // New Item add by Manager
  const [showAddPart, setShowAddPart] = useState(false);
  const [invSearch, setInvSearch] = useState('');
  const [invItems, setInvItems] = useState<InventoryItem[]>([]);

  // Missing / Custom Item add on Bill Review
  const [showAddMissingItem, setShowAddMissingItem] = useState(false);
  const [missingItemName, setMissingItemName] = useState('');
  const [missingItemQty, setMissingItemQty] = useState<number>(1);
  const [missingItemPrice, setMissingItemPrice] = useState<string>('');
  const [isAddingMissingItem, setIsAddingMissingItem] = useState(false);

  // Daily Wallet / Direct Workshop Expense State
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState<number | ''>('');
  const [expenseType, setExpenseType] = useState<'shop_expense' | 'staff_upad'>('shop_expense');
  const [expensePaymentMode, setExpensePaymentMode] = useState<'cash' | 'upi'>('cash');
  const [expenseCategory, setExpenseCategory] = useState<string>('Workshop Supplies');
  const [shopStaff, setShopStaff] = useState<User[]>([]);
  const [upadStaffId, setUpadStaffId] = useState<string>('');

  // Direct Job Card Creation Modal with Rich DMS Vehicle Intake
  const [showNewCardModal, setShowNewCardModal] = useState(false);
  const handleOpenNewCard = () => {
    setNewBikeNumber('');
    setNewBikeModel('');
    setNewFuelLevel('50%');
    setNewCustomerName('');
    setNewCustomerPhone('');
    setNewCustomerAddress('');
    setNewOdometer('');
    setNewAdvancePaid('');
    setNewEstimatedCost('');
    setNewSelectedQuickChips([]);
    setNewCustomerComplaints('');
    setNewMechanicNotes('');
    setNewAssignedMechId('');
    setPastHistoryCards([]);
    setShowNewCardModal(true);
  };
  const [newBikeNumber, setNewBikeNumber] = useState('');
  const [newBikeModel, setNewBikeModel] = useState('');
  const [newFuelLevel, setNewFuelLevel] = useState<'Empty' | '25%' | '50%' | '75%' | 'Full'>('50%');
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerAddress, setNewCustomerAddress] = useState('');
  const [newOdometer, setNewOdometer] = useState<number | ''>('');
  const [newAdvancePaid, setNewAdvancePaid] = useState<number | ''>('');
  const [newEstimatedCost, setNewEstimatedCost] = useState<number | ''>('');
  const [newSelectedQuickChips, setNewSelectedQuickChips] = useState<string[]>([]);
  const [newCustomerComplaints, setNewCustomerComplaints] = useState('');
  const [newMechanicNotes, setNewMechanicNotes] = useState('');
  const [newAssignedMechId, setNewAssignedMechId] = useState('');
  const [isCreatingCard, setIsCreatingCard] = useState(false);
  const [pastHistoryCards, setPastHistoryCards] = useState<JobCard[]>([]);

  // Edit Complaints / Notes Modal
  const [showEditComplaintsModal, setShowEditComplaintsModal] = useState(false);
  const [editCardComplaints, setEditCardComplaints] = useState('');
  const [editCardMechNotes, setEditCardMechNotes] = useState('');
  const [isSavingComplaints, setIsSavingComplaints] = useState(false);

  // Edit Unit Price Modal / In-Place Editing for Items
  const [editingItemPriceId, setEditingItemPriceId] = useState<string | null>(null);
  const [editingItemPriceVal, setEditingItemPriceVal] = useState<number>(0);

  // Completed Bill Revision Modal
  const [revisingCard, setRevisingCard] = useState<JobCard | null>(null);
  const [revisedTotal, setRevisedTotal] = useState<number>(0);
  const [revisedCash, setRevisedCash] = useState<number>(0);
  const [revisedUpi, setRevisedUpi] = useState<number>(0);
  const [revisedNotes, setRevisedNotes] = useState<string>('');
  const [isSavingRevision, setIsSavingRevision] = useState(false);

  // In-Place Card Editor Modal
  const [editingCard, setEditingCard] = useState<JobCard | null>(null);
  const [editBikeNumber, setEditBikeNumber] = useState('');
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editCustomerPhone, setEditCustomerPhone] = useState('');
  const [editOdometer, setEditOdometer] = useState<number | ''>('');
  const [isSavingCardEdit, setIsSavingCardEdit] = useState(false);

  // Completed Bills Archive Search & Filter
  const [completedSearch, setCompletedSearch] = useState('');
  const [completedDateFilter, setCompletedDateFilter] = useState<'all' | 'today' | 'this_month' | 'last_3_months' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [viewingDetailsCard, setViewingDetailsCard] = useState<JobCard | null>(null);

  // Save Unlisted Part to Master Inventory Modal State (Task 3)
  const [saveToInventoryItem, setSaveToInventoryItem] = useState<JobCardItem | null>(null);
  const [invFormCost, setInvFormCost] = useState<number>(0);
  const [invFormStock, setInvFormStock] = useState<number>(5);
  const [invFormCategory, setInvFormCategory] = useState<string>('General');
  const [invFormSelling, setInvFormSelling] = useState<number>(0);
  const [invFormPartName, setInvFormPartName] = useState<string>('');

  // Missing / Custom Item addition in Invoice Review
  const [missingItemMode, setMissingItemMode] = useState<'catalog' | 'custom'>('catalog');
  const [customItemName, setCustomItemName] = useState<string>('');
  const [customItemPrice, setCustomItemPrice] = useState<number>(0);
  const [customItemQty, setCustomItemQty] = useState<number>(1);

  // Copied message state
  const [copiedBillId, setCopiedBillId] = useState<string | null>(null);

  // Billing Finalization Lock (Task 5)
  const [isFinalizingBill, setIsFinalizingBill] = useState(false);

  // Approval Request States
  const [requestingCredit, setRequestingCredit] = useState(false);
  const [requestingDiscount, setRequestingDiscount] = useState(false);

  const isTempMgr = currentUser.is_temp_manager;
  const isOwner = currentUser.role === 'owner';
  const isOnDuty = isOwner || (!!todayAttendance && !todayAttendance.punch_out_time);

  // Load Job Cards & Attendance
  const loadJobCards = async (showSpinner = false) => {
    if (showSpinner || isInitialLoad.current) {
      setLoading(true);
    }
    try {
      const [cards, users, att] = await Promise.all([
        supabaseService.getJobCards(currentShop.id),
        supabaseService.getUsersByShop(currentShop.id),
        supabaseService.getTodayAttendance(currentShop.id, currentUser.id),
      ]);
      setJobCards(cards);
      setShopStaff(users.filter((u) => u.role !== 'owner'));
      if (selectedCard) {
        const fresh = cards.find((c) => c.id === selectedCard.id);
        if (fresh) syncSelectedCard(fresh);
      }
      setTodayAttendance(att);
    } finally {
      if (showSpinner || isInitialLoad.current) {
        setLoading(false);
        isInitialLoad.current = false;
      }
    }
  };

  useEffect(() => {
    loadJobCards();
  }, [currentShop.id, currentUser.id]);

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
      if (fresh) syncSelectedCard(fresh);
      onRefreshData();
    }
  };

  const handleSendWhatsAppQuotation = () => {
    if (!selectedCard) return;
    const url = supabaseService.generateWhatsAppQuotation(currentShop, selectedCard);
    window.open(url, '_blank');
  };

  // Duty Punch Handlers
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

  // Counter Quick PIN Punch
  const handlePinPunch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinPunchInput.trim() || pinPunchInput.length < 4) return;

    const res = await supabaseService.punchWithPin(currentShop.id, pinPunchInput);
    setPinPunchMsg({ text: res.message, error: !res.success });
    setPinPunchInput('');
    setTimeout(() => setPinPunchMsg(null), 4000);
    onRefreshData();
  };

  // Sync selected card into form
  const syncSelectedCard = (card: JobCard) => {
    setSelectedCard(card);
    setLabourCharge(card.labour_charge || 0);
    setConsumableCharge(card.consumable_charge ?? 0);
    setOutsideDesc(card.outside_work_desc || '');
    setOutsideShopCost(card.outside_work_shop_cost || 0);
    setOutsideCustPrice(card.outside_work_customer_price || 0);
    setExtraDiscount(card.extra_discount || 0);

    const partsTotal = (card.items || []).reduce(
      (s, it) => s + (Number(it.unit_price) || 0) * (Number(it.quantity) || 1),
      0
    );
    const grossTotal = Math.max(
      0,
      partsTotal +
        Number(card.labour_charge || 0) +
        Number(card.consumable_charge ?? 0) +
        Number(card.outside_work_customer_price || 0) -
        Number(card.extra_discount || 0)
    );
    const advPaid = Number(card.advance_paid || 0);
    const netTotal = Math.max(0, grossTotal - advPaid);

    // Calculate customer credit constraints based on net payable
    const cust = card.customer;
    if (card.credit_override_status === 'approved') {
      const approvedLimit = Math.min(Number(card.approved_credit_amount || card.credit_override_amount || 0), netTotal);
      const requiredImmediateCash = Math.max(0, netTotal - approvedLimit);
      setPaymentChoice('split_credit');
      setKhataAmount(approvedLimit);
      setCashToCollect(requiredImmediateCash);
      setSplitUpiAmount(0);
    } else if (cust) {
      if (cust.trust_tier === 'blocked' || (cust.credit_limit || 0) <= 0) {
        setPaymentChoice('cash');
        setCashToCollect(netTotal);
        setKhataAmount(0);
        setSplitUpiAmount(0);
      } else {
        const availCredit = Math.max(0, Number(cust.credit_limit || 0) - Number(cust.current_due || 0));
        if (netTotal > availCredit) {
          const mandatory = netTotal - availCredit;
          setCashToCollect(mandatory);
          setKhataAmount(availCredit);
          setSplitUpiAmount(0);
        } else {
          setCashToCollect(0);
          setKhataAmount(netTotal);
          setSplitUpiAmount(0);
        }
      }
    } else {
      setCashToCollect(netTotal);
      setKhataAmount(0);
      setSplitUpiAmount(0);
    }
  };

  // Live item total, subtotal, gross total & net payable calculations
  const currentItemsTotal = Math.round(((selectedCard?.items || []).reduce(
    (sum, it) => sum + (Number(it.unit_price) || 0) * (Number(it.quantity) || 1),
    0
  ) + Number.EPSILON) * 100) / 100;

  const currentLabour = Math.round((Math.max(0, Number(labourCharge || 0)) + Number.EPSILON) * 100) / 100;
  const currentConsumable = Math.round((Math.max(0, Number(consumableCharge || 0)) + Number.EPSILON) * 100) / 100;
  const currentOutside = Math.round((Math.max(0, Number(outsideCustPrice || 0)) + Number.EPSILON) * 100) / 100;
  const currentDiscount = Math.round((Math.max(0, Number(extraDiscount || 0)) + Number.EPSILON) * 100) / 100;
  const currentAdvance = Math.round((Math.max(0, Number(selectedCard?.advance_paid || 0)) + Number.EPSILON) * 100) / 100;

  const currentSubtotal = Math.round((currentItemsTotal + currentLabour + currentConsumable + currentOutside + Number.EPSILON) * 100) / 100;
  const currentGrossTotal = Math.max(0, Math.round((currentSubtotal - currentDiscount + Number.EPSILON) * 100) / 100);
  const currentNetPayable = Math.max(0, Math.round((currentGrossTotal - currentAdvance + Number.EPSILON) * 100) / 100);

  const currentBillTotal = currentGrossTotal;
  const calculatedNetPayable = currentNetPayable;

  // Auto-adjust split when charges change with strict credit override lock & mutual exclusivity
  useEffect(() => {
    if (!selectedCard) return;
    const cust = selectedCard.customer;

    if (selectedCard.credit_override_status === 'approved') {
      const approvedLimit = Math.min(Number(selectedCard.approved_credit_amount || selectedCard.credit_override_amount || 0), calculatedNetPayable);
      const requiredImmediateCash = Math.max(0, calculatedNetPayable - approvedLimit);
      setKhataAmount(approvedLimit);
      setCashToCollect(requiredImmediateCash);
      setSplitUpiAmount(0);
      return;
    }

    if (paymentChoice === 'cash') {
      setCashToCollect(calculatedNetPayable);
      setSplitUpiAmount(0);
      setKhataAmount(0);
    } else if (paymentChoice === 'upi') {
      setCashToCollect(0);
      setSplitUpiAmount(calculatedNetPayable);
      setKhataAmount(0);
    } else if (paymentChoice === 'split_cash_upi') {
      const currentCash = Math.min(calculatedNetPayable, Math.max(0, Number(cashToCollect) || 0));
      setCashToCollect(currentCash);
      setSplitUpiAmount(Math.max(0, calculatedNetPayable - currentCash));
      setKhataAmount(0);
    } else if (paymentChoice === 'split_credit') {
      if (!cust || cust.trust_tier === 'blocked') {
        setPaymentChoice('cash');
        setCashToCollect(calculatedNetPayable);
        setSplitUpiAmount(0);
        setKhataAmount(0);
      } else {
        const availCredit = Math.max(0, Number(cust.credit_limit || 0) - Number(cust.current_due || 0));
        const maxKhata = Math.min(calculatedNetPayable, availCredit);
        const mandatory = Math.max(0, calculatedNetPayable - maxKhata);
        setKhataAmount(maxKhata);
        setCashToCollect(mandatory);
        setSplitUpiAmount(0);
      }
    }
  }, [calculatedNetPayable, paymentChoice, selectedCard?.customer?.id, selectedCard?.credit_override_status, selectedCard?.approved_credit_amount]);

  // Load inventory when searching to add forgotten parts
  useEffect(() => {
    if (showAddPart) {
      supabaseService.getInventory(currentShop.id, 1, 10, invSearch).then((r) => {
        setInvItems(r.items);
      });
    }
  }, [showAddPart, invSearch, currentShop.id]);

  // QR Code generator effect with transaction code BR-XXXX
  useEffect(() => {
    if (selectedCard && currentShop.upi_id) {
      const amt = paymentChoice === 'split_cash_upi' || paymentChoice === 'split_credit'
        ? Number(splitUpiAmount || 0)
        : (paymentChoice === 'upi' ? calculatedNetPayable : 0);
      const upiAmt = amt > 0 ? amt : calculatedNetPayable;
      const txnCode = `BR-${selectedCard.id.slice(-4).toUpperCase()}`;
      const upiPayload = generateUpiPayload(
        currentShop.upi_id,
        currentShop.shop_name,
        upiAmt,
        txnCode,
        selectedCard.bike_number
      );
      QRCode.toDataURL(upiPayload, { width: 180, margin: 1 })
        .then(setUpiQrDataUrl)
        .catch(console.error);
    }
  }, [selectedCard?.id, paymentChoice, splitUpiAmount, cashToCollect, calculatedNetPayable, currentShop.upi_id]);

  const handleCopyUpiId = () => {
    if (currentShop.upi_id) {
      navigator.clipboard.writeText(currentShop.upi_id);
      setCopiedUpi(true);
      notify.success(`UPI ID copied: ${currentShop.upi_id}`);
      setTimeout(() => setCopiedUpi(false), 3000);
    }
  };

  // Real-Time Bike & Customer History Lookup (Strict 9+ char + 4-digit exact match)
  const handleNewBikeNumberChange = async (val: string) => {
    const upper = val.toUpperCase();
    setNewBikeNumber(upper);
    const clean = upper.replace(/[^A-Z0-9]/gi, '');

    // Auto-fill ONLY when complete vehicle registration (at least 9 chars and ending with 4 digits)
    if (clean.length >= 9 && /[0-9]{4}$/.test(clean)) {
      const hist = await supabaseService.getVehiclePastHistory(currentShop.id, upper);
      // Strictly verify 100% exact match against vehicle_no
      const exactMatches = (hist || []).filter((h) => {
        const hClean = (h.bike_number || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
        return hClean === clean;
      });

      if (exactMatches.length > 0) {
        setPastHistoryCards(exactMatches);
        const found = exactMatches[0];
        if (found.customer?.customer_name) setNewCustomerName(found.customer.customer_name);
        if (found.customer?.phone) setNewCustomerPhone(found.customer.phone);
        if (found.customer?.address) setNewCustomerAddress(found.customer.address);
        if (found.bike_model) setNewBikeModel(found.bike_model);
        return;
      }
    }

    // Clear auto-filled customer info if input does not strictly match
    setPastHistoryCards([]);
  };

  // Voice speech-to-text input using Web Speech API
  const startVoiceInput = (field: 'bike' | 'name' | 'complaints' | 'notes' | 'search') => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      notify.alert('Voice typing is not supported on this browser/device.', 'Voice Typing', 'error');
      return;
    }
    try {
      const rec = new SpeechRec();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'hi-IN';
      rec.onresult = (e: any) => {
        const transcript = e.results[0][0].transcript;
        if (field === 'bike') {
          handleNewBikeNumberChange(transcript.replace(/[^A-Z0-9]/gi, '').toUpperCase());
        } else if (field === 'name') {
          setNewCustomerName(transcript);
        } else if (field === 'complaints') {
          setNewCustomerComplaints((prev) => (prev ? `${prev} | ${transcript}` : transcript));
        } else if (field === 'notes') {
          setNewMechanicNotes((prev) => (prev ? `${prev} | ${transcript}` : transcript));
        } else if (field === 'search') {
          setInvSearch(transcript);
        }
      };
      rec.onerror = () => {};
      rec.start();
      notify.alert('Listening... बोलें (Speak in Hindi or English)', 'Voice Mic Active', 'info');
    } catch {
      notify.alert('Could not start microphone.', 'Microphone Error', 'error');
    }
  };

  // Direct Job Card Creation Handler with Full DMS Intake
  const handleCreateNewJobCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBikeNumber.trim()) {
      notify.alert('Bike Registration Number is required.', 'Input Required', 'error');
      return;
    }
    setIsCreatingCard(true);
    try {
      const combinedComplaints = [
        ...newSelectedQuickChips,
        newCustomerComplaints.trim(),
      ].filter(Boolean).join(' | ');

      const card = await supabaseService.createJobCard(currentShop.id, {
        bike_number: newBikeNumber.trim().toUpperCase(),
        bike_model: newBikeModel.trim() || undefined,
        fuel_level: newFuelLevel,
        customer_name: newCustomerName.trim() || 'Walk-in Customer',
        customer_phone: newCustomerPhone.trim(),
        customer_address: newCustomerAddress.trim() || undefined,
        odometer_km: Number(newOdometer) || 0,
        advance_paid: Number(newAdvancePaid) || 0,
        estimated_cost: Number(newEstimatedCost) || 0,
        customer_complaints: combinedComplaints || undefined,
        mechanic_notes: newMechanicNotes.trim() || undefined,
        mechanic_id: newAssignedMechId || undefined,
        created_by_user_id: currentUser.id,
      });

      if (card) {
        notify.success(`Job Card created for ${card.bike_number}!`);
        setShowNewCardModal(false);
        setNewBikeNumber('');
        setNewBikeModel('');
        setNewFuelLevel('50%');
        setNewCustomerName('');
        setNewCustomerPhone('');
        setNewCustomerAddress('');
        setNewOdometer('');
        setNewAdvancePaid('');
        setNewEstimatedCost('');
        setNewSelectedQuickChips([]);
        setNewCustomerComplaints('');
        setNewMechanicNotes('');
        setNewAssignedMechId('');
        setPastHistoryCards([]);
        // Immediately prepend to local state so UI reflects new job card instantly
        setJobCards((prev) => [card, ...prev.filter((c) => c.id !== card.id)]);
        syncSelectedCard(card);
        await loadJobCards();
      }
    } finally {
      setIsCreatingCard(false);
    }
  };

  // Save Complaints & Mechanic Notes on Active Card
  const handleSaveComplaintsAndNotes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCard) return;
    setIsSavingComplaints(true);
    try {
      const ok = await supabaseService.updateJobCardComplaints(
        selectedCard.id,
        editCardComplaints.trim(),
        editCardMechNotes.trim()
      );
      if (ok) {
        notify.success('Job card complaints and notes updated!');
        setShowEditComplaintsModal(false);
        const fresh = await supabaseService.getJobCardById(selectedCard.id);
        if (fresh) syncSelectedCard(fresh);
        await loadJobCards();
      }
    } finally {
      setIsSavingComplaints(false);
    }
  };

  // Unit Price Editing for ANY Item on Active Card
  const handleUpdateItemUnitPrice = async (itemId: string, newPrice: number) => {
    if (!selectedCard) return;
    setSelectedCard((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: (prev.items || []).map((item) =>
          item.id === itemId ? { ...item, unit_price: newPrice, price_pending_inspection: false } : item
        ),
      };
    });
    const ok = await supabaseService.updateJobCardItemPrice(itemId, newPrice, selectedCard.id);
    if (ok) {
      setEditingItemPriceId(null);
      const fresh = await supabaseService.getJobCardById(selectedCard.id);
      if (fresh) syncSelectedCard(fresh);
      await loadJobCards();
      notify.success('Item price updated!');
    }
  };

  // Delete Item from Active Card
  const handleDeleteCardItem = async (itemId: string, itemName: string) => {
    if (!selectedCard) return;
    const ok = await notify.confirm(`Remove "${itemName}" from this job card?`);
    if (!ok) return;

    const success = await supabaseService.deleteJobCardItem(itemId, selectedCard.id);
    if (success) {
      const fresh = await supabaseService.getJobCardById(selectedCard.id);
      if (fresh) syncSelectedCard(fresh);
      await loadJobCards();
      notify.success(`Removed "${itemName}".`);
    }
  };

  // Save unlisted part to master inventory catalog (React modal driven - Task 3)
  const handleSaveUnlistedToMasterInventory = (item: JobCardItem) => {
    if (isOwner) {
      setSaveToInventoryItem(item);
      setInvFormPartName(item.item_name || 'Custom Part');
      setInvFormSelling(Number(item.unit_price) || 0);
      setInvFormCost(0);
      setInvFormStock(5);
      setInvFormCategory('General');
    } else {
      supabaseService.requestCustomPartInventoryApproval(
        currentShop.id,
        item.item_name,
        item.unit_price || 0,
        currentUser.full_name
      ).then(() => {
        notify.success(`Catalog request for "${item.item_name}" sent to Owner for approval!`);
      });
    }
  };

  const handleConfirmSaveToMasterInventory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saveToInventoryItem) return;
    const ok = await supabaseService.saveUnlistedPartToInventory(
      currentShop.id,
      invFormPartName.trim() || saveToInventoryItem.item_name,
      Number(invFormSelling) || 0,
      Number(invFormCost) || 0,
      Number(invFormStock) || 5,
      invFormCategory
    );
    if (ok) {
      notify.success(`"${invFormPartName || saveToInventoryItem.item_name}" saved to Master Inventory!`);
      setSaveToInventoryItem(null);
      await loadJobCards();
    }
  };

  // Add Custom / Missing Item directly to Job Card bill
  const handleAddCustomMissingItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCard || !customItemName.trim()) return;
    const validPrice = Math.max(0, Number(customItemPrice) || 0);
    const validQty = Math.max(1, Number(customItemQty) || 1);
    setIsAddingMissingItem(true);
    try {
      const ok = await supabaseService.addPartToJobCard(currentShop.id, selectedCard.id, {
        itemName: customItemName.trim(),
        unitPrice: validPrice,
        isUnlisted: true,
        addedByName: `${currentUser.full_name}`,
        quantity: validQty,
      });
      if (ok) {
        setShowAddPart(false);
        setCustomItemName('');
        setCustomItemPrice(0);
        setCustomItemQty(1);
        const fresh = await supabaseService.getJobCardById(selectedCard.id);
        if (fresh) {
          syncSelectedCard(fresh);
          setJobCards((prev) => prev.map((c) => (c.id === selectedCard.id ? fresh : c)));
        }
        await loadJobCards();
        notify.success(`Added "${customItemName}" to bill!`);
      }
    } finally {
      setIsAddingMissingItem(false);
    }
  };

  // Copy Formatted Bill for WhatsApp & open WhatsApp
  const handleCopyBillToClipboard = async (card: JobCard) => {
    const text = generateItemizedWhatsAppBill(currentShop, card);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedBillId(card.id);
      setTimeout(() => setCopiedBillId(null), 2500);
      notify.success('Formatted bill copied to clipboard! Opening WhatsApp...');
      const phone = card.customer?.phone || card.customer_phone || '';
      const waUrl = generateWhatsAppLink(phone, text);
      window.open(waUrl, '_blank');
    } catch (err) {
      console.error('Clipboard copy error:', err);
    }
  };

  // Cancel / Delete Entire Draft or Pending Job Card
  const handleDeleteSelectedJobCard = async () => {
    if (!selectedCard) return;
    const ok = await notify.confirm(
      `Permanently cancel and delete Job Card ${selectedCard.bike_number}? This will remove all parts and free the card.`
    );
    if (!ok) return;

    const success = await supabaseService.deleteJobCard(selectedCard.id);
    if (success) {
      setSelectedCard(null);
      await loadJobCards();
      notify.success('Job Card cancelled and deleted.');
    }
  };

  // Revise Completed Bill
  const handleSaveBillRevision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revisingCard) return;
    setIsSavingRevision(true);
    try {
      const ok = await supabaseService.reviseCompletedBill(revisingCard.id, {
        totalBill: Number(revisedTotal),
        cashCollected: Number(revisedCash),
        upiCollected: Number(revisedUpi),
        notes: revisedNotes.trim() || undefined,
      });
      if (ok) {
        notify.success(`Bill ${revisingCard.bike_number} revised successfully!`);
        setRevisingCard(null);
        await loadJobCards();
        onRefreshData();
      } else {
        notify.error('Failed to revise bill.');
      }
    } finally {
      setIsSavingRevision(false);
    }
  };

  // In-Place Card Editor
  const handleOpenEditCard = (card: JobCard, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingCard(card);
    setEditBikeNumber(card.bike_number);
    setEditCustomerName(card.customer?.customer_name || '');
    setEditCustomerPhone(card.customer?.phone || '');
    setEditOdometer(card.odometer_km || '');
  };

  const handleSaveJobCardEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCard) return;
    setIsSavingCardEdit(true);
    try {
      const ok = await supabaseService.updateJobCardDetails(editingCard.id, {
        bike_number: editBikeNumber.trim().toUpperCase(),
        odometer_km: Number(editOdometer) || 0,
        customer_name: editCustomerName.trim(),
        customer_phone: editCustomerPhone.trim(),
      });
      if (ok) {
        notify.success('Job Card details updated!');
        setEditingCard(null);
        await loadJobCards();
        if (selectedCard && selectedCard.id === editingCard.id) {
          const fresh = await supabaseService.getJobCardById(editingCard.id);
          if (fresh) syncSelectedCard(fresh);
        }
      }
    } finally {
      setIsSavingCardEdit(false);
    }
  };

  // Emergency: Use Manager Daily Quota for credit shortfall
  const handleUseManagerDailyQuota = async () => {
    if (!selectedCard) return;
    const remainingQuota = Math.max(
      0,
      (currentUser.daily_wallet_limit || 2000) - (currentUser.daily_wallet_used || 0)
    );
    if (remainingQuota <= 0) {
      notify.alert('Your Daily Wallet quota is exhausted (₹2,000 used). Please request Owner Credit Override.', 'Daily Quota Exhausted', 'error');
      return;
    }

    const coverage = Math.min(cashToCollect, remainingQuota);
    const newMandatoryCash = Math.max(0, cashToCollect - coverage);
    const newKhata = khataAmount + coverage;

    setCashToCollect(newMandatoryCash);
    setKhataAmount(newKhata);

    await supabaseService.deductManagerDailyWallet(currentUser.id, coverage);
    notify.success(`Used ₹${coverage} from Manager Daily Wallet. Transferred to Customer Khata!`);
  };

  // Emergency: Request Owner Credit Override
  const handleRequestOwnerCreditOverride = async () => {
    if (!selectedCard) return;
    setRequestingCredit(true);
    try {
      const computedBill = currentBillTotal;
      const availCredit = selectedCard.customer
        ? Math.max(0, (selectedCard.customer.credit_limit || 0) - (selectedCard.customer.current_due || 0))
        : 0;

      // Shortfall is strictly the requested balance beyond available credit
      const requestedKhata = khataAmount > 0 ? khataAmount : (computedBill - cashToCollect - splitUpiAmount);
      const shortfall = Math.max(0, requestedKhata - availCredit);
      const finalShortfall = shortfall > 0 ? shortfall : (requestedKhata > 0 ? requestedKhata : computedBill);

      await supabaseService.updateJobCardBilling(selectedCard.id, {
        labourCharge,
        consumableCharge,
        outsideWorkDesc: outsideDesc,
        outsideWorkShopCost: outsideShopCost,
        outsideWorkCustomerPrice: outsideCustPrice,
        extraDiscount,
        mandatoryCashToCollect: finalShortfall,
        transferredToKhata: availCredit,
      });

      await supabaseService.requestCreditOverride(selectedCard.id, finalShortfall, computedBill);
      await loadJobCards();
      notify.alert(`Emergency credit override request for Shortfall ₹${finalShortfall} (Total Bill ₹${computedBill}) sent to Owner dashboard!`, 'Override Requested', 'success');
    } finally {
      setRequestingCredit(false);
    }
  };

  // Request Owner Discount Approval (if discount > ₹100)
  const handleRequestOwnerDiscountApproval = async () => {
    if (!selectedCard) return;
    setRequestingDiscount(true);
    try {
      await supabaseService.requestDiscountApproval(selectedCard.id, extraDiscount);
      await loadJobCards();
      notify.success(`Discount approval request for ₹${extraDiscount} sent to Owner!`);
    } finally {
      setRequestingDiscount(false);
    }
  };

  // Finalize & Bill Action (with lock to prevent double billing)
  const handleFinalizeAndBill = async () => {
    if (!selectedCard || isFinalizingBill) return;

    const canBill = isOwner || (!!todayAttendance && !todayAttendance.punch_out_time);
    if (!canBill) {
      notify.alert("🔒 Punch In for Today's Duty to finalize bills.", "Attendance Required", "error");
      return;
    }

    // Check discount cap
    if (extraDiscount > 100 && selectedCard.discount_approval_status !== 'approved') {
      notify.alert('Discount exceeds ₹100 limit. Please request and await Owner approval.', 'Discount Approval Required', 'error');
      return;
    }

    // Check if any items have price 0 (only block if price is <= 0, never block if user entered price)
    const unpricedItems = (selectedCard.items || []).filter(
      (it) => Number(it.unit_price || 0) <= 0
    );
    if (unpricedItems.length > 0) {
      notify.alert(
        `Cannot issue invoice: ${unpricedItems.length} item(s) have ₹0 rate. Please set rates for all parts before billing.`,
        'Rates Pending',
        'error'
      );
      return;
    }

    // Exact Partial Udhaar enforcement & Number wrap
    const numGrossBill = Math.round((Number(currentBillTotal || 0) + Number.EPSILON) * 100) / 100;
    const numNetPayable = Math.round((Number(calculatedNetPayable || 0) + Number.EPSILON) * 100) / 100;
    const numCash = Math.round((Number(cashToCollect || 0) + Number.EPSILON) * 100) / 100;
    const numUpi = Math.round((Number(splitUpiAmount || 0) + Number.EPSILON) * 100) / 100;
    const numKhata = Math.round((Number(khataAmount || 0) + Number.EPSILON) * 100) / 100;

    const approvedCredit = Number(selectedCard.approved_credit_amount || selectedCard.credit_override_amount || 0);
    if (selectedCard.credit_override_status === 'approved' && approvedCredit > 0) {
      if (numKhata > approvedCredit) {
        notify.alert(
          `Udhaar amount (₹${numKhata}) exceeds Owner approved credit limit of ₹${approvedCredit}.`,
          'Credit Exceeded',
          'error'
        );
        return;
      }
      const requiredPaid = Math.max(0, numNetPayable - approvedCredit);
      if (numCash + numUpi < requiredPaid) {
        const remainingBal = requiredPaid - (numCash + numUpi);
        notify.alert(
          `⚠️ Vehicle retained in workshop! Remaining ₹${remainingBal} must be paid via Cash/UPI before vehicle release.`,
          'Vehicle Retained',
          'error'
        );
        return;
      }
    }

    setIsFinalizingBill(true);
    try {
      let finalPaymentMode = paymentChoice === 'split_credit' ? 'credit' : paymentChoice === 'split_cash_upi' ? 'cash' : paymentChoice;
      if (numKhata > 0 && (numCash > 0 || numUpi > 0)) {
        finalPaymentMode = 'split_credit';
      } else if (numKhata === numNetPayable && numNetPayable > 0) {
        finalPaymentMode = 'credit';
      } else if (numUpi > 0 && numCash > 0) {
        finalPaymentMode = 'split_cash_upi';
      } else if (numUpi > 0 && numCash === 0) {
        finalPaymentMode = 'upi';
      }

      const finalCashToCollect = numCash;
      const finalKhataAmount = numKhata;
      const finalUpiToCollect = numUpi;

      // Save billing data first
      await supabaseService.updateJobCardBilling(selectedCard.id, {
        labourCharge,
        consumableCharge,
        outsideWorkDesc: outsideDesc,
        outsideWorkShopCost: outsideShopCost,
        outsideWorkCustomerPrice: outsideCustPrice,
        extraDiscount,
        mandatoryCashToCollect: finalCashToCollect,
        transferredToKhata: finalKhataAmount,
        totalBill: numGrossBill,
        cashCollected: finalCashToCollect,
        upiCollected: finalUpiToCollect,
      });

      // Schedule check-up follow-up if selected
      if (followupDaysOption !== 'none') {
        let targetDate = '';
        const now = new Date();
        if (followupDaysOption === '3_days') {
          now.setDate(now.getDate() + 3);
          targetDate = now.toISOString().split('T')[0];
        } else if (followupDaysOption === '7_days') {
          now.setDate(now.getDate() + 7);
          targetDate = now.toISOString().split('T')[0];
        } else if (followupDaysOption === '15_days') {
          now.setDate(now.getDate() + 15);
          targetDate = now.toISOString().split('T')[0];
        } else if (followupDaysOption === 'custom' && customFollowupDate) {
          targetDate = customFollowupDate;
        }

        if (targetDate) {
          const fullNote = [selectedComplaints.join(', '), followupNote].filter(Boolean).join(' | ') || 'Service Check-up Re-inspection';
          await supabaseService.scheduleJobCardFollowup(selectedCard.id, targetDate, fullNote);
        }
      }

      // Finalize card, deduct stock & sync Khata
      const ok = await supabaseService.completeAndBillJobCard(
        selectedCard.id,
        finalPaymentMode,
        finalCashToCollect,
        finalKhataAmount,
        upiRefNumber.trim(),
        finalUpiToCollect
      );

      if (ok) {
        notify.success(`Invoice issued for ${selectedCard.bike_number}!`);
        const updatedCard: JobCard = {
          ...selectedCard,
          status: 'completed',
          total_bill: numGrossBill,
          mandatory_cash_to_collect: finalCashToCollect,
          cash_collected: finalCashToCollect,
          transferred_to_khata: finalKhataAmount,
          upi_collected: finalUpiToCollect,
          upi_ref_number: upiRefNumber.trim(),
          payment_mode: finalPaymentMode,
          billed_at: new Date().toISOString(),
        };

        // Immediately reflect COMPLETED status in local UI without requiring a reload
        setJobCards((prev) => prev.map((c) => (c.id === selectedCard.id ? updatedCard : c)));
        setSelectedCard(null);

        // Open official Invoice & Gate Pass PDF modal 100% of the time
        onOpenInvoiceModal(updatedCard);

        await loadJobCards();
        onRefreshData();
      }
    } finally {
      setIsFinalizingBill(false);
    }
  };

  // Add forgotten part
  const handleAddForgottenPart = async (item: InventoryItem) => {
    if (!selectedCard) return;
    await supabaseService.addPartToJobCard(currentShop.id, selectedCard.id, {
      partId: item.id,
      itemName: item.part_name,
      unitPrice: item.unit_price,
      isUnlisted: false,
      addedByName: `${currentUser.full_name} (Mgr)`,
      quantity: 1,
    });
    setShowAddPart(false);
    await loadJobCards();
  };

  // Record Daily Wallet / Direct Workshop Expense
  const handleRecordExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseTitle.trim() || !expenseAmount) return;

    if (expenseType === 'staff_upad') {
      const targetStaff = shopStaff.find((s) => s.id === upadStaffId);
      if (!targetStaff) {
        notify.alert('Please select the staff member receiving the upad advance.', 'Staff Required', 'error');
        return;
      }
      await supabaseService.recordStaffUpad({
        shop_id: currentShop.id,
        staff_id: targetStaff.id,
        staff_name: targetStaff.full_name,
        amount: Number(expenseAmount),
        payment_mode: expensePaymentMode,
        notes: expenseTitle.trim() || `Workshop Upad (${targetStaff.full_name})`,
        recorded_by: `${currentUser.full_name} (${isOwner ? 'Owner' : 'Mgr'})`,
      });
      if (!isOwner) {
        await supabaseService.deductManagerDailyWallet(currentUser.id, Number(expenseAmount));
      }
    } else {
      await supabaseService.recordExpense(
        currentShop.id,
        expenseType,
        expenseTitle,
        Number(expenseAmount),
        `${currentUser.full_name} (${isOwner ? 'Owner' : 'Mgr'})`,
        null,
        null,
        expensePaymentMode,
        expenseCategory
      );
      if (!isOwner) {
        await supabaseService.deductManagerDailyWallet(currentUser.id, Number(expenseAmount));
      }
    }

    setExpenseTitle('');
    setExpenseAmount('');
    setUpadStaffId('');
    setShowWalletModal(false);
    onRefreshData();
    notify.success(`Expense ₹${expenseAmount} (${expensePaymentMode.toUpperCase()}) recorded in Galla Tally!`);
  };

  const isDiscountLocked = extraDiscount > 100 && selectedCard?.discount_approval_status !== 'approved';
  const remainingWallet = Math.max(
    0,
    (currentUser.daily_wallet_limit || 2000) - (currentUser.daily_wallet_used || 0)
  );

  const submittedCards = jobCards.filter((c) => c.status === 'submitted');

  return (
    <div className="space-y-4 pb-24">
      {/* Daily Duty Punch In/Out Banner for Manager (Hidden for Owner) */}
      {!isOwner && (
        !todayAttendance ? (
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-950/90 to-slate-900 border border-emerald-600/80 shadow-lg flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                <CheckCircle2 className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <span className="font-bold text-slate-100 text-sm">
                  Good Day, {currentUser.full_name}! Start Manager Shift
                </span>
                <p className="text-[11px] text-slate-400">
                  1-tap punch in records exact CCTV timestamp for today's workshop duty.
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
                  Manager desk active. Click Punch Out at end of duty.
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

      {/* Quick Job Express Cash Bar */}
      <QuickJobBar
        currentUser={currentUser}
        currentShop={currentShop}
        isOnDuty={isOnDuty}
        onJobRecorded={() => {
          onRefreshData();
          loadJobCards();
        }}
      />

      {/* Realtime Alert Banner for Submitted Cards */}
      {submittedCards.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex flex-wrap items-center justify-between gap-3 shadow-lg animate-pulse">
          <div className="flex items-center gap-2.5">
            <Bell className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <span className="font-bold text-slate-100 text-sm">
                {submittedCards.length} Job Card(s) Submitted by Mechanics!
              </span>
              <p className="text-slate-400 mt-0.5">
                Mechanics have locked tools &amp; parts. Review outside lathe work, customer credit, and issue final invoice.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {submittedCards.map((c) => (
              <button
                key={c.id}
                onClick={() => syncSelectedCard(c)}
                className="px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-mono font-bold hover:bg-amber-400 transition"
              >
                Bill {c.bike_number}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Top Controls: Daily Wallet & Counter Quick PIN Punch Widget */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
        {/* Left: Owner Expense Desk OR Manager Petty Cash */}
        <div className="md:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-md">
          {isOwner ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                <Wallet className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase text-amber-400">
                    Owner Direct Workshop Expense Desk
                  </span>
                  <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono text-[10px] font-bold">
                    No Quota Limit
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Record tea, parts purchase, utilities, or staff upad directly into Galla Tally
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold">
                <Wallet className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase text-slate-300">
                    Manager Petty Cash Wallet
                  </span>
                  <span className="px-2 py-0.5 rounded bg-sky-950 border border-sky-800 text-sky-300 font-mono text-[11px] font-bold">
                    ₹{currentUser.daily_wallet_used || 0} / ₹{currentUser.daily_wallet_limit || 2000} Used
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Remaining Quota: <strong className="text-emerald-400 font-mono">₹{remainingWallet}</strong> for shop expenses &amp; credit coverage
                </p>
              </div>
            </div>
          )}

          {!isTempMgr ? (
            <button
              onClick={() => setShowWalletModal(true)}
              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-md shadow-amber-500/10 flex items-center gap-1.5 transition"
            >
              <Plus className="w-4 h-4" /> {isOwner ? '💸 Record Workshop Expense' : 'Record Wallet Expense'}
            </button>
          ) : (
            <span className="text-[11px] text-slate-500 italic">
              🔒 Temp Manager: Expenses locked
            </span>
          )}
        </div>

        {/* Right: Counter Quick PIN Punch Widget for phone-less workers */}
        <div className="md:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex flex-col justify-between shadow-md">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-amber-400" /> Counter Quick PIN Punch
            </span>
            <span className="text-[10px] text-slate-400">Worker self-punch</span>
          </div>

          <form onSubmit={handlePinPunch} className="flex items-center gap-2">
            <input
              type="password"
              maxLength={4}
              placeholder="4-Digit PIN"
              value={pinPunchInput}
              onChange={(e) => setPinPunchInput(e.target.value.replace(/\D/g, ''))}
              className="w-28 px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono font-bold text-center tracking-widest text-slate-100 focus:outline-none focus:border-amber-500"
            />
            <button
              type="submit"
              disabled={pinPunchInput.length < 4}
              className="flex-1 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition disabled:opacity-40"
            >
              Punch In / Out
            </button>
          </form>

          {pinPunchMsg && (
            <p className={`text-[10px] mt-1.5 font-semibold ${pinPunchMsg.error ? 'text-rose-400' : 'text-emerald-400'}`}>
              {pinPunchMsg.text}
            </p>
          )}
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      {!selectedCard ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-2">
            <div className="flex items-center gap-3">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Workshop Job Cards
              </h3>
              <button
                onClick={handleOpenNewCard}
                className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition"
              >
                <Plus className="w-4 h-4" /> Create New Job Card / Vehicle Intake
              </button>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 overflow-x-auto">
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
          </div>

          {/* Search & Date Filter Bar for Completed Bills */}
          {cardFilter === 'completed' && (
            <div className="p-3 bg-slate-900 border border-slate-800 rounded-2xl flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by Bike No, Customer, Phone, Job ID, or UTR..."
                  value={completedSearch}
                  onChange={(e) => setCompletedSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] text-slate-400 font-semibold flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5" /> Date:
                </span>
                <select
                  value={completedDateFilter}
                  onChange={(e) => setCompletedDateFilter(e.target.value as any)}
                  className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-200"
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="this_month">This Month</option>
                  <option value="last_3_months">Last 3 Months</option>
                  <option value="custom">Custom Range</option>
                </select>

                {completedDateFilter === 'custom' && (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="px-2 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-200"
                    />
                    <span className="text-xs text-slate-500">to</span>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="px-2 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-200"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {jobCards
              .filter((c) => {
                if (cardFilter === 'pending') return c.status === 'submitted' || c.status === 'approved';
                if (cardFilter === 'drafts') return c.status === 'pending' || c.status === 'in_progress' || c.status === 'draft';
                // Completed filter with search & date
                if (c.status !== 'completed') return false;
                if (completedSearch.trim()) {
                  const q = completedSearch.trim().toLowerCase();
                  const matchBike = c.bike_number?.toLowerCase().includes(q);
                  const matchCust = c.customer?.customer_name?.toLowerCase().includes(q);
                  const matchPhone = c.customer?.phone?.includes(q);
                  const matchId = c.id?.toLowerCase().includes(q);
                  const matchUtr = c.upi_ref_number?.toLowerCase().includes(q);
                  if (!matchBike && !matchCust && !matchPhone && !matchId && !matchUtr) return false;
                }
                if (completedDateFilter !== 'all') {
                  const billTime = new Date(c.billed_at || c.created_at).getTime();
                  const now = new Date();
                  if (completedDateFilter === 'today') {
                    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
                    if (billTime < startOfToday) return false;
                  } else if (completedDateFilter === 'this_month') {
                    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
                    if (billTime < startOfMonth) return false;
                  } else if (completedDateFilter === 'last_3_months') {
                    const startOf3m = new Date(now.getFullYear(), now.getMonth() - 3, 1).getTime();
                    if (billTime < startOf3m) return false;
                  } else if (completedDateFilter === 'custom') {
                    if (customStartDate && billTime < new Date(customStartDate).getTime()) return false;
                    if (customEndDate && billTime > new Date(customEndDate + 'T23:59:59').getTime()) return false;
                  }
                }
                return true;
              })
              .map((card) => {
                const isSub = card.status === 'submitted';
                const isComp = card.status === 'completed';
                const isInProgress = card.status === 'pending' || card.status === 'in_progress' || card.status === 'draft';

                return (
                  <div
                    key={card.id}
                    className={`p-4 rounded-2xl border transition shadow-md flex flex-col justify-between ${
                      isSub
                        ? 'bg-amber-950/20 border-amber-500/60 ring-1 ring-amber-500/30'
                        : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div onClick={() => !isComp && syncSelectedCard(card)} className={!isComp ? 'cursor-pointer' : ''}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="px-2 py-0.5 rounded font-mono font-bold text-xs uppercase bg-slate-950 border border-slate-800 text-amber-400">
                          {card.bike_number}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {!isComp && (
                            <button
                              type="button"
                              onClick={(e) => handleOpenEditCard(card, e)}
                              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px]"
                              title="Edit Card Details"
                            >
                              <Edit className="w-3 h-3" />
                            </button>
                          )}
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              isSub
                                ? 'bg-amber-500 text-slate-950'
                                : isComp
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            }`}
                          >
                            {isSub ? '⚠️ Action Required' : isInProgress ? '🟢 WORK IN PROGRESS' : card.status}
                          </span>
                        </div>
                      </div>

                      <h4 className="text-sm font-bold text-slate-100">
                        {card.customer?.customer_name || 'Walk-in Customer'}
                      </h4>
                      <p className="text-xs text-slate-400">
                        {card.customer?.phone || 'No Phone'} • {card.items?.length || 0} Parts
                      </p>

                      {/* Strict CCTV Timestamp - Visible ONLY to Manager/Owner */}
                      <div className="mt-2.5 p-2 bg-slate-950/80 rounded-lg text-[10px] text-slate-400 font-mono space-y-0.5 border border-slate-800/60">
                        <div>Created: {formatCCTVTimestamp(card.created_at)}</div>
                        {card.submitted_at && (
                          <div>Submitted: {formatCCTVTimestamp(card.submitted_at)}</div>
                        )}
                        {card.billed_at && (
                          <div>Billed: {formatCCTVTimestamp(card.billed_at)}</div>
                        )}
                        {card.upi_ref_number && (
                          <div className="text-indigo-400">UTR: {card.upi_ref_number}</div>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between">
                      <span className="font-mono font-bold text-amber-400 text-base">
                        ₹{card.total_bill}
                      </span>

                      {/* Actions */}
                      {isComp ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {/* PDF */}
                          <button
                            onClick={() => onOpenInvoiceModal(card)}
                            className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-[11px] font-bold border border-slate-700 flex items-center gap-1"
                            title="Download / Print PDF"
                          >
                            <FileText className="w-3.5 h-3.5" /> PDF
                          </button>

                          {/* Direct WhatsApp + Companion SMS + Copy Msg (Tasks 4 & 5) */}
                          {(() => {
                            const phone = card.customer?.phone || card.customer_phone || '';
                            const billMsg = generateItemizedWhatsAppBill(currentShop, card);
                            const waUrl = generateWhatsAppLink(phone, billMsg);
                            const smsMsg = generateSimpleSmsText(currentShop, card, 'bill');
                            const smsUrl = generateSmsLink(phone, smsMsg);
                            const isCopied = copiedBillId === card.id;

                            return (
                              <>
                                <a
                                  href={waUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold border border-emerald-500 flex items-center gap-1 shadow-sm transition"
                                  title="Send Full Itemized Bill on WhatsApp"
                                >
                                  <Send className="w-3.5 h-3.5" /> WhatsApp
                                </a>
                                {phone && (
                                  <a
                                    href={smsUrl}
                                    className="px-2 py-1.5 rounded-lg bg-sky-600/30 hover:bg-sky-600/50 text-sky-200 text-[11px] font-bold border border-sky-600/50 flex items-center gap-1 transition"
                                    title="Send Bilingual Text SMS for Keypad / Offline Phones"
                                  >
                                    <MessageSquare className="w-3.5 h-3.5" /> SMS
                                  </a>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleCopyBillToClipboard(card)}
                                  className={`px-2 py-1.5 rounded-lg text-[11px] font-bold border flex items-center gap-1 transition ${
                                    isCopied
                                      ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                                  }`}
                                  title="Copy Full Bill Text to Clipboard and Open WhatsApp"
                                >
                                  {isCopied ? <Check className="w-3.5 h-3.5 text-slate-950" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                                  {isCopied ? 'Copied!' : 'Copy Msg'}
                                </button>
                              </>
                            );
                          })()}
                          <button
                            onClick={() => {
                              setRevisingCard(card);
                              setRevisedTotal(card.total_bill);
                              setRevisedCash(card.mandatory_cash_to_collect || 0);
                              setRevisedUpi(Math.max(0, (card.total_bill || 0) - (card.mandatory_cash_to_collect || 0) - (card.transferred_to_khata || 0)));
                              setRevisedNotes('');
                            }}
                            className="px-2 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[11px] font-bold border border-amber-500/40 flex items-center gap-1"
                            title="Edit / Revise Final Bill"
                          >
                            <Edit className="w-3.5 h-3.5" /> Revise
                          </button>
                          {card.customer?.phone && (
                            <a
                              href={`https://wa.me/91${card.customer.phone.replace(/\D/g, '')}?text=${encodeURIComponent(
                                `Hello ${card.customer.customer_name || 'Customer'}! Greetings from *${currentShop.shop_name}*. Your vehicle *${card.bike_number}* was serviced on ${formatSimpleDate(card.created_at)}. Periodic maintenance check-up is recommended. Contact: ${currentShop.owner_phone}`
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 text-[11px] font-bold border border-sky-500/40 flex items-center gap-1"
                              title="Send Service Due Reminder on WhatsApp"
                            >
                              <Calendar className="w-3.5 h-3.5" /> Reminder
                            </a>
                          )}
                          <button
                            onClick={() => setViewingDetailsCard(card)}
                            className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold border border-slate-700 flex items-center gap-1"
                            title="View / Edit Details"
                          >
                            <Eye className="w-3.5 h-3.5" /> Details
                          </button>
                          {(currentUser.role === 'owner' || currentUser.phone === '9999999999') && onOpenQuickEdit && (
                            <button
                              type="button"
                              onClick={() => onOpenQuickEdit(card)}
                              className="px-2 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[11px] font-bold border border-amber-500/40 flex items-center gap-1 shadow-sm transition"
                              title="Owner Quick Job Edit"
                            >
                              <Edit className="w-3.5 h-3.5 text-amber-400" /> Quick Edit
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          {(currentUser.role === 'owner' || currentUser.phone === '9999999999') && onOpenQuickEdit && (
                            <button
                              type="button"
                              onClick={() => onOpenQuickEdit(card)}
                              className="px-2 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[11px] font-bold border border-amber-500/40 flex items-center gap-1 shadow-sm transition"
                              title="Owner Quick Job Edit"
                            >
                              <Edit className="w-3.5 h-3.5 text-amber-400" /> Quick Edit
                            </button>
                          )}
                          <button
                            onClick={(e) => handleOpenEditCard(card, e)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700"
                            title="Edit Card Info"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => syncSelectedCard(card)}
                            className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold"
                          >
                            Manage &amp; Bill →
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      ) : (
        /* WORKBENCH FOR SELECTED CARD */
        <div className="space-y-4">
          {/* Header */}
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
                  <span className="font-mono font-bold text-lg text-amber-400 uppercase">
                    {selectedCard.bike_number}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-800 text-slate-300">
                    Status: {selectedCard.status}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Mechanic:{' '}
                  <strong className="text-slate-200">
                    {selectedCard.mechanic?.full_name || 'Assigned Mechanic'}
                  </strong>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {selectedCard.status !== 'completed' && (
                <>
                  <button
                    onClick={handleApplyStandardPackage}
                    className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold text-xs transition flex items-center gap-1.5"
                    title="1-Tap Standard Service: Synthetic Oil + Filter + Chain + Brake + Rs. 250 Labour"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" /> ⚡ + Standard Package
                  </button>

                  <button
                    onClick={handleSendWhatsAppQuotation}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-600/50 font-bold text-xs transition flex items-center gap-1.5"
                    title="Send Estimate / Quotation to Customer on WhatsApp"
                  >
                    <Send className="w-3.5 h-3.5 text-emerald-400" /> 📋 Estimate WhatsApp
                  </button>
                </>
              )}

              {selectedCard.status === 'completed' && (
                <>
                  <button
                    onClick={handleSendWhatsAppQuotation}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-600/50 font-bold text-xs transition flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5 text-emerald-400" /> 📋 Estimate WhatsApp
                  </button>
                  <button
                    onClick={() => onOpenInvoiceModal(selectedCard)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-bold border border-slate-700 flex items-center gap-1.5"
                  >
                    <FileText className="w-4 h-4" /> View Invoice PDF
                  </button>
                </>
              )}
            </div>
          </div>

          {/* INSPECTION READY BANNER */}
          {selectedCard.inspection_status === 'ready_for_inspection' && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-amber-500/20 border-2 border-amber-500 flex items-center justify-between gap-3 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold animate-pulse shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-100 flex items-center gap-1.5">
                    <span>🔍 Inspection Ready — Verify &amp; Finalize Bill</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-bold uppercase">Work Complete</span>
                  </h3>
                  <p className="text-xs text-amber-200">
                    Mechanic has finished work on this bike. Verify parts, set prices for unpriced items, and issue final invoice.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* CUSTOMER PROFILE & TRUST TIER AT TOP */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-100">
                      {selectedCard.customer?.customer_name || 'Walk-in Customer'}
                    </h3>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        selectedCard.customer?.trust_tier === 'trusted'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-600/40'
                          : selectedCard.customer?.trust_tier === 'blocked'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-600/40'
                          : 'bg-sky-500/20 text-sky-300 border border-sky-600/40'
                      }`}
                    >
                      Tier: {selectedCard.customer?.trust_tier || 'new'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Phone: {selectedCard.customer?.phone || 'No phone'} • Bike: {selectedCard.bike_number}
                  </p>
                </div>
              </div>

              {/* Credit Status & WhatsApp Reminder Link */}
              <div className="flex items-center gap-4 text-xs">
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                    Credit Limit
                  </span>
                  <span className="font-mono font-bold text-slate-200">
                    ₹{selectedCard.customer?.credit_limit || 0}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                    Existing Udhar Due
                  </span>
                  <span className="font-mono font-bold text-rose-400">
                    ₹{selectedCard.customer?.current_due || 0}
                  </span>
                </div>

                {selectedCard.customer?.phone && (
                  <a
                    href={generateWhatsAppLink(
                      selectedCard.customer.phone,
                      `Hello ${selectedCard.customer.customer_name}, this is from ${currentShop.shop_name}. Your vehicle (${selectedCard.bike_number}) service update: Due Amount ₹${selectedCard.customer.current_due}. Pay via UPI: ${currentShop.upi_id}`
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition"
                  >
                    <Send className="w-3.5 h-3.5" /> WhatsApp Reminder
                  </a>
                )}
              </div>
            </div>
          </div>

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

            {/* Quick Metrics Badges: Bike Model, Fuel, Advance, Estimated */}
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
                <span className="text-slate-200 font-medium">{selectedCard.customer_complaints || 'General Service & Checkup'}</span>
              </div>
              {selectedCard.mechanic_notes && (
                <div className="text-slate-400 pt-1 border-t border-slate-800">
                  <span className="font-bold text-sky-400">Mechanic Inspection Notes: </span>
                  <span className="text-slate-300">{selectedCard.mechanic_notes}</span>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* LEFT: PARTS REVIEW, WARRANTY, QUANTITY (+/-) & UNLISTED MANUAL EDITING (lg: 7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                    Parts &amp; Consumables Breakdown
                  </h3>
                  <button
                    onClick={() => setShowAddPart(!showAddPart)}
                    className="text-xs text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> + Add Forgotten Part
                  </button>
                </div>

                {/* Add forgotten / missing part drawer */}
                {showAddPart && (
                  <div className="p-3 bg-slate-950 rounded-xl border border-amber-500/40 mb-3 space-y-3">
                    <div className="flex border-b border-slate-800 pb-2 gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => setMissingItemMode('catalog')}
                        className={`px-3 py-1 rounded-lg font-bold transition ${
                          missingItemMode === 'catalog'
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        📦 Inventory Catalog
                      </button>
                      <button
                        type="button"
                        onClick={() => setMissingItemMode('custom')}
                        className={`px-3 py-1 rounded-lg font-bold transition ${
                          missingItemMode === 'custom'
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        ➕ Custom / Missing Item
                      </button>
                    </div>

                    {missingItemMode === 'catalog' ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          placeholder="Search inventory to add..."
                          value={invSearch}
                          onChange={(e) => setInvSearch(e.target.value)}
                          className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100"
                        />
                        <div className="max-h-36 overflow-y-auto space-y-1">
                          {invItems.map((item) => (
                            <div
                              key={item.id}
                              className="p-1.5 rounded bg-slate-900 flex items-center justify-between text-xs"
                            >
                              <div>
                                <span className="font-bold text-slate-100">{item.part_name}</span>
                                <span className="text-[10px] text-slate-400 ml-2">Stock: {item.stock_quantity}</span>
                              </div>
                              <button
                                onClick={() => handleAddForgottenPart(item)}
                                className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 transition"
                              >
                                + ₹{item.unit_price}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <form onSubmit={handleAddCustomMissingItem} className="space-y-2">
                        <div className="text-[11px] text-slate-300 font-semibold">
                          Add custom or non-inventory part / labor service:
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <input
                            type="text"
                            placeholder="Item / Service Name (e.g. Clutch Wire)"
                            value={customItemName}
                            onChange={(e) => setCustomItemName(e.target.value)}
                            className="sm:col-span-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 font-medium"
                            required
                          />
                          <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-lg px-2">
                            <span className="text-slate-400 text-xs">Qty:</span>
                            <input
                              type="number"
                              min="1"
                              value={customItemQty}
                              onChange={(e) => setCustomItemQty(Math.max(1, Number(e.target.value) || 1))}
                              className="w-full py-1 bg-transparent text-xs text-slate-100 font-mono text-center focus:outline-none"
                              required
                            />
                          </div>
                          <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-lg px-2">
                            <span className="text-amber-400 text-xs font-bold">₹ Rate:</span>
                            <input
                              type="number"
                              min="0"
                              placeholder="0"
                              value={customItemPrice || ''}
                              onChange={(e) => setCustomItemPrice(Math.max(0, Number(e.target.value) || 0))}
                              className="w-full py-1 bg-transparent text-xs text-amber-300 font-mono font-bold focus:outline-none"
                              required
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setShowAddPart(false)}
                            className="px-3 py-1 rounded-lg bg-slate-800 text-slate-300 text-xs font-bold"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={isAddingMissingItem || !customItemName.trim()}
                            className="px-4 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow transition disabled:opacity-50"
                          >
                            {isAddingMissingItem ? 'Adding...' : '+ Add Item to Bill'}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  {(selectedCard.items || []).map((it) => (
                    <div
                      key={it.id}
                      className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-100">{it.item_name}</span>
                          {it.is_unlisted_manual && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-700 text-[10px]">
                              Manual
                            </span>
                          )}
                          <select
                            value={it.warranty_months || 0}
                            onChange={async (e) => {
                              const months = Number(e.target.value);
                              await (supabaseService as any).supabase
                                ?.from('job_card_items')
                                ?.update({ warranty_months: months })
                                ?.eq('id', it.id);
                              await loadJobCards();
                            }}
                            className="bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-[10px] text-emerald-400 font-bold"
                          >
                            <option value={0}>No Warranty</option>
                            <option value={6}>6M Warranty</option>
                            <option value={12}>12M Warranty</option>
                            <option value={24}>24M Warranty</option>
                          </select>
                        </div>

                        {/* CCTV timestamp and added_by_name */}
                        <div className="text-[10px] text-slate-400 mt-1 flex flex-wrap items-center gap-2 font-mono">
                          <span>Added by: {it.added_by_name}</span>
                          <span>•</span>
                          <span>CCTV: {formatCCTVTimestamp(it.created_at)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        {/* Quantity +/- Buttons */}
                        <div className="flex items-center bg-slate-900 rounded-lg border border-slate-800 px-1 py-0.5">
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
                          <span className="font-mono font-bold text-slate-100 px-2">
                            {it.quantity}
                          </span>
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
                        </div>

                        {/* Editable Unit Price on-the-spot for any item */}
                        {editingItemPriceId === it.id ? (
                          <div className="flex items-center gap-1">
                            <span className="text-slate-400">₹</span>
                            <input
                              type="number"
                              min="0"
                              value={editingItemPriceVal}
                              onChange={(e) => {
                                const val = Number(e.target.value) || 0;
                                setEditingItemPriceVal(val);
                                setSelectedCard((prev) => {
                                  if (!prev) return prev;
                                  return {
                                    ...prev,
                                    items: (prev.items || []).map((item) =>
                                      item.id === it.id ? { ...item, unit_price: val } : item
                                    ),
                                  };
                                });
                              }}
                              className="w-16 px-1.5 py-0.5 bg-slate-900 border border-amber-500 rounded text-right font-mono font-bold text-amber-300 text-xs"
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdateItemUnitPrice(it.id, editingItemPriceVal)}
                              className="px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 font-bold text-[10px]"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingItemPriceId(null)}
                              className="px-1 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px]"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (it.price_pending_inspection || Number(it.unit_price || 0) <= 0) ? (
                          <div className="flex items-center gap-1.5 p-1 px-2 rounded-xl bg-amber-500/20 border border-amber-500/50">
                            <span className="text-[10px] font-bold text-amber-300">Set Rate:</span>
                            <span className="text-slate-400 text-xs">₹</span>
                            <input
                              type="number"
                              min="0"
                              placeholder="0"
                              value={it.unit_price || ''}
                              onChange={(e) => {
                                const val = Math.max(0, Number(e.target.value) || 0);
                                setSelectedCard((prev) => {
                                  if (!prev) return prev;
                                  const updatedItems = (prev.items || []).map((item) =>
                                    item.id === it.id ? { ...item, unit_price: val, price_pending_inspection: val <= 0 } : item
                                  );
                                  return { ...prev, items: updatedItems };
                                });
                                setJobCards((prev) =>
                                  prev.map((c) => {
                                    if (c.id !== selectedCard.id) return c;
                                    const updatedItems = (c.items || []).map((item) =>
                                      item.id === it.id ? { ...item, unit_price: val, price_pending_inspection: val <= 0 } : item
                                    );
                                    return { ...c, items: updatedItems };
                                  })
                                );
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  const val = Number((e.target as HTMLInputElement).value) || 0;
                                  if (val > 0) handleUpdateItemUnitPrice(it.id, val);
                                }
                              }}
                              onBlur={(e) => {
                                const val = Number(e.target.value) || 0;
                                if (val > 0) handleUpdateItemUnitPrice(it.id, val);
                              }}
                              className="w-16 px-1.5 py-0.5 bg-slate-900 border border-amber-400 rounded text-right font-mono font-bold text-amber-300 text-xs focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const val = Number(it.unit_price) || 0;
                                if (val > 0) {
                                  handleUpdateItemUnitPrice(it.id, val);
                                } else {
                                  notify.alert('Please enter a valid rate greater than ₹0.', 'Invalid Rate', 'warning');
                                }
                              }}
                              className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] shadow transition flex items-center gap-0.5"
                            >
                              ✓ Set Rate
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-amber-400 text-sm min-w-[50px] text-right">
                              ₹{(it.unit_price || 0) * (it.quantity || 1)}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingItemPriceId(it.id);
                                setEditingItemPriceVal(it.unit_price || 0);
                              }}
                              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-amber-300 transition"
                              title="Edit Item Rate"
                            >
                              <Edit className="w-3 h-3" />
                            </button>
                          </div>
                        )}

                        {(it.is_unlisted_manual || !it.part_id) && (
                          <button
                            type="button"
                            onClick={() => handleSaveUnlistedToMasterInventory(it)}
                            className="px-2 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold flex items-center gap-1 transition"
                            title="Save custom part to workshop master inventory"
                          >
                            <Package className="w-3 h-3 text-emerald-400" />
                            <span>📦 Save to Master Inventory</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleDeleteCardItem(it.id, it.item_name)}
                          className="p-1 text-slate-500 hover:text-rose-400 transition"
                          title="Remove Item from Card"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Outside Lathe / Welding Work */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-amber-400" /> Outside Lathe / Welding / Machining
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    Customer sees customer price; shop cost recorded for margins
                  </span>
                </div>

                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Description (e.g. Lathe Hub Boring, Crank Alignment, Cylinder Re-bore)"
                    value={outsideDesc}
                    onChange={(e) => setOutsideDesc(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Shop Vendor Cost (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="e.g. 150"
                        value={outsideShopCost}
                        onChange={(e) => setOutsideShopCost(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Customer Billed Price (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="e.g. 250"
                        value={outsideCustPrice}
                        onChange={(e) => setOutsideCustPrice(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-slate-950 border border-amber-500/50 rounded-xl text-xs font-mono font-bold text-amber-300"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT: LABOUR, DISCOUNTS CAP, STRICT CREDIT LOCK & SETTLEMENT (lg: 5 cols) */}
            <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-4">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider border-b border-slate-800 pb-2">
                Billing &amp; Payment Settlement
              </h3>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">
                    Labour Charge (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={labourCharge}
                    onChange={(e) => setLabourCharge(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl font-mono font-bold text-slate-100"
                  />
                </div>

                <div className="flex items-center justify-between text-slate-400">
                  <span>Shop Consumables &amp; Solvents:</span>
                  <span className="font-mono text-slate-200">₹{consumableCharge}</span>
                </div>

                {/* Extra Discount (Cap ₹100, owner approval beyond) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-400 font-semibold">
                      Discount / Adjustment (₹)
                    </label>
                    <span className="text-[10px] text-slate-500">
                      Manager limit: ₹100
                    </span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    value={extraDiscount}
                    onChange={(e) => setExtraDiscount(Number(e.target.value))}
                    className={`w-full px-3 py-2 bg-slate-950 border rounded-xl font-mono ${
                      extraDiscount > 100
                        ? 'border-amber-500 text-amber-300 font-bold'
                        : 'border-slate-700 text-slate-100'
                    }`}
                  />

                  {/* Discount Approval Notice */}
                  {extraDiscount > 100 && (
                    <div className="mt-2 p-2 rounded-lg bg-amber-950/60 border border-amber-600/60 text-[11px] space-y-1">
                      {selectedCard.discount_approval_status === 'approved' ? (
                        <p className="text-emerald-400 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Owner Approved Discount of ₹{extraDiscount}
                        </p>
                      ) : selectedCard.discount_approval_status === 'pending' ? (
                        <p className="text-amber-300 font-bold flex items-center gap-1 animate-pulse">
                          <Clock className="w-3.5 h-3.5" /> Discount Approval Pending on Owner Dashboard...
                        </p>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          <p className="text-amber-200">
                            Discount exceeds Manager limit (₹100). Owner approval required to finalize bill.
                          </p>
                          <button
                            type="button"
                            onClick={handleRequestOwnerDiscountApproval}
                            disabled={requestingDiscount}
                            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs self-start"
                          >
                            {requestingDiscount ? 'Sending...' : '🚨 Request Owner Discount Approval'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Comprehensive Transparent Workshop Calculation Card */}
                <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-300">
                    <span>Parts &amp; Spares Total:</span>
                    <span className="font-mono font-bold text-slate-100">₹{currentItemsTotal}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span>Workshop Labour &amp; Tuning:</span>
                    <span className="font-mono font-bold text-slate-100">₹{currentLabour}</span>
                  </div>
                  {currentOutside > 0 && (
                    <div className="flex items-center justify-between text-slate-300">
                      <span>Outside Lathe / Machining:</span>
                      <span className="font-mono font-bold text-slate-100">₹{currentOutside}</span>
                    </div>
                  )}
                  {currentConsumable > 0 && (
                    <div className="flex items-center justify-between text-slate-300">
                      <span>Workshop Consumables:</span>
                      <span className="font-mono font-bold text-slate-100">₹{currentConsumable}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-slate-400 border-t border-slate-800/80 pt-1.5 font-medium">
                    <span>Subtotal:</span>
                    <span className="font-mono text-slate-200">₹{currentSubtotal}</span>
                  </div>
                  {currentDiscount > 0 && (
                    <div className="flex items-center justify-between text-rose-400 font-medium">
                      <span>Discount:</span>
                      <span className="font-mono">-₹{currentDiscount}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between border-t border-slate-800 pt-2 text-sm font-bold">
                    <span className="text-slate-100">Gross Total Bill:</span>
                    <span className="font-mono font-black text-amber-400 text-lg">₹{currentGrossTotal}</span>
                  </div>
                  {currentAdvance > 0 && (
                    <div className="flex items-center justify-between text-emerald-400 font-semibold bg-emerald-950/30 px-2.5 py-1.5 rounded-lg border border-emerald-900/50">
                      <span>Advance Received at Intake:</span>
                      <span className="font-mono">-₹{currentAdvance}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between bg-slate-900 px-3 py-2 rounded-xl border border-slate-700/80 text-sm font-extrabold">
                    <span className="text-white">Net to Collect at Handover:</span>
                    <span className="font-mono font-black text-emerald-400 text-lg">₹{calculatedNetPayable}</span>
                  </div>
                </div>
              </div>

              {/* CUSTOMER COMPLAINTS & CHECK-UP FOLLOW-UP */}
              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-3 text-xs">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Customer Complaint Quick-Tags
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {['Engine Oil Leak', 'Brake Noise / Weak', 'Starting Problem', 'Chain Loose / Sound', 'Low Mileage', 'Fork Oil Leak', 'Wiring / Horn'].map((tag) => {
                      const isSel = selectedComplaints.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => {
                            setSelectedComplaints((prev) =>
                              isSel ? prev.filter((t) => t !== tag) : [...prev, tag]
                            );
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                            isSel
                              ? 'bg-amber-500 text-slate-950 font-bold'
                              : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
                          }`}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Follow-up Re-inspection selector */}
                <div className="pt-2 border-t border-slate-800/80">
                  <label className="block text-[11px] font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>📅 Schedule Check-up Follow-up (Optional Re-inspection)</span>
                  </label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {[
                      { id: 'none', label: 'None' },
                      { id: '3_days', label: 'After 3 Days' },
                      { id: '7_days', label: 'After 7 Days' },
                      { id: '15_days', label: 'After 15 Days' },
                      { id: 'custom', label: 'Custom Date' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setFollowupDaysOption(opt.id as any)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                          followupDaysOption === opt.id
                            ? 'bg-amber-500 text-slate-950 font-bold'
                            : 'bg-slate-900 text-slate-400 border border-slate-800'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {followupDaysOption === 'custom' && (
                    <input
                      type="date"
                      value={customFollowupDate}
                      onChange={(e) => setCustomFollowupDate(e.target.value)}
                      className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 mb-2"
                    />
                  )}

                  {followupDaysOption !== 'none' && (
                    <input
                      type="text"
                      placeholder="Follow-up note (e.g. Check chain lube & oil level after running 100km)"
                      value={followupNote}
                      onChange={(e) => setFollowupNote(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder:text-slate-500"
                    />
                  )}
                </div>
              </div>

              {/* PAYMENT MODE & 3-WAY SPLIT SETTLEMENT */}
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <label className="block text-xs font-bold text-slate-300">
                  Payment Mode &amp; Settlement
                </label>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentChoice('cash');
                      setCashToCollect(calculatedNetPayable);
                      setSplitUpiAmount(0);
                      setKhataAmount(0);
                    }}
                    className={`py-2 rounded-xl text-xs font-bold flex flex-col items-center gap-1 border transition ${
                      paymentChoice === 'cash'
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black'
                        : 'bg-slate-950 text-slate-300 border-slate-800'
                    }`}
                  >
                    <Banknote className="w-4 h-4" />
                    <span>Cash</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPaymentChoice('upi');
                      setCashToCollect(0);
                      setSplitUpiAmount(calculatedNetPayable);
                      setKhataAmount(0);
                    }}
                    className={`py-2 rounded-xl text-xs font-bold flex flex-col items-center gap-1 border transition ${
                      paymentChoice === 'upi'
                        ? 'bg-indigo-500 text-slate-100 border-indigo-400 font-black'
                        : 'bg-slate-950 text-slate-300 border-slate-800'
                    }`}
                  >
                    <QrCode className="w-4 h-4" />
                    <span>UPI QR</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPaymentChoice('split_cash_upi');
                      const half = Math.round(calculatedNetPayable / 2);
                      setCashToCollect(half);
                      setSplitCashAmount(half);
                      setSplitUpiAmount(calculatedNetPayable - half);
                      setKhataAmount(0);
                    }}
                    className={`py-2 rounded-xl text-xs font-bold flex flex-col items-center gap-1 border transition ${
                      paymentChoice === 'split_cash_upi'
                        ? 'bg-sky-500 text-slate-950 border-sky-400 font-black'
                        : 'bg-slate-950 text-slate-300 border-slate-800'
                    }`}
                  >
                    <DollarSign className="w-4 h-4" />
                    <span>Cash + UPI</span>
                  </button>

                  <button
                    type="button"
                    disabled={selectedCard.customer?.trust_tier === 'blocked'}
                    onClick={() => {
                      setPaymentChoice('split_credit');
                      const cust = selectedCard.customer;
                      if (selectedCard.credit_override_status === 'approved') {
                        const approvedLimit = Math.min(Number(selectedCard.approved_credit_amount || selectedCard.credit_override_amount || 0), calculatedNetPayable);
                        const requiredImmediateCash = Math.max(0, calculatedNetPayable - approvedLimit);
                        setKhataAmount(approvedLimit);
                        setCashToCollect(requiredImmediateCash);
                        setSplitUpiAmount(0);
                      } else {
                        const avail = cust ? Math.max(0, Number(cust.credit_limit || 0) - Number(cust.current_due || 0)) : 0;
                        const maxKhata = Math.min(calculatedNetPayable, avail);
                        setKhataAmount(maxKhata);
                        setCashToCollect(Math.max(0, calculatedNetPayable - maxKhata));
                        setSplitUpiAmount(0);
                      }
                    }}
                    className={`py-2 rounded-xl text-xs font-bold flex flex-col items-center gap-1 border transition disabled:opacity-40 ${
                      paymentChoice === 'split_credit'
                        ? 'bg-amber-500 text-slate-950 border-amber-400 font-black'
                        : 'bg-slate-950 text-slate-300 border-slate-800'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Credit / Udhar</span>
                  </button>
                </div>

                {/* 3 DISTINCT NUMERIC BOXES WITH STRICT UDHAAR OVERRIDE LOCK & AUTO-CALCULATION */}
                {(() => {
                  const isApprovedCredit = selectedCard.credit_override_status === 'approved';
                  const approvedCreditAmt = Number(selectedCard.approved_credit_amount || selectedCard.credit_override_amount || 0);
                  const isPartialLock = isApprovedCredit && approvedCreditAmt > 0;
                  const maxKhataLimit = isPartialLock ? Math.min(calculatedNetPayable, approvedCreditAmt) : calculatedNetPayable;
                  const mandatoryCashRequired = isPartialLock ? Math.max(0, calculatedNetPayable - approvedCreditAmt) : 0;
                  const collectedNow = Number(cashToCollect || 0) + Number(splitUpiAmount || 0);
                  const remainingMandatoryDue = isPartialLock ? Math.max(0, mandatoryCashRequired - collectedNow) : 0;
                  const currentBalance = Math.round((calculatedNetPayable - (Number(cashToCollect || 0) + Number(splitUpiAmount || 0) + Number(khataAmount || 0)) + Number.EPSILON) * 100) / 100;

                  return (
                    <div className="space-y-2.5">
                      <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wide">
                            Payment Settlement Breakdown (Net Due: ₹{calculatedNetPayable})
                          </span>
                          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md ${
                            currentBalance === 0
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : 'bg-amber-950 text-amber-300 border border-amber-800'
                          }`}>
                            {currentBalance === 0 ? '✅ Settled: ₹0 remaining' : `Remaining to Settle: ₹${currentBalance}`}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                          {/* Box 1: Cash Collected Now */}
                          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-700/80">
                            <label className="text-[10px] font-bold text-emerald-400 block mb-1">
                              💵 (1) Cash Collected Now (₹)
                            </label>
                            <input
                              type="number"
                              min="0"
                              max={calculatedNetPayable}
                              value={cashToCollect}
                              onChange={(e) => {
                                const cash = Math.min(calculatedNetPayable, Math.max(0, Number(e.target.value) || 0));
                                setCashToCollect(cash);
                                if (isPartialLock) {
                                  const needed = Math.max(0, mandatoryCashRequired - cash);
                                  setSplitUpiAmount(needed);
                                  setKhataAmount(maxKhataLimit);
                                } else if (paymentChoice === 'split_cash_upi') {
                                  setSplitUpiAmount(Math.max(0, calculatedNetPayable - cash));
                                  setKhataAmount(0);
                                } else {
                                  const remaining = Math.max(0, calculatedNetPayable - cash - Number(splitUpiAmount || 0));
                                  setKhataAmount(remaining);
                                }
                              }}
                              className="w-full px-2.5 py-1.5 bg-slate-950 border border-emerald-500/50 rounded-lg text-xs font-mono font-bold text-emerald-300"
                            />
                          </div>

                          {/* Box 2: UPI Collected Now */}
                          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-700/80">
                            <label className="text-[10px] font-bold text-indigo-400 block mb-1">
                              📱 (2) UPI Collected Now (₹)
                            </label>
                            <input
                              type="number"
                              min="0"
                              max={calculatedNetPayable}
                              value={splitUpiAmount}
                              onChange={(e) => {
                                const upi = Math.min(calculatedNetPayable, Math.max(0, Number(e.target.value) || 0));
                                setSplitUpiAmount(upi);
                                if (isPartialLock) {
                                  const needed = Math.max(0, mandatoryCashRequired - upi);
                                  setCashToCollect(needed);
                                  setKhataAmount(maxKhataLimit);
                                } else if (paymentChoice === 'split_cash_upi') {
                                  setCashToCollect(Math.max(0, calculatedNetPayable - upi));
                                  setKhataAmount(0);
                                } else {
                                  const remaining = Math.max(0, calculatedNetPayable - Number(cashToCollect || 0) - upi);
                                  setKhataAmount(remaining);
                                }
                              }}
                              className="w-full px-2.5 py-1.5 bg-slate-950 border border-indigo-500/50 rounded-lg text-xs font-mono font-bold text-indigo-300"
                            />
                          </div>

                          {/* Box 3: Balance Transferred to Khata */}
                          <div className={`p-2.5 rounded-xl bg-slate-900 border ${isPartialLock ? 'border-amber-500/80 bg-amber-950/20' : 'border-slate-700/80'}`}>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[10px] font-bold text-amber-400 block">
                                📒 (3) Balance to Khata (₹)
                              </label>
                              {isPartialLock && (
                                <span className="text-[9px] text-amber-300 font-bold bg-amber-500/20 px-1 py-0.2 rounded border border-amber-500/40">
                                  🔒 Max ₹{approvedCreditAmt}
                                </span>
                              )}
                            </div>
                            <input
                              type="number"
                              min="0"
                              max={maxKhataLimit}
                              value={khataAmount}
                              readOnly={isPartialLock}
                              onChange={(e) => {
                                if (isPartialLock) return;
                                const khata = Math.min(maxKhataLimit, Math.max(0, Number(e.target.value) || 0));
                                setKhataAmount(khata);
                                const remCash = Math.max(0, calculatedNetPayable - khata - Number(splitUpiAmount || 0));
                                setCashToCollect(remCash);
                              }}
                              className={`w-full px-2.5 py-1.5 bg-slate-950 border rounded-lg text-xs font-mono font-bold text-amber-300 ${
                                isPartialLock ? 'border-amber-500/80 cursor-not-allowed bg-slate-950/80' : 'border-amber-500/50'
                              }`}
                            />
                          </div>
                        </div>
                      </div>

                      {/* STRICT WARNING WHEN MANDATORY PAID PORTION IS NOT COLLECTED */}
                      {isPartialLock && remainingMandatoryDue > 0 && (
                        <div className="p-3 bg-rose-950 border-2 border-rose-600 rounded-xl text-rose-200 text-xs font-bold flex items-start gap-2.5 shadow-xl animate-pulse">
                          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                          <div>
                            <div className="text-rose-100 font-black uppercase text-[11px] tracking-wide">
                              ⚠️ STRICT VEHICLE RETENTION GATEWAY
                            </div>
                            <div className="mt-0.5 text-rose-200 font-bold leading-relaxed">
                              ⚠️ Vehicle retained in workshop! Remaining ₹{remainingMandatoryDue} must be paid via Cash/UPI before vehicle release.
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* UPI QR & UTR VERIFICATION (Shown when UPI is being collected) */}
                {splitUpiAmount > 0 && (
                  <div className="p-3.5 bg-slate-950 rounded-2xl border border-indigo-900/60 space-y-3 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <QrCode className="w-4 h-4 text-indigo-400" />
                        <span className="font-bold text-indigo-200">
                          Scan &amp; Pay ₹{splitUpiAmount} via UPI
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-950 text-indigo-300 border border-indigo-800">
                        Txn: BR-{selectedCard.id.slice(-4).toUpperCase()}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                      {upiQrDataUrl && (
                        <div className="p-2 bg-white rounded-xl shadow-md text-center shrink-0">
                          <img src={upiQrDataUrl} alt="UPI QR" className="w-24 h-24 mx-auto" />
                          <span className="text-[8px] font-mono font-bold text-slate-900 block mt-0.5">
                            ₹{splitUpiAmount}
                          </span>
                        </div>
                      )}

                      <div className="flex-1 min-w-[200px] space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-slate-400">UPI ID: <strong className="text-slate-200 font-mono">{currentShop.upi_id}</strong></span>
                          <button
                            type="button"
                            onClick={handleCopyUpiId}
                            className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold border border-slate-700 flex items-center gap-1 transition"
                          >
                            {copiedUpi ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            {copiedUpi ? 'Copied!' : '📋 Copy UPI ID'}
                          </button>
                        </div>

                        {/* Screenshot limit warning notice */}
                        <div className="p-2 rounded-xl bg-amber-950/40 border border-amber-600/40 text-[11px] text-amber-200 leading-snug">
                          💡 <strong>Note:</strong> ₹2,000 se bade bill ka screenshot scan karne par bank limit lagti hai. ₹2,000+ ke liye UPI ID copy karke ya Direct UPI Link se pay karein (Limit: ₹1,00,000).
                        </div>

                        {/* Direct App Deep Link */}
                        <a
                          href={`upi://pay?pa=${currentShop.upi_id}&pn=${encodeURIComponent(currentShop.shop_name)}&am=${splitUpiAmount}&tr=BR-${selectedCard.id.slice(-4).toUpperCase()}&tn=BR-${selectedCard.id.slice(-4).toUpperCase()}-${selectedCard.bike_number}&mc=5541&cu=INR`}
                          className="inline-flex items-center gap-1 text-[11px] text-indigo-400 font-bold underline hover:text-indigo-300"
                        >
                          🔗 Click here to Open Google Pay / PhonePe / Paytm Directly
                        </a>
                      </div>
                    </div>

                    {/* 12-Digit UPI UTR Input Field & In-App Confirm Button */}
                    <div className="pt-2 border-t border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="block text-[11px] font-bold text-indigo-300">
                          UPI UTR / Reference Code
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            const generatedCode = `BR-UPI-${Date.now().toString(36).toUpperCase().slice(-6)}`;
                            setUpiRefNumber(`${generatedCode} (🟢 UPI VERIFIED)`);
                            notify.success(`Payment verified with code ${generatedCode}!`, 'UPI Verified');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[10px] transition flex items-center gap-1 shadow-sm cursor-pointer"
                        >
                          <CheckCircle2 className="w-3 h-3 text-slate-950" />
                          <span>✅ Confirm UPI Payment Received in App</span>
                        </button>
                      </div>
                      <input
                        type="text"
                        placeholder="e.g. 425612345678 or tap button above to verify"
                        value={upiRefNumber}
                        onChange={(e) => setUpiRefNumber(e.target.value.trim())}
                        className="w-full px-3 py-2 bg-slate-900 border border-indigo-500/50 rounded-xl text-xs font-mono font-bold text-indigo-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-400"
                      />
                      {upiRefNumber.includes('UPI VERIFIED') && (
                        <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>🟢 UPI VERIFIED &amp; Stamped in Cloud</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* KHATA / UDHAAR STATUS & SHORTFALL RESOLUTION */}
                {khataAmount > 0 && (
                  <div className="space-y-2.5 text-xs">
                    {/* Live breakdown banner */}
                    <div className="p-3 bg-amber-950/50 border border-amber-600/50 rounded-xl text-amber-200 space-y-1">
                      <div className="flex items-center justify-between font-bold">
                        <span>Total: ₹{currentBillTotal}</span>
                        <span className="text-emerald-400">Paying Now: ₹{cashToCollect + splitUpiAmount}</span>
                        <span className="text-rose-400">Udhaar Requested: ₹{khataAmount}</span>
                      </div>
                    </div>

                    {/* Check if Udhaar exceeds Customer Available Credit */}
                    {(() => {
                      const cust = selectedCard.customer;
                      const availCredit = cust ? Math.max(0, (cust.credit_limit || 0) - (cust.current_due || 0)) : 0;
                      const isApproved = selectedCard.credit_override_status === 'approved';
                      const isPending = selectedCard.credit_override_status === 'pending';
                      const shortfall = Math.max(0, khataAmount - availCredit);

                      if (isApproved) {
                        return (
                          <div className="p-2.5 bg-emerald-950/80 border border-emerald-600 rounded-xl text-emerald-300 text-xs font-bold flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4" />
                            ✅ Owner Approved Credit Override for ₹{khataAmount}!
                          </div>
                        );
                      }

                      if (shortfall > 0) {
                        return (
                          <div className="p-3 bg-rose-950 border-2 border-rose-600 rounded-xl text-rose-100 space-y-2 shadow-lg">
                            <div className="flex items-center gap-2">
                              <Lock className="w-4 h-4 text-rose-400 shrink-0" />
                              <span className="font-black text-xs uppercase tracking-wide text-rose-200">
                                🔒 SYSTEM CREDIT LOCKED (Shortfall ₹{shortfall})
                              </span>
                            </div>
                            <p className="text-[11px] font-semibold text-rose-200 leading-snug">
                              Available Customer Credit is ₹{availCredit}. Requested Udhaar (₹{khataAmount}) exceeds limit by ₹{shortfall}.
                            </p>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                              {/* Option A: Use Manager Wallet Quota */}
                              <button
                                type="button"
                                onClick={handleUseManagerDailyQuota}
                                disabled={remainingWallet <= 0}
                                className="py-2 px-2.5 rounded-lg bg-sky-950 hover:bg-sky-900 border border-sky-600/80 text-sky-200 font-bold text-xs flex items-center justify-between transition disabled:opacity-40"
                              >
                                <span>Use Daily Quota (₹{remainingWallet})</span>
                                <span className="font-mono text-sky-400">+ Cover</span>
                              </button>

                              {/* Option B: Request Owner Credit Override */}
                              <button
                                type="button"
                                onClick={handleRequestOwnerCreditOverride}
                                disabled={requestingCredit || isPending}
                                className="py-2 px-2.5 rounded-lg bg-rose-900/60 hover:bg-rose-800 border border-rose-600 text-rose-200 font-bold text-xs flex items-center justify-between transition disabled:opacity-40"
                              >
                                <span>{isPending ? '⏳ Override Pending...' : `🚨 Request Owner Override (₹${shortfall})`}</span>
                                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                              </button>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div className="p-2.5 bg-emerald-950/40 border border-emerald-800/60 rounded-xl text-emerald-300 text-xs flex items-center justify-between">
                          <span>Customer Credit Limit: ₹{cust?.credit_limit || 0}</span>
                          <span className="font-bold">✅ Within Available Limit (₹{availCredit})</span>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* ACTION: FINALIZE & BILL */}
              {(() => {
                const approvedCreditAmt = Number(selectedCard.approved_credit_amount || selectedCard.credit_override_amount || 0);
                const isPartialLock = selectedCard.credit_override_status === 'approved' && approvedCreditAmt > 0;
                const mandatoryCashRequired = isPartialLock ? Math.max(0, calculatedNetPayable - approvedCreditAmt) : 0;
                const collectedPaid = Number(cashToCollect || 0) + Number(splitUpiAmount || 0);
                const isPartialPaymentShort = isPartialLock && collectedPaid < mandatoryCashRequired;
                const remainingMandatory = Math.max(0, mandatoryCashRequired - collectedPaid);
                const totalSettled = collectedPaid + Number(khataAmount || 0);
                const isTotalNotMet = totalSettled < calculatedNetPayable;

                return (
                  <button
                    type="button"
                    disabled={isFinalizingBill || isDiscountLocked || isPartialPaymentShort || isTotalNotMet}
                    onClick={handleFinalizeAndBill}
                    className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-sm shadow-lg shadow-amber-500/20 transition flex items-center justify-center gap-2 disabled:opacity-40"
                  >
                    <CheckCircle2 className={`w-4 h-4 ${isFinalizingBill ? 'animate-spin' : ''}`} />
                    {isFinalizingBill
                      ? 'Finalizing Bill & Generating Invoice...'
                      : isDiscountLocked
                      ? 'Discount Approval Required'
                      : isPartialPaymentShort
                      ? `⚠️ Vehicle Retained — Remaining ₹${remainingMandatory} Must Be Paid`
                      : isTotalNotMet
                      ? `⚠️ Settle Balance (₹${Math.round((calculatedNetPayable - totalSettled) * 100) / 100}) to Finalize`
                      : `⚡ Hand Over Vehicle & Finalize Bill (₹${currentBillTotal})`}
                  </button>
                );
              })()}

              {/* CANCEL / DELETE JOB CARD */}
              {selectedCard.status !== 'completed' && (
                <button
                  type="button"
                  onClick={handleDeleteSelectedJobCard}
                  className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-rose-950 text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-800 text-xs font-bold transition flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" /> 🗑️ Cancel &amp; Delete Job Card
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* RECORD DAILY WALLET / WORKSHOP EXPENSE MODAL */}
      {showWalletModal && !isTempMgr && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl p-6">
            <h3 className="text-base font-bold text-slate-100 mb-3 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-amber-400" /> {isOwner ? '💸 Record Workshop Expense' : 'Record Wallet Expense / Staff Upad'}
            </h3>

            <form onSubmit={handleRecordExpense} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Expense Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setExpenseType('shop_expense')}
                    className={`py-2 rounded-xl text-xs font-bold border transition ${
                      expenseType === 'shop_expense'
                        ? 'bg-amber-500 text-slate-950 border-amber-400'
                        : 'bg-slate-950 text-slate-300 border-slate-800'
                    }`}
                  >
                    Workshop Expense
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpenseType('staff_upad')}
                    className={`py-2 rounded-xl text-xs font-bold border transition ${
                      expenseType === 'staff_upad'
                        ? 'bg-amber-500 text-slate-950 border-amber-400'
                        : 'bg-slate-950 text-slate-300 border-slate-800'
                    }`}
                  >
                    Staff Upad Advance
                  </button>
                </div>
              </div>

              {expenseType === 'shop_expense' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Expense Category
                  </label>
                  <select
                    value={expenseCategory}
                    onChange={(e) => setExpenseCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100"
                  >
                    <option value="Workshop Supplies">Workshop Supplies</option>
                    <option value="Tea & Refreshments">Tea &amp; Refreshments</option>
                    <option value="Kerosene & Cleaning">Kerosene &amp; Cleaning</option>
                    <option value="Lathe & Outside Work">Lathe &amp; Outside Work</option>
                    <option value="Electricity & Utilities">Electricity &amp; Utilities</option>
                    <option value="Shop Rent">Shop Rent</option>
                    <option value="Tools & Equipment">Tools &amp; Equipment</option>
                    <option value="Other Workshop Expense">Other Workshop Expense</option>
                  </select>
                </div>
              )}

              {/* Payment Mode (Cash vs UPI Separation) */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Payment Paid From
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setExpensePaymentMode('cash')}
                    className={`py-2 rounded-xl text-xs font-bold border transition ${
                      expensePaymentMode === 'cash'
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                        : 'bg-slate-950 text-slate-300 border-slate-800'
                    }`}
                  >
                    💵 Cash Drawer
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpensePaymentMode('upi')}
                    className={`py-2 rounded-xl text-xs font-bold border transition ${
                      expensePaymentMode === 'upi'
                        ? 'bg-indigo-500 text-slate-100 border-indigo-400'
                        : 'bg-slate-950 text-slate-300 border-slate-800'
                    }`}
                  >
                    📱 Online UPI
                  </button>
                </div>
              </div>

              {expenseType === 'staff_upad' && (
                <div>
                  <label className="block text-xs font-semibold text-amber-300 mb-1">
                    Select Staff Member *
                  </label>
                  <select
                    required
                    value={upadStaffId}
                    onChange={(e) => {
                      setUpadStaffId(e.target.value);
                      const target = shopStaff.find((s) => s.id === e.target.value);
                      if (target && !expenseTitle) {
                        setExpenseTitle(`Staff Advance (${target.full_name})`);
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-950 border border-amber-500/50 rounded-xl text-xs text-slate-100"
                  >
                    <option value="">-- Choose Staff Member --</option>
                    {shopStaff.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.full_name} ({s.designation || s.role})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Title / Description *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tea & biscuits, Lathe work, Raju advance"
                  value={expenseTitle}
                  onChange={(e) => setExpenseTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-300">
                    Amount (₹) *
                  </label>
                  {!isOwner && (
                    <span className="text-[10px] text-sky-400 font-mono">
                      Max Quota: ₹{remainingWallet}
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  required
                  min="1"
                  max={isOwner ? undefined : remainingWallet}
                  placeholder={isOwner ? 'Enter amount (₹)' : `Max ₹${remainingWallet}`}
                  value={expenseAmount}
                  onChange={(e) =>
                    setExpenseAmount(e.target.value === '' ? '' : Number(e.target.value))
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-100"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowWalletModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition shadow-md shadow-amber-500/20"
                >
                  Save to Galla Tally
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE NEW JOB CARD / VEHICLE INTAKE MODAL */}
      {showNewCardModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Plus className="w-4 h-4 text-amber-400" /> Create New Job Card / Vehicle Intake
              </h3>
              <button
                type="button"
                onClick={() => setShowNewCardModal(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateNewJobCard} className="space-y-3.5 text-xs max-h-[80vh] overflow-y-auto pr-1">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-semibold">
                    Bike Registration Number *
                  </label>
                  <button
                    type="button"
                    onClick={() => startVoiceInput('bike')}
                    className="px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1 border border-amber-500/30 bg-slate-800 text-amber-300 hover:bg-slate-700"
                  >
                    <Mic className="w-3 h-3" />
                    <span>🎤 Speak</span>
                  </button>
                </div>
                <input
                  type="text"
                  required
                  placeholder="e.g. MH 12 AB 1234"
                  value={newBikeNumber}
                  onChange={(e) => handleNewBikeNumberChange(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-amber-500/50 rounded-xl text-xs font-mono font-bold text-amber-300 uppercase focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Past Visits History Lookup Badge */}
              {pastHistoryCards.length > 0 && (
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] space-y-1">
                  <div className="flex items-center justify-between text-amber-400 font-bold">
                    <span>📋 Past Service History ({pastHistoryCards.length} Visits Found)</span>
                    <span className="text-slate-400 font-mono">Last Odo: {pastHistoryCards[0]?.odometer_km || '—'} KM</span>
                  </div>
                  <div className="text-slate-400">
                    Last Visit: {formatSimpleDate(pastHistoryCards[0]?.created_at)} • Bill: ₹{pastHistoryCards[0]?.total_bill}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Bike Brand &amp; Model
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Honda Activa 6G, Pulsar 150"
                    value={newBikeModel}
                    onChange={(e) => setNewBikeModel(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Fuel Gauge Level
                  </label>
                  <div className="grid grid-cols-5 gap-1">
                    {(['Empty', '25%', '50%', '75%', 'Full'] as const).map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setNewFuelLevel(lvl)}
                        className={`py-1.5 rounded-lg text-[10px] font-bold border transition ${
                          newFuelLevel === lvl
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-300 font-semibold">
                      Customer Name
                    </label>
                    <button
                      type="button"
                      onClick={() => startVoiceInput('name')}
                      className="px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1 border border-amber-500/30 bg-slate-800 text-amber-300 hover:bg-slate-700"
                    >
                      <Mic className="w-3 h-3" />
                      <span>🎤 Speak</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. Rajesh Kumar"
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Mobile Number (10 Digits)
                  </label>
                  <input
                    type="tel"
                    maxLength={10}
                    placeholder="e.g. 9876543210"
                    value={newCustomerPhone}
                    onChange={(e) => setNewCustomerPhone(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Customer Address / Area (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Main Market, Shiv Nagar"
                  value={newCustomerAddress}
                  onChange={(e) => setNewCustomerAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Odometer (KM)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 18500"
                    value={newOdometer}
                    onChange={(e) => setNewOdometer(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl font-mono text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Advance Paid (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 500"
                    value={newAdvancePaid}
                    onChange={(e) => setNewAdvancePaid(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl font-mono text-emerald-400 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Estimated Cost (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 1500"
                    value={newEstimatedCost}
                    onChange={(e) => setNewEstimatedCost(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl font-mono text-amber-300 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Assign Mechanic
                </label>
                <select
                  value={newAssignedMechId}
                  onChange={(e) => setNewAssignedMechId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100"
                >
                  <option value="">-- Auto / Any Available Mechanic --</option>
                  {shopStaff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name} ({s.designation || s.role})
                    </option>
                  ))}
                </select>
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
                    const isSel = newSelectedQuickChips.includes(chip.label);
                    return (
                      <button
                        key={chip.label}
                        type="button"
                        onClick={() =>
                          setNewSelectedQuickChips((prev) =>
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
                  <label className="text-slate-300 font-semibold">
                    Detailed Customer Instructions &amp; Complaints
                  </label>
                  <button
                    type="button"
                    onClick={() => startVoiceInput('complaints')}
                    className="px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1 border border-amber-500/30 bg-slate-800 text-amber-300 hover:bg-slate-700"
                  >
                    <Mic className="w-3 h-3" />
                    <span>🎤 Speak Problem</span>
                  </button>
                </div>
                <textarea
                  rows={2}
                  placeholder="e.g. Engine heat ho rahi hai, front brake me sound aa raha hai, washing bhi karni hai..."
                  value={newCustomerComplaints}
                  onChange={(e) => setNewCustomerComplaints(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Mechanic Inspection / Intake Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Scratches on left mudguard, brake shoe worn out"
                  value={newMechanicNotes}
                  onChange={(e) => setNewMechanicNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNewCardModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingCard}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs font-bold transition shadow-md shadow-amber-500/20 disabled:opacity-50"
                >
                  {isCreatingCard ? 'Creating...' : '+ Create Job Card & Start Service'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT COMPLAINTS / NOTES MODAL */}
      {showEditComplaintsModal && selectedCard && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Edit className="w-4 h-4 text-amber-400" /> Edit Complaints &amp; Mechanic Notes
              </h3>
              <button
                type="button"
                onClick={() => setShowEditComplaintsModal(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveComplaintsAndNotes} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Customer Voice / Reported Problems
                </label>
                <textarea
                  rows={3}
                  value={editCardComplaints}
                  onChange={(e) => setEditCardComplaints(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100"
                  placeholder="Enter customer reported problems..."
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Mechanic Inspection Notes
                </label>
                <textarea
                  rows={2}
                  value={editCardMechNotes}
                  onChange={(e) => setEditCardMechNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100"
                  placeholder="Enter internal inspection notes..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowEditComplaintsModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingComplaints}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold"
                >
                  {isSavingComplaints ? 'Saving...' : 'Save Notes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REVISE COMPLETED BILL MODAL */}
      {revisingCard && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Edit className="w-4 h-4 text-amber-400" /> Edit / Revise Completed Bill ({revisingCard.bike_number})
              </h3>
              <button
                type="button"
                onClick={() => setRevisingCard(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveBillRevision} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Total Bill Amount (₹) *
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={revisedTotal}
                  onChange={(e) => setRevisedTotal(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl font-mono font-bold text-amber-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Cash Collected (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={revisedCash}
                    onChange={(e) => setRevisedCash(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl font-mono text-emerald-400 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    UPI Collected (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={revisedUpi}
                    onChange={(e) => setRevisedUpi(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl font-mono text-indigo-400 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Revision Reason / Audit Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Corrected labour charge as per customer discount agreement"
                  value={revisedNotes}
                  onChange={(e) => setRevisedNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setRevisingCard(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingRevision}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold"
                >
                  {isSavingRevision ? 'Saving...' : 'Save Bill Revision'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* IN-PLACE EDIT CARD MODAL */}
      {editingCard && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Edit className="w-4 h-4 text-amber-400" /> Edit Job Card Info
              </h3>
              <button
                type="button"
                onClick={() => setEditingCard(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveJobCardEdit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Bike Number
                </label>
                <input
                  type="text"
                  required
                  value={editBikeNumber}
                  onChange={(e) => setEditBikeNumber(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl font-mono font-bold text-amber-300 uppercase"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Customer Name
                </label>
                <input
                  type="text"
                  value={editCustomerName}
                  onChange={(e) => setEditCustomerName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Mobile Number
                </label>
                <input
                  type="tel"
                  maxLength={10}
                  value={editCustomerPhone}
                  onChange={(e) => setEditCustomerPhone(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Odometer (KM)
                </label>
                <input
                  type="number"
                  min="0"
                  value={editOdometer}
                  onChange={(e) => setEditOdometer(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl font-mono text-slate-100"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingCard(null)}
                  className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingCardEdit}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition disabled:opacity-50"
                >
                  {isSavingCardEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW / INSPECT COMPLETED CARD DETAILS MODAL (TASKS 4 & 5) */}
      {viewingDetailsCard && (() => {
        const items = viewingDetailsCard.items || [];
        const partsSum = items.reduce(
          (sum, it) => sum + (Number(it.unit_price) || 0) * (Number(it.quantity) || 1),
          0
        );
        const labour = Number(viewingDetailsCard.labour_charge || 0);
        const consumables = Number(
          viewingDetailsCard.consumable_charge !== undefined && viewingDetailsCard.consumable_charge !== null
            ? viewingDetailsCard.consumable_charge
            : 20
        );
        const grossBill = Number(viewingDetailsCard.total_bill) > 0 ? Number(viewingDetailsCard.total_bill) : partsSum + labour + consumables;
        const advancePaid = Number(viewingDetailsCard.advance_paid || 0);
        const netPayable = Math.max(0, grossBill - advancePaid);
        const cashPaid = Number(viewingDetailsCard.cash_collected ?? viewingDetailsCard.mandatory_cash_to_collect ?? 0);
        const upiPaid = Number(viewingDetailsCard.upi_collected ?? (viewingDetailsCard as any).upi_amount ?? 0);
        const paidAtDelivery = cashPaid + upiPaid;
        const totalPaidOverall = advancePaid + paidAtDelivery;
        const khataDue = Number(
          viewingDetailsCard.transferred_to_khata !== undefined
            ? viewingDetailsCard.transferred_to_khata
            : Math.max(0, netPayable - paidAtDelivery)
        );

        const phone = viewingDetailsCard.customer?.phone || viewingDetailsCard.customer_phone || '';
        const billMsg = generateItemizedWhatsAppBill(currentShop, viewingDetailsCard);
        const waUrl = generateWhatsAppLink(phone, billMsg);
        const smsMsg = generateSimpleSmsText(currentShop, viewingDetailsCard, 'bill');
        const smsUrl = generateSmsLink(phone, smsMsg);
        const isCopied = copiedBillId === viewingDetailsCard.id;

        return (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-amber-400" />
                    <span>Invoice Details: {viewingDetailsCard.bike_number}</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Customer: {viewingDetailsCard.customer?.customer_name || viewingDetailsCard.customer_name || 'Walk-in'} • Phone: {phone || 'N/A'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingDetailsCard(null)}
                  className="text-slate-400 hover:text-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Comprehensive 6-Figure Financial Breakdown (Task 4) */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-center font-mono">
                <div className="bg-slate-900/60 p-1.5 rounded-lg border border-slate-800">
                  <span className="text-[9px] text-slate-400 uppercase block">Gross Total</span>
                  <span className="text-amber-400 font-bold text-xs">₹{grossBill}</span>
                </div>
                <div className="bg-slate-900/60 p-1.5 rounded-lg border border-slate-800">
                  <span className="text-[9px] text-sky-400 uppercase block">Advance</span>
                  <span className="text-sky-300 font-bold text-xs">-₹{advancePaid}</span>
                </div>
                <div className="bg-slate-900/60 p-1.5 rounded-lg border border-slate-800">
                  <span className="text-[9px] text-amber-300 uppercase block">Net Delivery</span>
                  <span className="text-amber-300 font-bold text-xs">₹{netPayable}</span>
                </div>
                <div className="bg-slate-900/60 p-1.5 rounded-lg border border-slate-800">
                  <span className="text-[9px] text-emerald-400 uppercase block">Paid Delivery</span>
                  <span className="text-emerald-400 font-bold text-xs">₹{paidAtDelivery}</span>
                </div>
                <div className="bg-slate-900/60 p-1.5 rounded-lg border border-slate-800">
                  <span className="text-[9px] text-emerald-300 uppercase block">Total Paid</span>
                  <span className="text-emerald-300 font-bold text-xs">₹{totalPaidOverall}</span>
                </div>
                <div className="bg-slate-900/60 p-1.5 rounded-lg border border-slate-800">
                  <span className="text-[9px] text-rose-400 uppercase block">Khata / Due</span>
                  <span className="text-rose-400 font-bold text-xs">₹{khataDue}</span>
                </div>
              </div>

              {viewingDetailsCard.upi_ref_number && (
                <div className="p-2.5 rounded-xl bg-indigo-950/60 border border-indigo-700/60 text-xs text-indigo-300 font-mono">
                  📱 UPI UTR / Ref No: <strong>{viewingDetailsCard.upi_ref_number}</strong>
                </div>
              )}

              {/* Items & Charges list */}
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Items, Labour & Consumables Breakdown:
                </span>
                <div className="space-y-1 text-xs">
                  {items.map((it, idx) => (
                    <div key={idx} className="flex justify-between p-2 bg-slate-950 rounded-lg border border-slate-800">
                      <span className="text-slate-200">{it.item_name} × {it.quantity || 1}</span>
                      <span className="font-mono text-slate-300 font-bold">₹{(Number(it.unit_price) || 0) * (Number(it.quantity) || 1)}</span>
                    </div>
                  ))}
                  {labour > 0 && (
                    <div className="flex justify-between p-2 bg-slate-950 rounded-lg border border-slate-800">
                      <span className="text-slate-200">Labour / Tuning Charge</span>
                      <span className="font-mono text-slate-300 font-bold">₹{labour}</span>
                    </div>
                  )}
                  <div className="flex justify-between p-2 bg-slate-950 rounded-lg border border-slate-800">
                    <span className="text-slate-200">Workshop Solvents &amp; Consumables</span>
                    <span className="font-mono text-slate-300 font-bold">₹{consumables}</span>
                  </div>
                </div>

                {/* Summary footer */}
                <div className="mt-2 p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-xs flex justify-between items-center font-bold">
                  <span className="text-slate-300">Final Gross Bill:</span>
                  <span className="text-amber-400 font-mono text-sm">₹{grossBill}</span>
                </div>
              </div>

              {/* Action buttons (Task 4 & 5) */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-800">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition shadow"
                  >
                    <Send className="w-3.5 h-3.5" /> WhatsApp
                  </a>
                  {phone && (
                    <a
                      href={smsUrl}
                      className="px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 transition shadow"
                      title="Send SMS"
                    >
                      <MessageSquare className="w-3.5 h-3.5" /> SMS
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => handleCopyBillToClipboard(viewingDetailsCard)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition border ${
                      isCopied
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                    }`}
                  >
                    {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {isCopied ? 'Copied!' : 'Copy Msg'}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onOpenInvoiceModal(viewingDetailsCard);
                    setViewingDetailsCard(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition flex items-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5" /> Print PDF
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* SAVE UNLISTED PART TO MASTER INVENTORY MODAL (TASK 3) */}
      {saveToInventoryItem && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-emerald-500/50 w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                  📦
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">Save to Master Inventory</h3>
                  <p className="text-xs text-slate-400">Add custom part to workshop catalog</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSaveToInventoryItem(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmSaveToMasterInventory} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Part / Item Name</label>
                <input
                  type="text"
                  value={invFormPartName}
                  onChange={(e) => setInvFormPartName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 font-bold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Category</label>
                  <select
                    value={invFormCategory}
                    onChange={(e) => setInvFormCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100"
                  >
                    <option value="General">General</option>
                    <option value="Engine Oil">Engine Oil</option>
                    <option value="Brakes">Brakes &amp; Cables</option>
                    <option value="Electrical">Electrical &amp; Battery</option>
                    <option value="Filters">Filters &amp; Spark Plugs</option>
                    <option value="Tyres">Tyres &amp; Tubes</option>
                    <option value="Chassis">Body &amp; Chassis</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Initial Stock Qty</label>
                  <input
                    type="number"
                    min="1"
                    value={invFormStock}
                    onChange={(e) => setInvFormStock(Math.max(1, Number(e.target.value) || 1))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 font-mono"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Cost Price (₹ Buy)</label>
                  <input
                    type="number"
                    min="0"
                    value={invFormCost}
                    onChange={(e) => setInvFormCost(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-amber-400 mb-1 font-semibold">Selling Price (₹ MRP)</label>
                  <input
                    type="number"
                    min="0"
                    value={invFormSelling}
                    onChange={(e) => setInvFormSelling(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full px-3 py-2 bg-slate-950 border border-amber-500/50 rounded-xl text-amber-300 font-mono font-bold"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setSaveToInventoryItem(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg transition"
                >
                  📦 Save to Master Catalog
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
