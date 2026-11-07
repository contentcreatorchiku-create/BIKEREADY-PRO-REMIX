import React, { useState, useEffect, useRef } from 'react';
import {
  User,
  Shop,
  InventoryItem,
  JobCard,
  Customer,
  DailyGallaTally,
  ShopExpense,
  TrustTier,
  StaffAttendance,
  Distributor,
  StaffPayment,
  QuickJob,
} from '../types/supabase';
import {
  supabaseService,
  formatCCTVTimestamp,
  formatSimpleDate,
  getNextServiceDate,
  generateWhatsAppLink,
  getPublicAppUrl,
  generateSmsLink,
  generateSimpleSmsText,
  formatIndianMobile,
  generateItemizedWhatsAppBill,
} from '../utils/supabaseService';
import { StaffDossierModal } from './StaffDossierModal';
import { StaffAppointModal } from './StaffAppointModal';
import { DistributorsManagerView } from './DistributorsManagerView';
import { CustomerBroadcastView } from './CustomerBroadcastView';
import { notify } from './NotificationModal';
import jsPDF from 'jspdf';
import {
  Crown,
  Package,
  AlertTriangle,
  Users,
  Wallet,
  Clock,
  Download,
  Calendar,
  Send,
  MessageSquare,
  Copy,
  Check,
  Plus,
  Edit2,
  CheckCircle,
  FileSpreadsheet,
  FileText,
  DollarSign,
  TrendingUp,
  ShieldCheck,
  RefreshCw,
  HardDrive,
  Eye,
  EyeOff,
  Settings,
  Mic,
  MicOff,
  Search,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Share2,
  Truck,
  UserPlus,
  History,
  ShoppingCart,
  CheckSquare,
  Square,
  PackageCheck,
  FileDown,
  X,
  Banknote,
  Upload,
  KeyRound,
  Trash2,
  UserCheck,
  UserX,
} from 'lucide-react';

interface OwnerDashboardProps {
  currentUser: User;
  currentShop: Shop;
  onRefreshData: () => void;
  onOpenInvoiceModal: (jobCard: JobCard) => void;
}

export const OwnerDashboard: React.FC<OwnerDashboardProps> = ({
  currentUser,
  currentShop,
  onRefreshData,
  onOpenInvoiceModal,
}) => {
  const isSuperAdmin = currentUser.phone === '9999999999';
  const [activeTab, setActiveTab] = useState<'galla' | 'inventory' | 'distributors' | 'staff' | 'reminders' | 'reports' | 'settings' | 'saas_seller'>(() => {
    if (isSuperAdmin) return 'saas_seller';
    try {
      const saved = localStorage.getItem('bikeready_owner_tab');
      if (saved && ['galla', 'inventory', 'distributors', 'staff', 'reminders', 'reports', 'settings', 'saas_seller'].includes(saved)) {
        return saved as any;
      }
    } catch {}
    return 'galla';
  });

  useEffect(() => {
    if (!isSuperAdmin) {
      try {
        localStorage.setItem('bikeready_owner_tab', activeTab);
      } catch {}
    }
  }, [activeTab, isSuperAdmin]);

  const [gallaTally, setGallaTally] = useState<DailyGallaTally | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [jobCards, setJobCards] = useState<JobCard[]>([]);
  const [followupJobCards, setFollowupJobCards] = useState<JobCard[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<StaffAttendance[]>([]);
  const [monthlyAttendance, setMonthlyAttendance] = useState<StaffAttendance[]>([]);
  const [staffStats, setStaffStats] = useState<Record<string, { bikesCompleted: number; quickJobsDone: number }>>({});
  const [pendingApprovals, setPendingApprovals] = useState<JobCard[]>([]);
  const [loading, setLoading] = useState(false);

  // Workshop Passbook Ledger State
  const [allExpenses, setAllExpenses] = useState<ShopExpense[]>([]);
  const [allQuickJobs, setAllQuickJobs] = useState<QuickJob[]>([]);
  const [passbookFilter, setPassbookFilter] = useState<'today' | 'yesterday' | 'this_week' | 'this_month' | 'all' | 'custom'>('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Staff Dossier & Appoint Modal State
  const [dossierStaff, setDossierStaff] = useState<User | null>(null);
  const [showAppointModal, setShowAppointModal] = useState(false);

  // Inventory Search & Voice
  const [invSearch, setInvSearch] = useState('');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Inventory Sub-Tab & Checkbox Stock Ordering State
  const [invSubTab, setInvSubTab] = useState<'all' | 'ordered_tracker'>('all');
  const [selectedOrderItems, setSelectedOrderItems] = useState<Record<string, boolean>>({});
  const [orderQuantities, setOrderQuantities] = useState<Record<string, number>>({});
  const [unlockedReorders, setUnlockedReorders] = useState<Record<string, boolean>>({});
  const [showOrderDistributorModal, setShowOrderDistributorModal] = useState(false);
  const [orderDistributorId, setOrderDistributorId] = useState<string>('');
  const [customDistName, setCustomDistName] = useState('');
  const [customDistPhone, setCustomDistPhone] = useState('');
  const [isDispatchingOrder, setIsDispatchingOrder] = useState(false);

  // Inventory Edit State with Cost Price (Owner-only)
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [editPrice, setEditPrice] = useState<number>(0);
  const [editCostPrice, setEditCostPrice] = useState<number | ''>(0);
  const [editStock, setEditStock] = useState<number>(0);
  const [editMinStock, setEditMinStock] = useState<number>(5);

  // New Item State with Cost Price (Owner-only)
  const [showNewItemModal, setShowNewItemModal] = useState(false);
  const [newPartName, setNewPartName] = useState('');
  const [newPartCategory, setNewPartCategory] = useState('General');
  const [newPartStock, setNewPartStock] = useState<number>(10);
  const [newPartPrice, setNewPartPrice] = useState<number>(100);
  const [newPartCostPrice, setNewPartCostPrice] = useState<number | ''>(70);
  const [newPartMinStock, setNewPartMinStock] = useState<number>(5);
  const [newPartDistributorId, setNewPartDistributorId] = useState('');

  // Scrap / Engine Oil Sale Modal
  const [showScrapModal, setShowScrapModal] = useState(false);
  const [scrapTitle, setScrapTitle] = useState('Old Scrap Metal & Engine Oil Sale');
  const [scrapAmount, setScrapAmount] = useState<number | ''>('');
  const [isRecordingScrap, setIsRecordingScrap] = useState(false);

  // Super Admin SaaS Seller Panel
  const [allRegisteredShops, setAllRegisteredShops] = useState<Shop[]>([]);
  const [loadingShops, setLoadingShops] = useState(false);

  // Database Saver State & 7-Day Backup Reminder
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isPurgingLogs, setIsPurgingLogs] = useState(false);
  const [purgeResultMsg, setPurgeResultMsg] = useState('');
  const [lastBackupTime, setLastBackupTime] = useState<number | null>(() => {
    try {
      const saved = localStorage.getItem(`bikeready_last_backup_${currentShop.id}`);
      return saved ? Number(saved) : null;
    } catch {
      return null;
    }
  });

  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const isBackupOverdue = !lastBackupTime || (Date.now() - lastBackupTime > SEVEN_DAYS_MS);
  const daysSinceBackup = lastBackupTime
    ? Math.floor((Date.now() - lastBackupTime) / (24 * 60 * 60 * 1000))
    : null;

  // Multi-Tier Auto-Vault & Universal Export (Task 6)
  const [exportTimeframe, setExportTimeframe] = useState<'today' | 'week' | 'month' | 'year' | 'all'>('all');
  const [autoVaultSnapshots, setAutoVaultSnapshots] = useState<any[]>([]);
  const [lastVaultUpdate, setLastVaultUpdate] = useState<string>('');

  // 60-Second Rolling Auto-Vault Heartbeat
  useEffect(() => {
    if (!currentShop?.id) return;
    const runVault = async () => {
      try {
        const res = await supabaseService.saveAutoVaultSnapshot(currentShop.id, currentShop.shop_name);
        if (res.success) {
          setLastVaultUpdate(
            new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          );
          const snaps = supabaseService.getAutoVaultSnapshots(currentShop.id);
          setAutoVaultSnapshots(snaps);
        }
      } catch (err) {
        console.error('Auto-vault heartbeat error:', err);
      }
    };
    runVault();
    const timer = setInterval(runVault, 60000);
    return () => clearInterval(timer);
  }, [currentShop?.id, currentShop?.shop_name]);

  // Staff Masked PINs Reveal Map
  const [revealedPins, setRevealedPins] = useState<Record<string, boolean>>({});

  // Staff Upad & Payments State
  const [allStaffPayments, setAllStaffPayments] = useState<StaffPayment[]>([]);
  const [upadStaff, setUpadStaff] = useState<User | null>(null);
  const [upadAmount, setUpadAmount] = useState<number | ''>('');
  const [upadReason, setUpadReason] = useState('');

  // Pay Salary Modal State
  const [paySalaryStaff, setPaySalaryStaff] = useState<User | null>(null);
  const [paySalaryAmount, setPaySalaryAmount] = useState<number | ''>('');
  const [paySalaryMode, setPaySalaryMode] = useState<'cash' | 'upi'>('cash');
  const [paySalaryNotes, setPaySalaryNotes] = useState('');
  const [isSavingSalary, setIsSavingSalary] = useState(false);

  // Custom Credit Override Inputs Map (cardId -> custom amount)
  const [customCreditInputs, setCustomCreditInputs] = useState<Record<string, number | ''>>({});

  // Staff PIN Reset Modal State
  const [resetStaffTarget, setResetStaffTarget] = useState<User | null>(null);
  const [newStaffPin, setNewStaffPin] = useState('');
  const [isResettingPin, setIsResettingPin] = useState(false);

  // Monthly Statement Selector
  const [reportMonth, setReportMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // Shop & UPI Settings State
  const [settingsShopName, setSettingsShopName] = useState(currentShop.shop_name);
  const [settingsUpiId, setSettingsUpiId] = useState(currentShop.upi_id || 'bikeready@upi');
  const [settingsShopAddress, setSettingsShopAddress] = useState(currentShop.shop_address || '');
  const [settingsGstNumber, setSettingsGstNumber] = useState(currentShop.gst_number || '');
  const [settingsInvoiceTerms, setSettingsInvoiceTerms] = useState(currentShop.invoice_terms || 'Thank you for choosing our workshop. 30 days warranty on standard service.');
  const [settingsDistributorPhone, setSettingsDistributorPhone] = useState(currentShop.distributor_phone || currentShop.owner_phone);
  const [settingsOwnerPin, setSettingsOwnerPin] = useState(currentUser.pin_code || '1234');
  const [settingsRecoverySecret, setSettingsRecoverySecret] = useState(currentShop.recovery_secret || '');
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSavedMsg, setSettingsSavedMsg] = useState(false);

  // Today Expenses List for Galla Audit & Reversals
  const [todayExpenses, setTodayExpenses] = useState<ShopExpense[]>([]);

  // Staff HR Management: Edit & Deactivate
  const [editingStaff, setEditingStaff] = useState<User | null>(null);
  const [editStaffName, setEditStaffName] = useState('');
  const [editStaffPhone, setEditStaffPhone] = useState('');
  const [editStaffRole, setEditStaffRole] = useState<'mechanic' | 'manager'>('mechanic');
  const [editStaffSalary, setEditStaffSalary] = useState<number>(12000);
  const [editStaffPin, setEditStaffPin] = useState('1234');
  const [isSavingStaffEdit, setIsSavingStaffEdit] = useState(false);

  // Staff Full & Final Settlement Modal
  const [deactivatingStaff, setDeactivatingStaff] = useState<User | null>(null);
  const [settlementNotes, setSettlementNotes] = useState('');
  const [isDeactivatingStaff, setIsDeactivatingStaff] = useState(false);
  const [showExStaffArchive, setShowExStaffArchive] = useState(false);

  // Super Admin Owner PIN Reset Modal
  const [adminResetShop, setAdminResetShop] = useState<Shop | null>(null);
  const [adminNewPin, setAdminNewPin] = useState('');
  const [isAdminResettingPin, setIsAdminResettingPin] = useState(false);
  const [showMasterKey, setShowMasterKey] = useState(false);

  // Load All Owner Data
  const loadData = async () => {
    setLoading(true);
    try {
      const [tally, invRes, users, cards, custs, todayAtt, monthAtt, sStats, approvals, dists, followups, payments, expList, fullExpenses, quicks] = await Promise.all([
        supabaseService.getDailyGallaTally(currentShop.id),
        supabaseService.getInventory(currentShop.id, 1, 100),
        supabaseService.getUsersByShop(currentShop.id),
        supabaseService.getJobCards(currentShop.id),
        supabaseService.getCustomers(currentShop.id),
        supabaseService.getShopAttendanceToday(currentShop.id),
        supabaseService.getShopAttendanceMonthly(currentShop.id),
        supabaseService.getStaffStats(currentShop.id),
        supabaseService.getPendingApprovals(currentShop.id),
        supabaseService.getDistributors(currentShop.id),
        supabaseService.getShopFollowups(currentShop.id),
        supabaseService.getStaffPayments(currentShop.id),
        supabaseService.getTodayExpenses(currentShop.id),
        supabaseService.getExpenses(currentShop.id),
        supabaseService.getQuickJobs(currentShop.id),
      ]);

      setGallaTally(tally);
      setInventory(invRes.items);
      setAllUsers(users);
      setJobCards(cards);
      setCustomers(custs);
      setTodayAttendance(todayAtt);
      setMonthlyAttendance(monthAtt);
      setStaffStats(sStats);
      setPendingApprovals(approvals);
      setDistributors(dists);
      setFollowupJobCards(followups);
      setAllStaffPayments(payments);
      setTodayExpenses(expList);
      setAllExpenses(fullExpenses);
      setAllQuickJobs(quicks);

      // Auto-sync / backfill any past upad so passbook has all historical entries
      supabaseService.syncStaffUpadPassbook(currentShop.id, users);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateFollowupStatus = async (jobCardId: string, status: 'completed' | 'cancelled') => {
    await supabaseService.updateFollowupStatus(jobCardId, status);
    await loadData();
  };

  useEffect(() => {
    loadData();
  }, [currentShop.id]);

  // Voice typing for inventory search
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-IN';
      rec.onresult = (e: any) => {
        const transcript = e.results[0][0].transcript;
        setInvSearch(transcript);
        setIsListening(false);
      };
      rec.onerror = () => setIsListening(false);
      rec.onend = () => setIsListening(false);
      recognitionRef.current = rec;
    }
  }, []);

  const toggleVoiceListening = () => {
    if (!recognitionRef.current) {
      notify.alert('Voice typing is not supported on this browser.', 'Voice Typing', 'error');
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  // Approval Handlers
  const handleApproveCredit = async (cardId: string, status: 'approved' | 'rejected', customAmount?: number) => {
    await supabaseService.approveCreditOverride(cardId, status, customAmount);
    await loadData();
    onRefreshData();
  };

  const handleApproveDiscount = async (cardId: string, status: 'approved' | 'rejected') => {
    await supabaseService.approveDiscount(cardId, status);
    await loadData();
    onRefreshData();
  };

  // Toggle 4-Hour Temp Manager
  const handleToggleTempManager = async (user: User) => {
    const isCurrentlyActive =
      user.is_temp_manager &&
      user.temp_manager_expires_at &&
      new Date(user.temp_manager_expires_at).getTime() > Date.now();

    const ok = await supabaseService.toggleTempManager(user.id, !isCurrentlyActive);
    if (ok) {
      await loadData();
      onRefreshData();
    }
  };

  // Quick Stock Increment (+1, +5)
  const handleQuickStockIncrement = async (itemId: string, delta: number) => {
    await supabaseService.incrementStock(itemId, delta);
    await loadData();
  };

  // Save Item Price/Stock Edit with custom min_stock_limit
  const handleSaveItemEdit = async () => {
    if (!editingItem) return;
    await supabaseService.saveInventoryItem({
      id: editingItem.id,
      shop_id: currentShop.id,
      part_name: editingItem.part_name,
      part_category: editingItem.part_category,
      unit_price: editPrice,
      cost_price: editCostPrice !== '' ? Number(editCostPrice) : null,
      stock_quantity: editStock,
      min_stock_limit: editMinStock,
    });
    setEditingItem(null);
    await loadData();
  };

  // Create New Part with custom min_stock_limit and cost_price (Owner-only)
  const handleCreateNewItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartName.trim()) return;

    const matchedDist = distributors.find((d) => d.id === newPartDistributorId);

    await supabaseService.saveInventoryItem({
      shop_id: currentShop.id,
      part_name: newPartName.trim(),
      part_category: newPartCategory,
      stock_quantity: newPartStock,
      unit_price: newPartPrice,
      cost_price: newPartCostPrice !== '' ? Number(newPartCostPrice) : null,
      min_stock_limit: newPartMinStock,
      distributor_id: matchedDist?.id,
      distributor_name: matchedDist?.distributor_name,
    });

    setNewPartName('');
    setNewPartDistributorId('');
    setNewPartMinStock(5);
    setNewPartCostPrice(70);
    setShowNewItemModal(false);
    await loadData();
  };

  // Toggle selection for item
  const handleToggleOrderItem = (itemId: string, defaultQty: number) => {
    setSelectedOrderItems((prev) => {
      const next = { ...prev, [itemId]: !prev[itemId] };
      if (!next[itemId]) {
        delete next[itemId];
      }
      return next;
    });
    if (!orderQuantities[itemId]) {
      setOrderQuantities((prev) => ({ ...prev, [itemId]: defaultQty }));
    }
  };

  // Select all low stock parts that are NOT already marked as ordered
  const handleSelectAllLowStock = () => {
    const nextSelected: Record<string, boolean> = {};
    const nextQtys: Record<string, number> = { ...orderQuantities };
    inventory
      .filter((i) => i.stock_quantity < (i.min_stock_limit ?? 5) && !i.is_ordered)
      .forEach((i) => {
        nextSelected[i.id] = true;
        if (!nextQtys[i.id]) nextQtys[i.id] = 10;
      });
    setSelectedOrderItems(nextSelected);
    setOrderQuantities(nextQtys);
  };

  const handleClearSelection = () => {
    setSelectedOrderItems({});
  };

  // Dispatch Stock Order via WhatsApp or PDF
  const handleDispatchOrder = async (format: 'whatsapp' | 'pdf') => {
    const selectedIds = Object.keys(selectedOrderItems).filter((id) => selectedOrderItems[id]);
    if (selectedIds.length === 0) {
      notify.alert('Please select at least one item to order.', 'Selection Required', 'error');
      return;
    }

    // Determine Distributor
    let distName = customDistName.trim();
    let distPhone = customDistPhone.trim();

    if (orderDistributorId) {
      const found = distributors.find((d) => d.id === orderDistributorId);
      if (found) {
        distName = found.distributor_name;
        distPhone = found.phone;
      }
    }

    if (!distName) {
      distName = currentShop.shop_name + ' Parts Supplier';
    }
    if (!distPhone) {
      distPhone = currentShop.distributor_phone || currentShop.owner_phone;
    }

    const cleanPhone = distPhone.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      notify.alert('Please provide a valid 10-digit distributor phone number.', 'Invalid Phone', 'error');
      return;
    }

    setIsDispatchingOrder(true);
    try {
      const orderPayload = selectedIds.map((id) => {
        const it = inventory.find((item) => item.id === id);
        const qty = Math.max(1, orderQuantities[id] || (it && it.stock_quantity < 5 ? 10 : 5));
        return {
          itemId: id,
          qty,
          distributorId: orderDistributorId || null,
          distributorName: distName,
          itemName: it?.part_name || 'Part',
          category: it?.part_category || 'General',
          unitPrice: it?.unit_price || 0,
        };
      });

      // Save order status in Supabase & localStorage sync
      await supabaseService.markInventoryItemsOrdered(
        currentShop.id,
        orderPayload.map((o) => ({
          itemId: o.itemId,
          qty: o.qty,
          distributorId: o.distributorId,
          distributorName: o.distributorName,
        }))
      );

      const totalUnits = orderPayload.reduce((sum, it) => sum + it.qty, 0);

      if (format === 'whatsapp') {
        const textMsg =
          `📦 *PURCHASE ORDER - ${currentShop.shop_name.toUpperCase()}*\n` +
          `To: *${distName}*\n` +
          `Date: ${new Date().toLocaleDateString('en-IN')} ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}\n\n` +
          `*ITEMS REQUIRED:*\n` +
          orderPayload
            .map((it, idx) => `${idx + 1}. *${it.itemName}* [${it.category}] - *${it.qty} pcs*`)
            .join('\n') +
          `\n\n*Total Items:* ${orderPayload.length} | *Total Units:* ${totalUnits}\n\n` +
          `Please confirm availability, price, and dispatch time!\n` +
          `Workshop: ${currentShop.shop_name} • Phone: ${currentShop.owner_phone}`;

        const waUrl = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(textMsg)}`;
        window.open(waUrl, '_blank');
      } else {
        // PDF Dispatch
        const doc = new jsPDF({ unit: 'pt', format: 'a4' });
        doc.setFillColor(15, 23, 42); // slate-900
        doc.rect(0, 0, 595, 75, 'F');
        doc.setTextColor(245, 158, 11); // amber-500
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(`${currentShop.shop_name.toUpperCase()} - PURCHASE ORDER`, 40, 38);

        doc.setTextColor(203, 213, 225);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(`Supplier: ${distName} (${distPhone}) | Date: ${new Date().toLocaleString('en-IN')}`, 40, 58);

        let y = 100;
        doc.setFillColor(241, 245, 249);
        doc.rect(40, y, 515, 22, 'F');
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('#', 50, y + 15);
        doc.text('Part Description', 80, y + 15);
        doc.text('Category', 310, y + 15);
        doc.text('Order Qty', 470, y + 15, { align: 'right' });
        y += 24;

        doc.setFont('helvetica', 'normal');
        orderPayload.forEach((it, idx) => {
          if (idx % 2 === 0) {
            doc.setFillColor(248, 250, 252);
            doc.rect(40, y, 515, 20, 'F');
          }
          doc.setTextColor(30, 41, 59);
          doc.text(String(idx + 1), 50, y + 14);
          doc.text(it.itemName, 80, y + 14);
          doc.text(it.category, 310, y + 14);
          doc.setFont('helvetica', 'bold');
          doc.text(`${it.qty} pcs`, 470, y + 14, { align: 'right' });
          doc.setFont('helvetica', 'normal');
          y += 20;
        });

        y += 15;
        doc.setDrawColor(203, 213, 225);
        doc.line(40, y, 555, y);
        y += 20;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(`Total Order Units: ${totalUnits} pcs across ${orderPayload.length} items`, 40, y);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(`Contact: ${currentShop.owner_name} (${currentShop.owner_phone})`, 40, y + 16);

        const filename = `Purchase_Order_${distName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
        doc.save(filename);

        const followMsg = `Hello ${distName}! Attached is our Purchase Order (${filename}) from ${currentShop.shop_name}. Total: ${totalUnits} units. Please confirm dispatch!`;
        window.open(`https://wa.me/91${cleanPhone}?text=${encodeURIComponent(followMsg)}`, '_blank');
      }

      setShowOrderDistributorModal(false);
      setSelectedOrderItems({});
      await loadData();
      setInvSubTab('ordered_tracker');
      notify.success(`Order successfully dispatched and marked as ORDERED! Items are now tracked under '📦 Order Tracker'.`);
    } finally {
      setIsDispatchingOrder(false);
    }
  };

  // Receive stock from Order Tracker
  const handleReceiveStock = async (itemId: string, qty: number) => {
    const ok = await supabaseService.receiveOrderedStock(itemId, qty);
    if (ok) {
      await loadData();
      notify.success(`✅ Stock received! Added +${qty} units to inventory.`);
    }
  };

  // Cancel order status
  const handleCancelOrdered = async (itemId: string) => {
    const ok = await notify.confirm('Are you sure you want to cancel this order tag?');
    if (ok) {
      await supabaseService.cancelOrderedItem(itemId);
      await loadData();
    }
  };

  // Record Staff Upad Advance using unified function
  const handleRecordUpad = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!upadStaff || !upadAmount) return;

    await supabaseService.recordStaffUpad({
      shop_id: currentShop.id,
      staff_id: upadStaff.id,
      staff_name: upadStaff.full_name,
      amount: Number(upadAmount),
      payment_mode: 'cash',
      notes: upadReason.trim() || `Staff Advance (${upadStaff.full_name})`,
      recorded_by: currentUser.full_name,
    });

    setUpadStaff(null);
    setUpadAmount('');
    setUpadReason('');
    await loadData();
    onRefreshData();
    notify.success('Upad advance recorded, added to Lifetime Passbook and Daily Galla!');
  };

  // Pay Monthly Salary Settlement Payout
  const handleConfirmPaySalary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paySalaryStaff || !paySalaryAmount || Number(paySalaryAmount) <= 0) return;
    setIsSavingSalary(true);
    try {
      const numAmount = Number(paySalaryAmount);
      await supabaseService.recordStaffPayment({
        shop_id: currentShop.id,
        staff_id: paySalaryStaff.id,
        staff_name: paySalaryStaff.full_name,
        payment_type: 'salary_payout',
        amount: numAmount,
        payment_mode: paySalaryMode,
        notes: paySalaryNotes || 'Monthly Salary Settlement Payout',
        recorded_by: currentUser.full_name,
      });

      setPaySalaryStaff(null);
      await loadData();
      onRefreshData();
      notify.success(
        `Monthly salary of ₹${numAmount} paid via ${paySalaryMode === 'cash' ? '💵 Cash Galla Drawer' : '📱 Online UPI / Bank'} to ${paySalaryStaff.full_name}!`
      );
    } catch (err: any) {
      notify.error('Failed to record salary payout: ' + (err?.message || 'Unknown error'));
    } finally {
      setIsSavingSalary(false);
    }
  };

  // Record Scrap / Old Engine Oil Sale (Kabad Bikri)
  const handleRecordScrapSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scrapAmount || Number(scrapAmount) <= 0) return;
    setIsRecordingScrap(true);
    try {
      await supabaseService.recordScrapSale(
        currentShop.id,
        scrapTitle.trim() || 'Old Scrap & Engine Oil Sale',
        Number(scrapAmount),
        currentUser.full_name
      );
      setScrapAmount('');
      setShowScrapModal(false);
      await loadData();
      onRefreshData();
      notify.success('Scrap income added to today\'s Galla Drawer Cash!');
    } finally {
      setIsRecordingScrap(false);
    }
  };

  // Save Shop Settings & Security Credentials
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await supabaseService.updateShopSettings(currentShop.id, {
        shop_name: settingsShopName.trim(),
        upi_id: settingsUpiId.trim(),
        distributor_phone: settingsDistributorPhone.trim(),
        shop_address: settingsShopAddress.trim() || null,
        gst_number: settingsGstNumber.trim() || null,
        invoice_terms: settingsInvoiceTerms.trim() || null,
      });

      // Update Owner PIN and Private Secret Recovery Passcode
      await supabaseService.updateShopSecurity(
        currentShop.id,
        currentUser.id,
        settingsOwnerPin.trim(),
        settingsRecoverySecret.trim()
      );

      setSettingsSavedMsg(true);
      setTimeout(() => setSettingsSavedMsg(false), 3000);
      onRefreshData();
      notify.success('Shop settings & Owner security credentials saved successfully!');
    } finally {
      setSavingSettings(false);
    }
  };

  // Delete / Reverse Shop Expense from Galla Drawer
  const handleDeleteExpense = async (expense: ShopExpense) => {
    const isUpad = expense.expense_type === 'staff_upad';
    const ok = await notify.confirm(
      `Delete expense "${expense.title}" of ₹${expense.amount}? ${isUpad ? 'This will also reverse the staff upad balance.' : ''}`
    );
    if (!ok) return;

    const success = await supabaseService.deleteShopExpense(expense.id);
    if (success) {
      await loadData();
      onRefreshData();
      notify.success('Expense reversed and Galla drawer updated!');
    } else {
      notify.error('Failed to reverse expense. Please try again.');
    }
  };

  const handleDeleteJobCard = async (cardId: string, bikeNumber: string) => {
    const ok = await notify.confirm(
      `Delete & reverse Job Card #${bikeNumber}? This will remove it from the workshop ledger and restore records.`
    );
    if (!ok) return;
    const success = await supabaseService.deleteJobCard(cardId);
    if (success) {
      await loadData();
      onRefreshData();
      notify.success(`Job Card #${bikeNumber} reversed successfully!`);
    } else {
      notify.error('Failed to delete job card.');
    }
  };

  const handleDeleteQuickJob = async (jobId: string, serviceName: string) => {
    const ok = await notify.confirm(
      `Delete & reverse Quick Service "${serviceName}"? This will reverse the cashflow from the galla and ledger.`
    );
    if (!ok) return;
    const success = await supabaseService.deleteQuickJob(jobId);
    if (success) {
      await loadData();
      onRefreshData();
      notify.success('Quick service reversed from ledger!');
    } else {
      notify.error('Failed to reverse quick job.');
    }
  };

  const handleDeleteStaffPayment = async (paymentId: string, staffName: string, amount: number) => {
    const ok = await notify.confirm(
      `Delete & reverse payment of ₹${amount} for ${staffName}? If this was an Upad advance, the worker's balance will be credited back.`
    );
    if (!ok) return;
    const success = await supabaseService.deleteStaffPayment(paymentId);
    if (success) {
      await loadData();
      onRefreshData();
      notify.success('Payment entry deleted and staff balance reversed!');
    } else {
      notify.error('Failed to delete staff payment.');
    }
  };

  // Delete Master Inventory Item
  const handleDeleteItem = async (itemId: string, partName: string) => {
    const ok = await notify.confirm(
      `Are you sure you want to permanently delete "${partName}" from inventory? This cannot be undone.`
    );
    if (!ok) return;

    const success = await supabaseService.deleteInventoryItem(itemId);
    if (success) {
      await loadData();
      notify.success(`Deleted "${partName}" from inventory.`);
    } else {
      notify.error('Failed to delete item.');
    }
  };

  // Staff HR: Edit Handler
  const handleOpenEditStaff = (staff: User) => {
    setEditingStaff(staff);
    setEditStaffName(staff.full_name);
    setEditStaffPhone(staff.phone);
    setEditStaffRole(staff.role === 'manager' ? 'manager' : 'mechanic');
    setEditStaffSalary(staff.monthly_salary || 12000);
    setEditStaffPin(staff.pin_code);
  };

  const handleSaveStaffEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;
    setIsSavingStaffEdit(true);
    try {
      const ok = await supabaseService.updateStaffUser(editingStaff.id, {
        full_name: editStaffName.trim(),
        phone: editStaffPhone.trim(),
        role: editStaffRole,
        monthly_salary: Number(editStaffSalary),
        pin_code: editStaffPin.trim(),
      });
      if (ok) {
        setEditingStaff(null);
        await loadData();
        onRefreshData();
        notify.success('Staff profile and salary updated successfully!');
      } else {
        notify.error('Failed to update staff profile.');
      }
    } finally {
      setIsSavingStaffEdit(false);
    }
  };

  // Staff HR: Deactivate & F&F Settlement
  const handleDeactivateStaff = async () => {
    if (!deactivatingStaff) return;
    setIsDeactivatingStaff(true);
    try {
      const ok = await supabaseService.deactivateStaffUser(deactivatingStaff.id, settlementNotes.trim());
      if (ok) {
        notify.success(`Staff ${deactivatingStaff.full_name} deactivated and moved to Left Job Archive.`);
        setDeactivatingStaff(null);
        setSettlementNotes('');
        await loadData();
        onRefreshData();
      } else {
        notify.error('Failed to deactivate staff.');
      }
    } finally {
      setIsDeactivatingStaff(false);
    }
  };

  // Staff HR: Reactivate Staff
  const handleReactivateStaff = async (staff: User) => {
    const ok = await notify.confirm(
      `Re-activate ${staff.full_name}? They will be able to log in again and rejoin duty.`
    );
    if (!ok) return;

    const success = await supabaseService.reactivateStaffUser(staff.id);
    if (success) {
      await loadData();
      onRefreshData();
      notify.success(`${staff.full_name} re-activated successfully!`);
    } else {
      notify.error('Failed to re-activate staff.');
    }
  };

  // Staff HR: Delete Staff Record
  const handleDeleteStaffRecord = async (staff: User) => {
    const ok = await notify.confirm(
      `Permanently delete ${staff.full_name}? Historical job card records will remain, but worker profile will be deleted.`
    );
    if (!ok) return;

    const success = await supabaseService.deleteStaffUser(staff.id);
    if (success) {
      await loadData();
      onRefreshData();
      notify.success(`${staff.full_name} permanently removed.`);
    } else {
      notify.error('Failed to delete staff record.');
    }
  };

  // Super Admin: Reset Owner PIN
  const handleAdminResetOwnerPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminResetShop || !adminNewPin || adminNewPin.length !== 4) {
      notify.alert('Please enter a valid 4-digit PIN', 'Invalid PIN', 'error');
      return;
    }
    setIsAdminResettingPin(true);
    try {
      const ok = await supabaseService.adminResetOwnerPin(adminResetShop.id, adminNewPin.trim());
      if (ok) {
        setAdminResetShop(null);
        setAdminNewPin('');
        await loadAllShops();
        notify.success('Owner PIN reset successfully!');
      } else {
        notify.error('Failed to reset owner PIN.');
      }
    } finally {
      setIsAdminResettingPin(false);
    }
  };

  // Load all registered shops for Super Admin / SaaS Seller Panel
  const loadAllShops = async () => {
    setLoadingShops(true);
    try {
      const shops = await supabaseService.getAllShops();
      setAllRegisteredShops(shops);
    } finally {
      setLoadingShops(false);
    }
  };

  const handleUpdateShopLicense = async (shopId: string, status: 'active' | 'trial' | 'suspended') => {
    const ok = await supabaseService.updateShopLicense(shopId, status);
    if (ok) {
      await loadAllShops();
      onRefreshData();
      notify.success(`Workshop license updated to ${status.toUpperCase()}!`);
    }
  };

  // Database Backup & Saver
  const handleDownloadBackup = async () => {
    setIsBackingUp(true);
    try {
      await supabaseService.downloadFullDatabaseBackup(currentShop.id, currentShop.shop_name);
      const now = Date.now();
      localStorage.setItem(`bikeready_last_backup_${currentShop.id}`, now.toString());
      setLastBackupTime(now);
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleFileRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ok = await notify.confirm(
      `Are you sure you want to restore and import records from "${file.name}" into ${currentShop.shop_name}? Existing records with matching IDs will be safely updated.`
    );
    if (!ok) {
      e.target.value = '';
      return;
    }

    setIsRestoring(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const res = await supabaseService.restoreDatabaseBackup(currentShop.id, parsed);
      if (res.success) {
        notify.success(res.message);
        await loadData();
        onRefreshData();
      } else {
        notify.error(res.message);
      }
    } catch (err: any) {
      notify.error(`Import failed: ${err?.message || 'Invalid JSON format'}`);
    } finally {
      setIsRestoring(false);
      e.target.value = '';
    }
  };

  const handleUniversalExportCsv = () => {
    supabaseService.exportWorkshopCsv(
      currentShop.id,
      currentShop.shop_name,
      exportTimeframe,
      jobCards,
      inventory,
      allExpenses
    );
    notify.success(`Exported ${exportTimeframe.toUpperCase()} audit report to Excel (.CSV)!`);
  };

  const handleExportPdf = () => {
    supabaseService.exportMasterAuditPdf(
      currentShop.id,
      currentShop.shop_name,
      exportTimeframe,
      jobCards,
      allExpenses
    );
    notify.success(`Generated ${exportTimeframe.toUpperCase()} Master Audit PDF report!`);
  };

  const handleRestoreVaultSnapshot = async (snap: any) => {
    const ok = await notify.confirm(
      `Restore all records from "${snap.tierLabel}" taken on ${snap.dateFormatted}? (Contains ${snap.totalRecords} records across all workshop tables). Existing records with matching IDs will be safely synchronized.`
    );
    if (!ok) return;
    setIsRestoring(true);
    try {
      const res = await supabaseService.restoreFromVaultSnapshot(currentShop.id, snap.raw);
      if (res.success) {
        notify.success(res.message);
        await loadData();
        onRefreshData();
      } else {
        notify.error(res.message);
      }
    } catch (err: any) {
      notify.error(`Vault restore failed: ${err?.message || 'Error restoring snapshot'}`);
    } finally {
      setIsRestoring(false);
    }
  };

  const handlePurgeLogs = async () => {
    const ok = await notify.confirm(
      'Clean all audit logs & quick jobs older than 1 year to speed up database performance? (Master inventory, customers, and job cards will NEVER be deleted).'
    );
    if (!ok) return;
    setIsPurgingLogs(true);
    try {
      const res = await supabaseService.purgeOldAuditLogs(currentShop.id, 365);
      setPurgeResultMsg(`Cleaned ${res.purged} archived audit records older than 1 year.`);
      await loadData();
    } finally {
      setIsPurgingLogs(false);
    }
  };

  // Export CSV
  const handleExportCsv = (type: 'inventory' | 'job_cards' | 'galla') => {
    let csvContent = '';
    let filename = '';

    if (type === 'inventory') {
      csvContent = 'Part Name,Category,Stock Quantity,Unit Price\n';
      inventory.forEach((i) => {
        csvContent += `"${i.part_name}","${i.part_category}",${i.stock_quantity},${i.unit_price}\n`;
      });
      filename = `Inventory_${currentShop.shop_name.replace(/\s+/g, '_')}.csv`;
    } else if (type === 'job_cards') {
      csvContent = 'Bike Number,Customer,Mechanic,Total Bill,Status,Created At\n';
      jobCards.forEach((c) => {
        csvContent += `"${c.bike_number}","${c.customer?.customer_name || 'Walk-in'}","${c.mechanic?.full_name || 'N/A'}",${c.total_bill},"${c.status}","${c.created_at}"\n`;
      });
      filename = `JobCards_${currentShop.shop_name.replace(/\s+/g, '_')}.csv`;
    } else {
      csvContent = 'Metric,Amount (INR)\n';
      if (gallaTally) {
        csvContent += `Job Card Cash,${gallaTally.jobCardCash}\n`;
        csvContent += `Quick Job Cash,${gallaTally.quickJobCash}\n`;
        csvContent += `Total Cash In,${gallaTally.totalCashIn}\n`;
        csvContent += `Total UPI In,${gallaTally.totalUpiIn}\n`;
        csvContent += `Shop Expenses,${gallaTally.shopExpenses}\n`;
        csvContent += `Staff Upad Advance,${gallaTally.staffUpad}\n`;
        csvContent += `Net Cash in Galla (Drawer),${gallaTally.netCashInGalla}\n`;
      }
      filename = `Daily_Galla_${new Date().toISOString().split('T')[0]}.csv`;
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Generate Upgraded 7-Day, 30-Day, or Monthly PDF Performance Report with 5 Tables
  const handleGeneratePdfReport = async (daysOrPeriod: 7 | 30 | string, shareDrive: boolean = false) => {
    const historical = await supabaseService.getHistoricalReportData(currentShop.id, daysOrPeriod);
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });

    const periodLabel = typeof daysOrPeriod === 'number' ? `LAST ${daysOrPeriod} DAYS` : `MONTH ${daysOrPeriod}`;

    // 1. Header Banner
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, 595, 75, 'F');
    doc.setTextColor(245, 158, 11); // amber-500
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(`${currentShop.shop_name.toUpperCase()} - ${periodLabel} AUDIT REPORT`, 40, 40);

    doc.setTextColor(203, 213, 225);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${new Date().toLocaleString()} | Period: ${periodLabel} | Prop: ${currentShop.owner_name} (${currentShop.owner_phone})`, 40, 60);

    let y = 100;

    // Table 1: Summary KPIs
    doc.setFillColor(241, 245, 249);
    doc.rect(40, y, 515, 20, 'F');
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(`1. SUMMARY KEY PERFORMANCE INDICATORS (${periodLabel})`, 48, y + 14);

    y += 28;
    const completedHistorical = historical.jobCards.filter((c: any) => c.status === 'completed');
    const totalJobCash = completedHistorical.reduce((sum: number, c: any) => sum + (c.mandatory_cash_to_collect || 0), 0);
    const totalKhata = completedHistorical.reduce((sum: number, c: any) => sum + (c.transferred_to_khata || 0), 0);
    const totalQuickCash = historical.quickJobs.filter((q: any) => q.payment_mode === 'cash').reduce((sum: number, q: any) => sum + (q.final_price || 0), 0);
    const totalQuickUpi = historical.quickJobs.filter((q: any) => q.payment_mode === 'upi').reduce((sum: number, q: any) => sum + (q.final_price || 0), 0);
    const totalExpenses = historical.expenses.reduce((sum: number, e: any) => sum + (e.amount || 0), 0);

    doc.setFont('helvetica', 'normal');
    doc.text(`Total Completed Job Cards: ${completedHistorical.length}`, 48, y);
    doc.text(`Total Job Card Cash: INR ${totalJobCash}`, 220, y);
    doc.text(`Total Khata Transferred: INR ${totalKhata}`, 400, y);
    y += 16;
    doc.text(`Quick Jobs Logged: ${historical.quickJobs.length} (Cash: INR ${totalQuickCash} | UPI: INR ${totalQuickUpi})`, 48, y);
    doc.text(`Shop Expenses & Staff Upad: INR ${totalExpenses}`, 340, y);
    y += 24;

    // Table 2: Completed Bills Table
    doc.setFillColor(241, 245, 249);
    doc.rect(40, y, 515, 20, 'F');
    doc.setFont('helvetica', 'bold');
    doc.text('2. COMPLETED JOB CARDS REGISTER (SAMPLE)', 48, y + 14);
    y += 26;

    doc.setFontSize(8);
    doc.text('BIKE NUMBER', 48, y);
    doc.text('CUSTOMER', 150, y);
    doc.text('TOTAL BILL', 300, y);
    doc.text('CASH', 380, y);
    doc.text('KHATA', 440, y);
    doc.text('DATE', 500, y);
    y += 14;

    doc.setFont('helvetica', 'normal');
    completedHistorical.slice(0, 5).forEach((c: any) => {
      doc.text(c.bike_number, 48, y);
      doc.text((c.customer?.customer_name || 'Walk-in').substring(0, 18), 150, y);
      doc.text(`INR ${c.total_bill}`, 300, y);
      doc.text(`INR ${c.mandatory_cash_to_collect || 0}`, 380, y);
      doc.text(`INR ${c.transferred_to_khata || 0}`, 440, y);
      doc.text(formatSimpleDate(c.created_at), 500, y);
      y += 14;
    });

    y += 14;
    // Table 3: Quick Jobs Audit Table
    doc.setFillColor(241, 245, 249);
    doc.rect(40, y, 515, 20, 'F');
    doc.setFont('helvetica', 'bold');
    doc.text('3. QUICK JOBS ANTI-MISUSE AUDIT LOG', 48, y + 14);
    y += 26;

    doc.setFontSize(8);
    doc.text('SERVICE', 48, y);
    doc.text('WORKER', 200, y);
    doc.text('RATE (INR)', 320, y);
    doc.text('MODIFIED?', 400, y);
    doc.text('DATE', 480, y);
    y += 14;

    doc.setFont('helvetica', 'normal');
    historical.quickJobs.slice(0, 5).forEach((q: any) => {
      doc.text(q.service_name.substring(0, 24), 48, y);
      doc.text(q.worker_name.substring(0, 16), 200, y);
      doc.text(`INR ${q.final_price}`, 320, y);
      doc.text(q.is_price_modified ? 'YES (AUDITED)' : 'NO (STANDARD)', 400, y);
      doc.text(formatSimpleDate(q.created_at), 480, y);
      y += 14;
    });

    y += 14;
    // Table 4: Shop Expenses & Staff Upad
    doc.setFillColor(241, 245, 249);
    doc.rect(40, y, 515, 20, 'F');
    doc.setFont('helvetica', 'bold');
    doc.text('4. SHOP EXPENSES & STAFF UPAD ADVANCES', 48, y + 14);
    y += 26;

    doc.setFontSize(8);
    doc.text('TITLE / REASON', 48, y);
    doc.text('CATEGORY', 240, y);
    doc.text('AMOUNT', 380, y);
    doc.text('RECORDED BY', 460, y);
    y += 14;

    doc.setFont('helvetica', 'normal');
    historical.expenses.slice(0, 4).forEach((e: any) => {
      doc.text(e.title.substring(0, 28), 48, y);
      doc.text(e.expense_type === 'staff_upad' ? 'Staff Upad' : 'Shop Expense', 240, y);
      doc.text(`INR ${e.amount}`, 380, y);
      doc.text(e.recorded_by || 'Manager', 460, y);
      y += 14;
    });

    y += 14;
    // Table 5: Staff Attendance Log
    doc.setFillColor(241, 245, 249);
    doc.rect(40, y, 515, 20, 'F');
    doc.setFont('helvetica', 'bold');
    doc.text('5. STAFF ATTENDANCE & CCTV DUTY LOG', 48, y + 14);
    y += 26;

    doc.setFontSize(8);
    doc.text('STAFF NAME', 48, y);
    doc.text('ROLE', 180, y);
    doc.text('PUNCH IN (CCTV)', 260, y);
    doc.text('PUNCH OUT (CCTV)', 400, y);
    doc.text('STATUS', 505, y);
    y += 14;

    doc.setFont('helvetica', 'normal');
    historical.attendance.slice(0, 4).forEach((a: any) => {
      doc.text(a.staff_name.substring(0, 18), 48, y);
      doc.text(a.role, 180, y);
      doc.text(formatCCTVTimestamp(a.punch_in_time).substring(11), 260, y);
      doc.text(a.punch_out_time ? formatCCTVTimestamp(a.punch_out_time).substring(11) : 'On Duty', 400, y);
      doc.text(a.status.toUpperCase(), 505, y);
      y += 14;
    });

    const filename = typeof daysOrPeriod === 'number'
      ? `${daysOrPeriod}_Day_Report_${currentShop.shop_name.replace(/\s+/g, '_')}.pdf`
      : `Monthly_Statement_${daysOrPeriod}_${currentShop.shop_name.replace(/\s+/g, '_')}.pdf`;

    if (shareDrive) {
      try {
        const pdfBlob = doc.output('blob');
        const pdfFile = new File([pdfBlob], filename, { type: 'application/pdf' });
        if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
          await navigator.share({
            title: `${periodLabel} Workshop Performance Report`,
            text: `Performance report for ${currentShop.shop_name}`,
            files: [pdfFile],
          });
        } else {
          doc.save(filename);
          window.open('https://drive.google.com/drive/my-drive', '_blank');
          notify.success(`Report saved as "${filename}"! Google Drive web view opened to upload.`);
        }
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          console.warn('Native share error, falling back to download:', err);
          doc.save(filename);
        }
      }
    } else {
      doc.save(filename);
    }
  };

  // Exclude owner from salaried staff list
  const staffList = allUsers.filter((u) => u.role !== 'owner');
  const activeStaffList = staffList.filter((s) => s.is_active !== false);
  const exStaffList = staffList.filter((s) => s.is_active === false);

  // Filtered & sorted inventory (low stock < min_stock_limit sorted to top in red)
  const sortedInventory = [...inventory]
    .filter((item) => {
      if (!invSearch.trim()) return true;
      return (
        item.part_name.toLowerCase().includes(invSearch.toLowerCase()) ||
        item.part_category.toLowerCase().includes(invSearch.toLowerCase())
      );
    })
    .sort((a, b) => {
      const aLimit = a.min_stock_limit ?? 5;
      const bLimit = b.min_stock_limit ?? 5;
      const aLow = a.stock_quantity < aLimit ? 0 : 1;
      const bLow = b.stock_quantity < bLimit ? 0 : 1;
      return aLow - bLow;
    });

  const orderedItems: InventoryItem[] = inventory.filter((item) => item.is_ordered);
  const orderedCount = orderedItems.length;
  const selectedCount = Object.keys(selectedOrderItems).length;
  const totalSelectedUnits = Object.entries(selectedOrderItems).reduce((sum, [id, selected]) => {
    if (selected) {
      return sum + (orderQuantities[id] || 1);
    }
    return sum;
  }, 0);

  const lowStockCount = inventory.filter((i) => i.stock_quantity < (i.min_stock_limit ?? 5) && !i.is_ordered).length;
  const serviceDueCustomers = customers.filter((c) => c.current_due > 0 || c.trust_tier === 'trusted');

  return (
    <div className="space-y-4 pb-24">
      {/* LIVE APPROVAL POPUP BANNER FOR OWNER (Credit Overrides & Discounts) */}
      {pendingApprovals.length > 0 && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-rose-950/90 to-amber-950/90 border-2 border-amber-500 shadow-2xl animate-in fade-in space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-400 animate-pulse" />
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
                ⚠️ Live Approvals Required ({pendingApprovals.length})
              </h3>
            </div>
            <span className="text-[11px] text-amber-300 font-bold bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/40">
              Action Needed
            </span>
          </div>

          <div className="space-y-2">
            {pendingApprovals.map((card) => {
              const isCredit = card.credit_override_status === 'pending';
              const isDiscount = card.discount_approval_status === 'pending';
              const currentItemsTotal = (card?.items || []).reduce(
                (sum, it) => sum + (Number(it.unit_price) || 0) * (Number(it.quantity) || 1),
                0
              );
              const cardGrossTotal = Number(card.total_bill) > 0
                ? Number(card.total_bill)
                : Math.max(
                    0,
                    currentItemsTotal +
                      Number(card.labour_charge || 0) +
                      Number(card.consumable_charge || 0) +
                      Number(card.outside_work_customer_price || 0) -
                      Number(card.extra_discount || 0)
                  );
              const cardAdv = Number(card.advance_paid || 0);
              const cardNetPayable = Math.max(0, cardGrossTotal - cardAdv);
              const cardTotal = cardGrossTotal;
              const shortfall = Number(card.mandatory_cash_to_collect || 0) > 0 ? Number(card.mandatory_cash_to_collect) : cardNetPayable;
              const payingNow = Math.max(0, cardNetPayable - shortfall);

              return (
                <div
                  key={card.id}
                  className="p-3 bg-slate-900/90 rounded-xl border border-slate-700 flex flex-wrap items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-amber-400 uppercase text-sm">
                        {card.bike_number}
                      </span>
                      <span className="font-semibold text-slate-200">
                        ({card.customer?.customer_name || 'Walk-in'})
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 flex flex-wrap items-center gap-3">
                      {isCredit && (
                        <div className="flex flex-wrap items-center gap-2 font-mono">
                          <span className="text-slate-300">Total: <strong className="text-white">₹{cardTotal}</strong></span>
                          <span className="text-slate-500">|</span>
                          <span className="text-emerald-400">Paying Now: <strong>₹{payingNow}</strong></span>
                          <span className="text-slate-500">|</span>
                          <span className="text-rose-400 font-bold bg-rose-950/60 px-2 py-0.5 rounded border border-rose-800">
                            Udhaar Requested: ₹{shortfall}
                          </span>
                        </div>
                      )}
                      {isDiscount && (
                        <span className="text-amber-300 font-bold">
                          🏷️ Discount Approval: ₹{card.extra_discount} (Total: ₹{cardTotal})
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {isCredit && (
                      <>
                        <button
                          onClick={() => handleApproveCredit(card.id, 'approved')}
                          className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1 shadow-md transition"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Approve ₹{shortfall} Udhaar
                        </button>

                        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-700">
                          <span className="text-[11px] text-slate-400 font-mono">₹</span>
                          <input
                            type="number"
                            placeholder="Custom ₹"
                            value={customCreditInputs[card.id] ?? ''}
                            onChange={(e) => {
                              const val = e.target.value === '' ? '' : Number(e.target.value);
                              setCustomCreditInputs((prev) => ({ ...prev, [card.id]: val }));
                            }}
                            className="w-20 px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-xs font-mono font-bold text-amber-300"
                          />
                          <button
                            onClick={() => {
                              const amt = customCreditInputs[card.id];
                              if (typeof amt === 'number' && amt > 0) {
                                handleApproveCredit(card.id, 'approved', amt);
                              } else {
                                notify.alert('Please enter a valid custom credit amount in ₹.');
                              }
                            }}
                            className="px-2 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-bold"
                          >
                            Approve Custom
                          </button>
                        </div>

                        <button
                          onClick={() => handleApproveCredit(card.id, 'rejected')}
                          className="px-3 py-1.5 rounded-lg bg-rose-950 hover:bg-rose-900 text-rose-300 font-bold text-xs border border-rose-700 transition"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Reject
                        </button>
                      </>
                    )}

                    {isDiscount && (
                      <>
                        <button
                          onClick={() => handleApproveDiscount(card.id, 'approved')}
                          className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1 shadow-md transition"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Approve Discount
                        </button>
                        <button
                          onClick={() => handleApproveDiscount(card.id, 'rejected')}
                          className="px-3 py-1.5 rounded-lg bg-rose-950 hover:bg-rose-900 text-rose-300 font-bold text-xs border border-rose-700 transition"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Top Header Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
            <Crown className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              Owner Master Command Center
              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-bold">
                PRO
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              {currentShop.shop_name} • Full Audit, Staff Payroll, Galla Drawer &amp; Master Pricing
            </p>
          </div>
        </div>

        <button
          onClick={loadData}
          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Visual Notification Badge & Banner: Offline Data Export Backup Reminder (> 7 Days) */}
      {isBackupOverdue && (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-amber-950/90 via-slate-900 to-amber-950/70 border-2 border-amber-500/70 shadow-xl flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold shrink-0 border border-amber-500/40">
              <AlertTriangle className="w-5 h-5 text-amber-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-slate-100 text-xs sm:text-sm">
                  ⚠️ Offline Data Backup Recommended
                </span>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/40">
                  {lastBackupTime ? `Last Export: ${daysSinceBackup} Days Ago` : 'No Backup Taken Yet'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Ensure 100% data safety for inventory, customer ledgers, and billing. Offline export backup is recommended every 7 days.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isBackingUp}
              onClick={handleDownloadBackup}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs shadow-md shadow-amber-500/20 flex items-center gap-1.5 transition disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isBackingUp ? 'Exporting...' : 'Export Backup (JSON)'}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('reports')}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
            >
              View Saver
            </button>
          </div>
        </div>
      )}

      {/* SUB-NAVIGATION TABS */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-slate-800">
        <button
          onClick={() => setActiveTab('galla')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'galla'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <DollarSign className="w-3.5 h-3.5" /> Daily Galla Tally
        </button>

        <button
          onClick={() => setActiveTab('inventory')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'inventory'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <Package className="w-3.5 h-3.5" /> Master Inventory ({inventory.length})
          {lowStockCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[10px]">
              {lowStockCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('distributors')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'distributors'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <Truck className="w-3.5 h-3.5" /> Suppliers / Distributors ({distributors.length})
        </button>

        <button
          onClick={() => setActiveTab('staff')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'staff'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <Users className="w-3.5 h-3.5" /> Staff Payroll &amp; Attendance ({staffList.length})
        </button>

        <button
          onClick={() => setActiveTab('reminders')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'reminders'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" /> Follow-ups &amp; Broadcast
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap relative ${
            activeTab === 'reports'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : isBackupOverdue
              ? 'bg-slate-900 text-amber-300 hover:bg-slate-800 border border-amber-500/50'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Reports &amp; Exports</span>
          {isBackupOverdue && (
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping ml-0.5" title="Offline backup recommended" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'settings'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <Settings className="w-3.5 h-3.5" /> Shop &amp; UPI Settings
        </button>

        {isSuperAdmin && (
          <button
            onClick={() => {
              setActiveTab('saas_seller');
              loadAllShops();
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'saas_seller'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-900 text-amber-400 hover:bg-slate-800 border border-amber-500/40'
            }`}
          >
            <Crown className="w-3.5 h-3.5 text-amber-400" /> 👑 Software Seller Panel
          </button>
        )}
      </div>

      {/* TAB 1: DAILY GALLA TALLY */}
      {activeTab === 'galla' && (
        <div className="space-y-4">
          {/* Real Net Profit (Asli Munafa) Feature Card */}
          <div className="bg-gradient-to-r from-emerald-950/90 via-slate-900 to-amber-950/50 border-2 border-emerald-500/70 p-5 rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-black uppercase text-emerald-300 tracking-wider">
                  📈 Real Net Profit (Asli Workshop Munafa)
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                  Live Today
                </span>
              </div>
              <p className="text-xs text-slate-400 max-w-xl">
                Formula: (Spare Parts Selling - Kharid Cost) + Labour Charges + Consumables + Outside Lathe Margin + Quick Jobs + Scrap Income - Shop Expenses.
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Net Profit Today
                </span>
                <div className="text-3xl font-mono font-black text-emerald-400">
                  ₹{gallaTally?.realNetProfit || 0}
                </div>
              </div>

              <button
                onClick={() => setShowScrapModal(true)}
                className="px-3.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-lg shadow-amber-500/20 transition flex items-center gap-1.5"
              >
                <Banknote className="w-4 h-4" /> + Record Scrap / Old Oil Sale
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
              <span className="text-[11px] text-slate-400 uppercase font-semibold block">
                Net Cash in Galla (Drawer)
              </span>
              <div className="text-2xl font-mono font-bold text-emerald-400 mt-1">
                ₹{gallaTally?.netCashInGalla || 0}
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">
                Cash In - (Expenses + Upad)
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
              <span className="text-[11px] text-slate-400 uppercase font-semibold block">
                Total UPI Collected
              </span>
              <div className="text-2xl font-mono font-bold text-indigo-400 mt-1">
                ₹{gallaTally?.totalUpiIn || 0}
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">
                Direct to Bank Account
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
              <span className="text-[11px] text-slate-400 uppercase font-semibold block">
                Expenses &amp; Upad Out
              </span>
              <div className="text-2xl font-mono font-bold text-rose-400 mt-1">
                ₹{gallaTally?.totalCashOut || 0}
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">
                ₹{gallaTally?.shopExpenses || 0} Shop + ₹{gallaTally?.staffUpad || 0} Upad
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
              <span className="text-[11px] text-slate-400 uppercase font-semibold block">
                Khata (Udhar Transferred)
              </span>
              <div className="text-2xl font-mono font-bold text-amber-400 mt-1">
                ₹{gallaTally?.transferredToKhata || 0}
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">
                Receivable from Customers
              </span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-xs">
            <h4 className="font-bold text-slate-200 mb-2">
              Daily Drawer Formula (Tally Reconciliation)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-slate-300">
              <div className="space-y-1.5 p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div className="text-xs font-bold text-emerald-400">Cash Inflows (+)</div>
                <div className="flex justify-between">
                  <span>Job Card Cash:</span>
                  <span className="font-mono font-bold">₹{gallaTally?.jobCardCash || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Quick Job Express Cash:</span>
                  <span className="font-mono font-bold">₹{gallaTally?.quickJobCash || 0}</span>
                </div>
                {gallaTally?.scrapIncome ? (
                  <div className="flex justify-between text-emerald-300 font-bold">
                    <span>Scrap / Old Oil Sale (+):</span>
                    <span className="font-mono">₹{gallaTally.scrapIncome}</span>
                  </div>
                ) : null}
                <div className="flex justify-between pt-1 border-t border-slate-800 font-bold text-emerald-300">
                  <span>Total Cash Collected:</span>
                  <span className="font-mono">₹{gallaTally?.totalCashIn || 0}</span>
                </div>
              </div>

              <div className="space-y-1.5 p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div className="text-xs font-bold text-rose-400">Cash Outflows (-)</div>
                <div className="flex justify-between">
                  <span>Shop Expenses (Tea/Tools):</span>
                  <span className="font-mono font-bold">₹{gallaTally?.shopExpenses || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Staff Upad Advances:</span>
                  <span className="font-mono font-bold">₹{gallaTally?.staffUpad || 0}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-800 font-bold text-rose-300">
                  <span>Total Cash Spent:</span>
                  <span className="font-mono">₹{gallaTally?.totalCashOut || 0}</span>
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between p-3 rounded-xl bg-emerald-950/40 border border-emerald-600/40">
              <span className="font-bold text-emerald-200">
                Physical Cash in Cash Drawer Right Now:
              </span>
              <span className="text-xl font-mono font-black text-emerald-400">
                ₹{gallaTally?.netCashInGalla || 0}
              </span>
            </div>
          </div>

          {/* Today's Expenses & Upad Audit List with 1-Click Reverse / Delete */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-rose-400" />
                <h4 className="text-xs font-bold text-slate-100 uppercase tracking-wide">
                  Today's Recorded Expenses &amp; Upad Outflows ({todayExpenses.length})
                </h4>
              </div>
              <span className="text-[11px] text-slate-400">
                1-click delete to reverse mistake and restore drawer cash
              </span>
            </div>

            {todayExpenses.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500">
                No expenses or Upad advances recorded today.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase border-b border-slate-800">
                    <tr>
                      <th className="p-2.5">Title / Reason</th>
                      <th className="p-2.5">Category</th>
                      <th className="p-2.5 text-right">Amount</th>
                      <th className="p-2.5">Recorded By</th>
                      <th className="p-2.5">Time</th>
                      <th className="p-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {todayExpenses.map((exp) => (
                      <tr key={exp.id} className="hover:bg-slate-800/40 transition">
                        <td className="p-2.5 font-semibold text-slate-200">{exp.title}</td>
                        <td className="p-2.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              exp.expense_type === 'staff_upad'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            }`}
                          >
                            {exp.expense_type === 'staff_upad' ? 'Staff Upad' : 'Shop Expense'}
                          </span>
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold text-rose-400">
                          -₹{exp.amount}
                        </td>
                        <td className="p-2.5 text-slate-400">{exp.recorded_by || 'Manager'}</td>
                        <td className="p-2.5 text-slate-500 text-[11px] font-mono">
                          {formatCCTVTimestamp(exp.created_at).substring(11)}
                        </td>
                        <td className="p-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteExpense(exp)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 border border-slate-700 transition"
                            title="Reverse / Delete this expense"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* COMPLETE TIME-STAMPED WORKSHOP PASSBOOK & CASHFLOW LEDGER */}
          {(() => {
            const now = new Date();
            let startDate: Date | null = null;
            let endDate: Date | null = null;

            if (passbookFilter === 'today') {
              startDate = new Date(now);
              startDate.setHours(0, 0, 0, 0);
            } else if (passbookFilter === 'yesterday') {
              startDate = new Date(now);
              startDate.setDate(startDate.getDate() - 1);
              startDate.setHours(0, 0, 0, 0);
              endDate = new Date(startDate);
              endDate.setHours(23, 59, 59, 999);
            } else if (passbookFilter === 'this_week') {
              startDate = new Date(now);
              startDate.setDate(startDate.getDate() - 7);
              startDate.setHours(0, 0, 0, 0);
            } else if (passbookFilter === 'this_month') {
              startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
            } else if (passbookFilter === 'custom') {
              if (customStartDate) {
                startDate = new Date(customStartDate);
                startDate.setHours(0, 0, 0, 0);
              }
              if (customEndDate) {
                endDate = new Date(customEndDate);
                endDate.setHours(23, 59, 59, 999);
              }
            }

            const filterDate = (timestamp: string) => {
              if (!timestamp) return false;
              const t = new Date(timestamp).getTime();
              if (startDate && t < startDate.getTime()) return false;
              if (endDate && t > endDate.getTime()) return false;
              return true;
            };

            interface LedgerEntry {
              id: string;
              type: 'job_card' | 'quick_job' | 'expense' | 'scrap' | 'upad' | 'salary_payout';
              timestamp: string;
              title: string;
              subtitle: string;
              mode: 'cash' | 'upi';
              amount: number;
              isCash: boolean;
              onDelete: () => void;
            }

            const ledgerItems: LedgerEntry[] = [];

            // 1. Completed Job Cards
            jobCards
              .filter((c) => c.status === 'completed' && filterDate(c.billed_at || c.created_at))
              .forEach((c) => {
                const cardMode = (c as any).payment_mode || 'cash';
                const isCash = cardMode === 'cash' || Number(c.mandatory_cash_to_collect || 0) > 0;
                const amt = Number(c.mandatory_cash_to_collect || c.total_bill || 0);
                ledgerItems.push({
                  id: `jc-${c.id}`,
                  type: 'job_card',
                  timestamp: c.billed_at || c.created_at,
                  title: `Intake Bill #${c.bike_number}`,
                  subtitle: `${c.customer?.customer_name || 'Walk-in'} | Total: ₹${c.total_bill}`,
                  mode: cardMode === 'upi' ? 'upi' : 'cash',
                  amount: amt,
                  isCash,
                  onDelete: () => handleDeleteJobCard(c.id, c.bike_number),
                });
              });

            // 2. Quick Jobs
            allQuickJobs
              .filter((q) => filterDate(q.created_at))
              .forEach((q) => {
                ledgerItems.push({
                  id: `qj-${q.id}`,
                  type: 'quick_job',
                  timestamp: q.created_at,
                  title: `Quick Job: ${q.service_name}`,
                  subtitle: `Done by ${q.worker_name || 'Staff'}${q.is_price_modified ? ' (Audited)' : ''}`,
                  mode: q.payment_mode === 'upi' ? 'upi' : 'cash',
                  amount: Number(q.final_price || 0),
                  isCash: q.payment_mode === 'cash',
                  onDelete: () => handleDeleteQuickJob(q.id, q.service_name),
                });
              });

            // 3. Shop Expenses, Scrap Sales, and Staff Upads
            allExpenses
              .filter((e) => filterDate(e.created_at))
              .forEach((e) => {
                const isScrap = e.expense_type === 'scrap_income';
                const isUpad = e.expense_type === 'staff_upad';
                const mode = (e as any).payment_mode === 'upi' ? 'upi' : 'cash';
                const amt = isScrap ? Number(e.amount || 0) : -Number(e.amount || 0);
                ledgerItems.push({
                  id: `exp-${e.id}`,
                  type: isScrap ? 'scrap' : isUpad ? 'upad' : 'expense',
                  timestamp: e.created_at,
                  title: e.title,
                  subtitle: `Recorded by ${e.recorded_by || 'Staff'} ${e.category ? `• ${e.category}` : ''}`,
                  mode,
                  amount: amt,
                  isCash: mode === 'cash',
                  onDelete: () => handleDeleteExpense(e),
                });
              });

            // 4. Staff Payments (Salary Payouts)
            allStaffPayments
              .filter((p) => p.payment_type === 'salary_payout' && filterDate(p.created_at))
              .forEach((p) => {
                const mode = p.payment_mode === 'upi' ? 'upi' : 'cash';
                ledgerItems.push({
                  id: `pay-${p.id}`,
                  type: 'salary_payout',
                  timestamp: p.created_at,
                  title: `Salary Payout: ${p.staff_name}`,
                  subtitle: `${p.notes || 'Monthly Salary Settlement'} (Paid by ${(p as any).recorded_by || 'Owner'})`,
                  mode,
                  amount: -Number(p.amount || 0),
                  isCash: mode === 'cash',
                  onDelete: () => handleDeleteStaffPayment(p.id, p.staff_name, p.amount),
                });
              });

            // Sort chronologically descending
            ledgerItems.sort(
              (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );

            // Compute Filtered KPIs
            let totalCashIn = 0;
            let totalUpiIn = 0;
            let totalCashOut = 0;
            let totalExpenses = 0;

            ledgerItems.forEach((it) => {
              if (it.amount > 0) {
                if (it.mode === 'cash') totalCashIn += it.amount;
                else totalUpiIn += it.amount;
              } else {
                totalExpenses += Math.abs(it.amount);
                if (it.mode === 'cash') totalCashOut += Math.abs(it.amount);
              }
            });

            const netCashInDrawer = totalCashIn - totalCashOut;
            const netProfit = totalCashIn + totalUpiIn - totalExpenses;

            return (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-4">
                {/* Header & Date Filters */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                      <FileSpreadsheet className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                        📊 Time-Stamped Workshop Passbook &amp; Cashflow Ledger
                      </h4>
                      <p className="text-xs text-slate-400">
                        Unified financial timeline of intake bills, quick jobs, workshop expenses, and staff settlements
                      </p>
                    </div>
                  </div>

                  {/* Filter Pills */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {(['today', 'yesterday', 'this_week', 'this_month', 'all', 'custom'] as const).map((filter) => (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => setPassbookFilter(filter)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition ${
                          passbookFilter === filter
                            ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                        }`}
                      >
                        {filter.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Date Pickers */}
                {passbookFilter === 'custom' && (
                  <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 font-semibold">From:</span>
                      <input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        className="px-2.5 py-1 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 font-semibold">To:</span>
                      <input
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        className="px-2.5 py-1 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                )}

                {/* Filtered Period Aggregate KPIs */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Cash In</span>
                    <span className="text-lg font-mono font-bold text-emerald-400 mt-0.5 block">+₹{totalCashIn}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Total UPI In</span>
                    <span className="text-lg font-mono font-bold text-indigo-400 mt-0.5 block">+₹{totalUpiIn}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Cash Expenses</span>
                    <span className="text-lg font-mono font-bold text-rose-400 mt-0.5 block">-₹{totalCashOut}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-emerald-500/40 bg-emerald-950/20">
                    <span className="text-[10px] uppercase font-bold text-emerald-300 block">Net in Drawer</span>
                    <span className="text-lg font-mono font-black text-emerald-400 mt-0.5 block">₹{netCashInDrawer}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-amber-500/40 bg-amber-950/20 col-span-2 sm:col-span-1">
                    <span className="text-[10px] uppercase font-bold text-amber-300 block">Net Profit</span>
                    <span className="text-lg font-mono font-black text-amber-400 mt-0.5 block">₹{netProfit}</span>
                  </div>
                </div>

                {/* Chronological Event Rows */}
                {ledgerItems.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500">
                    No transactions recorded for the selected period.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase border-b border-slate-800">
                        <tr>
                          <th className="p-2.5">Date &amp; Time</th>
                          <th className="p-2.5">Type</th>
                          <th className="p-2.5">Particulars</th>
                          <th className="p-2.5">Payment Mode</th>
                          <th className="p-2.5 text-right">Amount</th>
                          <th className="p-2.5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {ledgerItems.map((item) => {
                          const isPositive = item.amount > 0;
                          const typeBadge =
                            item.type === 'job_card'
                              ? { label: '📋 Job Card', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' }
                              : item.type === 'quick_job'
                              ? { label: '⚡ Quick Job', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' }
                              : item.type === 'scrap'
                              ? { label: '♻️ Scrap Sale', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' }
                              : item.type === 'upad'
                              ? { label: '💸 Staff Upad', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' }
                              : item.type === 'salary_payout'
                              ? { label: '💰 Salary Payout', color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' }
                              : { label: '🧾 Shop Expense', color: 'bg-rose-500/20 text-rose-300 border-rose-500/40' };

                          return (
                            <tr key={item.id} className="hover:bg-slate-800/40 transition">
                              <td className="p-2.5 text-slate-400 text-[11px] font-mono whitespace-nowrap">
                                {formatSimpleDate(item.timestamp)} {formatCCTVTimestamp(item.timestamp).substring(11)}
                              </td>
                              <td className="p-2.5 whitespace-nowrap">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${typeBadge.color}`}>
                                  {typeBadge.label}
                                </span>
                              </td>
                              <td className="p-2.5">
                                <div className="font-semibold text-slate-200">{item.title}</div>
                                <div className="text-[11px] text-slate-400">{item.subtitle}</div>
                              </td>
                              <td className="p-2.5 whitespace-nowrap">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                    item.mode === 'cash'
                                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                      : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                                  }`}
                                >
                                  {item.mode === 'cash' ? '💵 Cash' : '📱 UPI'}
                                </span>
                              </td>
                              <td
                                className={`p-2.5 text-right font-mono font-bold whitespace-nowrap ${
                                  isPositive ? 'text-emerald-400' : 'text-rose-400'
                                }`}
                              >
                                {isPositive ? `+₹${item.amount}` : `-₹${Math.abs(item.amount)}`}
                              </td>
                              <td className="p-2.5 text-right whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={item.onDelete}
                                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-300 border border-slate-700 hover:border-rose-700 transition inline-flex items-center gap-1 text-[11px] font-bold cursor-pointer"
                                  title="Reverse / Delete this transaction"
                                >
                                  <Trash2 className="w-3 h-3 text-rose-400" />
                                  <span>Delete</span>
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
            );
          })()}
        </div>
      )}

      {/* TAB 2: MASTER INVENTORY WITH SMART CHECKBOX ORDERING & ANTI-DOUBLE-ORDER TRACKER */}
      {activeTab === 'inventory' && (
        <div className="space-y-4">
          {/* Header & Sub-Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Package className="w-4 h-4 text-amber-400" />
                Workshop Master Inventory &amp; Stock Reorders
              </h3>
              <p className="text-xs text-slate-400">
                Low stock (&lt; 5) sorted to top. Select checkboxes, enter order quantities, and dispatch WhatsApp POs with anti-double-order tracking.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleExportCsv('inventory')}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <Download className="w-3.5 h-3.5" /> Export CSV
              </button>
              <button
                onClick={() => setShowNewItemModal(true)}
                className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition"
              >
                <Plus className="w-3.5 h-3.5" /> + New Spare Part
              </button>
            </div>
          </div>

          {/* Sub-Navigation: All Parts vs Side Order Tracker */}
          <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
            <button
              onClick={() => setInvSubTab('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                invSubTab === 'all'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              <Package className="w-3.5 h-3.5" /> All Spare Parts ({inventory.length})
            </button>

            <button
              onClick={() => setInvSubTab('ordered_tracker')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                invSubTab === 'ordered_tracker'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              <PackageCheck className="w-3.5 h-3.5 text-amber-400" />
              <span>📦 Order Tracker</span>
              {orderedCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-slate-950 font-mono text-[10px] font-bold animate-pulse">
                  {orderedCount}
                </span>
              )}
            </button>
          </div>

          {/* VIEW A: ALL SPARE PARTS WITH CHECKBOX ORDERING */}
          {invSubTab === 'all' && (
            <div className="space-y-3">
              {/* Search bar with Microphone voice typing & quick selection */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[240px]">
                  <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search spare parts by name or category..."
                    value={invSearch}
                    onChange={(e) => setInvSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={toggleVoiceListening}
                  className={`p-2.5 rounded-xl border transition ${
                    isListening
                      ? 'bg-rose-500 text-white border-rose-400 animate-pulse'
                      : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                  }`}
                  title="Voice search parts"
                >
                  {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>

                {lowStockCount > 0 && (
                  <button
                    onClick={handleSelectAllLowStock}
                    className="px-3 py-2 rounded-xl bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-700 text-xs font-bold transition flex items-center gap-1.5"
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    <span>Select All Low Stock ({lowStockCount})</span>
                  </button>
                )}

                {selectedCount > 0 && (
                  <button
                    onClick={handleClearSelection}
                    className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs font-semibold"
                  >
                    Clear ({selectedCount})
                  </button>
                )}
              </div>

              {/* Selected Items Order Floating Banner */}
              {selectedCount > 0 && (
                <div className="p-3 rounded-2xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 border-2 border-amber-500 flex flex-wrap items-center justify-between gap-3 shadow-xl animate-in fade-in">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
                      <ShoppingCart className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-100">
                        {selectedCount} Part(s) Selected • Total: {totalSelectedUnits} Units
                      </span>
                      <p className="text-[11px] text-amber-300">
                        Ready to dispatch purchase order to supplier via WhatsApp or PDF
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowOrderDistributorModal(true)}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/30 transition"
                  >
                    <Send className="w-3.5 h-3.5" /> 🛒 Order Selected Items ({selectedCount})
                  </button>
                </div>
              )}

              {/* Inventory Table with Checkboxes & Order Qty */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                      <tr>
                        <th className="p-3 text-center w-10">Select</th>
                        <th className="p-3">Part Name &amp; Order Status</th>
                        <th className="p-3">Category</th>
                        <th className="p-3 text-center">Current Stock</th>
                        <th className="p-3 text-center">Order Qty</th>
                        <th className="p-3 text-right">Selling Price</th>
                        <th className="p-3 text-center">Quick Restock</th>
                        <th className="p-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {sortedInventory.map((item) => {
                        const minLimit = item.min_stock_limit ?? 5;
                        const isLow = item.stock_quantity < minLimit;
                        const isEditing = editingItem?.id === item.id;
                        const isSelected = !!selectedOrderItems[item.id];
                        const orderQty = orderQuantities[item.id] ?? (isLow ? 10 : 5);

                        return (
                          <tr
                            key={item.id}
                            className={`transition ${
                              isSelected
                                ? 'bg-amber-500/10 hover:bg-amber-500/15'
                                : isLow
                                ? 'bg-rose-950/30 hover:bg-rose-950/50'
                                : 'hover:bg-slate-800/40'
                            }`}
                          >
                            {/* Checkbox column with double-order lock */}
                            <td className="p-3 text-center">
                              <div className="flex flex-col items-center justify-center gap-0.5">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  disabled={Boolean(item.is_ordered && !unlockedReorders[item.id])}
                                  onChange={() => handleToggleOrderItem(item.id, orderQty)}
                                  className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-amber-500 focus:ring-amber-500 cursor-pointer disabled:opacity-40"
                                />
                                {item.is_ordered && !unlockedReorders[item.id] && (
                                  <button
                                    type="button"
                                    onClick={() => setUnlockedReorders((prev) => ({ ...prev, [item.id]: true }))}
                                    className="text-[9px] text-amber-400 hover:text-amber-300 underline font-bold whitespace-nowrap"
                                    title="Unlock to reorder"
                                  >
                                    Unlock
                                  </button>
                                )}
                              </div>
                            </td>

                            {/* Part Name & ORDERED Badge with 1-Click Receive/Cancel */}
                            <td className="p-3 font-semibold text-slate-200">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span>{item.part_name}</span>
                                  {isLow && (
                                    <span className="px-1.5 py-0.2 rounded bg-rose-600 text-white font-mono text-[9px] font-bold">
                                      LOW (&lt;{minLimit})
                                    </span>
                                  )}
                                </div>

                                {/* Anti-Double-Order Bright Badge & 1-Click Receive/Cancel Buttons */}
                                {item.is_ordered && (
                                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold">
                                      <Clock className="w-3 h-3 text-amber-400" />
                                      ⏳ ORDERED (Qty: {item.ordered_qty || 10} • {item.ordered_distributor_name || 'Supplier'})
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleReceiveStock(item.id, item.ordered_qty || 10)}
                                      className="px-2 py-0.5 rounded-md bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-700 text-[10px] font-bold transition flex items-center gap-1"
                                      title="Add ordered quantity to stock"
                                    >
                                      <CheckCircle className="w-3 h-3" /> ✅ Received (+{item.ordered_qty || 10} Stock)
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleCancelOrdered(item.id)}
                                      className="px-1.5 py-0.5 rounded-md bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-300 border border-slate-700 text-[10px] font-bold transition"
                                      title="Cancel order status"
                                    >
                                      ✖ Cancel
                                    </button>
                                  </div>
                                )}
                              </div>
                            </td>

                            <td className="p-3 text-slate-400">{item.part_category}</td>

                            {/* Current Stock & Min Stock Limit */}
                            <td className="p-3 text-center">
                              {isEditing ? (
                                <div className="flex flex-col items-center gap-1">
                                  <div className="flex items-center gap-1 text-[10px] text-slate-400">
                                    <span>Stock:</span>
                                    <input
                                      type="number"
                                      min="0"
                                      value={editStock}
                                      onChange={(e) => setEditStock(Number(e.target.value))}
                                      className="w-14 px-1 py-0.5 bg-slate-950 border border-slate-700 rounded text-center font-mono font-bold text-slate-100"
                                    />
                                  </div>
                                  <div className="flex items-center gap-1 text-[10px] text-amber-400">
                                    <span>Min:</span>
                                    <input
                                      type="number"
                                      min="1"
                                      value={editMinStock}
                                      onChange={(e) => setEditMinStock(Math.max(1, Number(e.target.value)))}
                                      className="w-14 px-1 py-0.5 bg-slate-950 border border-amber-500/50 rounded text-center font-mono font-bold text-amber-300"
                                    />
                                  </div>
                                </div>
                              ) : (
                                <span
                                  className={`px-2 py-0.5 rounded font-mono font-bold text-xs ${
                                    isLow
                                      ? 'bg-rose-600 text-white'
                                      : 'bg-slate-950 text-slate-200'
                                  }`}
                                >
                                  {item.stock_quantity}
                                </span>
                              )}
                            </td>

                            {/* Order Quantity Input Field with - / + Buttons */}
                            <td className="p-3 text-center">
                              <div className="inline-flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setOrderQuantities((prev) => ({
                                      ...prev,
                                      [item.id]: Math.max(1, (prev[item.id] || orderQty) - 1),
                                    }))
                                  }
                                  className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  min="1"
                                  value={orderQty}
                                  onChange={(e) => {
                                    const val = Math.max(1, Number(e.target.value));
                                    setOrderQuantities((prev) => ({ ...prev, [item.id]: val }));
                                  }}
                                  className="w-10 px-1 py-0.5 bg-transparent border-0 text-center font-mono font-bold text-amber-300 text-xs focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    setOrderQuantities((prev) => ({
                                      ...prev,
                                      [item.id]: (prev[item.id] || orderQty) + 1,
                                    }))
                                  }
                                  className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center"
                                >
                                  +
                                </button>
                              </div>
                            </td>

                            {/* Selling Price */}
                            <td className="p-3 text-right">
                              {isEditing ? (
                                <input
                                  type="number"
                                  min="0"
                                  value={editPrice}
                                  onChange={(e) => setEditPrice(Number(e.target.value))}
                                  className="w-20 px-2 py-1 bg-slate-950 border border-amber-500 rounded text-right font-mono font-bold text-amber-300"
                                />
                              ) : (
                                <span className="font-mono font-bold text-amber-400 text-sm">
                                  ₹{item.unit_price}
                                </span>
                              )}
                            </td>

                            {/* Quick Restock (+1 / +5) Buttons */}
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => handleQuickStockIncrement(item.id, 1)}
                                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold border border-slate-700"
                                  title="Add 1 unit to stock"
                                >
                                  +1
                                </button>
                                <button
                                  onClick={() => handleQuickStockIncrement(item.id, 5)}
                                  className="px-2 py-0.5 rounded bg-emerald-950 hover:bg-emerald-900 text-emerald-300 text-[11px] font-bold border border-emerald-700"
                                  title="Add 5 units to stock"
                                >
                                  +5
                                </button>
                              </div>
                            </td>

                            <td className="p-3 text-right">
                              {isEditing ? (
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={handleSaveItemEdit}
                                    className="px-2.5 py-1 rounded bg-amber-500 text-slate-950 font-bold text-xs"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={() => setEditingItem(null)}
                                    className="px-2 py-1 rounded bg-slate-800 text-slate-400 text-xs"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => {
                                      setEditingItem(item);
                                      setEditPrice(item.unit_price);
                                      setEditStock(item.stock_quantity);
                                      setEditMinStock(item.min_stock_limit ?? 5);
                                    }}
                                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                                    title="Edit Part"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteItem(item.id, item.part_name)}
                                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 border border-slate-700 transition"
                                    title="Delete Part"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* VIEW B: SIDE ORDER TRACKER (ANTI-DOUBLE-ORDER & 1-CLICK RECEIVE STOCK) */}
          {invSubTab === 'ordered_tracker' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <PackageCheck className="w-4 h-4 text-emerald-400" />
                    Currently Pending Orders Tracker ({orderedItems.length})
                  </h4>
                  <span className="text-xs text-amber-400 font-semibold">
                    Anti-Double-Order Protected
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  When goods arrive from your distributor, click "✅ Received (Add to Stock)" to automatically credit stock and clear the ordered badge.
                </p>
              </div>

              {orderedItems.length === 0 ? (
                <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-2xl">
                  <PackageCheck className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-300">No Pending Stock Orders</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Select parts in "All Spare Parts" and click "🛒 Order Selected Items" to place orders.
                  </p>
                  <button
                    onClick={() => setInvSubTab('all')}
                    className="mt-3 px-3.5 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs"
                  >
                    Go to All Spare Parts
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {orderedItems.map((item: InventoryItem) => (
                    <div
                      key={item.id}
                      className="p-4 rounded-2xl bg-slate-900 border border-amber-500/30 flex flex-col justify-between shadow-md space-y-3"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-100 text-sm">
                            {item.part_name}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-slate-800 text-slate-300">
                            {item.part_category}
                          </span>
                        </div>

                        <div className="mt-2 p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-xs space-y-1.5">
                          <div className="flex justify-between text-slate-400">
                            <span>Supplier:</span>
                            <span className="text-amber-300 font-semibold">
                              {item.ordered_distributor_name || 'Registered Supplier'}
                            </span>
                          </div>
                          <div className="flex justify-between text-slate-400">
                            <span>In-Shop Current Stock:</span>
                            <span className="font-mono text-slate-200">{item.stock_quantity} units</span>
                          </div>
                          <div className="flex justify-between pt-1 border-t border-slate-800">
                            <span className="text-slate-300 font-bold">Ordered Quantity:</span>
                            <span className="font-mono text-emerald-400 font-bold text-sm">
                              +{item.ordered_qty || 10} units
                            </span>
                          </div>
                          {item.ordered_at && (
                            <div className="text-[10px] text-slate-500 pt-0.5">
                              Ordered: {formatCCTVTimestamp(item.ordered_at)}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                        <button
                          onClick={() => handleReceiveStock(item.id, item.ordered_qty || 10)}
                          className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1 shadow-md transition"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> ✅ Received (Add to Stock)
                        </button>
                        <button
                          onClick={() => handleCancelOrdered(item.id)}
                          className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-rose-950 hover:text-rose-300 text-slate-400 text-xs font-semibold border border-slate-700 transition"
                          title="Cancel order tag"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB: SUPPLIERS & DISTRIBUTORS */}
      {activeTab === 'distributors' && (
        <DistributorsManagerView
          currentShop={currentShop}
          distributors={distributors}
          inventory={inventory}
          onRefresh={loadData}
        />
      )}

      {/* TAB 3: STAFF PAYROLL, ATTENDANCE LOG & 4H TEMP MANAGER */}
      {activeTab === 'staff' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                Staff Payroll, Duty Attendance &amp; Delegation Control
              </h3>
              <p className="text-xs text-slate-400">
                Owner excluded. Displays CCTV Duty Punch In/Out, Monthly Days, Bikes Completed, Upad advances, and Net Salary.
              </p>
            </div>
            <button
              onClick={() => setShowAppointModal(true)}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition"
            >
              <UserPlus className="w-4 h-4" /> + Appoint New Staff / Position
            </button>
          </div>

          {/* Active Staff Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeStaffList.map((staff) => {
              const isTempMgr =
                staff.is_temp_manager &&
                staff.temp_manager_expires_at &&
                new Date(staff.temp_manager_expires_at).getTime() > Date.now();

              // Today attendance record
              const attToday = todayAttendance.find((a) => a.staff_id === staff.id);

              // Monthly duty days credit count (matches 360 Dossier)
              const monthDutyDays = monthlyAttendance
                .filter((a) => a.staff_id === staff.id)
                .reduce((sum, a) => sum + (a.day_credit ?? (a.status === 'present' ? 1.0 : a.status === 'half_day' ? 0.5 : 0)), 0);

              // Stats: Bikes completed & quick jobs
              const sStat = staffStats[staff.id] || { bikesCompleted: 0, quickJobsDone: 0 };

              const currentMonthStr = new Date().toISOString().slice(0, 7);
              const currentMonthName = new Date().toLocaleString('en-IN', { month: 'short' });

              // Attendance-based pro-rata salary formula
              const dailyRate = Math.round((staff.monthly_salary || 12000) / 30);
              const earnedSalary = Math.round(dailyRate * monthDutyDays);

              const thisMonthUpad = allStaffPayments
                .filter((p) => p.staff_id === staff.id && p.payment_type === 'upad_advance' && (p.created_at || '').startsWith(currentMonthStr))
                .reduce((sum, p) => sum + (p.amount || 0), 0);

              const thisMonthSalaryPaid = allStaffPayments
                .filter((p) => p.staff_id === staff.id && p.payment_type === 'salary_payout' && (p.created_at || '').startsWith(currentMonthStr))
                .reduce((sum, p) => sum + (p.amount || 0), 0);

              const netPayable = Math.max(0, earnedSalary - thisMonthUpad - thisMonthSalaryPaid);
              const isMonthSettled = thisMonthSalaryPaid > 0;

              const isPinRevealed = revealedPins[staff.id];
              const appUrl = getPublicAppUrl();
              const inviteMsg = `🏍️ *BikeReady Staff App Login Invite*\n\nWorkshop: *${currentShop.shop_name}*\nStaff Name: *${staff.full_name}* (${staff.designation || staff.role})\nApp Link: ${appUrl}\nLogin Mobile: *${staff.phone}*\nSecurity PIN: *${staff.pin_code}*\n\n👉 Open the link, sign in with your mobile & PIN, and tap '🟢 Punch In' daily to start work!`;

              return (
                <div
                  key={staff.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="font-bold text-slate-100 text-sm block">
                          {staff.full_name}
                        </span>
                        {staff.designation && (
                          <span className="text-[11px] text-amber-400 font-medium">
                            {staff.designation}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-800 text-slate-300">
                          {staff.role}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleOpenEditStaff(staff)}
                          className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 transition"
                          title="Edit Staff details & salary"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeactivatingStaff(staff);
                            setSettlementNotes('');
                          }}
                          className="p-1 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 transition"
                          title="Staff Left Job / Deactivate (Full & Final Settlement)"
                        >
                          <UserX className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                      <span>Mobile: {staff.phone}</span>
                      <div className="flex items-center gap-1.5 font-mono">
                        <span>PIN: {isPinRevealed ? staff.pin_code : '••••'}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setRevealedPins((prev) => ({ ...prev, [staff.id]: !prev[staff.id] }))
                          }
                          className="text-slate-400 hover:text-slate-200"
                          title={isPinRevealed ? 'Mask PIN' : 'Reveal PIN'}
                        >
                          {isPinRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setResetStaffTarget(staff);
                            setNewStaffPin('');
                          }}
                          className="ml-1 px-1.5 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[10px] font-sans font-bold flex items-center gap-0.5"
                          title="Reset Worker Security PIN"
                        >
                          <KeyRound className="w-3 h-3" /> Reset PIN
                        </button>
                      </div>
                    </div>

                    {/* Today Attendance & CCTV Duty Time */}
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 text-[11px] space-y-1 mb-2.5 font-mono">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Today Duty Status:</span>
                        {attToday ? (
                          <span className={`font-bold ${attToday.punch_out_time ? 'text-slate-300' : 'text-emerald-400'}`}>
                            {attToday.punch_out_time ? 'Completed Duty' : '🟢 On Duty Now'}
                          </span>
                        ) : (
                          <span className="text-rose-400 font-bold">Not Punched In</span>
                        )}
                      </div>
                      {attToday && (
                        <div className="text-[10px] text-slate-400">
                          In: {formatCCTVTimestamp(attToday.punch_in_time).substring(11)}
                          {attToday.punch_out_time && ` | Out: ${formatCCTVTimestamp(attToday.punch_out_time).substring(11)}`}
                        </div>
                      )}
                      <div className="flex justify-between text-slate-400 pt-1 border-t border-slate-800">
                        <span>Month Duty Days:</span>
                        <span className="text-slate-200 font-bold">{monthDutyDays} days</span>
                      </div>
                    </div>

                    {/* Performance Counters */}
                    <div className="grid grid-cols-2 gap-2 text-xs mb-2.5">
                      <div className="p-2 bg-slate-950 rounded-lg border border-slate-800 text-center">
                        <span className="text-[10px] text-slate-400 block">Bikes Completed</span>
                        <span className="font-mono font-bold text-amber-400 text-sm">
                          {sStat.bikesCompleted}
                        </span>
                      </div>
                      <div className="p-2 bg-slate-950 rounded-lg border border-slate-800 text-center">
                        <span className="text-[10px] text-slate-400 block">Quick Jobs Done</span>
                        <span className="font-mono font-bold text-indigo-400 text-sm">
                          {sStat.quickJobsDone}
                        </span>
                      </div>
                    </div>

                    {/* Payroll Breakdown */}
                    <div className="p-3 bg-slate-950 rounded-xl space-y-1 text-xs font-mono">
                      <div className="flex justify-between text-slate-400">
                        <span>Base Monthly Salary:</span>
                        <span className="text-slate-200">₹{staff.monthly_salary || 12000} (₹{dailyRate}/day)</span>
                      </div>
                      <div className="flex justify-between text-sky-400">
                        <span>Earned ({monthDutyDays} days worked):</span>
                        <span>₹{earnedSalary}</span>
                      </div>
                      <div className="flex justify-between text-rose-400">
                        <span>This Month Upad:</span>
                        <span>-₹{thisMonthUpad}</span>
                      </div>
                      {thisMonthSalaryPaid > 0 && (
                        <div className="flex justify-between text-emerald-400">
                          <span>Already Paid ({currentMonthName}):</span>
                          <span>-₹{thisMonthSalaryPaid}</span>
                        </div>
                      )}
                      <div className="flex justify-between pt-1 border-t border-slate-800 text-emerald-400 font-bold">
                        <span>Net Salary Payable:</span>
                        <span>₹{netPayable}</span>
                      </div>
                    </div>

                    {/* WhatsApp Share App Invite Button */}
                    <div className="mt-2.5">
                      <a
                        href={`https://wa.me/91${staff.phone.replace(/\D/g, '')}?text=${encodeURIComponent(inviteMsg)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-1.5 rounded-lg bg-emerald-600/90 hover:bg-emerald-500 text-white text-[11px] font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <Send className="w-3 h-3" /> 📲 Share App &amp; Login on WhatsApp
                      </a>
                    </div>
                  </div>

                  {/* Actions: Give Upad, Pay Salary, 360 Dossier & 4-Hour Temp Manager Toggle */}
                  <div className="mt-3 pt-2.5 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        onClick={() => {
                          setUpadStaff(staff);
                          setUpadAmount('');
                          setUpadReason('');
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> Upad
                      </button>

                      {isMonthSettled ? (
                        <span className="px-2.5 py-1.5 rounded-lg bg-emerald-950/70 border border-emerald-700/80 text-emerald-300 text-xs font-bold flex items-center gap-1">
                          ✅ {currentMonthName} Settled
                        </span>
                      ) : (
                        <button
                          onClick={() => {
                            setPaySalaryStaff(staff);
                            setPaySalaryAmount(netPayable);
                            setPaySalaryMode('cash');
                            setPaySalaryNotes(`${currentMonthName} Salary Settlement (${monthDutyDays} days worked)`);
                          }}
                          disabled={netPayable <= 0}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold transition flex items-center gap-1 disabled:opacity-40"
                          title="Record monthly pro-rata salary settlement payout in Passbook"
                        >
                          <Banknote className="w-3 h-3" /> Pay Salary
                        </button>
                      )}

                      <button
                        onClick={() => setDossierStaff(staff)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1 border border-slate-700"
                      >
                        <History className="w-3 h-3 text-amber-400" /> 📋 360° Dossier
                      </button>
                    </div>

                    {staff.role === 'mechanic' && (
                      <button
                        onClick={() => handleToggleTempManager(staff)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                          isTempMgr
                            ? 'bg-rose-950 text-rose-300 border border-rose-700 hover:bg-rose-900'
                            : 'bg-sky-500 text-slate-950 hover:bg-sky-400'
                        }`}
                      >
                        {isTempMgr ? 'Revoke 4h' : 'Grant 4h Mgr'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Collapsible Ex-Staff / Left Job Archive Section */}
          <div className="mt-6 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowExStaffArchive(!showExStaffArchive)}
              className="w-full p-3 rounded-2xl bg-slate-900 hover:bg-slate-800/80 border border-slate-800 flex items-center justify-between text-xs font-bold text-slate-300 transition"
            >
              <div className="flex items-center gap-2">
                <UserX className="w-4 h-4 text-slate-400" />
                <span>📁 Ex-Staff / Left Job Archive ({exStaffList.length} Deactivated)</span>
              </div>
              <span className="text-amber-400 font-mono text-[11px]">
                {showExStaffArchive ? '▲ Hide Archive' : '▼ View Archive'}
              </span>
            </button>

            {showExStaffArchive && (
              <div className="mt-3 space-y-2 animate-in fade-in">
                {exStaffList.length === 0 ? (
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center text-xs text-slate-500">
                    No ex-staff members in archive. All active staff are currently employed.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {exStaffList.map((ex) => (
                      <div
                        key={ex.id}
                        className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between space-y-2"
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-200 text-xs">
                              {ex.full_name} ({ex.role})
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-950 text-rose-300 border border-rose-800">
                              Deactivated
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1 font-mono">
                            Mobile: {ex.phone}
                          </p>
                          {ex.left_date && (
                            <p className="text-[10px] text-slate-500">
                              Left Date: {formatSimpleDate(ex.left_date)}
                            </p>
                          )}
                          {ex.settlement_notes && (
                            <p className="text-[11px] text-amber-300/80 mt-1 bg-slate-900 p-1.5 rounded border border-slate-800">
                              Note: {ex.settlement_notes}
                            </p>
                          )}
                        </div>

                        <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => handleReactivateStaff(ex)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold flex items-center gap-1 transition"
                          >
                            <UserCheck className="w-3.5 h-3.5" /> ✅ Re-join / Reactivate
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteStaffRecord(ex)}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 border border-slate-700 text-xs font-bold transition flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: FOLLOW-UPS & OFFER BROADCAST CENTER */}
      {activeTab === 'reminders' && (
        <CustomerBroadcastView
          currentShop={currentShop}
          customers={customers}
          followupJobCards={followupJobCards}
          onRefresh={loadData}
          onUpdateFollowupStatus={handleUpdateFollowupStatus}
        />
      )}

      {/* TAB 5: UPGRADED 7-DAY & 30-DAY REPORTS WITH 5 TABLES & GOOGLE DRIVE SHARE */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Raw CSV Data Exports */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                <h4 className="text-sm font-bold text-slate-100">
                  Raw CSV Data Exports
                </h4>
              </div>
              <p className="text-xs text-slate-400">
                Download database snapshots to Excel or accounting software.
              </p>

              <div className="space-y-2 pt-1">
                <button
                  onClick={() => handleExportCsv('galla')}
                  className="w-full py-2.5 px-3 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-200 text-xs font-semibold border border-slate-800 flex items-center justify-between"
                >
                  <span>Daily Galla Drawer Reconciliation</span>
                  <Download className="w-3.5 h-3.5 text-slate-400" />
                </button>
                <button
                  onClick={() => handleExportCsv('job_cards')}
                  className="w-full py-2.5 px-3 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-200 text-xs font-semibold border border-slate-800 flex items-center justify-between"
                >
                  <span>Complete Job Cards Register</span>
                  <Download className="w-3.5 h-3.5 text-slate-400" />
                </button>
                <button
                  onClick={() => handleExportCsv('inventory')}
                  className="w-full py-2.5 px-3 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-200 text-xs font-semibold border border-slate-800 flex items-center justify-between"
                >
                  <span>Inventory Master Stock List</span>
                  <Download className="w-3.5 h-3.5 text-slate-400" />
                </button>
              </div>
            </div>

            {/* Upgraded PDF Performance Reports (5 Tables) + Google Drive Share */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-400" />
                <h4 className="text-sm font-bold text-slate-100">
                  Comprehensive 5-Table PDF Audit Reports
                </h4>
              </div>
              <p className="text-xs text-slate-400">
                Contains KPIs, Completed Bills, Quick Jobs Audit, Shop Expenses, and Staff Attendance CCTV Logs.
              </p>

              <div className="space-y-2.5 pt-1">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <span className="text-xs font-bold text-amber-300 block">
                    Weekly (7-Day) Performance Audit
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleGeneratePdfReport(7, false)}
                      className="flex-1 py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-1 transition"
                    >
                      <Download className="w-3.5 h-3.5" /> Download PDF
                    </button>
                    <button
                      onClick={() => handleGeneratePdfReport(7, true)}
                      className="py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1 border border-slate-700 transition"
                      title="Save / Share to Google Drive"
                    >
                      <HardDrive className="w-3.5 h-3.5 text-amber-400" /> Drive Share
                    </button>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-indigo-300 block">
                      Monthly Complete Audit Statement
                    </span>
                    <input
                      type="month"
                      value={reportMonth}
                      onChange={(e) => setReportMonth(e.target.value)}
                      className="px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono font-bold text-amber-300 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <button
                      onClick={() => handleGeneratePdfReport(reportMonth, false)}
                      className="flex-1 py-2 px-3 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-sm"
                    >
                      <Download className="w-3.5 h-3.5" /> 📊 Download Monthly Complete Statement (PDF)
                    </button>
                    <button
                      onClick={() => handleGeneratePdfReport(reportMonth, true)}
                      className="py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 border border-slate-700 transition"
                      title="Save / Share to Google Drive"
                    >
                      <HardDrive className="w-3.5 h-3.5 text-indigo-400" /> ☁️ Save Monthly PDF to Google Drive / Share
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* MULTI-TIER AUTO-VAULT & UNIVERSAL EXPORT SUITE (TASK 6) */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4 md:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                    <HardDrive className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                      🛡️ Multi-Tier Auto-Vault &amp; Universal Audit Export Suite
                    </h4>
                    <p className="text-xs text-slate-400">
                      Automated 60-second rolling snapshots, Excel CSV with UTF-8 BOM, and printable Master Audit PDFs.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold flex items-center gap-1.5 shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span>Auto-Vault Active</span>
                    {lastVaultUpdate && <span className="text-slate-400 font-mono">({lastVaultUpdate})</span>}
                  </span>
                </div>
              </div>

              {/* TIMEFRAME SELECTOR FOR EXPORTS */}
              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-300">
                    Select Export Timeframe Filter:
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[
                      { id: 'today', label: '📅 Today' },
                      { id: 'week', label: '🗓️ Last 7 Days' },
                      { id: 'month', label: '📆 This Month' },
                      { id: 'year', label: '🏛️ This Year' },
                      { id: 'all', label: '🌐 All-Time Master' },
                    ].map((tf) => (
                      <button
                        key={tf.id}
                        type="button"
                        onClick={() => setExportTimeframe(tf.id as any)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                          exportTimeframe === tf.id
                            ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                            : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                        }`}
                      >
                        {tf.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3 Export Actions */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={handleUniversalExportCsv}
                    className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition"
                    title="Export all records to Excel (.CSV) with UTF-8 BOM"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>📊 Export Excel / Sheet (.CSV)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportPdf}
                    className="py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 transition"
                    title="Generate and print styled Master Audit Report PDF"
                  >
                    <FileText className="w-4 h-4" />
                    <span>📄 Export Master Audit PDF</span>
                  </button>

                  <button
                    type="button"
                    disabled={isBackingUp}
                    onClick={handleDownloadBackup}
                    className="py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 transition disabled:opacity-50"
                    title="Download complete database JSON backup"
                  >
                    <Download className="w-4 h-4" />
                    <span>{isBackingUp ? 'Exporting...' : '🛡️ Full Backup (.JSON)'}</span>
                  </button>
                </div>
              </div>

              {/* ROLLING AUTO-VAULT CHECKPOINTS & 1-CLICK RESTORE TABLE */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300">
                    📦 Multi-Tier Rolling Snapshots (1-Click Instant Restore):
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Rolling Minute, Daily, Weekly &amp; Monthly checkpoints
                  </span>
                </div>

                {autoVaultSnapshots.length === 0 ? (
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-center text-xs text-slate-400">
                    Initializing local auto-vault snapshots...
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {autoVaultSnapshots.map((snap) => (
                      <div
                        key={snap.key}
                        className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 flex flex-col justify-between gap-2 text-xs transition"
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-200">{snap.tierLabel}</span>
                            <span className="text-[10px] text-slate-400 font-mono">{snap.sizeKb} KB</span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-1">
                            {snap.description}
                          </div>
                          <div className="text-[10px] text-amber-300/90 font-mono mt-0.5">
                            Saved: {snap.dateFormatted}
                          </div>
                          <div className="text-[10px] text-emerald-400 font-semibold mt-0.5">
                            Total Records: {snap.totalRecords}
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={isRestoring}
                          onClick={() => handleRestoreVaultSnapshot(snap)}
                          className="w-full py-1.5 rounded-lg bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-300 text-[11px] font-bold border border-slate-700 hover:border-emerald-500 flex items-center justify-center gap-1 transition disabled:opacity-50"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>⚡ 1-Click Restore</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* RESTORE FROM EXTERNAL FILE & AUDIT LOG CLEANUP */}
              <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <label className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 flex items-center gap-1.5 transition cursor-pointer">
                    <Upload className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{isRestoring ? 'Restoring...' : '📤 Upload External JSON File to Restore'}</span>
                    <input
                      type="file"
                      accept=".json"
                      disabled={isRestoring}
                      onChange={handleFileRestore}
                      className="hidden"
                    />
                  </label>

                  <button
                    type="button"
                    disabled={isPurgingLogs}
                    onClick={handlePurgeLogs}
                    className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-rose-950 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-700/60 text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isPurgingLogs ? 'animate-spin' : ''}`} />
                    <span>Clean Logs (&gt;1 Year)</span>
                  </button>
                </div>

                {purgeResultMsg && (
                  <span className="text-xs text-emerald-400 font-semibold">
                    {purgeResultMsg}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: SHOP & UPI SETTINGS */}
      {activeTab === 'settings' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg max-w-xl space-y-4">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Settings className="w-4 h-4 text-amber-400" /> Shop Profile, White-Label &amp; UPI
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Printed on customer invoices, PDF gate passes, and WhatsApp quotations.
            </p>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
            {settingsSavedMsg && (
              <div className="p-2.5 rounded-xl bg-emerald-950 border border-emerald-600 text-emerald-300 font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Shop settings saved successfully!
              </div>
            )}

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Workshop / Business Name *
              </label>
              <input
                type="text"
                required
                value={settingsShopName}
                onChange={(e) => setSettingsShopName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 font-semibold"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Workshop Address (On Invoices)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Near Bus Stand, Main Road"
                  value={settingsShopAddress}
                  onChange={(e) => setSettingsShopAddress(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  GSTIN / Trade Lic. No. (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 27ABCDE1234F1Z5"
                  value={settingsGstNumber}
                  onChange={(e) => setSettingsGstNumber(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 uppercase"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Merchant UPI ID (For Invoices &amp; Dynamic QR) *
              </label>
              <input
                type="text"
                required
                value={settingsUpiId}
                onChange={(e) => setSettingsUpiId(e.target.value)}
                placeholder="e.g. shop@okhdfcbank or bikeready@upi"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 font-mono font-bold text-amber-300"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Customers scan this QR to pay directly into your shop bank account.
              </span>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Invoice Terms &amp; Warranty Policy (Bottom of PDF)
              </label>
              <textarea
                rows={2}
                value={settingsInvoiceTerms}
                onChange={(e) => setSettingsInvoiceTerms(e.target.value)}
                placeholder="e.g. 30 days service warranty. Electrical items carry manufacturer warranty only."
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-xs"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Distributor WhatsApp Number (For 1-Click Orders)
              </label>
              <input
                type="tel"
                value={settingsDistributorPhone}
                onChange={(e) => setSettingsDistributorPhone(e.target.value)}
                placeholder="10-digit mobile number"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100"
              />
            </div>

            {/* Owner Security Credentials */}
            <div className="p-3.5 bg-slate-950 rounded-xl border border-amber-500/30 space-y-3">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-400" />
                <span className="font-bold text-amber-300 text-xs">Owner Security &amp; PIN Recovery Setup</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Owner 4-Digit Login PIN *
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    value={settingsOwnerPin}
                    onChange={(e) => setSettingsOwnerPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="4-digit PIN"
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-amber-400 font-mono font-bold tracking-widest text-center"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">Your personal login PIN for this shop.</span>
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Private Secret Recovery Passcode
                  </label>
                  <input
                    type="password"
                    value={settingsRecoverySecret}
                    onChange={(e) => setSettingsRecoverySecret(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 font-mono text-xs"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">Used to reset your PIN if ever forgotten. Keep private.</span>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={savingSettings}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-sm transition shadow-lg shadow-amber-500/20 disabled:opacity-40"
            >
              {savingSettings ? 'Saving Settings...' : 'Save Workshop Settings'}
            </button>
          </form>
        </div>
      )}

      {/* TAB 7: SOFTWARE SELLER (SUPER ADMIN) PANEL */}
      {activeTab === 'saas_seller' && isSuperAdmin && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-amber-950/70 via-slate-900 to-slate-900 border border-amber-500/50 rounded-2xl p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-black text-slate-100">
                  Software Seller &amp; Super Admin Commercial Panel
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/40">
                  SaaS Master Control
                </span>
              </div>
              <p className="text-xs text-slate-400 max-w-2xl">
                Sell BikeReady software licenses to local bike garages, motorcycle service centers, and spare parts shops. Control tenant license status (Active / Trial / Suspended) to collect monthly/annual subscription fees.
              </p>
            </div>

            <button
              onClick={loadAllShops}
              disabled={loadingShops}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-xs font-bold transition flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingShops ? 'animate-spin' : ''}`} /> Refresh All Workshops
            </button>
          </div>

          {/* Workshops List Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <span className="font-bold text-slate-200 text-xs">
                Registered Workshops ({allRegisteredShops.length})
              </span>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <span>Master Activation Key:</span>
                <input
                  type={showMasterKey ? 'text' : 'password'}
                  readOnly
                  value="BIKEREADY2026"
                  className="w-28 px-2 py-0.5 bg-slate-950 border border-slate-700 rounded text-amber-400 font-mono font-bold text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowMasterKey(!showMasterKey)}
                  className="p-1 text-slate-400 hover:text-amber-400 transition"
                  title={showMasterKey ? 'Mask Key' : 'Reveal Key'}
                >
                  {showMasterKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="p-3">Workshop Name</th>
                    <th className="p-3">Owner Contact</th>
                    <th className="p-3">Address &amp; GSTIN</th>
                    <th className="p-3">UPI ID</th>
                    <th className="p-3 text-center">License Status</th>
                    <th className="p-3 text-right">License Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {allRegisteredShops.map((s) => {
                    const status = s.license_status || 'active';
                    return (
                      <tr key={s.id} className="hover:bg-slate-800/40 transition">
                        <td className="p-3 font-semibold text-slate-200">
                          <div>{s.shop_name}</div>
                          <span className="text-[10px] text-slate-500 font-mono">ID: {s.id.substring(0, 8)}...</span>
                        </td>
                        <td className="p-3 text-slate-300">
                          <div>{s.owner_name}</div>
                          <div className="font-mono text-slate-400 text-[11px]">{s.owner_phone}</div>
                          <div className="font-mono text-amber-400 text-[11px] font-bold">
                            PIN: {s.owner_pin || '••••'}
                          </div>
                        </td>
                        <td className="p-3 text-slate-400">
                          <div>{s.shop_address || '—'}</div>
                          {s.gst_number && <div className="text-[10px] font-mono text-amber-300/80">GST: {s.gst_number}</div>}
                        </td>
                        <td className="p-3 font-mono text-slate-300 text-xs">{s.upi_id || '—'}</td>
                        <td className="p-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              status === 'active'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : status === 'trial'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            }`}
                          >
                            {status === 'active' ? '🟢 Active' : status === 'trial' ? '🟡 Trial' : '🔴 Suspended'}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setAdminResetShop(s);
                                setAdminNewPin(s.owner_pin || '1234');
                              }}
                              className="px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[10px] font-bold border border-amber-500/40 transition"
                              title="Reset Owner 4-Digit Login PIN"
                            >
                              🔑 Reset PIN
                            </button>
                            {status !== 'active' && (
                              <button
                                onClick={() => handleUpdateShopLicense(s.id, 'active')}
                                className="px-2 py-1 rounded bg-emerald-950 hover:bg-emerald-900 text-emerald-300 text-[10px] font-bold border border-emerald-800 transition"
                                title="Grant full access"
                              >
                                Activate
                              </button>
                            )}
                            {status !== 'trial' && (
                              <button
                                onClick={() => handleUpdateShopLicense(s.id, 'trial')}
                                className="px-2 py-1 rounded bg-amber-950 hover:bg-amber-900 text-amber-300 text-[10px] font-bold border border-amber-800 transition"
                                title="Set 14-day trial"
                              >
                                Set Trial
                              </button>
                            )}
                            {status !== 'suspended' && (
                              <button
                                onClick={() => handleUpdateShopLicense(s.id, 'suspended')}
                                className="px-2 py-1 rounded bg-rose-950 hover:bg-rose-900 text-rose-300 text-[10px] font-bold border border-rose-800 transition"
                                title="Suspend workshop for non-payment"
                              >
                                Suspend
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CREATE NEW ITEM MODAL */}
      {showNewItemModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl p-6">
            <h3 className="text-base font-bold text-slate-100 mb-3 flex items-center gap-2">
              <Package className="w-4 h-4 text-amber-400" /> Add New Inventory Spare Part
            </h3>

            <form onSubmit={handleCreateNewItem} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Part Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Brake Lever Left Side"
                  value={newPartName}
                  onChange={(e) => setNewPartName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Category
                </label>
                <select
                  value={newPartCategory}
                  onChange={(e) => setNewPartCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100"
                >
                  <option value="General">General</option>
                  <option value="Lubricant">Lubricant</option>
                  <option value="Electrical">Electrical</option>
                  <option value="Brakes">Brakes</option>
                  <option value="Consumable">Consumable</option>
                  <option value="Cables">Cables</option>
                  <option value="Hardware">Hardware</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Supplier / Distributor (Optional)
                </label>
                <select
                  value={newPartDistributorId}
                  onChange={(e) => setNewPartDistributorId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100"
                >
                  <option value="">Direct / Local Purchase</option>
                  {distributors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.distributor_name} ({d.phone})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Initial Stock
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newPartStock}
                    onChange={(e) => setNewPartStock(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Min Stock Limit
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newPartMinStock}
                    onChange={(e) => setNewPartMinStock(Math.max(1, Number(e.target.value)))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Price (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newPartPrice}
                    onChange={(e) => setNewPartPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-amber-500/50 rounded-xl text-xs font-mono font-bold text-amber-300"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewItemModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold"
                >
                  Save to Inventory
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STAFF UPAD ADVANCE MODAL */}
      {upadStaff && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-sm rounded-2xl shadow-2xl p-6">
            <h3 className="text-base font-bold text-slate-100 mb-1">
              Give Upad Advance
            </h3>
            <p className="text-xs text-slate-400 mb-3">
              Staff: <strong className="text-slate-200">{upadStaff.full_name}</strong> (Salary: ₹{upadStaff.monthly_salary})
            </p>

            <form onSubmit={handleRecordUpad} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Advance Amount (₹)
                </label>
                <input
                  type="number"
                  required
                  min="50"
                  value={upadAmount}
                  onChange={(e) => setUpadAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="e.g. 500"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm font-mono font-bold text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Reason / Description
                </label>
                <input
                  type="text"
                  placeholder="e.g. Festival advance, Emergency"
                  value={upadReason}
                  onChange={(e) => setUpadReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setUpadStaff(null)}
                  className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold"
                >
                  Confirm Upad &amp; Deduct
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PAY SALARY SETTLEMENT MODAL */}
      {paySalaryStaff && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Banknote className="w-5 h-5 text-emerald-400" /> Pay Monthly Salary Settlement
              </h3>
              <button
                type="button"
                onClick={() => setPaySalaryStaff(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Staff: <strong className="text-slate-200">{paySalaryStaff.full_name}</strong> ({paySalaryStaff.designation || paySalaryStaff.role})
            </p>

            <form onSubmit={handleConfirmPaySalary} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Net Salary Payable (₹)
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={paySalaryAmount}
                  onChange={(e) => setPaySalaryAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="e.g. 8500"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-emerald-500/60 rounded-xl text-base font-mono font-bold text-emerald-400 focus:outline-none focus:border-emerald-400"
                />
              </div>

              {/* Source Radio Buttons */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Payment Source (भुगतान का स्रोत):
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label
                    className={`p-3 rounded-xl border cursor-pointer transition flex items-center gap-2 text-xs font-bold ${
                      paySalaryMode === 'cash'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300 ring-1 ring-amber-500/30'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="paySalaryMode"
                      checked={paySalaryMode === 'cash'}
                      onChange={() => setPaySalaryMode('cash')}
                      className="sr-only"
                    />
                    <span>💵 Cash Galla Drawer</span>
                  </label>

                  <label
                    className={`p-3 rounded-xl border cursor-pointer transition flex items-center gap-2 text-xs font-bold ${
                      paySalaryMode === 'upi'
                        ? 'bg-sky-500/20 border-sky-500 text-sky-300 ring-1 ring-sky-500/30'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="paySalaryMode"
                      checked={paySalaryMode === 'upi'}
                      onChange={() => setPaySalaryMode('upi')}
                      className="sr-only"
                    />
                    <span>📱 Online UPI / Bank</span>
                  </label>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  {paySalaryMode === 'cash'
                    ? '• Deducts cash from Workshop Galla Drawer immediately.'
                    : '• Paid via UPI/Bank. Does not affect physical cash drawer tally.'}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Notes / Remark (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Month salary cleared in full"
                  value={paySalaryNotes}
                  onChange={(e) => setPaySalaryNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPaySalaryStaff(null)}
                  className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingSalary}
                  className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-lg shadow-emerald-500/20 transition disabled:opacity-40"
                >
                  {isSavingSalary ? 'Recording...' : 'Confirm & Record Payout'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PLACE ORDER DISTRIBUTOR POPUP MODAL */}
      {showOrderDistributorModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl p-6 text-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">
                    Place Supplier Purchase Order
                  </h3>
                  <p className="text-xs text-slate-400">
                    {selectedCount} item(s) selected • {totalSelectedUnits} total units
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowOrderDistributorModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Selected Items Summary List with - / + & Remove Controls */}
            <div className="mb-4">
              <span className="text-[11px] uppercase font-bold text-slate-400 mb-1.5 block">
                Selected Spare Parts &amp; Quantities (Editable):
              </span>
              <div className="max-h-48 overflow-y-auto space-y-1.5 bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-xs">
                {Object.keys(selectedOrderItems)
                  .filter((id) => selectedOrderItems[id])
                  .map((id) => {
                    const it = inventory.find((item) => item.id === id);
                    const qty = orderQuantities[id] || (it && it.stock_quantity < (it.min_stock_limit ?? 5) ? 10 : 5);
                    return (
                      <div key={id} className="flex items-center justify-between py-1.5 border-b border-slate-900 last:border-0 gap-2">
                        <div className="min-w-0 flex-1">
                          <span className="font-semibold text-slate-200 truncate block">
                            {it?.part_name}
                          </span>
                          <span className="text-[10px] text-slate-400 uppercase bg-slate-900 px-1.5 py-0.2 rounded">
                            {it?.part_category} • Stock: {it?.stock_quantity}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              setOrderQuantities((prev) => ({
                                ...prev,
                                [id]: Math.max(1, (prev[id] || qty) - 1),
                              }))
                            }
                            className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="1"
                            value={qty}
                            onChange={(e) => {
                              const val = Math.max(1, Number(e.target.value));
                              setOrderQuantities((prev) => ({ ...prev, [id]: val }));
                            }}
                            className="w-12 px-1 py-0.5 bg-slate-900 border border-slate-700 rounded text-center font-mono font-bold text-amber-300 text-xs"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setOrderQuantities((prev) => ({
                                ...prev,
                                [id]: (prev[id] || qty) + 1,
                              }))
                            }
                            className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center"
                          >
                            +
                          </button>
                          <span className="text-[11px] text-slate-400 font-mono">pcs</span>
                          <button
                            type="button"
                            onClick={() => handleToggleOrderItem(id, qty)}
                            className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 ml-1"
                            title="Remove from this order"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Step 2: Choose Distributor */}
            <div className="mb-5 space-y-2">
              <span className="text-[11px] uppercase font-bold text-slate-400 block">
                Select Supplier / Distributor:
              </span>

              {distributors.length > 0 && (
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {distributors.map((d) => (
                    <label
                      key={d.id}
                      className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition ${
                        orderDistributorId === d.id
                          ? 'bg-amber-500/15 border-amber-500 text-slate-100'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="radio"
                          name="distributorSelect"
                          checked={orderDistributorId === d.id}
                          onChange={() => {
                            setOrderDistributorId(d.id);
                            setCustomDistName('');
                            setCustomDistPhone('');
                          }}
                          className="text-amber-500 focus:ring-amber-500 bg-slate-900"
                        />
                        <div>
                          <span className="font-bold text-xs block">{d.distributor_name}</span>
                          <span className="text-[10px] text-slate-400">
                            {d.supplied_categories} • WhatsApp: {d.phone}
                          </span>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}

              {/* Or Custom / Direct Phone Input */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-300">
                  <input
                    type="radio"
                    name="distributorSelect"
                    checked={orderDistributorId === ''}
                    onChange={() => setOrderDistributorId('')}
                    className="text-amber-500 focus:ring-amber-500 bg-slate-900"
                  />
                  <span>Other / Custom Distributor Contact</span>
                </label>

                {orderDistributorId === '' && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <input
                      type="text"
                      placeholder="Supplier Name (e.g. Apex Auto)"
                      value={customDistName}
                      onChange={(e) => setCustomDistName(e.target.value)}
                      className="px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                    />
                    <input
                      type="tel"
                      maxLength={10}
                      placeholder="10-digit WhatsApp"
                      value={customDistPhone}
                      onChange={(e) => setCustomDistPhone(e.target.value.replace(/\D/g, ''))}
                      className="px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-slate-100 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Instant Dispatch Options */}
            <div className="pt-3 border-t border-slate-800 space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={isDispatchingOrder}
                  onClick={() => handleDispatchOrder('whatsapp')}
                  className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 active:scale-95 transition"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>💬 Send Typed Order on WhatsApp</span>
                </button>

                <button
                  type="button"
                  disabled={isDispatchingOrder}
                  onClick={() => handleDispatchOrder('pdf')}
                  className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition"
                >
                  <FileDown className="w-3.5 h-3.5 text-amber-400" />
                  <span>📄 Download Order PDF &amp; Open WA</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowOrderDistributorModal(false)}
                className="w-full py-1.5 text-slate-400 hover:text-slate-200 text-xs font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STAFF 360 DOSSIER MODAL */}
      {dossierStaff && (
        <StaffDossierModal
          currentShop={currentShop}
          currentUser={currentUser}
          staff={dossierStaff}
          onClose={() => setDossierStaff(null)}
          onRefresh={loadData}
        />
      )}

      {/* APPOINT NEW STAFF MODAL */}
      <StaffAppointModal
        isOpen={showAppointModal}
        currentShop={currentShop}
        onClose={() => setShowAppointModal(false)}
        onSaved={() => {
          setShowAppointModal(false);
          loadData();
          onRefreshData();
        }}
      />

      {/* RECORD SCRAP / OLD OIL SALE MODAL */}
      {showScrapModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-sm rounded-2xl shadow-2xl p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Banknote className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">
                    Record Scrap / Old Oil Sale
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    Kabad / Used Engine Oil Cash Income
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowScrapModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRecordScrapSale} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Item Description / Particulars
                </label>
                <input
                  type="text"
                  required
                  value={scrapTitle}
                  onChange={(e) => setScrapTitle(e.target.value)}
                  placeholder="e.g. 50L Drum Used Oil / Scrap Iron"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Cash Amount Received (₹) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={scrapAmount}
                  onChange={(e) => setScrapAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="e.g. 1500"
                  className="w-full px-3 py-2 bg-slate-950 border border-emerald-500/80 rounded-xl font-mono font-bold text-emerald-300 text-base focus:outline-none"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Instantly recorded in today's Galla Drawer Cash and factored into Real Net Profit!
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowScrapModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 font-semibold hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRecordingScrap}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold shadow-md shadow-emerald-500/20 disabled:opacity-50"
                >
                  {isRecordingScrap ? 'Adding...' : '+ Add Cash to Galla'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STAFF PIN RESET MODAL */}
      {resetStaffTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-slate-100 text-sm">
                  Reset Staff Security PIN
                </h3>
              </div>
              <button
                onClick={() => setResetStaffTarget(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Set a new 4-digit PIN for <strong>{resetStaffTarget.full_name}</strong> ({resetStaffTarget.phone}).
            </p>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-300">New 4-Digit Security PIN</label>
              <input
                type="password"
                maxLength={4}
                value={newStaffPin}
                onChange={(e) => setNewStaffPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="e.g. 1234"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl font-mono text-center text-xl tracking-widest text-amber-400 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setResetStaffTarget(null)}
                className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={newStaffPin.length !== 4 || isResettingPin}
                onClick={async () => {
                  if (newStaffPin.length !== 4) return;
                  setIsResettingPin(true);
                  const ok = await supabaseService.resetStaffPin(resetStaffTarget.id, newStaffPin);
                  setIsResettingPin(false);
                  if (ok) {
                    notify.success(`Security PIN successfully updated for ${resetStaffTarget.full_name}!`);
                    setResetStaffTarget(null);
                    await loadData();
                    onRefreshData();
                  } else {
                    notify.error('Failed to update PIN. Please try again.');
                  }
                }}
                className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold disabled:opacity-40 transition"
              >
                {isResettingPin ? 'Updating...' : 'Save New PIN'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT STAFF MODAL */}
      {editingStaff && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-slate-100 text-sm">
                  Edit Staff Profile &amp; Compensation
                </h3>
              </div>
              <button
                onClick={() => setEditingStaff(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveStaffEdit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={editStaffName}
                  onChange={(e) => setEditStaffName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Mobile (Login) *</label>
                  <input
                    type="tel"
                    maxLength={10}
                    required
                    value={editStaffPhone}
                    onChange={(e) => setEditStaffPhone(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Workshop Role *</label>
                  <select
                    value={editStaffRole}
                    onChange={(e) => setEditStaffRole(e.target.value as 'mechanic' | 'manager')}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100"
                  >
                    <option value="mechanic">Mechanic</option>
                    <option value="manager">Manager</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Base Monthly Salary (₹) *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={editStaffSalary}
                    onChange={(e) => setEditStaffSalary(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Security PIN (4 Digits) *</label>
                  <input
                    type="password"
                    maxLength={4}
                    required
                    value={editStaffPin}
                    onChange={(e) => setEditStaffPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-amber-400 font-mono font-bold text-center tracking-widest"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingStaffEdit || !editStaffName.trim() || editStaffPhone.length < 10 || editStaffPin.length !== 4}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition disabled:opacity-40"
                >
                  {isSavingStaffEdit ? 'Saving...' : 'Save Staff Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FULL & FINAL SETTLEMENT / DEACTIVATE MODAL */}
      {deactivatingStaff && (() => {
        // Calculate settlement figures
        const attCount = monthlyAttendance
          .filter((a) => a.staff_id === deactivatingStaff.id)
          .reduce((sum, a) => sum + (a.day_credit ?? (a.status === 'present' ? 1.0 : a.status === 'half_day' ? 0.5 : 0)), 0);
        const upadTotal = allStaffPayments
          .filter((p) => p.staff_id === deactivatingStaff.id && p.payment_type === 'upad_advance')
          .reduce((sum, p) => sum + (p.amount || 0), 0);
        const effectiveUpad = Math.max(upadTotal, deactivatingStaff.total_upad_taken || 0);
        const earnedSalary = Math.round(((deactivatingStaff.monthly_salary || 12000) / 30) * attCount);
        const netSettlement = earnedSalary - effectiveUpad;

        return (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <UserX className="w-5 h-5 text-rose-400" />
                  <h3 className="font-bold text-slate-100 text-sm">
                    Full &amp; Final Settlement &amp; Deactivate
                  </h3>
                </div>
                <button
                  onClick={() => setDeactivatingStaff(null)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl space-y-2 text-xs font-mono border border-slate-800">
                <div className="flex justify-between text-slate-300">
                  <span>Staff Name:</span>
                  <strong className="text-white font-sans">{deactivatingStaff.full_name} ({deactivatingStaff.role})</strong>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Base Monthly Salary:</span>
                  <span>₹{deactivatingStaff.monthly_salary}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Current Month Days ({attCount} days):</span>
                  <span className="text-emerald-400">₹{earnedSalary}</span>
                </div>
                <div className="flex justify-between text-rose-400">
                  <span>Total Upad Taken:</span>
                  <span>-₹{effectiveUpad}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-800 font-bold text-sm">
                  <span className={netSettlement >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                    Net F&amp;F Amount ({netSettlement >= 0 ? 'Pay to Staff' : 'Recover from Staff'}):
                  </span>
                  <span className={netSettlement >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                    ₹{Math.abs(netSettlement)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 text-xs font-semibold mb-1">
                  Settlement &amp; Relieving Notes (Reason / Payout Mode)
                </label>
                <textarea
                  rows={2}
                  value={settlementNotes}
                  onChange={(e) => setSettlementNotes(e.target.value)}
                  placeholder="e.g. Cleared all dues in cash. Relieved on good terms."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-xs"
                />
              </div>

              <p className="text-[11px] text-rose-400">
                ⚠️ Once deactivated, this worker's login will be immediately blocked and moved to the Left Job Archive.
              </p>

              <div className="flex gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setDeactivatingStaff(null)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeactivatingStaff}
                  onClick={handleDeactivateStaff}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-md shadow-rose-600/30 disabled:opacity-40"
                >
                  {isDeactivatingStaff ? 'Deactivating...' : 'Confirm F&F & Deactivate'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* SUPER ADMIN: RESET OWNER PIN MODAL */}
      {adminResetShop && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-slate-100 text-sm">
                  Super Admin: Reset Owner PIN
                </h3>
              </div>
              <button
                onClick={() => setAdminResetShop(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Set new 4-digit Owner PIN for <strong>{adminResetShop.shop_name}</strong> ({adminResetShop.owner_name} - {adminResetShop.owner_phone}).
            </p>
            <form onSubmit={handleAdminResetOwnerPin} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">New 4-Digit Owner PIN</label>
                <input
                  type="password"
                  maxLength={4}
                  required
                  value={adminNewPin}
                  onChange={(e) => setAdminNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="e.g. 1234"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl font-mono text-center text-xl tracking-widest text-amber-400 focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAdminResetShop(null)}
                  className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adminNewPin.length !== 4 || isAdminResettingPin}
                  className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold disabled:opacity-40 transition"
                >
                  {isAdminResettingPin ? 'Resetting...' : 'Save Owner PIN'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
