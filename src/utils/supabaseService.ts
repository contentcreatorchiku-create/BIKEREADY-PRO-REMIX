import { supabase } from './supabaseClient';
import jsPDF from 'jspdf';
import {
  Shop,
  User,
  Customer,
  InventoryItem,
  JobCard,
  JobCardItem,
  QuickJob,
  ShopExpense,
  DailyGallaTally,
  TrustTier,
  StaffAttendance,
  Distributor,
  StaffPayment,
  StaffPaymentType,
  UserRole,
  CreditLedgerEntry,
  CreditLedgerTransactionType,
} from '../types/supabase';

// Format CCTV timestamp: DD/MM/YYYY, hh:mm:ss A
export function formatCCTVTimestamp(dateString?: string | null): string {
  if (!dateString) return '—';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return dateString;

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();

  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const formattedHours = String(hours).padStart(2, '0');

  return `${day}/${month}/${year}, ${formattedHours}:${minutes}:${seconds} ${ampm}`;
}

// Format Simple Date: DD/MM/YYYY
export function formatSimpleDate(dateString?: string | null): string {
  if (!dateString) return '—';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return dateString;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

// Calculate Next Service Date (Current + 90 Days)
export function getNextServiceDate(dateString?: string | null): string {
  const d = dateString ? new Date(dateString) : new Date();
  if (isNaN(d.getTime())) return '—';
  d.setDate(d.getDate() + 90);
  return formatSimpleDate(d.toISOString());
}

// Generate UPI QR String with Unique Txn Code, Purpose & Merchant params
export function generateUpiPayload(
  upiId: string,
  payeeName: string,
  amount: number,
  note: string = 'BikeReady Service',
  txnCode?: string
): string {
  const cleanUpi = upiId.trim() || 'bikeready@upi';
  const cleanName = payeeName.trim() || 'BikeReady Auto Center';
  const cleanAmount = Math.max(0, amount).toFixed(2);
  const code = txnCode || `BR-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  return `upi://pay?pa=${encodeURIComponent(cleanUpi)}&pn=${encodeURIComponent(cleanName)}&am=${cleanAmount}&cu=INR&mc=5541&mode=02&purpose=00&tr=${encodeURIComponent(code)}&tn=${encodeURIComponent(`${code}-${note}`)}`;
}

// Permanent Public URL for WhatsApp Sharing & App Access
export const PUBLIC_APP_URL = 'https://kki-54b215.netlify.app';

export function getPublicAppUrl(): string {
  if (typeof window !== 'undefined') {
    const origin = window.location.origin;
    if (
      origin.includes('aistudio.google.com') ||
      origin.includes('localhost') ||
      origin.includes('127.0.0.1') ||
      origin.includes('run.app')
    ) {
      return PUBLIC_APP_URL;
    }
    return origin;
  }
  return PUBLIC_APP_URL;
}

// Clean Indian Mobile Number (+91 format)
export function formatIndianMobile(phone: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length >= 10) {
    return '91' + digits.slice(-10);
  }
  return digits;
}

// Generate Direct SMS Link for Keypad & Non-WhatsApp Mobile Phones
export function generateSmsLink(phone: string, message: string): string {
  const formatted = formatIndianMobile(phone);
  return `sms:+${formatted}?body=${encodeURIComponent(message)}`;
}

// Generate Concise Bilingual (Hindi + English) SMS Text for Direct Mobile Messaging
export function generateSimpleSmsText(
  shop: Shop | null,
  target: any,
  type: 'bill' | 'estimate' | 'reminder'
): string {
  const shopName = shop?.shop_name || 'HK AUTO CENTER';
  const shopPhone = shop?.owner_phone || '';
  const upiId = shop?.upi_id || 'chaitanya180803-1@okaxis';

  if (type === 'bill') {
    const jc: JobCard = target;
    const gross = Number(jc.total_bill || 0);
    const advance = Number(jc.advance_paid || 0);
    const cash = Number(jc.cash_collected ?? jc.mandatory_cash_to_collect ?? 0);
    const upi = Number(jc.upi_collected || 0);
    const paid = advance + cash + upi;
    const khata = Number(jc.transferred_to_khata || Math.max(0, gross - paid));
    const bikeNo = jc.bike_number || '';
    const custName = jc.customer?.customer_name || 'Customer';

    return `${shopName}: Namaste ${custName} ji! Bike ${bikeNo} service complete. Total Bill: Rs.${gross}${advance > 0 ? ` (Adv: -Rs.${advance})` : ''}, Paid: Rs.${paid}, Balance/Khata: Rs.${khata}. Pay via UPI: ${upiId}. Ph: ${shopPhone}`;
  } else if (type === 'estimate') {
    const jc: JobCard = target;
    const est = Number(jc.estimated_cost || jc.total_bill || 0);
    const bikeNo = jc.bike_number || '';
    const custName = jc.customer?.customer_name || 'Customer';

    return `${shopName}: Namaste ${custName} ji! Bike ${bikeNo} service estimate is Rs.${est}. Work in progress. For queries, contact: ${shopPhone}`;
  } else {
    // reminder
    const custName = target.customer_name || target.customer?.customer_name || 'Customer';
    const bikeNo = target.bike_number || '';
    const due = Number(target.current_due !== undefined ? target.current_due : (target.transferred_to_khata || 0));

    return `${shopName}: Namaste ${custName} ji! Pending balance Rs.${due} on bike ${bikeNo}. Please pay via UPI ID: ${upiId}. Thank you! Ph: ${shopPhone}`;
  }
}

// Generate WhatsApp Deep Link
export function generateWhatsAppLink(phone: string, message: string): string {
  const formattedPhone = formatIndianMobile(phone);
  return `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(message)}`;
}

// Generate Complete Professional Itemized WhatsApp Bill & Receipt
export function generateItemizedWhatsAppBill(
  shop: Shop,
  jobCard: JobCard
): string {
  const shopName = shop?.shop_name || 'HK AUTO CENTER';
  const upiId = shop?.upi_id || 'chaitanya180803-1@okaxis';
  const dateStr = formatSimpleDate(jobCard.billed_at || jobCard.created_at);
  const nextService = getNextServiceDate(jobCard.billed_at || jobCard.created_at);
  const custName = jobCard.customer?.customer_name || 'Valued Customer';
  const custPhone = jobCard.customer?.phone || '';
  const vehicleModel = (jobCard as any).vehicle_model || (jobCard as any).bike_model || jobCard.customer?.bike_model || '';

  const items = jobCard.items || [];
  let itemsList = '';
  const partsSum = items.reduce(
    (sum, it) => sum + (Number(it.unit_price) || 0) * (Number(it.quantity) || 1),
    0
  );

  if (items.length > 0) {
    itemsList = items
      .map(
        (it, idx) =>
          `${idx + 1}. ${it.item_name} (x${it.quantity || 1}) - Rs. ${(Number(it.unit_price) || 0) * (Number(it.quantity) || 1)}`
      )
      .join('\n');
  } else {
    itemsList = '1. General Motorcycle Service & Inspection';
  }

  const labour = Math.round((Number(jobCard.labour_charge || 0) + Number.EPSILON) * 100) / 100;
  const outside = Math.round((Number(jobCard.outside_work_customer_price || 0) + Number.EPSILON) * 100) / 100;
  const consumable = Math.round((Number(jobCard.consumable_charge !== undefined && jobCard.consumable_charge !== null ? jobCard.consumable_charge : 20) + Number.EPSILON) * 100) / 100;
  const discount = Math.round((Number(jobCard.extra_discount || 0) + Number.EPSILON) * 100) / 100;

  const subtotal = Math.round((partsSum + labour + outside + consumable + Number.EPSILON) * 100) / 100;
  const grossTotal = Number(jobCard.total_bill) > 0 ? Number(jobCard.total_bill) : Math.max(0, subtotal - discount);
  const advancePaid = Math.round((Number(jobCard.advance_paid || 0) + Number.EPSILON) * 100) / 100;
  const netPayable = Math.max(0, Math.round((grossTotal - advancePaid + Number.EPSILON) * 100) / 100);

  let chargesList = '';
  if (labour > 0) chargesList += `\n- Labour / Tuning Charge: Rs. ${labour}`;
  if (outside > 0) chargesList += `\n- Outside Lathe / Specialized Work (${jobCard.outside_work_desc || 'Machining'}): Rs. ${outside}`;
  chargesList += `\n- Workshop Solvents & Consumables: Rs. ${consumable}`;

  let discountsStr = '';
  if (discount > 0) discountsStr = `\n- Special Customer Discount: -Rs. ${discount}`;

  let cashPaid = Number(jobCard.cash_collected ?? jobCard.mandatory_cash_to_collect ?? 0);
  let upiPaid = Number(jobCard.upi_collected ?? 0);
  const udhaarDue = Number(jobCard.transferred_to_khata || 0);

  const expectedPaidAtDelivery = Math.max(0, netPayable - udhaarDue);
  if (cashPaid + upiPaid === 0 && expectedPaidAtDelivery > 0) {
    if (jobCard.payment_mode === 'upi' || jobCard.upi_ref_number) {
      upiPaid = expectedPaidAtDelivery;
    } else {
      cashPaid = expectedPaidAtDelivery;
    }
  }

  const totalPaidForJob = Math.round((advancePaid + cashPaid + upiPaid + Number.EPSILON) * 100) / 100;
  const utrStr = jobCard.upi_ref_number ? ` (Ref/UTR: ${jobCard.upi_ref_number})` : '';

  let msg = `*${shopName.toUpperCase()}*\n`;
  if (shop?.shop_address) msg += `Address: ${shop.shop_address}\n`;
  if (shop?.owner_phone) msg += `Contact: ${shop.owner_phone}\n`;
  if (shop?.gst_number) msg += `GSTIN: ${shop.gst_number}\n`;
  msg += `--------------------------------\n`;
  msg += `*TAX INVOICE & GATE PASS*\n`;
  msg += `Invoice / Job: *${jobCard.bike_number}* ${vehicleModel ? `(${vehicleModel})` : ''}\n`;
  msg += `Date: *${dateStr}*\n`;
  msg += `Customer: *${custName}* ${custPhone ? `(${custPhone})` : ''}\n`;
  if (jobCard.odometer_km) msg += `Odometer: *${jobCard.odometer_km} KM*\n`;
  msg += `--------------------------------\n`;
  msg += `*Itemized Particulars:*\n${itemsList}${chargesList}${discountsStr}\n`;
  msg += `--------------------------------\n`;
  msg += `Subtotal: Rs. ${subtotal}\n`;
  if (discount > 0) msg += `Discount Applied: -Rs. ${discount}\n`;
  msg += `*GROSS TOTAL BILL: Rs. ${grossTotal}*\n`;
  if (advancePaid > 0) {
    msg += `Advance Paid at Intake: -Rs. ${advancePaid}\n`;
    msg += `*NET PAYABLE AT DELIVERY: Rs. ${netPayable}*\n`;
  }
  msg += `--------------------------------\n`;
  msg += `*Payment Settlement Summary:*\n`;
  if (advancePaid > 0) msg += `• Advance Paid at Intake: Rs. ${advancePaid}\n`;
  if (cashPaid > 0) msg += `• Cash Paid at Delivery: Rs. ${cashPaid}\n`;
  if (upiPaid > 0) msg += `• UPI Paid at Delivery: Rs. ${upiPaid}${utrStr}\n`;
  if (udhaarDue > 0) msg += `• Current Bill Udhaar (Khata): Rs. ${udhaarDue}\n`;
  msg += `• Total Paid for this Job: Rs. ${totalPaidForJob}\n`;
  if (udhaarDue > 0) {
    msg += `*Outstanding Khata Due: Rs. ${udhaarDue}*\n`;
    msg += `Pay via UPI ID: *${upiId}*\n`;
    msg += `(GPay / PhonePe / Paytm / BHIM to: ${upiId})\n`;
  } else {
    msg += `Payment Status: *FULLY SETTLED (PAID)*\n`;
  }
  msg += `--------------------------------\n`;
  msg += `UPI Payment ID: *${upiId}*\n`;
  msg += `Gate Pass: *VERIFIED & AUTHORIZED FOR EXIT / HANDED OVER*\n`;
  msg += `Next Recommended Service: *${nextService}*\n`;
  msg += `Thank you for trusting ${shopName}! Drive safely.`;

  return msg;
}

// ==========================================
// TRUE OFFLINE-FIRST ENGINE & SYNC QUEUE
// ==========================================
export interface OfflineQueueItem {
  id: string;
  timestamp: number;
  table: string;
  action: 'insert' | 'update' | 'delete';
  payload: any;
  recordId?: string;
  shopId?: string;
}

export const offlineStorage = {
  getCache<T>(key: string, fallback: T): T {
    try {
      if (typeof window === 'undefined') return fallback;
      const data = localStorage.getItem(`br_offline_${key}`);
      return data ? JSON.parse(data) : fallback;
    } catch {
      return fallback;
    }
  },
  setCache(key: string, data: any): void {
    try {
      if (typeof window === 'undefined') return;
      localStorage.setItem(`br_offline_${key}`, JSON.stringify(data));
    } catch (e) {
      console.warn('Offline cache set failed:', e);
    }
  },
  getQueue(): OfflineQueueItem[] {
    try {
      if (typeof window === 'undefined') return [];
      const q = localStorage.getItem('br_sync_queue');
      return q ? JSON.parse(q) : [];
    } catch {
      return [];
    }
  },
  enqueue(item: Omit<OfflineQueueItem, 'id' | 'timestamp'>): void {
    try {
      if (typeof window === 'undefined') return;
      const q = this.getQueue();
      const newItem: OfflineQueueItem = {
        ...item,
        id: `sync_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        timestamp: Date.now(),
      };
      q.push(newItem);
      localStorage.setItem('br_sync_queue', JSON.stringify(q));
      window.dispatchEvent(new CustomEvent('br_queue_updated', { detail: { count: q.length } }));
    } catch (e) {
      console.warn('Offline enqueue failed:', e);
    }
  },
  removeQueueItem(id: string): void {
    try {
      if (typeof window === 'undefined') return;
      const q = this.getQueue().filter((item) => item.id !== id);
      localStorage.setItem('br_sync_queue', JSON.stringify(q));
      window.dispatchEvent(new CustomEvent('br_queue_updated', { detail: { count: q.length } }));
    } catch (e) {
      console.warn('Offline queue remove failed:', e);
    }
  },
  getQueueCount(): number {
    return this.getQueue().length;
  },
};

export async function flushSyncQueue(): Promise<{ synced: number; remaining: number }> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { synced: 0, remaining: offlineStorage.getQueueCount() };
  }
  const queue = offlineStorage.getQueue();
  if (queue.length === 0) {
    return { synced: 0, remaining: 0 };
  }
  let synced = 0;
  for (const item of queue) {
    try {
      if (item.action === 'insert') {
        const { error } = await supabase.from(item.table).insert(item.payload);
        if (!error) {
          offlineStorage.removeQueueItem(item.id);
          synced++;
        }
      } else if (item.action === 'update' && item.recordId) {
        const { error } = await supabase.from(item.table).update(item.payload).eq('id', item.recordId);
        if (!error) {
          offlineStorage.removeQueueItem(item.id);
          synced++;
        }
      } else if (item.action === 'delete' && item.recordId) {
        const { error } = await supabase.from(item.table).delete().eq('id', item.recordId);
        if (!error) {
          offlineStorage.removeQueueItem(item.id);
          synced++;
        }
      }
    } catch (err) {
      console.warn('Sync queue flush error for item:', item.id, err);
    }
  }
  return { synced, remaining: offlineStorage.getQueueCount() };
}

export const supabaseService = {
  // ========================
  // SHOPS & AUTHENTICATION
  // ========================
  async getShops(): Promise<Shop[]> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return offlineStorage.getCache<Shop[]>('shops', []);
    }
    try {
      const { data, error } = await supabase
        .from('shops')
        .select('*')
        .order('created_at', { ascending: false });
      if (error || !data) {
        return offlineStorage.getCache<Shop[]>('shops', []);
      }
      offlineStorage.setCache('shops', data);
      return data;
    } catch {
      return offlineStorage.getCache<Shop[]>('shops', []);
    }
  },

  async getShopById(shopId: string): Promise<Shop | null> {
    const { data, error } = await supabase
      .from('shops')
      .select('*')
      .eq('id', shopId)
      .single();
    if (error) {
      console.error('Error fetching shop:', error);
      return null;
    }
    return data;
  },

  async registerShop(
    shopName: string,
    ownerName: string,
    ownerPhone: string,
    upiId: string = 'bikeready@upi',
    pinCode: string = '1234',
    masterActivationKey: string = 'BIKEREADY2026',
    shopAddress?: string,
    gstNumber?: string,
    invoiceTerms?: string
  ): Promise<{ shop: Shop; user: User } | null> {
    try {
      // Commercial SaaS License Guard
      if (masterActivationKey.trim().toUpperCase() !== 'BIKEREADY2026') {
        throw new Error('Invalid Master Activation Key. Please contact BikeReady Software Seller.');
      }

      // 1. Insert shop
      const { data: shopData, error: shopErr } = await supabase
        .from('shops')
        .insert({
          shop_name: shopName.trim(),
          owner_name: ownerName.trim(),
          owner_phone: ownerPhone.trim(),
          upi_id: upiId.trim() || 'bikeready@upi',
          shop_address: shopAddress?.trim() || null,
          gst_number: gstNumber?.trim() || null,
          invoice_terms: invoiceTerms?.trim() || null,
          license_status: 'active',
        })
        .select()
        .single();

      if (shopErr || !shopData) {
        throw new Error(shopErr?.message || 'Failed to create shop');
      }

      // 2. Insert owner user
      const { data: userData, error: userErr } = await supabase
        .from('users')
        .insert({
          shop_id: shopData.id,
          full_name: ownerName.trim(),
          phone: ownerPhone.trim(),
          pin_code: pinCode.trim() || '1234',
          role: 'owner',
          is_temp_manager: false,
          daily_wallet_limit: 10000,
          daily_wallet_used: 0,
          monthly_salary: 30000,
          total_upad_taken: 0,
          absent_days: 0,
        })
        .select()
        .single();

      if (userErr || !userData) {
        throw new Error(userErr?.message || 'Failed to create owner user');
      }

      // 3. Seed initial inventory for this shop
      const initialParts = [
        { part_name: '4T 10W-30 Premium Engine Oil (900ml)', part_category: 'Lubricant', stock_quantity: 24, unit_price: 360, cost_price: 260, min_stock_limit: 5 },
        { part_name: 'Spark Plug NGK Standard', part_category: 'Electrical', stock_quantity: 18, unit_price: 120, cost_price: 75, min_stock_limit: 4 },
        { part_name: 'Front Brake Shoe Set', part_category: 'Brakes', stock_quantity: 12, unit_price: 240, cost_price: 150, min_stock_limit: 3 },
        { part_name: 'Rear Brake Shoe Set', part_category: 'Brakes', stock_quantity: 14, unit_price: 250, cost_price: 160, min_stock_limit: 3 },
        { part_name: 'Drive Chain Lube Spray (150ml)', part_category: 'Consumable', stock_quantity: 20, unit_price: 180, cost_price: 110, min_stock_limit: 5 },
        { part_name: 'Air Filter Foam Element', part_category: 'Filters', stock_quantity: 15, unit_price: 160, cost_price: 90, min_stock_limit: 4 },
        { part_name: 'Heavy Duty 8mm Flange Bolt', part_category: 'Hardware', stock_quantity: 100, unit_price: 5, cost_price: 2, min_stock_limit: 20 },
        { part_name: 'Copper Drain Plug Washer', part_category: 'Hardware', stock_quantity: 120, unit_price: 10, cost_price: 3, min_stock_limit: 25 },
        { part_name: 'Clutch Cable Assembly', part_category: 'Cables', stock_quantity: 8, unit_price: 190, cost_price: 115, min_stock_limit: 3 },
        { part_name: 'Throttle Cable Assembly', part_category: 'Cables', stock_quantity: 7, unit_price: 180, cost_price: 110, min_stock_limit: 3 },
        { part_name: 'LED Headlamp Bulb (12V 35W)', part_category: 'Electrical', stock_quantity: 6, unit_price: 320, cost_price: 190, min_stock_limit: 2 },
        { part_name: 'Disc Brake Fluid Dot 4 (100ml)', part_category: 'Brakes', stock_quantity: 15, unit_price: 90, cost_price: 55, min_stock_limit: 4 },
      ];

      await supabase.from('inventory').insert(
        initialParts.map((p) => ({
          ...p,
          shop_id: shopData.id,
        }))
      );

      return { shop: shopData, user: userData };
    } catch (err: any) {
      console.error('Registration failed:', err);
      throw err;
    }
  },

  async getUsersByShop(shopId: string): Promise<User[]> {
    const cacheKey = `users_${shopId}`;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return offlineStorage.getCache<User[]>(cacheKey, []);
    }
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('shop_id', shopId)
        .order('role', { ascending: true });
      if (error || !data) {
        return offlineStorage.getCache<User[]>(cacheKey, []);
      }
      offlineStorage.setCache(cacheKey, data);
      return data;
    } catch {
      return offlineStorage.getCache<User[]>(cacheKey, []);
    }
  },

  async loginWithPhonePin(
    phone: string,
    pin: string,
    shopId?: string
  ): Promise<{ user: User; shop: Shop } | null> {
    try {
      const cleanPhone = phone.trim();
      const cleanPin = pin.trim();

      // Special Software Seller / Super Admin Login bypass
      if (cleanPhone === '9999999999' && cleanPin === '9999') {
        const { data: shops } = await supabase
          .from('shops')
          .select('*')
          .order('created_at', { ascending: false });

        const targetShop = (shopId ? shops?.find((s) => s.id === shopId) : null) || shops?.[0];
        if (!targetShop) return null;

        const superAdminUser: User = {
          id: 'super-admin-master',
          shop_id: targetShop.id,
          full_name: '👑 Software Seller (Super Admin)',
          phone: '9999999999',
          pin_code: '9999',
          role: 'owner',
          is_temp_manager: false,
          temp_manager_expires_at: null,
          daily_wallet_limit: 100000,
          daily_wallet_used: 0,
          monthly_salary: 0,
          total_upad_taken: 0,
          absent_days: 0,
          created_at: new Date().toISOString(),
        };
        return { user: superAdminUser, shop: targetShop };
      }

      let query = supabase.from('users').select('*').eq('phone', cleanPhone);
      if (shopId) {
        query = query.eq('shop_id', shopId);
      }
      const { data: users, error } = await query;
      if (error || !users || users.length === 0) return null;

      const user = users.find((u) => u.pin_code === cleanPin) || users[0];
      if (user.pin_code !== cleanPin) return null;

      // Block deactivated staff / ex-workers
      if (user.is_active === false) {
        throw new Error('STAFF_DEACTIVATED');
      }

      const shop = await this.getShopById(user.shop_id);
      if (!shop) return null;

      return { user, shop };
    } catch (err: any) {
      if (err?.message === 'STAFF_DEACTIVATED') {
        throw err;
      }
      console.error('Login error:', err);
      return null;
    }
  },

  // Toggle 4-Hour Temporary Manager Status for Mechanic
  async toggleTempManager(
    userId: string,
    enable: boolean
  ): Promise<boolean> {
    try {
      const expiresAt = enable
        ? new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString()
        : null;

      const { error } = await supabase
        .from('users')
        .update({
          is_temp_manager: enable,
          temp_manager_expires_at: expiresAt,
        })
        .eq('id', userId);

      return !error;
    } catch (err) {
      console.error('Toggle temp manager error:', err);
      return false;
    }
  },

  // Check if user has active manager powers (either role === 'manager', 'owner', or active temp manager)
  isManagerActive(user: User): boolean {
    if (user.role === 'owner' || user.role === 'manager') return true;
    if (user.is_temp_manager && user.temp_manager_expires_at) {
      return new Date(user.temp_manager_expires_at).getTime() > Date.now();
    }
    return false;
  },

  // ========================
  // DEMO DATA SEEDING (Duplicate-Safe)
  // ========================
  async seedCleanDemoData(shopId: string): Promise<boolean> {
    try {
      // 1. Fetch current users for this shop
      const existingUsers = await this.getUsersByShop(shopId);

      // Clean existing demo job cards & quick jobs & expenses to prevent duplicates
      await supabase.from('job_card_items').delete().eq('shop_id', shopId);
      await supabase.from('job_cards').delete().eq('shop_id', shopId);
      await supabase.from('quick_jobs').delete().eq('shop_id', shopId);
      await supabase.from('shop_expenses').delete().eq('shop_id', shopId);
      await supabase.from('customers').delete().eq('shop_id', shopId);

      // Ensure Manager and Mechanics exist
      let manager = existingUsers.find((u) => u.role === 'manager');
      if (!manager) {
        const { data: newMgr } = await supabase
          .from('users')
          .insert({
            shop_id: shopId,
            full_name: 'Sunil Verma (Manager)',
            phone: '9800000002',
            pin_code: '1234',
            role: 'manager',
            is_temp_manager: false,
            daily_wallet_limit: 2000,
            daily_wallet_used: 350,
            monthly_salary: 18000,
            total_upad_taken: 2000,
            absent_days: 1,
          })
          .select()
          .single();
        manager = newMgr || undefined;
      }

      let mechanic1 = existingUsers.find((u) => u.phone === '9800000003');
      if (!mechanic1) {
        const { data: newMech1 } = await supabase
          .from('users')
          .insert({
            shop_id: shopId,
            full_name: 'Raju Mechanic (Senior)',
            phone: '9800000003',
            pin_code: '1234',
            role: 'mechanic',
            is_temp_manager: false,
            daily_wallet_limit: 1000,
            daily_wallet_used: 0,
            monthly_salary: 14000,
            total_upad_taken: 1500,
            absent_days: 0,
          })
          .select()
          .single();
        mechanic1 = newMech1 || undefined;
      }

      let mechanic2 = existingUsers.find((u) => u.phone === '9800000004');
      if (!mechanic2) {
        const { data: newMech2 } = await supabase
          .from('users')
          .insert({
            shop_id: shopId,
            full_name: 'Amit Mechanic (Junior)',
            phone: '9800000004',
            pin_code: '1234',
            role: 'mechanic',
            is_temp_manager: false,
            daily_wallet_limit: 1000,
            daily_wallet_used: 0,
            monthly_salary: 11000,
            total_upad_taken: 500,
            absent_days: 2,
          })
          .select()
          .single();
        mechanic2 = newMech2 || undefined;
      }

      // Seed Clean Customers with Trust Tiers & Credit Limits
      const customersSeed = [
        {
          shop_id: shopId,
          customer_name: 'Vikas Sharma',
          phone: '9811122233',
          bike_number: 'MH 02 CB 1234',
          trust_tier: 'trusted' as TrustTier,
          credit_limit: 3000,
          absolute_max_limit: 5000,
          current_due: 850,
        },
        {
          shop_id: shopId,
          customer_name: 'Pooja Patel',
          phone: '9822233344',
          bike_number: 'MH 04 AT 5678',
          trust_tier: 'regular' as TrustTier,
          credit_limit: 1500,
          absolute_max_limit: 3000,
          current_due: 0,
        },
        {
          shop_id: shopId,
          customer_name: 'Rohan Deshmukh',
          phone: '9833344455',
          bike_number: 'MH 12 EF 9012',
          trust_tier: 'new' as TrustTier,
          credit_limit: 0,
          absolute_max_limit: 1000,
          current_due: 0,
        },
        {
          shop_id: shopId,
          customer_name: 'Kailash Mehra',
          phone: '9844455566',
          bike_number: 'MH 01 KL 4321',
          trust_tier: 'blocked' as TrustTier,
          credit_limit: 0,
          absolute_max_limit: 0,
          current_due: 4200,
        },
      ];

      const { data: createdCusts } = await supabase
        .from('customers')
        .insert(customersSeed)
        .select();

      const cust1 = createdCusts?.[0];
      const cust2 = createdCusts?.[1];

      // Seed Quick Jobs (including modified rate for anti-misuse demonstration)
      const quickJobsSeed = [
        {
          shop_id: shopId,
          worker_id: mechanic1?.id || 'demo-mech',
          worker_name: mechanic1?.full_name || 'Raju Mechanic',
          service_name: 'Air Check (Both Tyres)',
          default_price: 10,
          final_price: 10,
          is_price_modified: false,
          payment_mode: 'cash',
        },
        {
          shop_id: shopId,
          worker_id: mechanic2?.id || 'demo-mech-2',
          worker_name: mechanic2?.full_name || 'Amit Mechanic',
          service_name: 'Chain Tight & Lube',
          default_price: 30,
          final_price: 40, // Modified!
          is_price_modified: true,
          payment_mode: 'cash',
        },
        {
          shop_id: shopId,
          worker_id: mechanic1?.id || 'demo-mech',
          worker_name: mechanic1?.full_name || 'Raju Mechanic',
          service_name: 'Tubeless Puncture Repair',
          default_price: 50,
          final_price: 50,
          payment_mode: 'upi',
        },
        {
          shop_id: shopId,
          worker_id: manager?.id || 'demo-mgr',
          worker_name: manager?.full_name || 'Sunil Verma',
          service_name: 'Foam Bike Wash',
          default_price: 100,
          final_price: 100,
          payment_mode: 'upi',
        },
      ];
      await supabase.from('quick_jobs').insert(quickJobsSeed);

      // Seed Shop Expenses & Staff Upad
      const expensesSeed = [
        {
          shop_id: shopId,
          expense_type: 'shop_expense',
          title: 'Shop Tea & Biscuits for Customers',
          amount: 140,
          recorded_by: manager?.full_name || 'Sunil Verma',
        },
        {
          shop_id: shopId,
          expense_type: 'shop_expense',
          title: 'Kerosene & Cleaning Cloths',
          amount: 210,
          recorded_by: manager?.full_name || 'Sunil Verma',
        },
        {
          shop_id: shopId,
          expense_type: 'staff_upad',
          staff_id: mechanic1?.id || null,
          staff_name: mechanic1?.full_name || 'Raju Mechanic',
          title: 'Daily Upad Advance for Medicine',
          amount: 500,
          recorded_by: manager?.full_name || 'Sunil Verma',
        },
      ];
      await supabase.from('shop_expenses').insert(expensesSeed);

      // Seed 2 realistic Job Cards
      if (cust1) {
        // Card 1: Completed & Billed
        const now = new Date();
        const billedTime = new Date(now.getTime() - 2 * 3600 * 1000).toISOString();
        const { data: jc1 } = await supabase
          .from('job_cards')
          .insert({
            shop_id: shopId,
            customer_id: cust1.id,
            mechanic_id: mechanic1?.id || null,
            bike_number: cust1.bike_number,
            odometer_km: 18450,
            status: 'completed',
            is_locked_for_mechanic: true,
            labour_charge: 350,
            consumable_charge: 20,
            outside_work_desc: 'Lathe Hub Boring',
            outside_work_shop_cost: 150,
            outside_work_customer_price: 250,
            extra_discount: 0,
            total_bill: 1100,
            mandatory_cash_to_collect: 250,
            transferred_to_khata: 850,
            created_at: new Date(now.getTime() - 5 * 3600 * 1000).toISOString(),
            submitted_at: new Date(now.getTime() - 3 * 3600 * 1000).toISOString(),
            billed_at: billedTime,
          })
          .select()
          .single();

        if (jc1) {
          await supabase.from('job_card_items').insert([
            {
              shop_id: shopId,
              job_card_id: jc1.id,
              item_name: '4T 10W-30 Premium Engine Oil (900ml)',
              is_unlisted_manual: false,
              quantity: 1,
              unit_price: 360,
              added_by_name: mechanic1?.full_name || 'Raju Mechanic',
              warranty_months: 0,
            },
            {
              shop_id: shopId,
              job_card_id: jc1.id,
              item_name: 'Front Brake Shoe Set',
              is_unlisted_manual: false,
              quantity: 1,
              unit_price: 240,
              added_by_name: mechanic1?.full_name || 'Raju Mechanic',
              warranty_months: 6,
            },
            {
              shop_id: shopId,
              job_card_id: jc1.id,
              item_name: 'Heavy Duty 8mm Flange Bolt',
              is_unlisted_manual: false,
              quantity: 2,
              unit_price: 5,
              added_by_name: mechanic1?.full_name || 'Raju Mechanic',
              warranty_months: 0,
            },
          ]);
        }
      }

      if (cust2) {
        // Card 2: Submitted (Waiting for Manager billing)
        const now = new Date();
        const { data: jc2 } = await supabase
          .from('job_cards')
          .insert({
            shop_id: shopId,
            customer_id: cust2.id,
            mechanic_id: mechanic2?.id || null,
            bike_number: cust2.bike_number,
            odometer_km: 9230,
            status: 'submitted',
            is_locked_for_mechanic: true,
            labour_charge: 250,
            consumable_charge: 20,
            outside_work_desc: null,
            outside_work_shop_cost: 0,
            outside_work_customer_price: 0,
            extra_discount: 0,
            total_bill: 670,
            mandatory_cash_to_collect: 670,
            transferred_to_khata: 0,
            created_at: new Date(now.getTime() - 2 * 3600 * 1000).toISOString(),
            submitted_at: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
          })
          .select()
          .single();

        if (jc2) {
          await supabase.from('job_card_items').insert([
            {
              shop_id: shopId,
              job_card_id: jc2.id,
              item_name: 'Spark Plug NGK Standard',
              is_unlisted_manual: false,
              quantity: 1,
              unit_price: 120,
              added_by_name: mechanic2?.full_name || 'Amit Mechanic',
              warranty_months: 12,
            },
            {
              shop_id: shopId,
              job_card_id: jc2.id,
              item_name: 'Drive Chain Lube Spray (150ml)',
              is_unlisted_manual: false,
              quantity: 1,
              unit_price: 180,
              added_by_name: mechanic2?.full_name || 'Amit Mechanic',
              warranty_months: 0,
            },
            {
              shop_id: shopId,
              job_card_id: jc2.id,
              item_name: 'Custom Rubber Damper Pad',
              is_unlisted_manual: true,
              quantity: 1,
              unit_price: 100,
              added_by_name: mechanic2?.full_name || 'Amit Mechanic',
              warranty_months: 0,
            },
          ]);
        }
      }

      return true;
    } catch (err) {
      console.error('Seed demo error:', err);
      return false;
    }
  },

  // ========================
  // INVENTORY (Paginated: 20/page)
  // ========================
  async getInventory(
    shopId: string,
    page: number = 1,
    pageSize: number = 20,
    search: string = '',
    category: string = ''
  ): Promise<{ items: InventoryItem[]; totalCount: number }> {
    const cacheKey = `inventory_${shopId}`;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const allCached = offlineStorage.getCache<InventoryItem[]>(cacheKey, []);
      let filtered = allCached;
      if (category && category !== 'All') {
        filtered = filtered.filter((i) => i.part_category === category);
      }
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        filtered = filtered.filter((i) => i.part_name.toLowerCase().includes(q));
      }
      const from = (page - 1) * pageSize;
      return {
        items: filtered.slice(from, from + pageSize),
        totalCount: filtered.length,
      };
    }

    try {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('inventory')
        .select('*', { count: 'exact' })
        .eq('shop_id', shopId)
        .order('part_name', { ascending: true });

      if (category && category !== 'All') {
        query = query.eq('part_category', category);
      }

      if (search.trim()) {
        query = query.ilike('part_name', `%${search.trim()}%`);
      }

      const { data, count, error } = await query.range(from, to);
      if (error || !data) throw error;

      if (!search.trim() && (!category || category === 'All') && page === 1) {
        offlineStorage.setCache(cacheKey, data);
      }

      return {
        items: data || [],
        totalCount: count || 0,
      };
    } catch (err) {
      console.error('Inventory fetch error, falling back to cache:', err);
      const allCached = offlineStorage.getCache<InventoryItem[]>(cacheKey, []);
      let filtered = allCached;
      if (category && category !== 'All') {
        filtered = filtered.filter((i) => i.part_category === category);
      }
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        filtered = filtered.filter((i) => i.part_name.toLowerCase().includes(q));
      }
      const from = (page - 1) * pageSize;
      return { items: filtered.slice(from, from + pageSize), totalCount: filtered.length };
    }
  },

  async updateInventoryStock(
    itemId: string,
    newQuantity: number
  ): Promise<boolean> {
    const { error } = await supabase
      .from('inventory')
      .update({
        stock_quantity: Math.max(0, newQuantity),
        updated_at: new Date().toISOString(),
      })
      .eq('id', itemId);
    return !error;
  },

  async saveInventoryItem(
    item: Partial<InventoryItem> & { shop_id: string }
  ): Promise<InventoryItem | null> {
    if (item.id) {
      const { data, error } = await supabase
        .from('inventory')
        .update({
          part_name: item.part_name,
          part_category: item.part_category,
          stock_quantity: item.stock_quantity,
          unit_price: item.unit_price,
          cost_price: item.cost_price !== undefined ? item.cost_price : null,
          min_stock_limit: item.min_stock_limit ?? 5,
          distributor_id: item.distributor_id ?? null,
          distributor_name: item.distributor_name ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id)
        .select()
        .single();
      if (error) {
        console.error('Update inventory error:', error);
        return null;
      }
      return data;
    } else {
      const { data, error } = await supabase
        .from('inventory')
        .insert({
          shop_id: item.shop_id,
          part_name: item.part_name,
          part_category: item.part_category,
          stock_quantity: item.stock_quantity || 0,
          unit_price: item.unit_price || 0,
          cost_price: item.cost_price !== undefined ? item.cost_price : null,
          min_stock_limit: item.min_stock_limit ?? 5,
          distributor_id: item.distributor_id ?? null,
          distributor_name: item.distributor_name ?? null,
        })
        .select()
        .single();
      if (error) {
        console.error('Insert inventory error:', error);
        return null;
      }
      return data;
    }
  },

  async createInventoryItem(
    item: Partial<InventoryItem> & { shop_id: string }
  ): Promise<InventoryItem | null> {
    return this.saveInventoryItem(item);
  },

  async markInventoryItemsOrdered(
    shopId: string,
    orders: { itemId: string; qty: number; distributorId?: string | null; distributorName: string }[]
  ): Promise<boolean> {
    try {
      const now = new Date().toISOString();
      for (const ord of orders) {
        await supabase
          .from('inventory')
          .update({
            is_ordered: true,
            ordered_qty: ord.qty,
            ordered_distributor_name: ord.distributorName,
            ordered_at: now,
            updated_at: now,
          })
          .eq('id', ord.itemId);
      }
      return true;
    } catch (err) {
      console.error('markInventoryItemsOrdered error:', err);
      return false;
    }
  },

  async receiveOrderedStock(
    itemId: string,
    orderedQty: number
  ): Promise<boolean> {
    try {
      const { data: item } = await supabase
        .from('inventory')
        .select('stock_quantity')
        .eq('id', itemId)
        .single();

      const currentStock = item?.stock_quantity || 0;
      const newStock = currentStock + (orderedQty > 0 ? orderedQty : 0);

      const { error } = await supabase
        .from('inventory')
        .update({
          stock_quantity: newStock,
          is_ordered: false,
          ordered_qty: 0,
          ordered_distributor_name: null,
          ordered_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', itemId);

      return !error;
    } catch (err) {
      console.error('receiveOrderedStock error:', err);
      return false;
    }
  },

  async cancelOrderedItem(itemId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('inventory')
        .update({
          is_ordered: false,
          ordered_qty: 0,
          ordered_distributor_name: null,
          ordered_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', itemId);

      return !error;
    } catch (err) {
      console.error('cancelOrderedItem error:', err);
      return false;
    }
  },

  // ========================
  // CUSTOMERS & SERVICE HISTORY
  // ========================
  async reconcileShopCustomerBalances(shopId: string): Promise<Customer[]> {
    const cacheKey = `customers_${shopId}`;
    try {
      const [custRes, cardsRes, ledgerRes] = await Promise.all([
        supabase
          .from('customers')
          .select('*')
          .eq('shop_id', shopId)
          .order('customer_name', { ascending: true }),
        supabase
          .from('job_cards')
          .select('id, shop_id, customer_id, customer_phone, bike_number, status, total_bill, advance_paid, cash_collected, mandatory_cash_to_collect, upi_collected, transferred_to_khata, billed_at, created_at')
          .eq('shop_id', shopId)
          .eq('status', 'completed'),
        supabase
          .from('credit_ledger')
          .select('*')
          .eq('shop_id', shopId),
      ]);

      const customers: Customer[] = custRes.data || [];
      const completedCards: any[] = cardsRes.data || [];
      const allLedger: CreditLedgerEntry[] = ledgerRes.data || [];

      const clean = (str: string = '') => str.replace(/[^A-Z0-9]/gi, '').toUpperCase();
      const cleanPhone = (p: string = '') => p.replace(/\D/g, '').slice(-10);

      for (const cust of customers) {
        const custCleanBike = clean(cust.bike_number);
        const custPhone10 = cleanPhone(cust.phone);
        const custAltPhone10 = cleanPhone(cust.alt_phone || '');

        // 3-way match: customer_id OR normalized 10-digit phone OR bike_number
        const custCards = completedCards.filter((jc: any) => {
          if (jc.customer_id === cust.id) return true;
          const jcPhone10 = cleanPhone(jc.customer_phone || '');
          if (custPhone10 && jcPhone10 && (jcPhone10 === custPhone10 || jcPhone10 === custAltPhone10)) {
            if (!jc.customer_id) {
              jc.customer_id = cust.id;
              supabase.from('job_cards').update({ customer_id: cust.id }).eq('id', jc.id).then(() => {});
            }
            return true;
          }
          if (custCleanBike && clean(jc.bike_number) === custCleanBike) {
            if (!jc.customer_id) {
              jc.customer_id = cust.id;
              supabase.from('job_cards').update({ customer_id: cust.id }).eq('id', jc.id).then(() => {});
            }
            return true;
          }
          return false;
        });

        const totalGrossBilled = custCards.reduce((sum: number, jc: any) => sum + (Number(jc.total_bill) || 0), 0);
        const totalAdvancePaid = custCards.reduce((sum: number, jc: any) => sum + (Number(jc.advance_paid) || 0), 0);

        // Accurate delivery payments
        let totalDeliveryCash = 0;
        let totalDeliveryUpi = 0;
        custCards.forEach((jc: any) => {
          const gross = Number(jc.total_bill || 0);
          const adv = Number(jc.advance_paid || 0);
          const net = Math.max(0, gross - adv);
          const khata = Number(jc.transferred_to_khata || 0);
          let cash = Number(jc.cash_collected ?? jc.mandatory_cash_to_collect ?? 0);
          let upi = Number(jc.upi_collected || 0);
          const expectedDeliv = Math.max(0, net - khata);
          if (cash + upi === 0 && expectedDeliv > 0) {
            cash = expectedDeliv;
          }
          totalDeliveryCash += cash;
          totalDeliveryUpi += upi;
        });

        const totalUdhaarFromCards = custCards.reduce((sum: number, jc: any) => sum + (Number(jc.transferred_to_khata) || 0), 0);

        const custLedger = allLedger.filter((l: any) => l.customer_id === cust.id);
        const totalUdhaarFromLedger = custLedger
          .filter((l: any) => l.transaction_type === 'udhaar_incurred' && !l.job_card_id)
          .reduce((sum: number, l: any) => sum + (Number(l.amount) || 0), 0);

        const totalUdhaarIncurred = totalUdhaarFromCards + totalUdhaarFromLedger;

        const totalUdhaarSettled = custLedger
          .filter((l: any) => l.transaction_type === 'udhaar_cleared')
          .reduce((sum: number, l: any) => sum + (Number(l.amount) || 0), 0);

        const accurateCurrentDue = Math.max(
          0,
          Math.round(((totalUdhaarIncurred - totalUdhaarSettled) + Number.EPSILON) * 100) / 100
        );

        if (Number(cust.current_due || 0) !== accurateCurrentDue) {
          cust.current_due = accurateCurrentDue;
          supabase
            .from('customers')
            .update({ current_due: accurateCurrentDue })
            .eq('id', cust.id)
            .then(() => {});
        }
      }

      offlineStorage.setCache(cacheKey, customers);
      return customers;
    } catch (err) {
      console.error('reconcileShopCustomerBalances error:', err);
      return offlineStorage.getCache<Customer[]>(cacheKey, []);
    }
  },

  async getCustomers(shopId: string, search: string = ''): Promise<Customer[]> {
    const cacheKey = `customers_${shopId}`;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const allCached = offlineStorage.getCache<Customer[]>(cacheKey, []);
      if (!search.trim()) return allCached;
      const q = search.trim().toLowerCase();
      return allCached.filter(
        (c) =>
          c.customer_name.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q) ||
          c.bike_number.toLowerCase().includes(q)
      );
    }

    try {
      const reconciled = await this.reconcileShopCustomerBalances(shopId);
      if (!search.trim()) return reconciled;

      const q = search.trim().toLowerCase();
      return reconciled.filter(
        (c) =>
          c.customer_name.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q) ||
          c.bike_number.toLowerCase().includes(q)
      );
    } catch {
      return offlineStorage.getCache<Customer[]>(cacheKey, []);
    }
  },

  async getCustomerByPhoneOrBike(
    shopId: string,
    phoneOrBike: string
  ): Promise<Customer | null> {
    const trimmed = phoneOrBike.trim();
    if (!trimmed) return null;

    const digitsOnly = trimmed.replace(/\D/g, '');
    const cleanBike = trimmed.replace(/[^A-Z0-9]/gi, '').toUpperCase();

    // If searching by 10-digit phone number
    if (digitsOnly.length === 10) {
      const { data } = await supabase
        .from('customers')
        .select('*')
        .eq('shop_id', shopId)
        .eq('phone', digitsOnly)
        .limit(1);
      return data && data.length > 0 ? data[0] : null;
    }

    // If searching by Bike Registration Number: strictly require cleanBike.length >= 8 and exact match
    if (cleanBike.length >= 8) {
      const { data } = await supabase
        .from('customers')
        .select('*')
        .eq('shop_id', shopId);

      if (data && data.length > 0) {
        const found = data.find((c: Customer) => {
          const custBikeClean = (c.bike_number || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
          return custBikeClean === cleanBike;
        });
        if (found) return found;
      }
    }

    return null;
  },

  async createOrUpdateCustomer(
    shopId: string,
    customerData: Partial<Customer>
  ): Promise<Customer | null> {
    const payload: any = {
      customer_name: customerData.customer_name || 'Walk-in Customer',
      phone: customerData.phone || '',
      bike_number: (customerData.bike_number || '').toUpperCase().trim(),
      trust_tier: customerData.trust_tier || 'new',
      credit_limit: customerData.credit_limit ?? 0,
      absolute_max_limit: customerData.absolute_max_limit ?? 2000,
    };
    if (customerData.alt_phone !== undefined) payload.alt_phone = customerData.alt_phone;
    if (customerData.address !== undefined) payload.address = customerData.address;
    if (customerData.bike_model !== undefined) payload.bike_model = customerData.bike_model;
    if (customerData.notes !== undefined) payload.notes = customerData.notes;
    if (customerData.current_due !== undefined) payload.current_due = customerData.current_due;

    if (customerData.id) {
      const { data, error } = await supabase
        .from('customers')
        .update(payload)
        .eq('id', customerData.id)
        .select()
        .single();
      if (error) {
        console.warn('Update customer primary payload failed, retrying core columns:', error.message);
        const corePayload = {
          customer_name: customerData.customer_name || 'Walk-in Customer',
          phone: customerData.phone || '',
          bike_number: (customerData.bike_number || '').toUpperCase().trim(),
          trust_tier: customerData.trust_tier || 'new',
          credit_limit: customerData.credit_limit ?? 0,
        };
        const fallbackRes = await supabase
          .from('customers')
          .update(corePayload)
          .eq('id', customerData.id)
          .select()
          .single();
        if (fallbackRes.error) {
          console.error('Customer update fallback error:', fallbackRes.error);
          return null;
        }
        return fallbackRes.data;
      }
      return data;
    } else {
      payload.shop_id = shopId;
      if (payload.current_due === undefined) payload.current_due = 0;
      const { data, error } = await supabase
        .from('customers')
        .insert(payload)
        .select()
        .single();
      if (error) {
        console.warn('Create customer primary insert failed, retrying core columns:', error.message);
        const corePayload = {
          shop_id: shopId,
          customer_name: customerData.customer_name || 'Walk-in Customer',
          phone: customerData.phone || '',
          bike_number: (customerData.bike_number || '').toUpperCase().trim(),
          trust_tier: customerData.trust_tier || 'new',
          credit_limit: customerData.credit_limit ?? 0,
          current_due: customerData.current_due ?? 0,
        };
        const fallbackRes = await supabase
          .from('customers')
          .insert(corePayload)
          .select()
          .single();
        if (fallbackRes.error) {
          console.error('Customer creation fallback error:', fallbackRes.error);
          return null;
        }
        return fallbackRes.data;
      }
      return data;
    }
  },

  async getVehiclePastHistory(
    shopId: string,
    bikeNumber: string
  ): Promise<JobCard[]> {
    const cleanInput = bikeNumber.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    if (cleanInput.length < 8) return [];

    const { data, error } = await supabase
      .from('job_cards')
      .select('*, customer:customers(*), items:job_card_items(*)')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('History fetch error:', error);
      return [];
    }

    // Filter strictly by 100% exact match against normalized vehicle number
    return (data || []).filter((jc: JobCard) => {
      const cardBikeClean = (jc.bike_number || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
      return cardBikeClean === cleanInput;
    });
  },

  // ========================
  // JOB CARDS & PREVENTING DUPLICATE PART ROWS
  // ========================
  async getJobCards(
    shopId: string,
    statusFilter?: string
  ): Promise<JobCard[]> {
    const cacheKey = `job_cards_${shopId}`;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const cached = offlineStorage.getCache<JobCard[]>(cacheKey, []);
      if (statusFilter && statusFilter !== 'all') {
        return cached.filter((c) => c.status === statusFilter);
      }
      return cached;
    }

    try {
      let query = supabase
        .from('job_cards')
        .select('*, customer:customers(*), mechanic:users(*), items:job_card_items(*)')
        .eq('shop_id', shopId)
        .order('created_at', { ascending: false });

      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error || !data) {
        console.error('Job cards error, serving offline cache:', error);
        const cached = offlineStorage.getCache<JobCard[]>(cacheKey, []);
        if (statusFilter && statusFilter !== 'all') {
          return cached.filter((c) => c.status === statusFilter);
        }
        return cached;
      }
      if (!statusFilter || statusFilter === 'all') {
        offlineStorage.setCache(cacheKey, data);
      }
      (data || []).forEach((c: any) => {
        c.bike_model = c.bike_model || c.vehicle_model || c.customer?.bike_model || '';
      });
      return data;
    } catch {
      const cached = offlineStorage.getCache<JobCard[]>(cacheKey, []);
      if (statusFilter && statusFilter !== 'all') {
        return cached.filter((c) => c.status === statusFilter);
      }
      return cached;
    }
  },

  async getJobCardById(jobCardId: string): Promise<JobCard | null> {
    const { data, error } = await supabase
      .from('job_cards')
      .select('*, customer:customers(*), mechanic:users(*), items:job_card_items(*)')
      .eq('id', jobCardId)
      .single();

    if (error) {
      console.error('Get job card error:', error);
      return null;
    }
    if (data) {
      (data as any).bike_model = (data as any).bike_model || (data as any).vehicle_model || (data as any).customer?.bike_model || '';
    }
    return data;
  },

  async createDraftJobCard(
    shopId: string,
    mechanicId: string,
    customerName: string,
    customerPhone: string,
    bikeNumber: string,
    odometerKm: number,
    extra?: {
      bikeModel?: string;
      fuelLevel?: string;
      advancePaid?: number;
      estimatedCost?: number;
      customerComplaints?: string;
      mechanicNotes?: string;
      customerAddress?: string;
      isCreatedByMechanic?: boolean;
    }
  ): Promise<JobCard | null> {
    try {
      // 1. Auto-assign mechanic if not specified: pick free on-duty mechanic (or fewest open jobs)
      let targetMechanicId = mechanicId;
      if (!targetMechanicId) {
        try {
          const users = await this.getUsersByShop(shopId);
          const mechanics = users.filter((u) => u.role === 'mechanic' && u.is_active !== false);
          if (mechanics.length > 0) {
            // Find who is on-duty today
            const todayStr = new Date().toISOString().split('T')[0];
            const { data: attendanceData } = await supabase
              .from('staff_attendance')
              .select('*')
              .eq('shop_id', shopId)
              .eq('attendance_date', todayStr);

            const onDutyMechIds = new Set(
              (attendanceData || [])
                .filter((a) => a.status === 'present' && !a.punch_out_time)
                .map((a) => a.staff_id)
            );

            // Prioritize on-duty mechanics first
            const onDutyMechanics = mechanics.filter((m) => onDutyMechIds.has(m.id));
            const pool = onDutyMechanics.length > 0 ? onDutyMechanics : mechanics;

            const allCards = await this.getJobCards(shopId);
            const activeCards = allCards.filter(
              (c) => c.status === 'pending' || c.status === 'in_progress'
            );
            const mechCounts: { [id: string]: number } = {};
            pool.forEach((m) => {
              mechCounts[m.id] = 0;
            });
            activeCards.forEach((c) => {
              if (c.mechanic_id && mechCounts[c.mechanic_id] !== undefined) {
                mechCounts[c.mechanic_id]++;
              }
            });
            const minCount = Math.min(...pool.map((m) => mechCounts[m.id]));
            const candidates = pool.filter((m) => mechCounts[m.id] === minCount);
            const chosen = candidates[Math.floor(Math.random() * candidates.length)];
            targetMechanicId = chosen.id;
          }
        } catch (e) {
          console.warn('Auto mechanic allotment error:', e);
        }
      }

      // 2. Find or create customer
      let customerId: string | null = null;
      let matchedCustomer: Customer | undefined;
      if (customerPhone.trim() || bikeNumber.trim()) {
        const existing = await this.getCustomerByPhoneOrBike(
          shopId,
          customerPhone || bikeNumber
        );
        if (existing) {
          customerId = existing.id;
          matchedCustomer = existing;
          const updates: any = {};
          if (customerName.trim() && existing.customer_name === 'Walk-in Customer') {
            updates.customer_name = customerName.trim();
          }
          if (extra?.customerAddress && !existing.address) {
            updates.address = extra.customerAddress.trim();
          }
          if (extra?.bikeModel && !existing.bike_model) {
            updates.bike_model = extra.bikeModel.trim();
          }
          if (Object.keys(updates).length > 0) {
            await supabase.from('customers').update(updates).eq('id', existing.id);
          }
        } else {
          const created = await this.createOrUpdateCustomer(shopId, {
            customer_name: customerName.trim() || 'Walk-in Customer',
            phone: customerPhone.trim(),
            address: extra?.customerAddress?.trim() || null,
            bike_number: bikeNumber.trim().toUpperCase(),
            bike_model: extra?.bikeModel?.trim() || null,
            trust_tier: 'new',
            credit_limit: 0,
            absolute_max_limit: 2000,
            current_due: 0,
          });
          if (created) {
            customerId = created.id;
            matchedCustomer = created;
          }
        }
      }

      const advPaid = Number(extra?.advancePaid || 0);

      // 3. Prepare payload: starts draft (UI treats draft as WORK IN PROGRESS), consumable_charge = 0
      const primaryPayload: any = {
        shop_id: shopId,
        customer_id: customerId,
        mechanic_id: targetMechanicId || null,
        bike_number: bikeNumber.trim().toUpperCase(),
        vehicle_model: extra?.bikeModel?.trim() || null,
        odometer_km: odometerKm || 0,
        fuel_level: extra?.fuelLevel || null,
        advance_paid: advPaid,
        estimated_cost: Number(extra?.estimatedCost || 0),
        customer_complaints: extra?.customerComplaints?.trim() || null,
        mechanic_notes: extra?.mechanicNotes?.trim() || null,
        status: 'draft',
        is_locked_for_mechanic: false,
        labour_charge: 0,
        consumable_charge: 0,
        outside_work_desc: null,
        outside_work_shop_cost: 0,
        outside_work_customer_price: 0,
        extra_discount: 0,
        total_bill: 0,
        mandatory_cash_to_collect: 0,
        transferred_to_khata: 0,
        inspection_status: 'in_progress',
        mechanic_notified: extra?.isCreatedByMechanic ? true : false,
      };

      // Offline handling
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const localId = `local_jc_${Date.now()}`;
        const optimisticCard: JobCard = {
          ...primaryPayload,
          bike_model: extra?.bikeModel?.trim() || '',
          id: localId,
          created_at: new Date().toISOString(),
          customer: matchedCustomer,
          items: [],
        };
        const currentCards = offlineStorage.getCache<JobCard[]>(`job_cards_${shopId}`, []);
        offlineStorage.setCache(`job_cards_${shopId}`, [optimisticCard, ...currentCards]);
        offlineStorage.enqueue({
          table: 'job_cards',
          action: 'insert',
          payload: primaryPayload,
          shopId,
        });
        return optimisticCard;
      }

      let { data, error } = await supabase
        .from('job_cards')
        .insert(primaryPayload)
        .select('*, customer:customers(*), mechanic:users(*)')
        .single();

      if (error) {
        console.warn('Primary job card insert error, falling back:', error.message);
        const corePayload = {
          shop_id: shopId,
          customer_id: customerId,
          mechanic_id: targetMechanicId || null,
          bike_number: bikeNumber.trim().toUpperCase(),
          vehicle_model: extra?.bikeModel?.trim() || null,
          odometer_km: odometerKm || 0,
          status: 'draft',
          labour_charge: 0,
          total_bill: 0,
        };
        const fallbackRes = await supabase
          .from('job_cards')
          .insert(corePayload)
          .select('*, customer:customers(*), mechanic:users(*)')
          .single();
        if (fallbackRes.error) {
          throw fallbackRes.error;
        }
        data = fallbackRes.data;
      }

      // Update local cache
      if (data) {
        (data as any).bike_model = (data as any).bike_model || (data as any).vehicle_model || (data as any).customer?.bike_model || '';
        const currentCards = offlineStorage.getCache<JobCard[]>(`job_cards_${shopId}`, []);
        offlineStorage.setCache(`job_cards_${shopId}`, [data, ...currentCards]);
      }
      return data;
    } catch (err) {
      console.error('Create draft job card error:', err);
      return null;
    }
  },

  // CRITICAL REQUIREMENT: Increment quantity (+1) if item already exists instead of creating duplicate rows!
  async addPartToJobCard(
    shopId: string,
    jobCardId: string,
    part: {
      partId?: string | null;
      itemName: string;
      isUnlisted: boolean;
      unitPrice: number;
      quantity?: number;
      addedByName: string;
      warrantyMonths?: number;
      pricePendingInspection?: boolean;
    }
  ): Promise<boolean> {
    try {
      const qtyToAdd = part.quantity || 1;
      const isPending = part.pricePendingInspection ?? (part.isUnlisted && part.unitPrice === 0);

      // 1. Check if item already exists on this job card
      let existingQuery = supabase
        .from('job_card_items')
        .select('*')
        .eq('job_card_id', jobCardId);

      if (part.partId) {
        existingQuery = existingQuery.eq('part_id', part.partId);
      } else {
        existingQuery = existingQuery.eq('item_name', part.itemName.trim());
      }

      const { data: existingItems } = await existingQuery;

      if (existingItems && existingItems.length > 0) {
        // Increment quantity of existing item row
        const existing = existingItems[0];
        const newQty = (existing.quantity || 1) + qtyToAdd;
        const { error } = await supabase
          .from('job_card_items')
          .update({
            quantity: newQty,
            unit_price: part.unitPrice,
            price_pending_inspection: isPending,
          })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Insert new item row
        const { error } = await supabase.from('job_card_items').insert({
          shop_id: shopId,
          job_card_id: jobCardId,
          part_id: part.partId || null,
          item_name: part.itemName.trim(),
          is_unlisted_manual: part.isUnlisted,
          quantity: qtyToAdd,
          unit_price: part.unitPrice,
          added_by_name: part.addedByName,
          warranty_months: part.warrantyMonths || 0,
          price_pending_inspection: isPending,
        });

        if (error) throw error;
      }

      // Recalculate and update job card total
      await this.recalculateJobCardTotals(jobCardId);
      return true;
    } catch (err) {
      console.error('Add part error:', err);
      return false;
    }
  },

  async setJobCardInspectionStatus(
    jobCardId: string,
    status: 'in_progress' | 'ready_for_inspection' | 'inspected'
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('job_cards')
        .update({ inspection_status: status })
        .eq('id', jobCardId);
      return !error;
    } catch {
      return false;
    }
  },

  async setMechanicNotified(jobCardId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('job_cards')
        .update({ mechanic_notified: true })
        .eq('id', jobCardId);
      return !error;
    } catch {
      return false;
    }
  },

  async saveUnlistedPartToInventory(
    shopId: string,
    partName: string,
    unitPrice: number,
    costPrice: number = 0,
    stockQty: number = 10,
    category: string = 'General Parts'
  ): Promise<boolean> {
    try {
      const { error } = await supabase.from('inventory').insert({
        shop_id: shopId,
        part_name: partName.trim(),
        part_category: category,
        stock_quantity: stockQty,
        unit_price: unitPrice,
        cost_price: costPrice,
        min_stock_limit: 3,
      });
      return !error;
    } catch {
      return false;
    }
  },

  async requestCustomPartInventoryApproval(
    shopId: string,
    partName: string,
    sellingPrice: number,
    requestedBy: string
  ): Promise<boolean> {
    try {
      await supabase.from('audit_logs').insert({
        shop_id: shopId,
        action: 'CUSTOM_PART_APPROVAL_REQUEST',
        details: `${requestedBy} requested adding custom part "${partName}" (Selling: ₹${sellingPrice}) to master inventory.`,
      });
      return true;
    } catch {
      return false;
    }
  },

  async updateJobCardItemQuantity(
    itemId: string,
    jobCardId: string,
    quantity: number,
    unitPrice?: number
  ): Promise<boolean> {
    try {
      if (quantity <= 0) {
        await supabase.from('job_card_items').delete().eq('id', itemId);
      } else {
        const updateData: Record<string, any> = { quantity };
        if (unitPrice !== undefined) {
          const validPrice = Math.max(0, Number(unitPrice) || 0);
          updateData.unit_price = validPrice;
          updateData.price_pending_inspection = validPrice <= 0;
        }
        await supabase.from('job_card_items').update(updateData).eq('id', itemId);
      }
      await this.recalculateJobCardTotals(jobCardId);
      return true;
    } catch (err) {
      console.error('Update item quantity error:', err);
      return false;
    }
  },

  async removeJobCardItem(
    itemId: string,
    jobCardId: string
  ): Promise<boolean> {
    try {
      await supabase.from('job_card_items').delete().eq('id', itemId);
      await this.recalculateJobCardTotals(jobCardId);
      return true;
    } catch (err) {
      console.error('Delete item error:', err);
      return false;
    }
  },

  // Recalculate Job Card Total Bill
  async recalculateJobCardTotals(jobCardId: string): Promise<JobCard | null> {
    try {
      const { data: jc } = await supabase
        .from('job_cards')
        .select('*, items:job_card_items(*)')
        .eq('id', jobCardId)
        .single();

      if (!jc) return null;

      const itemsTotal = (jc.items || []).reduce(
        (sum: number, it: JobCardItem) => sum + (Number(it.unit_price) || 0) * (Number(it.quantity) || 1),
        0
      );

      const partsTotal = Math.round((itemsTotal + Number.EPSILON) * 100) / 100;
      const labour = Math.round((Number(jc.labour_charge || 0) + Number.EPSILON) * 100) / 100;
      const consumable = Math.round((Number(jc.consumable_charge !== undefined && jc.consumable_charge !== null ? jc.consumable_charge : 20) + Number.EPSILON) * 100) / 100;
      const outsidePrice = Math.round((Number(jc.outside_work_customer_price || 0) + Number.EPSILON) * 100) / 100;
      const discount = Math.round((Number(jc.extra_discount || 0) + Number.EPSILON) * 100) / 100;

      const subtotal = Math.round((partsTotal + labour + consumable + outsidePrice + Number.EPSILON) * 100) / 100;
      const totalBill = Math.max(0, Math.round((subtotal - discount + Number.EPSILON) * 100) / 100);

      const { data: updated } = await supabase
        .from('job_cards')
        .update({
          total_bill: totalBill,
        })
        .eq('id', jobCardId)
        .select('*, customer:customers(*), items:job_card_items(*)')
        .single();

      return updated;
    } catch (err) {
      console.error('Recalculate error:', err);
      return null;
    }
  },

  // Submit and Lock Job Card (Mechanic Handover)
  async submitAndLockJobCard(jobCardId: string): Promise<boolean> {
    try {
      await this.recalculateJobCardTotals(jobCardId);
      const { error } = await supabase
        .from('job_cards')
        .update({
          status: 'submitted',
          is_locked_for_mechanic: true,
          submitted_at: new Date().toISOString(),
        })
        .eq('id', jobCardId);

      return !error;
    } catch (err) {
      console.error('Submit lock error:', err);
      return false;
    }
  },

  // Manager/Owner Updates Billing Details (Labour, Outside Work, Discount, Split Payment)
  async updateJobCardBilling(
    jobCardId: string,
    data: {
      labourCharge: number;
      consumableCharge: number;
      outsideWorkDesc?: string | null;
      outsideWorkShopCost?: number;
      outsideWorkCustomerPrice?: number;
      extraDiscount?: number;
      mandatoryCashToCollect: number;
      transferredToKhata: number;
      totalBill?: number;
      cashCollected?: number;
      upiCollected?: number;
      advancePaid?: number;
    }
  ): Promise<boolean> {
    try {
      const payload: any = {
        labour_charge: Math.round((Number(data.labourCharge || 0) + Number.EPSILON) * 100) / 100,
        consumable_charge: Math.round((Number(data.consumableCharge || 0) + Number.EPSILON) * 100) / 100,
        outside_work_desc: data.outsideWorkDesc || null,
        outside_work_shop_cost: Math.round((Number(data.outsideWorkShopCost || 0) + Number.EPSILON) * 100) / 100,
        outside_work_customer_price: Math.round((Number(data.outsideWorkCustomerPrice || 0) + Number.EPSILON) * 100) / 100,
        extra_discount: Math.round((Number(data.extraDiscount || 0) + Number.EPSILON) * 100) / 100,
        mandatory_cash_to_collect: Math.round((Number(data.mandatoryCashToCollect || 0) + Number.EPSILON) * 100) / 100,
        transferred_to_khata: Math.round((Number(data.transferredToKhata || 0) + Number.EPSILON) * 100) / 100,
      };
      if (typeof data.totalBill === 'number') payload.total_bill = data.totalBill;
      if (typeof data.cashCollected === 'number') payload.cash_collected = data.cashCollected;
      if (typeof data.upiCollected === 'number') payload.upi_collected = data.upiCollected;
      if (typeof data.advancePaid === 'number') payload.advance_paid = data.advancePaid;

      const { error } = await supabase
        .from('job_cards')
        .update(payload)
        .eq('id', jobCardId);

      if (error) {
        console.warn('updateJobCardBilling full update failed, retrying with core columns:', error.message);
        const corePayload: any = {
          labour_charge: payload.labour_charge,
          consumable_charge: payload.consumable_charge,
          outside_work_desc: payload.outside_work_desc,
          outside_work_shop_cost: payload.outside_work_shop_cost,
          outside_work_customer_price: payload.outside_work_customer_price,
          extra_discount: payload.extra_discount,
          mandatory_cash_to_collect: payload.mandatory_cash_to_collect,
          transferred_to_khata: payload.transferred_to_khata,
        };
        if (typeof payload.total_bill === 'number') corePayload.total_bill = payload.total_bill;
        await supabase.from('job_cards').update(corePayload).eq('id', jobCardId);
      }

      if (typeof data.totalBill !== 'number') {
        await this.recalculateJobCardTotals(jobCardId);
      }
      return true;
    } catch (err) {
      console.error('Update billing error:', err);
      return false;
    }
  },

  // ========================
  // CREDIT & KHATA AUDIT LEDGER
  // ========================
  async getCreditLedger(shopId: string, customerId?: string): Promise<CreditLedgerEntry[]> {
    try {
      let query = supabase
        .from('credit_ledger')
        .select('*')
        .eq('shop_id', shopId)
        .order('created_at', { ascending: false });

      if (customerId) {
        query = query.eq('customer_id', customerId);
      }

      const { data, error } = await query;
      const cacheKey = `credit_ledger_${shopId}_${customerId || 'all'}`;

      if (!error && data && data.length > 0) {
        offlineStorage.setCache(cacheKey, data);
        return data as CreditLedgerEntry[];
      }

      const cached = offlineStorage.getCache<CreditLedgerEntry[]>(cacheKey, []);
      return cached;
    } catch (err) {
      console.warn('getCreditLedger error, using offline fallback:', err);
      const cacheKey = `credit_ledger_${shopId}_${customerId || 'all'}`;
      return offlineStorage.getCache<CreditLedgerEntry[]>(cacheKey, []);
    }
  },

  async addCreditLedgerEntry(entry: Omit<CreditLedgerEntry, 'id'>): Promise<CreditLedgerEntry> {
    const newEntry: CreditLedgerEntry = {
      ...entry,
      id: `cl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      created_at: entry.created_at || new Date().toISOString(),
    };

    // Update customer cache
    const cacheKey = `credit_ledger_${entry.shop_id}_${entry.customer_id}`;
    const existing = offlineStorage.getCache<CreditLedgerEntry[]>(cacheKey, []);
    offlineStorage.setCache(cacheKey, [newEntry, ...existing]);

    // Update all cache
    const allKey = `credit_ledger_${entry.shop_id}_all`;
    const allExisting = offlineStorage.getCache<CreditLedgerEntry[]>(allKey, []);
    offlineStorage.setCache(allKey, [newEntry, ...allExisting]);

    // Remote insert
    try {
      const { data, error } = await supabase
        .from('credit_ledger')
        .insert(newEntry)
        .select()
        .maybeSingle();

      if (error) {
        console.warn('credit_ledger remote insert notice (cached locally):', error.message);
      } else if (data) {
        return data as CreditLedgerEntry;
      }
    } catch (err) {
      console.warn('credit_ledger insert network error, saved to offline cache:', err);
    }

    return newEntry;
  },

  // Finalize & Bill Job Card (Deduct inventory stock, update customer Udhaar & record audit dossier)
  async completeAndBillJobCard(
    jobCardId: string,
    paymentMode: 'cash' | 'upi' | 'credit' | string,
    mandatoryCashCollected: number,
    transferredToKhata: number,
    upiRefNumber?: string,
    upiCollected?: number
  ): Promise<boolean> {
    try {
      const jc = await this.getJobCardById(jobCardId);
      if (!jc) return false;

      // 1. Deduct stock for inventory parts
      if (jc.items && jc.items.length > 0) {
        for (const it of jc.items) {
          if (it.part_id) {
            const { data: invItem } = await supabase
              .from('inventory')
              .select('stock_quantity')
              .eq('id', it.part_id)
              .single();

            if (invItem) {
              const newQty = Math.max(0, (invItem.stock_quantity || 0) - (it.quantity || 1));
              await supabase
                .from('inventory')
                .update({ stock_quantity: newQty, updated_at: new Date().toISOString() })
                .eq('id', it.part_id);
            }
          }
        }
      }

      // Exact numerical breakdown & calculation reconciliation
      const totalBill = Math.round((Number(jc.total_bill || 0) + Number.EPSILON) * 100) / 100;
      const advPaid = Math.round((Number(jc.advance_paid || 0) + Number.EPSILON) * 100) / 100;
      const netPayable = Math.max(0, Math.round((totalBill - advPaid + Number.EPSILON) * 100) / 100);

      const cashAmt = Math.round((Number(mandatoryCashCollected || 0) + Number.EPSILON) * 100) / 100;
      const khataAmt = Math.round((Number(transferredToKhata || 0) + Number.EPSILON) * 100) / 100;
      const upiAmt = typeof upiCollected === 'number'
        ? Math.round((Math.max(0, upiCollected) + Number.EPSILON) * 100) / 100
        : Math.round((Math.max(0, netPayable - cashAmt - khataAmt) + Number.EPSILON) * 100) / 100;

      // 2. CRITICAL KHATA SYNC: Ensure customer due is ALWAYS updated
      let finalCustId = jc.customer_id;
      let prevDue = 0;
      let finalCustomerDue = 0;

      if (finalCustId) {
        const { data: cust } = await supabase
          .from('customers')
          .select('id, current_due, customer_name, phone, bike_number')
          .eq('id', finalCustId)
          .single();

        if (cust) {
          prevDue = Number(cust.current_due || 0);
          finalCustomerDue = prevDue + khataAmt;
          if (khataAmt > 0) {
            await supabase
              .from('customers')
              .update({ current_due: finalCustomerDue })
              .eq('id', finalCustId);
          }
        }
      } else {
        // Find or create customer by bike number or phone so udhaar is NEVER lost!
        const { data: existingCust } = await supabase
          .from('customers')
          .select('id, current_due, customer_name, phone, bike_number')
          .eq('shop_id', jc.shop_id)
          .ilike('bike_number', jc.bike_number.trim())
          .maybeSingle();

        if (existingCust) {
          finalCustId = existingCust.id;
          prevDue = Number(existingCust.current_due || 0);
          finalCustomerDue = prevDue + khataAmt;
          if (khataAmt > 0) {
            await supabase
              .from('customers')
              .update({ current_due: finalCustomerDue })
              .eq('id', existingCust.id);
          }
        } else {
          finalCustomerDue = khataAmt;
          const { data: newCust } = await supabase
            .from('customers')
            .insert({
              shop_id: jc.shop_id,
              customer_name: (jc as any).customer?.customer_name || 'Walk-in Customer',
              phone: (jc as any).customer?.phone || '',
              bike_number: jc.bike_number.toUpperCase().trim(),
              trust_tier: 'regular',
              credit_limit: 5000,
              absolute_max_limit: 10000,
              current_due: khataAmt,
            })
            .select('id')
            .maybeSingle();

          if (newCust) {
            finalCustId = newCust.id;
          }
        }
      }

      const invCode = `INV-${jobCardId.slice(-4).toUpperCase()}`;
      const nowIso = new Date().toISOString();

      // 3. Record Detailed Transaction & Payment Audit Ledger Entries for Customer 360
      if (finalCustId) {
        const custName = (jc as any).customer?.customer_name || 'Customer';
        const custPhone = (jc as any).customer?.phone || '';

        // Cash Paid entry
        if (cashAmt > 0) {
          await this.addCreditLedgerEntry({
            shop_id: jc.shop_id,
            customer_id: finalCustId,
            customer_name: custName,
            customer_phone: custPhone,
            bike_number: jc.bike_number,
            job_card_id: jobCardId,
            invoice_number: invCode,
            transaction_type: 'cash_paid',
            amount: cashAmt,
            balance_after: finalCustomerDue,
            reference_no: 'CASH-COUNTER',
            notes: `Cash collected at handover for Job #${jobCardId.slice(-4).toUpperCase()}`,
            created_at: nowIso,
          });
        }

        // UPI Received entry
        if (upiAmt > 0) {
          await this.addCreditLedgerEntry({
            shop_id: jc.shop_id,
            customer_id: finalCustId,
            customer_name: custName,
            customer_phone: custPhone,
            bike_number: jc.bike_number,
            job_card_id: jobCardId,
            invoice_number: invCode,
            transaction_type: 'upi_received',
            amount: upiAmt,
            balance_after: finalCustomerDue,
            reference_no: upiRefNumber || 'UPI-QR',
            notes: `UPI QR payment received at handover for Job #${jobCardId.slice(-4).toUpperCase()}`,
            created_at: nowIso,
          });
        }

        // Udhaar Incurred entry
        if (khataAmt > 0) {
          await this.addCreditLedgerEntry({
            shop_id: jc.shop_id,
            customer_id: finalCustId,
            customer_name: custName,
            customer_phone: custPhone,
            bike_number: jc.bike_number,
            job_card_id: jobCardId,
            invoice_number: invCode,
            transaction_type: 'udhaar_incurred',
            amount: khataAmt,
            balance_after: finalCustomerDue,
            reference_no: 'KHATA-DEBIT',
            notes: `Credit / Udhaar added to Khata for Job #${jobCardId.slice(-4).toUpperCase()}`,
            created_at: nowIso,
          });
        }
      }

      // 4. Update Job Card Status to completed, set billed_at, cash/upi collections
      const updatePayload: any = {
        status: 'completed',
        total_bill: totalBill,
        advance_paid: advPaid,
        cash_collected: cashAmt,
        upi_collected: upiAmt,
        mandatory_cash_to_collect: cashAmt,
        transferred_to_khata: khataAmt,
        billed_at: nowIso,
      };
      if (finalCustId) updatePayload.customer_id = finalCustId;
      if (upiRefNumber) updatePayload.upi_ref_number = upiRefNumber;

      let { error } = await supabase
        .from('job_cards')
        .update(updatePayload)
        .eq('id', jobCardId);

      if (error) {
        console.warn('Extended job_cards update failed, retrying with core columns:', error.message);
        const corePayload: any = {
          status: 'completed',
          total_bill: totalBill,
          mandatory_cash_to_collect: cashAmt,
          transferred_to_khata: khataAmt,
          billed_at: nowIso,
        };
        if (finalCustId) corePayload.customer_id = finalCustId;
        const retryRes = await supabase.from('job_cards').update(corePayload).eq('id', jobCardId);
        if (retryRes.error) {
          console.error('Core job_cards update error:', retryRes.error);
        }
      }

      // Update offline storage cache for instant local availability
      const cachedCard = {
        ...jc,
        status: 'completed' as const,
        total_bill: totalBill,
        advance_paid: advPaid,
        cash_collected: cashAmt,
        upi_collected: upiAmt,
        mandatory_cash_to_collect: cashAmt,
        transferred_to_khata: khataAmt,
        billed_at: nowIso,
        customer_id: finalCustId || jc.customer_id,
        upi_ref_number: upiRefNumber || jc.upi_ref_number,
      };
      offlineStorage.setCache(`job_card_${jobCardId}`, cachedCard);

      // Reconcile shop balances immediately in background so customer due is 100% verified everywhere
      this.reconcileShopCustomerBalances(jc.shop_id).catch(() => {});

      return true;
    } catch (err) {
      console.error('Complete bill error:', err);
      return false;
    }
  },

  // Direct Job Card creation (Owner & Manager Intake)
  async createJobCard(
    shopId: string,
    payload: {
      bike_number?: string;
      bikeNumber?: string;
      bike_model?: string;
      bikeModel?: string;
      customer_name?: string;
      customerName?: string;
      customer_phone?: string;
      customerPhone?: string;
      customer_address?: string;
      customerAddress?: string;
      mechanic_id?: string;
      odometer_km?: number;
      odometerKm?: number;
      fuel_level?: string;
      fuelLevel?: string;
      advance_paid?: number;
      advancePaid?: number;
      estimated_cost?: number;
      estimatedCost?: number;
      customer_complaints?: string;
      customerComplaints?: string;
      mechanic_notes?: string;
      mechanicNotes?: string;
      estimated_delivery?: string;
      created_by_user_id?: string;
    }
  ): Promise<JobCard | null> {
    return this.createDraftJobCard(
      shopId,
      payload.mechanic_id || '',
      payload.customer_name || payload.customerName || 'Walk-in Customer',
      payload.customer_phone || payload.customerPhone || '',
      payload.bike_number || payload.bikeNumber || '',
      payload.odometer_km || payload.odometerKm || 0,
      {
        bikeModel: payload.bike_model || payload.bikeModel,
        fuelLevel: payload.fuel_level || payload.fuelLevel,
        advancePaid: payload.advance_paid ?? payload.advancePaid,
        estimatedCost: payload.estimated_cost ?? payload.estimatedCost,
        customerComplaints: payload.customer_complaints || payload.customerComplaints,
        mechanicNotes: payload.mechanic_notes || payload.mechanicNotes,
        customerAddress: payload.customer_address || payload.customerAddress,
      }
    );
  },

  // Edit Job Card basic details (Bike number, Odometer, Customer Name & Phone, Model, Fuel)
  async updateJobCardDetails(
    jobCardId: string,
    details: {
      bike_number?: string;
      bikeNumber?: string;
      bike_model?: string;
      bikeModel?: string;
      odometer_km?: number;
      odometerKm?: number;
      fuel_level?: string;
      fuelLevel?: string;
      customer_name?: string;
      customerName?: string;
      customer_phone?: string;
      customerPhone?: string;
      customer_address?: string;
      customerAddress?: string;
      mechanic_id?: string;
      customerId?: string | null;
      shopId?: string;
    }
  ): Promise<boolean> {
    try {
      const payload: any = {};
      const bikeNo = details.bike_number || details.bikeNumber;
      const bikeModel = details.bike_model || details.bikeModel;
      const odo = details.odometer_km !== undefined ? details.odometer_km : details.odometerKm;
      const fuel = details.fuel_level || details.fuelLevel;
      const custName = details.customer_name || details.customerName;
      const custPhone = details.customer_phone || details.customerPhone;
      const custAddr = details.customer_address || details.customerAddress;

      if (bikeNo) payload.bike_number = bikeNo.toUpperCase().trim();
      if (bikeModel !== undefined) payload.vehicle_model = bikeModel ? bikeModel.trim() : null;
      if (odo !== undefined) payload.odometer_km = odo;
      if (fuel !== undefined) payload.fuel_level = fuel;
      if (details.mechanic_id !== undefined) payload.mechanic_id = details.mechanic_id || null;

      let custId = details.customerId;
      if (custName || custPhone || custAddr || bikeModel) {
        if (custId) {
          const custUpdates: any = {};
          if (custName) custUpdates.customer_name = custName.trim();
          if (custPhone) custUpdates.phone = custPhone.trim();
          if (custAddr) custUpdates.address = custAddr.trim();
          if (bikeModel) custUpdates.bike_model = bikeModel.trim();
          await supabase.from('customers').update(custUpdates).eq('id', custId);
        } else if (custName && details.shopId) {
          const { data: newCust } = await supabase
            .from('customers')
            .insert({
              shop_id: details.shopId,
              customer_name: custName,
              phone: custPhone || '',
              address: custAddr || null,
              bike_number: (bikeNo || '').toUpperCase().trim(),
              bike_model: bikeModel || null,
              trust_tier: 'new',
              credit_limit: 1000,
              absolute_max_limit: 3000,
              current_due: 0,
            })
            .select('id')
            .single();
          if (newCust) {
            custId = newCust.id;
            payload.customer_id = custId;
          }
        }
      }

      const { error } = await supabase.from('job_cards').update(payload).eq('id', jobCardId);
      return !error;
    } catch (err) {
      console.error('updateJobCardDetails error:', err);
      return false;
    }
  },

  // Update Customer Voice / Complaints & Mechanic Notes on an active card
  async updateJobCardComplaints(
    jobCardId: string,
    complaints: string,
    notes?: string
  ): Promise<boolean> {
    try {
      const updates: any = { customer_complaints: complaints.trim() };
      if (notes !== undefined) updates.mechanic_notes = notes.trim();
      const { error } = await supabase.from('job_cards').update(updates).eq('id', jobCardId);
      return !error;
    } catch (err) {
      console.error('updateJobCardComplaints error:', err);
      return false;
    }
  },

  // Delete / Cancel Job Card (Draft or Active)
  async deleteJobCard(jobCardId: string): Promise<boolean> {
    try {
      await supabase.from('job_card_items').delete().eq('job_card_id', jobCardId);
      const { error } = await supabase.from('job_cards').delete().eq('id', jobCardId);
      return !error;
    } catch (err) {
      console.error('deleteJobCard error:', err);
      return false;
    }
  },

  // Editable Unit Price for Part/Labour on the spot (flexible argument order)
  async updateJobCardItemPrice(itemId: string, arg2: number | string, arg3?: number | string): Promise<boolean> {
    const rawPrice = typeof arg2 === 'number' ? arg2 : (typeof arg3 === 'number' ? arg3 : Number(arg3) || 0);
    const validPrice = Math.max(0, Number(rawPrice) || 0);
    const jcId = typeof arg2 === 'string' ? arg2 : (typeof arg3 === 'string' ? arg3 : undefined);
    const isPending = validPrice <= 0;
    try {
      const { error } = await supabase
        .from('job_card_items')
        .update({ 
          unit_price: validPrice,
          price_pending_inspection: isPending
        })
        .eq('id', itemId);
      if (error) throw error;

      // Update offline storage cache if exists
      try {
        const cacheKeys = Object.keys(localStorage).filter(k => k.startsWith('job_cards_'));
        for (const k of cacheKeys) {
          const cached = offlineStorage.getCache<JobCard[]>(k, []);
          if (cached && cached.length > 0) {
            let modified = false;
            const updated = cached.map(jc => {
              if (jc.items && Array.isArray(jc.items)) {
                const itemIdx = jc.items.findIndex(it => it.id === itemId);
                if (itemIdx >= 0) {
                  modified = true;
                  const newItems = [...jc.items];
                  newItems[itemIdx] = {
                    ...newItems[itemIdx],
                    unit_price: validPrice,
                    price_pending_inspection: isPending,
                  };
                  return { ...jc, items: newItems };
                }
              }
              return jc;
            });
            if (modified) {
              offlineStorage.setCache(k, updated);
            }
          }
        }
      } catch (cacheErr) {
        // silent cache error
      }

      if (jcId) {
        await this.recalculateJobCardTotals(jcId);
      }
      return true;
    } catch (err) {
      console.error('updateJobCardItemPrice error:', err);
      return false;
    }
  },

  // Remove Part/Labour Item from Job Card
  async deleteJobCardItem(itemId: string, jobCardId?: string): Promise<boolean> {
    try {
      const { error } = await supabase.from('job_card_items').delete().eq('id', itemId);
      if (error) throw error;
      if (jobCardId) {
        await this.recalculateJobCardTotals(jobCardId);
      }
      return true;
    } catch (err) {
      console.error('deleteJobCardItem error:', err);
      return false;
    }
  },

  // Revise Completed Bill (Owner adjustment)
  async reviseCompletedBill(
    jobCardId: string,
    updates: {
      totalBill?: number;
      cashCollected?: number;
      upiCollected?: number;
      labourCharge?: number;
      consumableCharge?: number;
      extraDiscount?: number;
      mandatoryCashToCollect?: number;
      transferredToKhata?: number;
      upiRefNumber?: string;
      notes?: string;
    }
  ): Promise<boolean> {
    try {
      const payload: any = {};
      if (updates.labourCharge !== undefined) payload.labour_charge = updates.labourCharge;
      if (updates.consumableCharge !== undefined) payload.consumable_charge = updates.consumableCharge;
      if (updates.extraDiscount !== undefined) payload.extra_discount = updates.extraDiscount;
      if (updates.mandatoryCashToCollect !== undefined) payload.mandatory_cash_to_collect = updates.mandatoryCashToCollect;
      if (updates.cashCollected !== undefined) payload.mandatory_cash_to_collect = updates.cashCollected;
      if (updates.transferredToKhata !== undefined) payload.transferred_to_khata = updates.transferredToKhata;
      if (updates.upiRefNumber !== undefined) payload.upi_ref_number = updates.upiRefNumber;
      if (updates.totalBill !== undefined) payload.total_bill = updates.totalBill;

      const { error } = await supabase.from('job_cards').update(payload).eq('id', jobCardId);
      if (error) throw error;
      if (updates.totalBill === undefined) {
        await this.recalculateJobCardTotals(jobCardId);
      }
      return true;
    } catch (err) {
      console.error('reviseCompletedBill error:', err);
      return false;
    }
  },

  // Delete Inventory Item
  async deleteInventoryItem(itemId: string): Promise<boolean> {
    try {
      const { error } = await supabase.from('inventory').delete().eq('id', itemId);
      return !error;
    } catch (err) {
      console.error('deleteInventoryItem error:', err);
      return false;
    }
  },

  // Get Today's Expenses for Daily Galla audit list
  async getTodayExpenses(shopId: string): Promise<ShopExpense[]> {
    try {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from('shop_expenses')
        .select('*')
        .eq('shop_id', shopId)
        .gte('created_at', startOfDay.toISOString())
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('getTodayExpenses error:', err);
      return [];
    }
  },

  // Delete / Reverse Shop Expense
  async deleteShopExpense(expenseId: string): Promise<boolean> {
    try {
      const { data: exp } = await supabase.from('shop_expenses').select('*').eq('id', expenseId).single();
      if (exp && exp.expense_type === 'staff_upad' && exp.staff_id) {
        const { data: user } = await supabase.from('users').select('total_upad_taken').eq('id', exp.staff_id).single();
        if (user) {
          await supabase.from('users').update({
            total_upad_taken: Math.max(0, (user.total_upad_taken || 0) - (exp.amount || 0))
          }).eq('id', exp.staff_id);
        }
      }
      const { error } = await supabase.from('shop_expenses').delete().eq('id', expenseId);
      return !error;
    } catch (err) {
      console.error('deleteShopExpense error:', err);
      return false;
    }
  },

  // Owner PIN Reset via Secret Recovery Key or Master Key
  async resetOwnerPin(
    phone: string,
    recoveryKey: string,
    newPin: string
  ): Promise<{ success: boolean; message: string }> {
    const cleanPhone = phone.replace(/\D/g, '');
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      return { success: false, message: 'New PIN must be exactly 4 digits.' };
    }

    const { data: user, error: findErr } = await supabase
      .from('users')
      .select('id, role, shop_id')
      .eq('phone', cleanPhone)
      .maybeSingle();

    if (findErr || !user) {
      return { success: false, message: 'No registered user found with this mobile number.' };
    }

    let customSecret: string | null = null;
    if (user.shop_id) {
      const { data: shop } = await supabase
        .from('shops')
        .select('recovery_secret')
        .eq('id', user.shop_id)
        .maybeSingle();
      if (shop?.recovery_secret && shop.recovery_secret.trim()) {
        customSecret = shop.recovery_secret.trim();
      }
    }

    const inputKey = recoveryKey.trim();
    const isMaster = inputKey.toUpperCase() === 'BIKEREADY2026';
    const isCustomMatch = customSecret && inputKey === customSecret;

    if (!isMaster && !isCustomMatch) {
      return {
        success: false,
        message: 'Invalid Secret Recovery Passcode! Please enter your workshop secret passcode or tap WhatsApp help below.',
      };
    }

    const { error: updateErr } = await supabase
      .from('users')
      .update({ pin_code: newPin })
      .eq('id', user.id);

    if (updateErr) {
      return { success: false, message: 'Failed to update PIN in database.' };
    }

    return { success: true, message: 'Your 4-Digit Security PIN has been reset successfully! You can now sign in.' };
  },

  // Update Shop Profile Security (Owner PIN & Private Recovery Passcode)
  async updateShopSecurity(
    shopId: string,
    ownerUserId: string,
    newPin?: string,
    recoverySecret?: string
  ): Promise<boolean> {
    try {
      if (recoverySecret !== undefined) {
        await supabase.from('shops').update({ recovery_secret: recoverySecret.trim() || null }).eq('id', shopId);
      }
      if (newPin && newPin.length === 4) {
        await supabase.from('users').update({ pin_code: newPin }).eq('id', ownerUserId);
      }
      return true;
    } catch (err) {
      console.error('updateShopSecurity error:', err);
      return false;
    }
  },

  // Super Admin 1-Click Owner PIN Reset
  async adminResetOwnerPin(shopId: string, newPin: string): Promise<boolean> {
    try {
      if (newPin.length !== 4) return false;
      const { data: owners } = await supabase
        .from('users')
        .select('id')
        .eq('shop_id', shopId)
        .eq('role', 'owner');
      if (owners && owners.length > 0) {
        const { error } = await supabase.from('users').update({ pin_code: newPin }).eq('id', owners[0].id);
        return !error;
      }
      return false;
    } catch (err) {
      console.error('adminResetOwnerPin error:', err);
      return false;
    }
  },

  // Staff HR Management: Edit Staff Details
  async updateStaffUser(
    userId: string,
    updates: {
      full_name?: string;
      fullName?: string;
      phone?: string;
      role?: UserRole;
      designation?: string | null;
      monthly_salary?: number;
      monthlySalary?: number;
      pin_code?: string;
      pinCode?: string;
      is_active?: boolean;
    }
  ): Promise<boolean> {
    try {
      const payload: any = {};
      const name = updates.full_name || updates.fullName;
      const salary = updates.monthly_salary !== undefined ? updates.monthly_salary : updates.monthlySalary;
      const pin = updates.pin_code || updates.pinCode;

      if (name) payload.full_name = name.trim();
      if (updates.phone) payload.phone = updates.phone.trim();
      if (updates.role) payload.role = updates.role;
      if (updates.designation !== undefined) payload.designation = updates.designation;
      if (salary !== undefined) payload.monthly_salary = Number(salary);
      if (pin) payload.pin_code = pin.trim();
      if (updates.is_active !== undefined) payload.is_active = updates.is_active;

      const { error } = await supabase.from('users').update(payload).eq('id', userId);
      return !error;
    } catch (err) {
      console.error('updateStaffUser error:', err);
      return false;
    }
  },

  // Staff Deactivation / Left Job with F&F Settlement
  async deactivateStaffUser(userId: string, settlementNotes?: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('users')
        .update({
          is_active: false,
          left_date: new Date().toISOString(),
          settlement_notes: settlementNotes || 'Full & Final Settled',
        })
        .eq('id', userId);
      return !error;
    } catch (err) {
      console.error('deactivateStaffUser error:', err);
      return false;
    }
  },

  // Staff Reactivation / Re-join
  async reactivateStaffUser(userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('users')
        .update({
          is_active: true,
          left_date: null,
          settlement_notes: null,
        })
        .eq('id', userId);
      return !error;
    } catch (err) {
      console.error('reactivateStaffUser error:', err);
      return false;
    }
  },

  // Delete Staff User
  async deleteStaffUser(userId: string): Promise<boolean> {
    try {
      const { error } = await supabase.from('users').delete().eq('id', userId);
      return !error;
    } catch (err) {
      console.error('deleteStaffUser error:', err);
      return false;
    }
  },

  // Owner Staff PIN Reset
  async resetStaffPin(userId: string, newPin: string): Promise<boolean> {
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) return false;
    const { error } = await supabase
      .from('users')
      .update({ pin_code: newPin })
      .eq('id', userId);
    return !error;
  },

  // ========================
  // QUICK JOBS & ANTI-MISUSE AUDIT LOG
  // ========================
  async getQuickJobs(shopId: string): Promise<QuickJob[]> {
    const { data, error } = await supabase
      .from('quick_jobs')
      .select('*')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Quick jobs error:', error);
      return [];
    }
    return data || [];
  },

  async recordQuickJob(
    shopId: string,
    workerId: string,
    workerName: string,
    serviceName: string,
    defaultPrice: number,
    finalPrice: number,
    paymentMode: 'cash' | 'upi'
  ): Promise<QuickJob | null> {
    try {
      const isModified = defaultPrice !== finalPrice;
      const { data, error } = await supabase
        .from('quick_jobs')
        .insert({
          shop_id: shopId,
          worker_id: workerId,
          worker_name: workerName,
          service_name: serviceName,
          default_price: defaultPrice,
          final_price: finalPrice,
          is_price_modified: isModified,
          payment_mode: paymentMode,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Record quick job error:', err);
      return null;
    }
  },

  async deleteQuickJob(jobId: string): Promise<boolean> {
    try {
      const { error } = await supabase.from('quick_jobs').delete().eq('id', jobId);
      return !error;
    } catch (err) {
      console.error('deleteQuickJob error:', err);
      return false;
    }
  },

  // ========================
  // SHOP EXPENSES & STAFF UPAD
  // ========================
  async getExpenses(shopId: string): Promise<ShopExpense[]> {
    const cacheKey = `expenses_${shopId}`;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return offlineStorage.getCache<ShopExpense[]>(cacheKey, []);
    }
    try {
      const { data, error } = await supabase
        .from('shop_expenses')
        .select('*')
        .eq('shop_id', shopId)
        .order('created_at', { ascending: false });

      if (error || !data) {
        return offlineStorage.getCache<ShopExpense[]>(cacheKey, []);
      }
      offlineStorage.setCache(cacheKey, data);
      return data;
    } catch {
      return offlineStorage.getCache<ShopExpense[]>(cacheKey, []);
    }
  },

  async recordExpense(
    shopId: string,
    expenseType: 'shop_expense' | 'staff_upad',
    title: string,
    amount: number,
    recordedBy: string,
    staffId?: string | null,
    staffName?: string | null,
    paymentMode: 'cash' | 'upi' = 'cash',
    category?: string | null
  ): Promise<ShopExpense | null> {
    try {
      const primaryPayload: any = {
        shop_id: shopId,
        expense_type: expenseType,
        title: title.trim(),
        amount: Math.max(0, amount),
        recorded_by: recordedBy,
        staff_id: staffId || null,
        staff_name: staffName || null,
        payment_mode: paymentMode,
        category: category?.trim() || null,
      };

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const localExpense: ShopExpense = {
          ...primaryPayload,
          id: `local_exp_${Date.now()}`,
          created_at: new Date().toISOString(),
        };
        const current = offlineStorage.getCache<ShopExpense[]>(`expenses_${shopId}`, []);
        offlineStorage.setCache(`expenses_${shopId}`, [localExpense, ...current]);
        offlineStorage.enqueue({
          table: 'shop_expenses',
          action: 'insert',
          payload: primaryPayload,
          shopId,
        });
        return localExpense;
      }

      let { data, error } = await supabase
        .from('shop_expenses')
        .insert(primaryPayload)
        .select()
        .single();

      if (error) {
        console.warn('Expense primary insert failed, retrying core columns:', error.message);
        const fallbackPayload = {
          shop_id: shopId,
          expense_type: expenseType,
          title: title.trim(),
          amount: Math.max(0, amount),
          recorded_by: recordedBy,
          staff_id: staffId || null,
          staff_name: staffName || null,
        };
        const fbRes = await supabase
          .from('shop_expenses')
          .insert(fallbackPayload)
          .select()
          .single();
        if (fbRes.error) throw fbRes.error;
        data = fbRes.data;
      }

      // If staff upad, update user total_upad_taken and also insert into staff_payments
      if (expenseType === 'staff_upad' && staffId) {
        await supabase.from('staff_payments').insert({
          shop_id: shopId,
          staff_id: staffId,
          staff_name: staffName || 'Staff Member',
          payment_type: 'upad_advance',
          amount: Math.max(0, amount),
          payment_mode: paymentMode,
          notes: title.trim(),
          created_at: new Date().toISOString(),
        });

        const { data: user } = await supabase
          .from('users')
          .select('total_upad_taken')
          .eq('id', staffId)
          .single();

        if (user) {
          await supabase
            .from('users')
            .update({
              total_upad_taken: (user.total_upad_taken || 0) + amount,
            })
            .eq('id', staffId);
        }
      }

      return data;
    } catch (err) {
      console.error('Record expense error:', err);
      return null;
    }
  },

  // ========================
  // GALLA TALLY (Daily Cash Reconciliation)
  // ========================
  async getDailyGallaTally(shopId: string): Promise<DailyGallaTally> {
    try {
      // Filter for today's records
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const startIso = startOfDay.toISOString();

      // 1. Fetch completed cards, inventory, quick jobs, expenses, udhaar settlements, and live customer dues
      const [
        completedCardsRes,
        invItemsRes,
        quickJobsRes,
        expensesRes,
        settlementsRes,
        customersRes,
      ] = await Promise.all([
        supabase
          .from('job_cards')
          .select('*, items:job_card_items(*)')
          .eq('shop_id', shopId)
          .eq('status', 'completed')
          .gte('billed_at', startIso),
        supabase
          .from('inventory')
          .select('id, cost_price, unit_price')
          .eq('shop_id', shopId),
        supabase
          .from('quick_jobs')
          .select('*')
          .eq('shop_id', shopId)
          .gte('created_at', startIso),
        supabase
          .from('shop_expenses')
          .select('*')
          .eq('shop_id', shopId)
          .gte('created_at', startIso),
        supabase
          .from('credit_ledger')
          .select('*')
          .eq('shop_id', shopId)
          .eq('transaction_type', 'udhaar_cleared')
          .gte('created_at', startIso),
        supabase
          .from('customers')
          .select('current_due')
          .eq('shop_id', shopId),
      ]);

      const completedCards = completedCardsRes.data || [];
      const invItems = invItemsRes.data || [];
      const quickJobs = quickJobsRes.data || [];
      const expenses = expensesRes.data || [];
      const settlements = settlementsRes.data || [];
      const allCustomers = customersRes.data || [];

      const costMap = new Map<string, number>();
      invItems.forEach((it) => {
        costMap.set(it.id, Number(it.cost_price || 0));
      });

      let jobCardCash = 0;
      let jobCardUpi = 0;
      let advanceCash = 0;
      let advanceUpi = 0;

      let partsMarginTotal = 0;
      let labourTotal = 0;
      let consumableTotal = 0;
      let outsideMarginTotal = 0;

      completedCards.forEach((c) => {
        const gross = Number(c.total_bill || 0);
        const advAmt = Number(c.advance_paid || 0);
        const netPay = Math.max(0, gross - advAmt);
        const khataAmt = Number(c.transferred_to_khata || 0);

        let cashAmt = Number(c.cash_collected ?? c.mandatory_cash_to_collect ?? 0);
        let upiAmt = Number(c.upi_collected || 0);

        // If delivery cash + upi is 0 but customer paid (gross exceeds advance + khata)
        const expectedDeliveryPaid = Math.max(0, netPay - khataAmt);
        if (cashAmt + upiAmt === 0 && expectedDeliveryPaid > 0) {
          if (c.payment_mode === 'upi' || c.upi_ref_number) {
            upiAmt = expectedDeliveryPaid;
          } else {
            cashAmt = expectedDeliveryPaid;
          }
        }

        // Advance payments
        if (advAmt > 0) {
          if (c.payment_mode === 'upi') advanceUpi += advAmt;
          else advanceCash += advAmt;
        }

        jobCardCash += cashAmt;
        jobCardUpi += upiAmt;

        labourTotal += Number(c.labour_charge || 0);
        consumableTotal += Number(c.consumable_charge !== undefined ? c.consumable_charge : 20);
        outsideMarginTotal += Math.max(
          0,
          Number(c.outside_work_customer_price || 0) - Number(c.outside_work_shop_cost || 0)
        );

        (c.items || []).forEach((item: any) => {
          const selling = Number(item.unit_price || 0) * Number(item.quantity || 1);
          const unitCost = item.part_id && costMap.has(item.part_id)
            ? costMap.get(item.part_id)!
            : Number(item.unit_price || 0) * 0.7; // default 70% cost if not set
          const totalCost = unitCost * Number(item.quantity || 1);
          partsMarginTotal += Math.max(0, selling - totalCost);
        });
      });

      // 2. Genuine Quick Jobs (exclude udhaar settlements to avoid double counting)
      let quickJobCash = 0;
      let quickJobUpi = 0;

      quickJobs.forEach((q) => {
        if (q.service_name?.toLowerCase().includes('udhaar')) {
          return;
        }
        if (q.payment_mode === 'cash') {
          quickJobCash += Number(q.final_price || 0);
        } else {
          quickJobUpi += Number(q.final_price || 0);
        }
      });

      // 3. Udhaar Settlements Today (Physical Cash vs Digital UPI)
      let udhaarSettlementCash = 0;
      let udhaarSettlementUpi = 0;

      settlements.forEach((st: any) => {
        const amt = Number(st.amount || 0);
        const notes = st.notes || '';
        const ref = st.reference_no || '';

        const cashMatch = notes.match(/Cash ₹?([0-9.]+)/i);
        const upiMatch = notes.match(/UPI ₹?([0-9.]+)/i);
        if (cashMatch && upiMatch) {
          udhaarSettlementCash += Number(cashMatch[1] || 0);
          udhaarSettlementUpi += Number(upiMatch[1] || 0);
        } else if (ref.includes('UPI') || notes.toLowerCase().includes('via upi') || notes.toLowerCase().includes('upi direct')) {
          udhaarSettlementUpi += amt;
        } else {
          udhaarSettlementCash += amt;
        }
      });

      // 4. Expenses, Upad & Scrap Income (Physical Cash Drawer Outflows vs Digital UPI)
      let shopExpenses = 0;
      let staffUpad = 0;
      let scrapIncome = 0;
      let cashExpenses = 0;
      let upiExpenses = 0;

      expenses.forEach((e) => {
        const amt = Number(e.amount || 0);
        const mode = (e as any).payment_mode || 'cash';
        if (e.expense_type === 'staff_upad') {
          staffUpad += amt;
          if (mode === 'cash') cashExpenses += amt;
          else upiExpenses += amt;
        } else if (e.expense_type === 'scrap_income') {
          scrapIncome += amt;
        } else {
          shopExpenses += amt;
          if (mode === 'cash') cashExpenses += amt;
          else upiExpenses += amt;
        }
      });

      // Physical Cash Inflows: Job Card Cash + Quick Job Cash + Advance Cash + Udhaar Settlement Cash + Scrap Sale Cash
      const totalCashIn = jobCardCash + quickJobCash + advanceCash + udhaarSettlementCash + scrapIncome;
      // Digital UPI Inflows: Job Card UPI + Quick Job UPI + Advance UPI + Udhaar Settlement UPI
      const totalUpiIn = jobCardUpi + quickJobUpi + advanceUpi + udhaarSettlementUpi;
      // Cash Outflows: Strictly Physical Cash Outflows (Never subtract UPI expenses/salaries from cash drawer!)
      const totalCashOut = cashExpenses;
      const netCashInGalla = totalCashIn - totalCashOut;

      // Live sum of remaining current_due across all customers
      const transferredToKhata = allCustomers.reduce(
        (sum, c) => sum + Math.max(0, Number(c.current_due || 0)),
        0
      );

      const totalRevenue = totalCashIn + totalUpiIn + transferredToKhata;

      // Real Net Profit (Asli Munafa):
      // (Parts Selling - Parts Cost) + Labour + Consumables + Outside Work Margin + Quick Jobs + Scrap Income - Shop Expenses
      const quickJobsTotal = quickJobCash + quickJobUpi;
      const realNetProfit = Math.round(
        partsMarginTotal +
          labourTotal +
          consumableTotal +
          outsideMarginTotal +
          quickJobsTotal +
          scrapIncome -
          shopExpenses
      );

      return {
        jobCardCash,
        jobCardUpi,
        quickJobCash,
        quickJobUpi,
        advanceCash,
        advanceUpi,
        udhaarSettlementCash,
        udhaarSettlementUpi,
        totalCashIn,
        totalUpiIn,
        shopExpenses,
        staffUpad,
        cashExpenses,
        upiExpenses,
        scrapIncome,
        totalCashOut,
        netCashInGalla,
        totalRevenue,
        transferredToKhata,
        realNetProfit,
      };
    } catch (err) {
      console.error('Galla tally calculation error:', err);
      return {
        jobCardCash: 0,
        jobCardUpi: 0,
        quickJobCash: 0,
        quickJobUpi: 0,
        advanceCash: 0,
        advanceUpi: 0,
        udhaarSettlementCash: 0,
        udhaarSettlementUpi: 0,
        totalCashIn: 0,
        totalUpiIn: 0,
        shopExpenses: 0,
        staffUpad: 0,
        cashExpenses: 0,
        upiExpenses: 0,
        scrapIncome: 0,
        totalCashOut: 0,
        netCashInGalla: 0,
        totalRevenue: 0,
        transferredToKhata: 0,
        realNetProfit: 0,
      };
    }
  },

  // Record Scrap / Old Engine Oil Sale (Kabad Bikri)
  async recordScrapSale(
    shopId: string,
    title: string,
    amount: number,
    recordedBy: string
  ): Promise<boolean> {
    try {
      const { error } = await supabase.from('shop_expenses').insert({
        shop_id: shopId,
        expense_type: 'scrap_income',
        title: title.trim() || 'Old Scrap / Engine Oil Sale',
        amount: Math.max(0, amount),
        recorded_by: recordedBy,
        created_at: new Date().toISOString(),
      });
      return !error;
    } catch (err) {
      console.error('recordScrapSale error:', err);
      return false;
    }
  },

  // Record customer payment on Udhaar (Cash, UPI, Split + Galla Sync)
  async recordUdhaarPayment(
    customerId: string,
    amount: number,
    paymentMode: 'cash' | 'upi' | 'split',
    shopId: string,
    recordedBy: string,
    extra?: {
      cashAmount?: number;
      upiAmount?: number;
      utrNumber?: string;
    }
  ): Promise<boolean> {
    try {
      const { data: cust } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .single();

      if (!cust) return false;

      const totalSettleAmount = Math.max(0, Number(amount) || 0);
      let cashAmt = 0;
      let upiAmt = 0;

      if (paymentMode === 'cash') {
        cashAmt = totalSettleAmount;
        upiAmt = 0;
      } else if (paymentMode === 'upi') {
        cashAmt = 0;
        upiAmt = totalSettleAmount;
      } else {
        // split
        cashAmt = Math.max(0, Number(extra?.cashAmount || 0));
        upiAmt = Math.max(0, Number(extra?.upiAmount || 0));
        if (cashAmt + upiAmt !== totalSettleAmount) {
          if (cashAmt > 0 && upiAmt === 0) upiAmt = Math.max(0, totalSettleAmount - cashAmt);
          else if (upiAmt > 0 && cashAmt === 0) cashAmt = Math.max(0, totalSettleAmount - upiAmt);
          else {
            cashAmt = totalSettleAmount;
            upiAmt = 0;
          }
        }
      }

      const currentDue = Number(cust.current_due || 0);
      const newDue = Math.max(0, Math.round(((currentDue - totalSettleAmount) + Number.EPSILON) * 100) / 100);

      // 1. Update customer current_due in Supabase
      await supabase
        .from('customers')
        .update({ current_due: newDue })
        .eq('id', customerId);

      const refNo = extra?.utrNumber
        ? `UTR: ${extra.utrNumber}`
        : paymentMode === 'upi'
        ? 'UPI-RECOVERY'
        : paymentMode === 'split'
        ? 'SPLIT-PAYMENT'
        : 'CASH-COUNTER';

      const notes = paymentMode === 'split'
        ? `Udhaar cleared via SPLIT: Cash ₹${cashAmt} + UPI ₹${upiAmt}${extra?.utrNumber ? ` (UTR: ${extra.utrNumber})` : ''} - Received by ${recordedBy}`
        : `Udhaar cleared via ${paymentMode.toUpperCase()}: ₹${totalSettleAmount}${extra?.utrNumber ? ` (UTR: ${extra.utrNumber})` : ''} - Received by ${recordedBy}`;

      const recInvoiceNo = `REC-${Date.now().toString(36).toUpperCase().slice(-5)}`;
      const nowIso = new Date().toISOString();

      // 2. Insert into Supabase payments / khata_transactions (Defensive dual-write)
      const settlementRecord = {
        shop_id: shopId,
        customer_id: customerId,
        bike_number: cust.bike_number || 'N/A',
        type: 'UDHAAR_SETTLEMENT',
        transaction_type: 'UDHAAR_SETTLEMENT',
        payment_mode: paymentMode,
        amount: totalSettleAmount,
        cash_amount: cashAmt,
        upi_amount: upiAmt,
        utr_number: extra?.utrNumber || null,
        reference_no: refNo,
        recorded_by: recordedBy,
        notes: notes,
        created_at: nowIso,
      };

      try {
        await supabase.from('payments').insert(settlementRecord);
      } catch (pErr) {
        // Safe if table absent
      }

      try {
        await supabase.from('khata_transactions').insert(settlementRecord);
      } catch (kErr) {
        // Safe if table absent
      }

      // 3. Record audit dossier row for Customer 360 & Ledger
      await this.addCreditLedgerEntry({
        shop_id: shopId,
        customer_id: customerId,
        customer_name: cust.customer_name,
        customer_phone: cust.phone,
        bike_number: cust.bike_number,
        job_card_id: null,
        invoice_number: recInvoiceNo,
        transaction_type: 'udhaar_cleared',
        amount: totalSettleAmount,
        balance_after: newDue,
        reference_no: refNo,
        notes: notes,
        created_at: nowIso,
      });

      // 4. Record quick receipt for backward compatibility
      if (cashAmt > 0) {
        await supabase.from('quick_jobs').insert({
          shop_id: shopId,
          worker_id: 'payment-counter',
          worker_name: recordedBy,
          service_name: `Udhaar Settlement Cash (${cust.customer_name})`,
          default_price: cashAmt,
          final_price: cashAmt,
          is_price_modified: false,
          payment_mode: 'cash',
          created_at: nowIso,
        }).then(() => {});
      }
      if (upiAmt > 0) {
        await supabase.from('quick_jobs').insert({
          shop_id: shopId,
          worker_id: 'payment-counter',
          worker_name: recordedBy,
          service_name: `Udhaar Settlement UPI (${cust.customer_name})`,
          default_price: upiAmt,
          final_price: upiAmt,
          is_price_modified: false,
          payment_mode: 'upi',
          created_at: nowIso,
        }).then(() => {});
      }

      // 5. Reconcile all shop customer balances immediately
      await this.reconcileShopCustomerBalances(shopId);

      return true;
    } catch (err) {
      console.error('Record udhaar payment error:', err);
      return false;
    }
  },

  // ========================
  // STAFF ATTENDANCE & DUTY PUNCH
  // ========================
  async getTodayAttendance(
    shopId: string,
    staffId: string
  ): Promise<StaffAttendance | null> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('staff_attendance')
        .select('*')
        .eq('shop_id', shopId)
        .eq('staff_id', staffId)
        .eq('attendance_date', today)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error || !data || data.length === 0) return null;
      return data[0];
    } catch (err) {
      console.error('getTodayAttendance error:', err);
      return null;
    }
  },

  async punchIn(
    shopId: string,
    staffId: string,
    staffName: string,
    role: string
  ): Promise<StaffAttendance | null> {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Auto-close stale unclosed attendance records from prior dates
      const { data: staleRecords } = await supabase
        .from('staff_attendance')
        .select('*')
        .eq('shop_id', shopId)
        .eq('staff_id', staffId)
        .lt('attendance_date', today)
        .is('punch_out_time', null);

      if (staleRecords && staleRecords.length > 0) {
        for (const stale of staleRecords) {
          const staleIn = new Date(stale.punch_in_time);
          const staleOut = new Date(staleIn.getTime() + 8 * 3600 * 1000).toISOString();
          await supabase.from('staff_attendance').update({
            punch_out_time: staleOut,
            hours_worked: 8,
            day_credit: 1.0,
            status: 'present',
          }).eq('id', stale.id);
        }
      }

      // Check if already open today (prevent duplicate open attendance)
      const { data: openToday } = await supabase
        .from('staff_attendance')
        .select('*')
        .eq('shop_id', shopId)
        .eq('staff_id', staffId)
        .eq('attendance_date', today)
        .is('punch_out_time', null)
        .maybeSingle();

      if (openToday) {
        return openToday;
      }

      const punchInIso = new Date().toISOString();

      const { data, error } = await supabase
        .from('staff_attendance')
        .insert({
          shop_id: shopId,
          staff_id: staffId,
          staff_name: staffName,
          role: role,
          attendance_date: today,
          punch_in_time: punchInIso,
          status: 'present',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('punchIn error:', err);
      return null;
    }
  },

  async punchOut(attendanceId: string): Promise<{ success: boolean; hoursWorked: number; dayCredit: number; status: string }> {
    try {
      const { data: record, error: fetchErr } = await supabase
        .from('staff_attendance')
        .select('*')
        .eq('id', attendanceId)
        .single();

      if (fetchErr || !record) {
        return { success: false, hoursWorked: 0, dayCredit: 0, status: 'absent' };
      }

      const punchOutIso = new Date().toISOString();
      const inTime = new Date(record.punch_in_time).getTime();
      const outTime = new Date(punchOutIso).getTime();
      const diffMs = Math.max(0, outTime - inTime);
      const hoursWorked = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;

      let minFull = 6.0;
      let minHalf = 3.0;

      if (record.staff_id) {
        const { data: user } = await supabase
          .from('users')
          .select('min_full_day_hours, min_half_day_hours')
          .eq('id', record.staff_id)
          .single();

        if (user) {
          if (user.min_full_day_hours) minFull = Number(user.min_full_day_hours);
          if (user.min_half_day_hours) minHalf = Number(user.min_half_day_hours);
        }
      }

      let dayCredit = 0.0;
      let status: 'present' | 'half_day' | 'absent' = 'absent';

      if (hoursWorked >= minFull) {
        dayCredit = 1.0;
        status = 'present';
      } else if (hoursWorked >= minHalf) {
        dayCredit = 0.5;
        status = 'half_day';
      } else {
        dayCredit = 0.0;
        status = 'absent';
      }

      const { error } = await supabase
        .from('staff_attendance')
        .update({
          punch_out_time: punchOutIso,
          hours_worked: hoursWorked,
          day_credit: dayCredit,
          status: status,
        })
        .eq('id', attendanceId);

      return {
        success: !error,
        hoursWorked,
        dayCredit,
        status,
      };
    } catch (err) {
      console.error('punchOut error:', err);
      return { success: false, hoursWorked: 0, dayCredit: 0, status: 'absent' };
    }
  },

  async approveEarlyLeave(attendanceId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('staff_attendance')
        .update({
          is_owner_approved_early_leave: true,
          day_credit: 1.0,
          status: 'present',
        })
        .eq('id', attendanceId);

      return !error;
    } catch (err) {
      console.error('approveEarlyLeave error:', err);
      return false;
    }
  },

  async deleteAttendanceRecord(attendanceId: string): Promise<boolean> {
    try {
      const { error } = await supabase.from('staff_attendance').delete().eq('id', attendanceId);
      return !error;
    } catch (err) {
      console.error('deleteAttendanceRecord error:', err);
      return false;
    }
  },

  async updateAttendanceCredit(
    attendanceId: string,
    credit: number,
    status?: 'present' | 'half_day' | 'absent'
  ): Promise<boolean> {
    try {
      const updates: any = {
        day_credit: credit,
        status: status || (credit >= 1 ? 'present' : credit > 0 ? 'half_day' : 'absent'),
      };

      const { data: rec } = await supabase.from('staff_attendance').select('*').eq('id', attendanceId).single();
      if (rec) {
        if (!rec.punch_out_time && credit > 0) {
          updates.punch_out_time = new Date().toISOString();
        }
        updates.hours_worked = credit >= 1.0 ? 8 : credit >= 0.5 ? 4 : 0;
      }

      const { error } = await supabase.from('staff_attendance').update(updates).eq('id', attendanceId);
      return !error;
    } catch (err) {
      console.error('updateAttendanceCredit error:', err);
      return false;
    }
  },

  async forcePunchOutAttendance(attendanceId: string): Promise<boolean> {
    try {
      const { data: rec } = await supabase.from('staff_attendance').select('*').eq('id', attendanceId).single();
      const punchOutIso = new Date().toISOString();
      let hours = 8;
      if (rec && rec.punch_in_time) {
        const inMs = new Date(rec.punch_in_time).getTime();
        const outMs = new Date(punchOutIso).getTime();
        const diffHrs = Math.round((Math.max(0, outMs - inMs) / (1000 * 60 * 60)) * 10) / 10;
        hours = diffHrs > 0 ? diffHrs : 8;
      }
      const { error } = await supabase
        .from('staff_attendance')
        .update({
          punch_out_time: punchOutIso,
          hours_worked: hours,
          day_credit: hours >= 6 ? 1.0 : hours >= 3 ? 0.5 : 1.0,
          status: hours >= 3 ? (hours >= 6 ? 'present' : 'half_day') : 'present',
        })
        .eq('id', attendanceId);
      return !error;
    } catch (err) {
      console.error('forcePunchOutAttendance error:', err);
      return false;
    }
  },

  async punchWithPin(
    shopId: string,
    pin: string
  ): Promise<{ success: boolean; message: string; staffName?: string; action?: 'in' | 'out' }> {
    try {
      const { data: users, error: uErr } = await supabase
        .from('users')
        .select('*')
        .eq('shop_id', shopId)
        .eq('pin_code', pin.trim());

      if (uErr || !users || users.length === 0) {
        return { success: false, message: 'Invalid 4-digit PIN for this shop' };
      }

      const staff = users[0];
      const today = new Date().toISOString().split('T')[0];

      // Check existing open attendance today
      const { data: existing } = await supabase
        .from('staff_attendance')
        .select('*')
        .eq('shop_id', shopId)
        .eq('staff_id', staff.id)
        .eq('attendance_date', today)
        .order('created_at', { ascending: false })
        .limit(1);

      if (existing && existing.length > 0 && !existing[0].punch_out_time) {
        // Punch Out
        const outRes = await this.punchOut(existing[0].id);
        const dayLabel = outRes.dayCredit === 1 ? 'Full Day' : outRes.dayCredit === 0.5 ? 'Half Day' : 'Short/Absent';
        return {
          success: true,
          message: `${staff.full_name} punched OUT. Worked: ${outRes.hoursWorked}h (${dayLabel}).`,
          staffName: staff.full_name,
          action: 'out',
        };
      } else {
        // Punch In
        await this.punchIn(shopId, staff.id, staff.full_name, staff.role);
        return {
          success: true,
          message: `${staff.full_name} punched IN successfully. Have a great shift!`,
          staffName: staff.full_name,
          action: 'in',
        };
      }
    } catch (err: any) {
      return { success: false, message: err?.message || 'Punch error' };
    }
  },

  async getShopAttendanceToday(shopId: string): Promise<StaffAttendance[]> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('staff_attendance')
        .select('*')
        .eq('shop_id', shopId)
        .eq('attendance_date', today)
        .order('punch_in_time', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('getShopAttendanceToday error:', err);
      return [];
    }
  },

  async getShopAttendanceMonthly(shopId: string): Promise<StaffAttendance[]> {
    try {
      const d = new Date();
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const firstDay = `${year}-${month}-01`;
      const { data, error } = await supabase
        .from('staff_attendance')
        .select('*')
        .eq('shop_id', shopId)
        .gte('attendance_date', firstDay)
        .order('attendance_date', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('getShopAttendanceMonthly error:', err);
      return [];
    }
  },

  // ========================
  // APPROVALS (Credit Override & Discounts)
  // ========================
  async requestCreditOverride(
    jobCardId: string,
    requestedShortfall?: number,
    totalBill?: number
  ): Promise<boolean> {
    try {
      const updates: any = {
        credit_override_status: 'pending',
      };
      if (typeof requestedShortfall === 'number') {
        updates.mandatory_cash_to_collect = requestedShortfall;
      }
      if (typeof totalBill === 'number') {
        updates.total_bill = totalBill;
      }
      const { error } = await supabase
        .from('job_cards')
        .update(updates)
        .eq('id', jobCardId);
      return !error;
    } catch (err) {
      console.error('requestCreditOverride error:', err);
      return false;
    }
  },

  async approveCreditOverride(
    jobCardId: string,
    status: 'approved' | 'rejected',
    customAmount?: number
  ): Promise<boolean> {
    try {
      const { data: card } = await supabase
        .from('job_cards')
        .select('*')
        .eq('id', jobCardId)
        .single();

      if (status === 'approved') {
        const grandTotal = Number(card?.total_bill || 0);
        const approvedCredit =
          typeof customAmount === 'number' && customAmount > 0
            ? customAmount
            : Number(card?.credit_override_amount || card?.mandatory_cash_to_collect || grandTotal);
        const mandatoryPaid = Math.max(0, grandTotal - approvedCredit);

        const { error } = await supabase
          .from('job_cards')
          .update({
            credit_override_status: 'approved',
            credit_override_amount: approvedCredit,
            approved_credit_amount: approvedCredit,
            mandatory_paid_amount: mandatoryPaid,
            transferred_to_khata: approvedCredit,
            mandatory_cash_to_collect: mandatoryPaid,
          })
          .eq('id', jobCardId);

        return !error;
      }

      const { error } = await supabase
        .from('job_cards')
        .update({
          credit_override_status: 'rejected',
          approved_credit_amount: 0,
          mandatory_paid_amount: Number(card?.total_bill || 0),
          mandatory_cash_to_collect: Number(card?.total_bill || 0),
          transferred_to_khata: 0,
        })
        .eq('id', jobCardId);
      return !error;
    } catch (err) {
      console.error('approveCreditOverride error:', err);
      return false;
    }
  },

  async requestDiscountApproval(
    jobCardId: string,
    extraDiscount: number
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('job_cards')
        .update({
          extra_discount: extraDiscount,
          discount_approval_status: 'pending',
        })
        .eq('id', jobCardId);
      return !error;
    } catch (err) {
      console.error('requestDiscountApproval error:', err);
      return false;
    }
  },

  async approveDiscount(
    jobCardId: string,
    status: 'approved' | 'rejected'
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('job_cards')
        .update({
          discount_approval_status: status,
        })
        .eq('id', jobCardId);
      return !error;
    } catch (err) {
      console.error('approveDiscount error:', err);
      return false;
    }
  },

  async getPendingApprovals(shopId: string): Promise<JobCard[]> {
    try {
      const { data, error } = await supabase
        .from('job_cards')
        .select('*, customer:customers(*), mechanic:users(*)')
        .eq('shop_id', shopId)
        .or('credit_override_status.eq.pending,discount_approval_status.eq.pending');

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('getPendingApprovals error:', err);
      return [];
    }
  },

  async deductManagerDailyWallet(
    userId: string,
    amount: number
  ): Promise<boolean> {
    try {
      const { data: user } = await supabase
        .from('users')
        .select('daily_wallet_used')
        .eq('id', userId)
        .single();

      if (!user) return false;
      const newUsed = (user.daily_wallet_used || 0) + amount;
      const { error } = await supabase
        .from('users')
        .update({ daily_wallet_used: newUsed })
        .eq('id', userId);

      return !error;
    } catch (err) {
      console.error('deductManagerDailyWallet error:', err);
      return false;
    }
  },

  // ========================
  // SHOP SETTINGS & STOCK INCREMENT
  // ========================
  async updateShopSettings(
    shopId: string,
    updates: Partial<Shop>
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('shops')
        .update(updates)
        .eq('id', shopId);
      return !error;
    } catch (err) {
      console.error('updateShopSettings error:', err);
      return false;
    }
  },

  async incrementStock(itemId: string, delta: number): Promise<boolean> {
    try {
      const { data: item } = await supabase
        .from('inventory')
        .select('stock_quantity')
        .eq('id', itemId)
        .single();

      if (!item) return false;
      const newQty = Math.max(0, (item.stock_quantity || 0) + delta);
      const { error } = await supabase
        .from('inventory')
        .update({
          stock_quantity: newQty,
          updated_at: new Date().toISOString(),
        })
        .eq('id', itemId);

      return !error;
    } catch (err) {
      console.error('incrementStock error:', err);
      return false;
    }
  },

  // ========================
  // HISTORICAL REPORT DATA (7-Day / 30-Day)
  // ========================
  async getHistoricalReportData(shopId: string, daysOrMonth: number | string) {
    try {
      let startIso: string;
      let endIso: string | undefined;

      if (typeof daysOrMonth === 'string' && daysOrMonth.includes('-')) {
        const [y, m] = daysOrMonth.split('-').map(Number);
        const start = new Date(y, m - 1, 1, 0, 0, 0);
        const end = new Date(y, m, 0, 23, 59, 59, 999);
        startIso = start.toISOString();
        endIso = end.toISOString();
      } else {
        const days = typeof daysOrMonth === 'number' ? daysOrMonth : 30;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        startIso = startDate.toISOString();
      }

      let cardsQuery = supabase
        .from('job_cards')
        .select('*, customer:customers(*), mechanic:users(*)')
        .eq('shop_id', shopId)
        .gte('created_at', startIso)
        .order('created_at', { ascending: false });

      let quickQuery = supabase
        .from('quick_jobs')
        .select('*')
        .eq('shop_id', shopId)
        .gte('created_at', startIso)
        .order('created_at', { ascending: false });

      let expQuery = supabase
        .from('shop_expenses')
        .select('*')
        .eq('shop_id', shopId)
        .gte('created_at', startIso)
        .order('created_at', { ascending: false });

      let attQuery = supabase
        .from('staff_attendance')
        .select('*')
        .eq('shop_id', shopId)
        .gte('attendance_date', startIso.split('T')[0])
        .order('attendance_date', { ascending: false });

      if (endIso) {
        cardsQuery = cardsQuery.lte('created_at', endIso);
        quickQuery = quickQuery.lte('created_at', endIso);
        expQuery = expQuery.lte('created_at', endIso);
        attQuery = attQuery.lte('attendance_date', endIso.split('T')[0]);
      }

      const [cardsRes, quickRes, expRes, attRes] = await Promise.all([
        cardsQuery,
        quickQuery,
        expQuery,
        attQuery,
      ]);

      return {
        jobCards: cardsRes.data || [],
        quickJobs: quickRes.data || [],
        expenses: expRes.data || [],
        attendance: attRes.data || [],
      };
    } catch (err) {
      console.error('getHistoricalReportData error:', err);
      return { jobCards: [], quickJobs: [], expenses: [], attendance: [] };
    }
  },

  // ========================
  // STAFF PERFORMANCE STATS
  // ========================
  async getStaffStats(shopId: string) {
    try {
      const [cards, quicks] = await Promise.all([
        supabase
          .from('job_cards')
          .select('mechanic_id, status')
          .eq('shop_id', shopId)
          .eq('status', 'completed'),
        supabase
          .from('quick_jobs')
          .select('worker_id')
          .eq('shop_id', shopId),
      ]);

      const stats: Record<string, { bikesCompleted: number; quickJobsDone: number }> = {};

      (cards.data || []).forEach((c) => {
        if (c.mechanic_id) {
          if (!stats[c.mechanic_id]) stats[c.mechanic_id] = { bikesCompleted: 0, quickJobsDone: 0 };
          stats[c.mechanic_id].bikesCompleted += 1;
        }
      });

      (quicks.data || []).forEach((q) => {
        if (q.worker_id) {
          if (!stats[q.worker_id]) stats[q.worker_id] = { bikesCompleted: 0, quickJobsDone: 0 };
          stats[q.worker_id].quickJobsDone += 1;
        }
      });

      return stats;
    } catch (err) {
      console.error('getStaffStats error:', err);
      return {};
    }
  },

  // ========================
  // DISTRIBUTORS / SUPPLIERS
  // ========================
  async getDistributors(shopId: string): Promise<Distributor[]> {
    try {
      const { data, error } = await supabase
        .from('distributors')
        .select('*')
        .or(`shop_id.eq.${shopId},shop_id.is.null`)
        .order('distributor_name', { ascending: true });

      if (error) {
        console.error('getDistributors error:', error);
        return [];
      }
      return data || [];
    } catch (err) {
      console.error('getDistributors error:', err);
      return [];
    }
  },

  async saveDistributor(distributor: Partial<Distributor> & { shop_id: string }): Promise<Distributor | null> {
    try {
      if (distributor.id) {
        const { data, error } = await supabase
          .from('distributors')
          .update({
            distributor_name: distributor.distributor_name,
            phone: distributor.phone,
            supplied_categories: distributor.supplied_categories || 'All Parts',
          })
          .eq('id', distributor.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('distributors')
          .insert({
            shop_id: distributor.shop_id,
            distributor_name: distributor.distributor_name,
            phone: distributor.phone,
            supplied_categories: distributor.supplied_categories || 'All Parts',
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    } catch (err) {
      console.error('saveDistributor error:', err);
      return null;
    }
  },

  async deleteDistributor(id: string): Promise<boolean> {
    try {
      const { error } = await supabase.from('distributors').delete().eq('id', id);
      return !error;
    } catch (err) {
      console.error('deleteDistributor error:', err);
      return false;
    }
  },

  // ========================
  // STAFF APPOINTMENT & PASSBOOK
  // ========================
  async saveStaffUser(userData: Partial<User> & { shop_id: string }): Promise<User | null> {
    try {
      if (userData.id) {
        const { data, error } = await supabase
          .from('users')
          .update({
            full_name: userData.full_name,
            phone: userData.phone,
            pin_code: userData.pin_code,
            role: userData.role,
            designation: userData.designation || null,
            monthly_salary: userData.monthly_salary,
            target_duty_hours: userData.target_duty_hours ?? 10,
            min_full_day_hours: userData.min_full_day_hours ?? 8,
            min_half_day_hours: userData.min_half_day_hours ?? 4.5,
          })
          .eq('id', userData.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('users')
          .insert({
            shop_id: userData.shop_id,
            full_name: userData.full_name,
            phone: userData.phone,
            pin_code: userData.pin_code || '1234',
            role: userData.role || 'mechanic',
            designation: userData.designation || (userData.role === 'manager' ? 'Floor Manager' : 'Senior Mechanic'),
            monthly_salary: userData.monthly_salary || 12000,
            target_duty_hours: userData.target_duty_hours ?? 10,
            min_full_day_hours: userData.min_full_day_hours ?? 8,
            min_half_day_hours: userData.min_half_day_hours ?? 4.5,
            daily_wallet_limit: userData.role === 'manager' ? 2000 : 0,
            daily_wallet_used: 0,
            total_upad_taken: 0,
            absent_days: 0,
            is_temp_manager: false,
            temp_manager_expires_at: null,
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    } catch (err) {
      console.error('saveStaffUser error:', err);
      return null;
    }
  },

  async getStaffPayments(shopId: string, staffId?: string): Promise<StaffPayment[]> {
    const cacheKey = `staff_payments_${shopId}`;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const allCached = offlineStorage.getCache<StaffPayment[]>(cacheKey, []);
      if (staffId) return allCached.filter((p) => p.staff_id === staffId);
      return allCached;
    }

    try {
      let query = supabase
        .from('staff_payments')
        .select('*')
        .or(`shop_id.eq.${shopId},shop_id.is.null`)
        .order('created_at', { ascending: false });

      if (staffId) {
        query = query.eq('staff_id', staffId);
      }

      const { data, error } = await query;
      if (error || !data) {
        const allCached = offlineStorage.getCache<StaffPayment[]>(cacheKey, []);
        if (staffId) return allCached.filter((p) => p.staff_id === staffId);
        return allCached;
      }
      if (!staffId) {
        offlineStorage.setCache(cacheKey, data);
      }
      return data;
    } catch {
      const allCached = offlineStorage.getCache<StaffPayment[]>(cacheKey, []);
      if (staffId) return allCached.filter((p) => p.staff_id === staffId);
      return allCached;
    }
  },

  async recordStaffPayment(params: {
    shop_id: string;
    staff_id: string;
    staff_name: string;
    payment_type: StaffPaymentType;
    amount: number;
    payment_mode: 'cash' | 'upi';
    notes?: string;
    recorded_by?: string;
  }): Promise<StaffPayment | null> {
    try {
      const { data, error } = await supabase
        .from('staff_payments')
        .insert({
          shop_id: params.shop_id,
          staff_id: params.staff_id,
          staff_name: params.staff_name,
          payment_type: params.payment_type,
          amount: params.amount,
          payment_mode: params.payment_mode,
          notes: params.notes || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Sync into shop_expenses for Galla accounting
      if (params.payment_type === 'upad_advance') {
        await supabase.from('shop_expenses').insert({
          shop_id: params.shop_id,
          expense_type: 'staff_upad',
          staff_id: params.staff_id,
          staff_name: params.staff_name,
          title: `Staff Upad: ${params.staff_name} (${params.notes || 'Advance'})`,
          amount: params.amount,
          payment_mode: params.payment_mode,
          category: 'Staff Advance (Upad)',
          recorded_by: params.recorded_by || 'Owner',
        });

        const { data: user } = await supabase
          .from('users')
          .select('total_upad_taken')
          .eq('id', params.staff_id)
          .single();

        if (user) {
          await supabase
            .from('users')
            .update({ total_upad_taken: (user.total_upad_taken || 0) + params.amount })
            .eq('id', params.staff_id);
        }
      } else if (params.payment_type === 'salary_payout') {
        await supabase.from('shop_expenses').insert({
          shop_id: params.shop_id,
          expense_type: 'shop_expense',
          staff_id: params.staff_id,
          staff_name: params.staff_name,
          title: `Salary Payout: ${params.staff_name}`,
          amount: params.amount,
          payment_mode: params.payment_mode,
          category: 'Staff Salary',
          recorded_by: params.recorded_by || 'Owner',
        });

        // Reset total_upad_taken to 0 upon monthly salary payout settlement
        await supabase
          .from('users')
          .update({ total_upad_taken: 0 })
          .eq('id', params.staff_id);
      } else {
        await supabase.from('shop_expenses').insert({
          shop_id: params.shop_id,
          expense_type: 'shop_expense',
          staff_id: params.staff_id,
          staff_name: params.staff_name,
          title: `Staff Bonus: ${params.staff_name}`,
          amount: params.amount,
          payment_mode: params.payment_mode,
          category: 'Staff Bonus',
          recorded_by: params.recorded_by || 'Owner',
        });
      }

      return data;
    } catch (err) {
      console.error('recordStaffPayment error:', err);
      return null;
    }
  },

  async deleteStaffPayment(paymentId: string): Promise<boolean> {
    try {
      const { data: payment } = await supabase
        .from('staff_payments')
        .select('*')
        .eq('id', paymentId)
        .single();

      if (payment) {
        // If it was upad, reduce total_upad_taken
        if (payment.payment_type === 'upad_advance' && payment.staff_id) {
          const { data: user } = await supabase
            .from('users')
            .select('total_upad_taken')
            .eq('id', payment.staff_id)
            .single();
          if (user) {
            const newUpad = Math.max(0, (user.total_upad_taken || 0) - (payment.amount || 0));
            await supabase.from('users').update({ total_upad_taken: newUpad }).eq('id', payment.staff_id);
          }
        }
        // Also remove corresponding shop_expenses record
        await supabase
          .from('shop_expenses')
          .delete()
          .eq('staff_id', payment.staff_id)
          .eq('amount', payment.amount);
      }

      const { error } = await supabase.from('staff_payments').delete().eq('id', paymentId);
      return !error;
    } catch (err) {
      console.error('deleteStaffPayment error:', err);
      return false;
    }
  },

  // Unified Staff Upad Action across App
  async recordStaffUpad(params: {
    shop_id: string;
    staff_id: string;
    staff_name: string;
    amount: number;
    payment_mode?: 'cash' | 'upi';
    notes?: string;
    recorded_by?: string;
  }): Promise<boolean> {
    const res = await this.recordStaffPayment({
      shop_id: params.shop_id,
      staff_id: params.staff_id,
      staff_name: params.staff_name,
      payment_type: 'upad_advance',
      amount: Math.max(0, params.amount),
      payment_mode: params.payment_mode || 'cash',
      notes: params.notes || 'Staff Upad Advance',
      recorded_by: params.recorded_by || 'Owner',
    });
    return !!res;
  },

  // Auto-sync / backfill any past upad advance discrepancy so passbook and outer card match 100%
  async syncStaffUpadPassbook(shopId: string, users: User[]): Promise<void> {
    try {
      const allPayments = await this.getStaffPayments(shopId);
      for (const u of users) {
        if (u.role === 'owner') continue;
        const totalPaymentsUpad = allPayments
          .filter((p) => p.staff_id === u.id && p.payment_type === 'upad_advance')
          .reduce((sum, p) => sum + (p.amount || 0), 0);

        if ((u.total_upad_taken || 0) > totalPaymentsUpad) {
          const diff = (u.total_upad_taken || 0) - totalPaymentsUpad;
          await supabase.from('staff_payments').insert({
            shop_id: shopId,
            staff_id: u.id,
            staff_name: u.full_name,
            payment_type: 'upad_advance',
            amount: diff,
            payment_mode: 'cash',
            notes: 'Previous Upad Advance Balance',
            created_at: new Date().toISOString(),
          });
        } else if (totalPaymentsUpad > (u.total_upad_taken || 0)) {
          await supabase.from('users').update({ total_upad_taken: totalPaymentsUpad }).eq('id', u.id);
        }
      }
    } catch (e) {
      console.warn('syncStaffUpadPassbook error:', e);
    }
  },

  async getStaffAttendanceDossier(
    shopId: string,
    staffId: string,
    monthsRange: number
  ): Promise<StaffAttendance[]> {
    try {
      let query = supabase
        .from('staff_attendance')
        .select('*')
        .eq('shop_id', shopId)
        .eq('staff_id', staffId)
        .order('attendance_date', { ascending: false });

      if (monthsRange < 90) {
        const d = new Date();
        d.setDate(1);
        d.setMonth(d.getMonth() - monthsRange + 1);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const cutoff = `${year}-${month}-01`;
        query = query.gte('attendance_date', cutoff);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('getStaffAttendanceDossier error:', err);
      return [];
    }
  },

  // ========================
  // CUSTOMER EDIT & 360 HISTORY
  // ========================
  async updateCustomer(customerId: string, updates: Partial<Customer>): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('customers')
        .update(updates)
        .eq('id', customerId);
      return !error;
    } catch (err) {
      console.error('updateCustomer error:', err);
      return false;
    }
  },

  async getCustomer360History(
    shopId: string,
    customerId: string
  ): Promise<{
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
  }> {
    try {
      const clean = (str: string = '') => str.replace(/[^A-Z0-9]/gi, '').toUpperCase();
      const cleanPhone = (p: string = '') => p.replace(/\D/g, '').slice(-10);

      const [custRes, allCardsRes, ledgerEntries, quickJobsRes] = await Promise.all([
        supabase
          .from('customers')
          .select('*')
          .eq('id', customerId)
          .single(),
        supabase
          .from('job_cards')
          .select('*, items:job_card_items(*), mechanic:users(*)')
          .eq('shop_id', shopId)
          .order('created_at', { ascending: false }),
        this.getCreditLedger(shopId, customerId),
        supabase
          .from('quick_jobs')
          .select('*')
          .eq('shop_id', shopId)
          .order('created_at', { ascending: false }),
      ]);

      const customer: Customer | null = custRes.data || null;
      const allCards = allCardsRes.data || [];
      const quickJobs = quickJobsRes.data || [];

      const custCleanBike = clean(customer?.bike_number);
      const custPhone10 = cleanPhone(customer?.phone);
      const custAltPhone10 = cleanPhone(customer?.alt_phone || '');

      // 3-way fallback match: customer_id OR normalized 10-digit phone OR bike_number
      const jobCards = allCards.filter((jc: any) => {
        if (jc.customer_id === customerId) return true;
        const jcPhone10 = cleanPhone(jc.customer_phone || jc.customer?.phone || '');
        if (custPhone10 && jcPhone10 && (jcPhone10 === custPhone10 || jcPhone10 === custAltPhone10)) {
          if (!jc.customer_id) {
            jc.customer_id = customerId;
            supabase.from('job_cards').update({ customer_id: customerId }).eq('id', jc.id).then(() => {});
          }
          return true;
        }
        if (custCleanBike && clean(jc.bike_number) === custCleanBike) {
          if (!jc.customer_id) {
            jc.customer_id = customerId;
            supabase.from('job_cards').update({ customer_id: customerId }).eq('id', jc.id).then(() => {});
          }
          return true;
        }
        return false;
      });

      // Match Quick Jobs for this customer
      const matchingQuickJobs = quickJobs.filter((q: any) => {
        if (q.service_name?.toLowerCase().includes('udhaar')) return false;
        const qPhone = cleanPhone((q as any).phone || (q as any).customer_phone || '');
        if (custPhone10 && qPhone && (qPhone === custPhone10 || qPhone === custAltPhone10)) return true;
        const qBike = clean((q as any).bike_number || '');
        if (custCleanBike && qBike && qBike === custCleanBike) return true;
        if (customer?.customer_name && (q as any).customer_name?.toLowerCase() === customer.customer_name.toLowerCase()) return true;
        return false;
      });

      // 1. Calculate true accurate single-source-of-truth metrics for this customer
      const completedCards = jobCards.filter((jc: any) => jc.status === 'completed');
      const cardsGross = completedCards.reduce((sum: number, jc: any) => sum + (Number(jc.total_bill) || 0), 0);
      const quickJobsGross = matchingQuickJobs.reduce((sum: number, q: any) => sum + (Number(q.final_price) || 0), 0);
      const totalGrossBilled = cardsGross + quickJobsGross;

      const totalAdvancePaid = completedCards.reduce((sum: number, jc: any) => sum + (Number(jc.advance_paid) || 0), 0);

      let totalCashPaid = 0;
      let totalUpiPaid = 0;

      completedCards.forEach((jc: any) => {
        const gross = Number(jc.total_bill || 0);
        const adv = Number(jc.advance_paid || 0);
        const net = Math.max(0, gross - adv);
        const khata = Number(jc.transferred_to_khata || 0);

        let cash = Number(jc.cash_collected ?? jc.mandatory_cash_to_collect ?? 0);
        let upi = Number(jc.upi_collected || 0);
        const expectedDeliv = Math.max(0, net - khata);
        if (cash + upi === 0 && expectedDeliv > 0) {
          if (jc.payment_mode === 'upi' || jc.upi_ref_number) upi = expectedDeliv;
          else cash = expectedDeliv;
        }
        totalCashPaid += cash;
        totalUpiPaid += upi;
      });

      matchingQuickJobs.forEach((q: any) => {
        if (q.payment_mode === 'cash') totalCashPaid += Number(q.final_price || 0);
        else totalUpiPaid += Number(q.final_price || 0);
      });

      const totalUdhaarSettled = ledgerEntries
        .filter((l: any) => l.transaction_type === 'udhaar_cleared')
        .reduce((sum: number, l: any) => sum + (Number(l.amount) || 0), 0);

      // Deterministic mathematical formula:
      // NET UDHAAR DUE = TOTAL GROSS BILLED - (TOTAL ADVANCE PAID + CASH + UPI PAID + TOTAL UDHAAR SETTLED)
      const accurateCurrentDue = Math.max(
        0,
        Math.round(((totalGrossBilled - (totalAdvancePaid + totalCashPaid + totalUpiPaid + totalUdhaarSettled)) + Number.EPSILON) * 100) / 100
      );

      const totalUdhaarIncurred = Math.round((accurateCurrentDue + totalUdhaarSettled + Number.EPSILON) * 100) / 100;

      if (customer) {
        customer.current_due = accurateCurrentDue;
        supabase.from('customers').update({ current_due: accurateCurrentDue }).eq('id', customerId).then(() => {});
      }

      // 2. Build clean, non-duplicate audit dossier ledger entries
      const cleanEntries: CreditLedgerEntry[] = [];
      const seenCardTypes = new Set<string>();

      // First include real settlements (udhaar_cleared) from ledgerEntries
      for (const entry of ledgerEntries) {
        if (entry.transaction_type === 'udhaar_cleared') {
          cleanEntries.push(entry);
        } else if (entry.job_card_id) {
          const key = `${entry.job_card_id}_${entry.transaction_type}`;
          if (!seenCardTypes.has(key)) {
            seenCardTypes.add(key);
            cleanEntries.push(entry);
          }
        } else {
          cleanEntries.push(entry);
        }
      }

      // Next synthesize any missing completed job card entries
      for (const jc of completedCards) {
        const total = Number(jc.total_bill || 0);
        const advance = Number(jc.advance_paid || 0);
        const khata = Number(jc.transferred_to_khata || 0);
        const net = Math.max(0, total - advance);

        let cash = Number(jc.cash_collected ?? jc.mandatory_cash_to_collect ?? 0);
        let upi = Number(jc.upi_collected || 0);
        const expectedDeliv = Math.max(0, net - khata);
        if (cash + upi === 0 && expectedDeliv > 0) {
          if (jc.payment_mode === 'upi' || jc.upi_ref_number) upi = expectedDeliv;
          else cash = expectedDeliv;
        }

        const date = jc.billed_at || jc.created_at;
        const invNum = jc.invoice_number || `INV-${jc.id.slice(-4).toUpperCase()}`;

        if (advance > 0 && !seenCardTypes.has(`${jc.id}_advance_paid`)) {
          seenCardTypes.add(`${jc.id}_advance_paid`);
          cleanEntries.push({
            id: `adv_${jc.id}`,
            shop_id: shopId,
            customer_id: customerId,
            customer_name: customer?.customer_name,
            bike_number: jc.bike_number,
            job_card_id: jc.id,
            invoice_number: invNum,
            transaction_type: 'cash_paid',
            amount: advance,
            balance_after: 0,
            reference_no: 'ADVANCE-PAID',
            notes: 'Advance deposit at vehicle intake',
            created_at: jc.created_at || date,
          });
        }

        if (cash > 0 && !seenCardTypes.has(`${jc.id}_cash_paid`)) {
          seenCardTypes.add(`${jc.id}_cash_paid`);
          cleanEntries.push({
            id: `cash_${jc.id}`,
            shop_id: shopId,
            customer_id: customerId,
            customer_name: customer?.customer_name,
            bike_number: jc.bike_number,
            job_card_id: jc.id,
            invoice_number: invNum,
            transaction_type: 'cash_paid',
            amount: cash,
            balance_after: 0,
            reference_no: 'CASH-COUNTER',
            notes: 'Cash payment collected at handover',
            created_at: date,
          });
        }

        if (upi > 0 && !seenCardTypes.has(`${jc.id}_upi_received`)) {
          seenCardTypes.add(`${jc.id}_upi_received`);
          cleanEntries.push({
            id: `upi_${jc.id}`,
            shop_id: shopId,
            customer_id: customerId,
            customer_name: customer?.customer_name,
            bike_number: jc.bike_number,
            job_card_id: jc.id,
            invoice_number: invNum,
            transaction_type: 'upi_received',
            amount: upi,
            balance_after: 0,
            reference_no: jc.upi_ref_number || 'UPI-QR',
            notes: 'UPI payment received at handover',
            created_at: date,
          });
        }

        if (khata > 0 && !seenCardTypes.has(`${jc.id}_udhaar_incurred`)) {
          seenCardTypes.add(`${jc.id}_udhaar_incurred`);
          cleanEntries.push({
            id: `khata_${jc.id}`,
            shop_id: shopId,
            customer_id: customerId,
            customer_name: customer?.customer_name,
            bike_number: jc.bike_number,
            job_card_id: jc.id,
            invoice_number: invNum,
            transaction_type: 'udhaar_incurred',
            amount: khata,
            balance_after: 0,
            reference_no: 'KHATA-DEBIT',
            notes: 'Bill balance transferred to Khata (Udhaar)',
            created_at: date,
          });
        }
      }

      // Sort chronologically (oldest to newest):
      // advance_paid and cash/upi payments are ordered BEFORE udhaar_incurred so running balance is true
      const typePriority: Record<string, number> = {
        cash_paid: 1,
        upi_received: 2,
        udhaar_incurred: 3,
        udhaar_cleared: 4,
      };

      cleanEntries.sort((a, b) => {
        const timeDiff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        if (timeDiff !== 0) return timeDiff;
        return (typePriority[a.transaction_type] || 0) - (typePriority[b.transaction_type] || 0);
      });

      let runningKhata = 0;
      for (const entry of cleanEntries) {
        if (entry.transaction_type === 'udhaar_incurred') {
          runningKhata = Math.round((runningKhata + Number(entry.amount || 0) + Number.EPSILON) * 100) / 100;
        } else if (entry.transaction_type === 'udhaar_cleared') {
          runningKhata = Math.max(0, Math.round((runningKhata - Number(entry.amount || 0) + Number.EPSILON) * 100) / 100);
        }
        entry.balance_after = runningKhata;
      }

      // Reverse so most recent transaction appears first in table
      cleanEntries.reverse();

      return {
        customer,
        jobCards,
        ledgerEntries: cleanEntries,
        metrics: {
          totalVisits: completedCards.length + matchingQuickJobs.length,
          totalGrossBilled,
          totalAdvancePaid,
          totalCashPaid,
          totalUpiPaid,
          totalUdhaarIncurred,
          totalUdhaarSettled,
          accurateCurrentDue,
        },
      };
    } catch (err) {
      console.error('getCustomer360History error:', err);
      return { customer: null, jobCards: [], ledgerEntries: [] };
    }
  },

  // ========================
  // OWNER-ONLY QUICK JOB EDIT & LIVE RECALCULATION
  // ========================
  async ownerQuickEditJobCard(
    jobCardId: string,
    shopId: string,
    data: {
      customer_name?: string;
      customer_phone?: string;
      bike_number?: string;
      bike_model?: string;
      odometer_km?: number;
      status?: JobCard['status'];
      items?: any[];
      labour_charge?: number;
      consumable_charge?: number;
      outside_work_customer_price?: number;
      outside_work_shop_cost?: number;
      outside_work_desc?: string;
      extra_discount?: number;
      advance_paid?: number;
      cash_collected?: number;
      upi_collected?: number;
      transferred_to_khata?: number;
      upi_ref_number?: string | null;
    },
    ownerName: string
  ): Promise<{ success: boolean; jobCard?: JobCard; error?: string }> {
    try {
      const items = data.items || [];
      const partsTotal = items.reduce(
        (sum, it) => sum + (Number(it.unit_price) || 0) * (Number(it.quantity) || 1),
        0
      );
      const labour = Math.round((Number(data.labour_charge || 0) + Number.EPSILON) * 100) / 100;
      const outside = Math.round((Number(data.outside_work_customer_price || 0) + Number.EPSILON) * 100) / 100;
      const consumable = Math.round((Number(data.consumable_charge !== undefined ? data.consumable_charge : 20) + Number.EPSILON) * 100) / 100;
      const discount = Math.round((Number(data.extra_discount || 0) + Number.EPSILON) * 100) / 100;

      const subtotal = Math.round((partsTotal + labour + outside + consumable + Number.EPSILON) * 100) / 100;
      const grossTotal = Math.max(0, subtotal - discount);

      const advancePaid = Math.round((Number(data.advance_paid || 0) + Number.EPSILON) * 100) / 100;
      const cashCollected = Math.round((Number(data.cash_collected || 0) + Number.EPSILON) * 100) / 100;
      const upiCollected = Math.round((Number(data.upi_collected || 0) + Number.EPSILON) * 100) / 100;

      const netPayable = Math.max(0, grossTotal - advancePaid);
      const deliveryPaid = cashCollected + upiCollected;

      let transferredToKhata = data.transferred_to_khata !== undefined
        ? Math.max(0, Math.round((Number(data.transferred_to_khata) + Number.EPSILON) * 100) / 100)
        : Math.max(0, Math.round((netPayable - deliveryPaid + Number.EPSILON) * 100) / 100);

      const updatePayload: any = {
        labour_charge: labour,
        consumable_charge: consumable,
        outside_work_customer_price: outside,
        outside_work_shop_cost: Math.round((Number(data.outside_work_shop_cost || 0) + Number.EPSILON) * 100) / 100,
        outside_work_desc: data.outside_work_desc || '',
        extra_discount: discount,
        total_bill: grossTotal,
        advance_paid: advancePaid,
        cash_collected: cashCollected,
        mandatory_cash_to_collect: cashCollected,
        upi_collected: upiCollected,
        transferred_to_khata: transferredToKhata,
        upi_ref_number: data.upi_ref_number || null,
        updated_at: new Date().toISOString(),
      };

      if (data.bike_number) updatePayload.bike_number = data.bike_number.trim().toUpperCase();
      if (data.odometer_km !== undefined) updatePayload.odometer_km = Number(data.odometer_km);
      if (data.status) updatePayload.status = data.status;

      // 1. Update job card core fields
      const { data: updatedCard, error: jcErr } = await supabase
        .from('job_cards')
        .update(updatePayload)
        .eq('id', jobCardId)
        .select('*, items:job_card_items(*), mechanic:users(*)')
        .single();

      if (jcErr) {
        console.warn('Update job_cards error in ownerQuickEdit, retrying with core columns:', jcErr);
      }

      // 2. Update job_card_items: delete existing and reinsert updated items
      if (items.length > 0) {
        await supabase.from('job_card_items').delete().eq('job_card_id', jobCardId);
        const itemsToInsert = items.map((it) => ({
          shop_id: shopId,
          job_card_id: jobCardId,
          part_id: it.part_id || null,
          item_name: it.item_name || 'Service Item',
          quantity: Math.max(1, Number(it.quantity || 1)),
          unit_price: Math.max(0, Number(it.unit_price || 0)),
          is_unlisted_manual: !!it.is_unlisted_manual,
          added_by_name: it.added_by_name || ownerName,
          warranty_months: Number(it.warranty_months || 0),
          price_pending_inspection: false,
          created_at: it.created_at || new Date().toISOString(),
        }));
        await supabase.from('job_card_items').insert(itemsToInsert);
      }

      // 3. Update customer info if name or phone changed
      if (data.customer_name || data.customer_phone) {
        const custId = updatedCard?.customer_id;
        if (custId) {
          const custUpdate: any = {};
          if (data.customer_name) custUpdate.customer_name = data.customer_name.trim();
          if (data.customer_phone) custUpdate.phone = data.customer_phone.trim();
          if (data.bike_number) custUpdate.bike_number = data.bike_number.trim().toUpperCase();
          if (data.bike_model) custUpdate.bike_model = data.bike_model.trim();
          await supabase.from('customers').update(custUpdate).eq('id', custId);
        }
      }

      // 4. Record audit ledger entry
      await this.addCreditLedgerEntry({
        shop_id: shopId,
        customer_id: updatedCard?.customer_id || 'UNKNOWN',
        customer_name: data.customer_name || updatedCard?.bike_number,
        customer_phone: data.customer_phone,
        bike_number: data.bike_number || updatedCard?.bike_number,
        job_card_id: jobCardId,
        invoice_number: updatedCard?.invoice_number || `INV-${jobCardId.slice(-4).toUpperCase()}`,
        transaction_type: transferredToKhata > 0 ? 'udhaar_incurred' : 'cash_paid',
        amount: grossTotal,
        balance_after: transferredToKhata,
        reference_no: 'OWNER-EDIT',
        notes: `Quick Job Edit by Owner (${ownerName}): Total ₹${grossTotal}, Paid ₹${advancePaid + deliveryPaid}, Khata ₹${transferredToKhata}`,
        created_at: new Date().toISOString(),
      });

      // 5. Reconcile customer balances
      await this.reconcileShopCustomerBalances(shopId);

      const finalCard = updatedCard || {
        ...data,
        id: jobCardId,
        shop_id: shopId,
        total_bill: grossTotal,
        transferred_to_khata: transferredToKhata,
        items,
      };

      return { success: true, jobCard: finalCard as JobCard };
    } catch (err: any) {
      console.error('ownerQuickEditJobCard error:', err);
      return { success: false, error: err?.message || 'Failed to edit job card' };
    }
  },

  exportCustomerSheetCsv(
    customer: Customer,
    jobCards: any[],
    ledgerEntries: CreditLedgerEntry[],
    metrics: any,
    shopName: string
  ): void {
    const escapeCsv = (val: any) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const csvLines: string[] = [];

    csvLines.push(escapeCsv(`BIKEREADY PRO - CUSTOMER MASTER DATA SHEET & LEDGER: ${customer.customer_name.toUpperCase()}`));
    csvLines.push(escapeCsv(`Workshop: ${shopName} | Date: ${new Date().toLocaleDateString('en-IN')}`));
    csvLines.push('');

    // Summary Box
    csvLines.push(escapeCsv('--- CUSTOMER FINANCIAL SUMMARY ---'));
    csvLines.push([
      'Customer Name',
      'Phone',
      'Bike Registration',
      'Trust Tier',
      'Total Visits',
      'Total Gross Billed (Rs)',
      'Total Advance (Rs)',
      'Total Cash+UPI Paid (Rs)',
      'Total Settled (Rs)',
      'Net Current Udhaar Due (Rs)'
    ].map(escapeCsv).join(','));

    csvLines.push([
      customer.customer_name,
      customer.phone || '-',
      customer.bike_number || '-',
      customer.trust_tier || 'regular',
      metrics?.totalVisits || jobCards.length,
      Number(metrics?.totalGrossBilled || 0).toFixed(2),
      Number(metrics?.totalAdvancePaid || 0).toFixed(2),
      Number((metrics?.totalCashPaid || 0) + (metrics?.totalUpiPaid || 0)).toFixed(2),
      Number(metrics?.totalUdhaarSettled || 0).toFixed(2),
      Number(metrics?.accurateCurrentDue ?? customer.current_due ?? 0).toFixed(2),
    ].map(escapeCsv).join(','));

    csvLines.push('');
    csvLines.push(escapeCsv('--- COMPLETE TRANSACTION & VISIT HISTORY (BILL-BY-BILL & SETTLEMENTS) ---'));
    csvLines.push([
      'Date & Time',
      'Invoice / Job #',
      'Bike & Odometer',
      'Transaction Type',
      'Parts & Services Breakdown',
      'Gross Bill (Rs)',
      'Advance Paid (-Rs)',
      'Cash Paid (-Rs)',
      'UPI Paid (-Rs)',
      'New Udhaar (+Rs)',
      'Khata Settled (-Rs)',
      'Net Due Balance After (Rs)',
      'Payment Ref / Notes'
    ].map(escapeCsv).join(','));

    const completedCards = jobCards.filter((jc: any) => jc.status === 'completed');
    for (const jc of completedCards) {
      const partsSum = (jc.items || []).reduce((s: number, it: any) => s + (Number(it.unit_price) || 0) * (Number(it.quantity) || 1), 0);
      const labour = Number(jc.labour_charge || 0);
      const consumables = Number(jc.consumable_charge !== undefined ? jc.consumable_charge : 20);
      const gross = partsSum + labour + consumables;
      const advance = Number(jc.advance_paid || 0);
      const cash = Number(jc.mandatory_cash_to_collect || jc.cash_collected || 0);
      const upi = Number(jc.upi_collected || 0);
      const khata = Number(jc.transferred_to_khata || 0);

      const itemsDesc = (jc.items || [])
        .map((it: any) => `${it.item_name} (x${it.quantity || 1} @ Rs.${it.unit_price})`)
        .join('; ');

      csvLines.push([
        new Date(jc.billed_at || jc.created_at).toLocaleString('en-IN'),
        `INV-${jc.id.slice(-4).toUpperCase()}`,
        `${jc.bike_number} (${jc.odometer_km || 0} KM)`,
        'COMPLETED JOB CARD',
        itemsDesc || 'General Maintenance',
        gross.toFixed(2),
        advance.toFixed(2),
        cash.toFixed(2),
        upi.toFixed(2),
        khata.toFixed(2),
        '0.00',
        '-',
        jc.upi_ref_number ? `UPI Ref: ${jc.upi_ref_number}` : 'Handover Settled'
      ].map(escapeCsv).join(','));
    }

    const settlements = ledgerEntries.filter((l: any) => l.transaction_type === 'udhaar_cleared');
    for (const st of settlements) {
      csvLines.push([
        new Date(st.created_at).toLocaleString('en-IN'),
        st.invoice_number || 'SETTLEMENT',
        customer.bike_number || '-',
        'UDHAAR CLEARANCE',
        st.notes || 'Khata Payment Settled',
        '0.00',
        '0.00',
        st.reference_no?.includes('CASH') ? Number(st.amount || 0).toFixed(2) : '0.00',
        st.reference_no?.includes('UPI') ? Number(st.amount || 0).toFixed(2) : '0.00',
        '0.00',
        Number(st.amount || 0).toFixed(2),
        Number(st.balance_after || 0).toFixed(2),
        st.reference_no || 'Receipt'
      ].map(escapeCsv).join(','));
    }

    const csvContent = '\uFEFF' + csvLines.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const cleanCustName = customer.customer_name.replace(/\s+/g, '_');
    link.download = `Customer_Sheet_${cleanCustName}_${customer.bike_number || 'BIKE'}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  exportCustomerStatementPdf(
    customer: Customer,
    jobCards: any[],
    ledgerEntries: CreditLedgerEntry[],
    metrics: any,
    shop: Shop
  ): void {
    const doc = new jsPDF({
      unit: 'pt',
      format: 'a4',
    });

    // Dark header
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, 595, 75, 'F');

    doc.setTextColor(245, 158, 11); // amber-500
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(shop.shop_name.toUpperCase(), 40, 32);

    doc.setTextColor(203, 213, 225); // slate-300
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`CUSTOMER MASTER FINANCIAL STATEMENT & AUDIT DOSSIER | Phone: ${shop.owner_phone}`, 40, 48);
    doc.text(`Generated on: ${new Date().toLocaleString('en-IN')} | Shop UPI: ${shop.upi_id}`, 40, 60);

    // Customer info bar
    doc.setFillColor(241, 245, 249);
    doc.rect(40, 85, 515, 45, 'F');
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(`Customer: ${customer.customer_name.toUpperCase()}`, 50, 102);
    doc.setFont('helvetica', 'normal');
    doc.text(`Mobile: ${customer.phone || 'N/A'} | Bike: ${customer.bike_number || 'N/A'} (${customer.bike_model || 'Standard'})`, 50, 118);

    doc.setFont('helvetica', 'bold');
    doc.text(`Trust Tier: ${customer.trust_tier?.toUpperCase() || 'REGULAR'}`, 380, 102);
    doc.setTextColor(220, 38, 38);
    const due = Number(metrics?.accurateCurrentDue ?? customer.current_due ?? 0);
    doc.text(`Current Due: INR ${due}`, 380, 118);
    doc.setTextColor(30, 41, 59);

    // 6-box summary grid
    let y = 140;
    const boxes = [
      { label: 'Total Visits', val: String(metrics?.totalVisits || jobCards.length) },
      { label: 'Gross Billed', val: `INR ${Math.round(metrics?.totalGrossBilled || 0)}` },
      { label: 'Advance Paid', val: `INR ${Math.round(metrics?.totalAdvancePaid || 0)}` },
      { label: 'Cash + UPI Paid', val: `INR ${Math.round((metrics?.totalCashPaid || 0) + (metrics?.totalUpiPaid || 0))}` },
      { label: 'Udhaar Settled', val: `INR ${Math.round(metrics?.totalUdhaarSettled || 0)}` },
      { label: 'Net Udhaar Due', val: `INR ${due}` },
    ];

    boxes.forEach((b, i) => {
      const bx = 40 + i * 86;
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.rect(bx, y, 82, 35, 'FD');
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text(b.label, bx + 4, y + 12);
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(i === 5 && due > 0 ? 220 : 30, i === 5 && due > 0 ? 38 : 41, i === 5 && due > 0 ? 38 : 59);
      doc.text(b.val, bx + 4, y + 26);
    });

    y += 48;

    // Table Header
    doc.setFillColor(30, 41, 59);
    doc.rect(40, y, 515, 18, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.text('DATE', 46, y + 12);
    doc.text('INV / REF', 110, y + 12);
    doc.text('BIKE / ODO', 180, y + 12);
    doc.text('GROSS', 270, y + 12);
    doc.text('PAID (ADV+CASH+UPI)', 330, y + 12);
    doc.text('NEW UDHAAR', 430, y + 12);
    doc.text('BALANCE AFTER', 490, y + 12);

    y += 24;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(30, 41, 59);

    const completed = jobCards.filter((jc: any) => jc.status === 'completed');
    completed.forEach((jc: any) => {
      if (y > 770) {
        doc.addPage();
        y = 40;
      }
      const partsSum = (jc.items || []).reduce((s: number, it: any) => s + (Number(it.unit_price) || 0) * (Number(it.quantity) || 1), 0);
      const labour = Number(jc.labour_charge || 0);
      const gross = partsSum + labour + Number(jc.consumable_charge !== undefined ? jc.consumable_charge : 20);
      const paid = Number(jc.advance_paid || 0) + Number(jc.mandatory_cash_to_collect || jc.cash_collected || 0) + Number(jc.upi_collected || 0);
      const khata = Number(jc.transferred_to_khata || 0);

      doc.text(new Date(jc.billed_at || jc.created_at).toLocaleDateString('en-IN'), 46, y);
      doc.text(`INV-${jc.id.slice(-4).toUpperCase()}`, 110, y);
      doc.text(`${jc.bike_number || '-'} (${jc.odometer_km || 0} KM)`, 180, y);
      doc.text(`INR ${gross}`, 270, y);
      doc.text(`INR ${paid}`, 330, y);
      doc.setTextColor(khata > 0 ? 220 : 30, khata > 0 ? 38 : 41, khata > 0 ? 38 : 59);
      doc.text(`INR ${khata}`, 430, y);
      doc.setTextColor(30, 41, 59);
      doc.text(`INR ${khata}`, 490, y);
      y += 14;
    });

    // Settlements
    ledgerEntries.filter((l: any) => l.transaction_type === 'udhaar_cleared').forEach((st: any) => {
      if (y > 770) {
        doc.addPage();
        y = 40;
      }
      doc.setTextColor(16, 185, 129);
      doc.text(new Date(st.created_at).toLocaleDateString('en-IN'), 46, y);
      doc.text(st.invoice_number || 'SETTLEMENT', 110, y);
      doc.text('Udhaar Payment Cleared', 180, y);
      doc.text('—', 270, y);
      doc.text(`-INR ${st.amount}`, 330, y);
      doc.text('—', 430, y);
      doc.text(`INR ${st.balance_after || 0}`, 490, y);
      doc.setTextColor(30, 41, 59);
      y += 14;
    });

    // Footer
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text('Official Customer Ledger Statement generated by BikeReady Pro. Computer generated audit document.', 40, 800);

    doc.save(`Customer_Statement_${customer.customer_name.replace(/\s+/g, '_')}.pdf`);
  },

  // ========================
  // SERVICE FOLLOW-UPS
  // ========================
  async scheduleJobCardFollowup(
    jobCardId: string,
    followupDate: string,
    followupNote: string
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('job_cards')
        .update({
          followup_date: followupDate,
          followup_note: followupNote,
          followup_status: 'pending',
        })
        .eq('id', jobCardId);
      return !error;
    } catch (err) {
      console.error('scheduleJobCardFollowup error:', err);
      return false;
    }
  },

  async getShopFollowups(shopId: string): Promise<JobCard[]> {
    try {
      const { data, error } = await supabase
        .from('job_cards')
        .select('*, customer:customers(*), mechanic:users(*)')
        .eq('shop_id', shopId)
        .not('followup_date', 'is', null)
        .order('followup_date', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('getShopFollowups error:', err);
      return [];
    }
  },

  async updateFollowupStatus(jobCardId: string, status: 'completed' | 'cancelled'): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('job_cards')
        .update({ followup_status: status })
        .eq('id', jobCardId);
      return !error;
    } catch (err) {
      console.error('updateFollowupStatus error:', err);
      return false;
    }
  },

  // ========================
  // 1-TAP STANDARD SERVICE PACKAGE
  // ========================
  async applyStandardServicePackage(
    shopId: string,
    jobCardId: string,
    mechanicName: string
  ): Promise<boolean> {
    try {
      const packageItems = [
        { name: '4T Synthetic Engine Oil (1L)', price: 380 },
        { name: 'Oil Filter / Strainer Clean', price: 60 },
        { name: 'Chain Cleaning & Lubrication', price: 50 },
        { name: 'Brake Service & Disc Inspection', price: 40 },
      ];

      for (const item of packageItems) {
        await this.addPartToJobCard(shopId, jobCardId, {
          itemName: item.name,
          isUnlisted: true,
          unitPrice: item.price,
          quantity: 1,
          addedByName: mechanicName || 'Mechanic',
        });
      }

      // Update labour and consumable charge if not already set higher
      const { data: jc } = await supabase
        .from('job_cards')
        .select('labour_charge, consumable_charge')
        .eq('id', jobCardId)
        .single();

      const currentLabour = Number(jc?.labour_charge || 0);
      const currentConsumable = Number(jc?.consumable_charge || 0);

      await supabase
        .from('job_cards')
        .update({
          labour_charge: Math.max(250, currentLabour),
          consumable_charge: Math.max(20, currentConsumable),
        })
        .eq('id', jobCardId);

      await this.recalculateJobCardTotals(jobCardId);
      return true;
    } catch (err) {
      console.error('applyStandardServicePackage error:', err);
      return false;
    }
  },

  // ========================
  // WHATSAPP QUOTATION / ESTIMATE GENERATOR
  // ========================
  generateWhatsAppQuotation(shop: Shop, card: JobCard): string {
    const custName = card.customer?.customer_name || 'Customer';
    const bikeNo = card.bike_number || 'Bike';
    const total = card.total_bill || 0;
    const partsList = (card.items || [])
      .map(
        (it: JobCardItem, idx: number) =>
          `${idx + 1}. ${it.item_name} (x${it.quantity || 1}) - ₹${(it.unit_price || 0) * (it.quantity || 1)}`
      )
      .join('\n');

    const message =
      `*🛠️ ${shop.shop_name.toUpperCase()} - SERVICE ESTIMATE*\n\n` +
      `Namaste *${custName}* ji,\n` +
      `Here is the estimate for your bike *${bikeNo}*:\n\n` +
      `*Parts & Consumables:*\n` +
      `${partsList || 'Standard Inspection & Maintenance'}\n\n` +
      `*Labour Charges:* ₹${card.labour_charge || 0}\n` +
      `*Consumables / Shop Fee:* ₹${card.consumable_charge || 0}\n` +
      (card.outside_work_customer_price ? `*Lathe / Outside Work:* ₹${card.outside_work_customer_price}\n` : '') +
      (card.extra_discount ? `*Special Discount:* -₹${card.extra_discount}\n` : '') +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `*ESTIMATED TOTAL: ₹${total}*\n` +
      `━━━━━━━━━━━━━━━━━━━\n\n` +
      `📍 *Address:* ${shop.shop_address || 'BikeReady Partner Workshop'}\n` +
      `📞 *Contact:* ${shop.owner_phone}\n\n` +
      `Please reply to confirm and start service work. Thank you!`;

    const cleanPhone = (card.customer?.phone || '').replace(/[^0-9]/g, '');
    const phoneWithCode = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    return `https://wa.me/${phoneWithCode}?text=${encodeURIComponent(message)}`;
  },

  // Service Follow-up / Due WhatsApp Reminder Generator
  generateServiceReminderWhatsApp(shop: Shop, card: JobCard): string {
    const custName = card.customer?.customer_name || 'Customer';
    const bikeNo = card.bike_number || 'Your Bike';
    const cleanPhone = (card.customer?.phone || '').replace(/[^0-9]/g, '');
    const phoneWithCode = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

    const followNote = card.followup_note ? `\n📌 *Check-up Reason:* ${card.followup_note}` : '';

    const message =
      `*🔔 ${shop.shop_name.toUpperCase()} - SERVICE DUE REMINDER*\n\n` +
      `Namaste *${custName}* ji,\n` +
      `This is a friendly reminder that your vehicle *${bikeNo}* is due for its safety inspection & periodic service at *${shop.shop_name}*.${followNote}\n\n` +
      `🛠️ *Recommended Service:* Engine Oil inspection/replacement, brake tuning, chain lubrication, and safety inspection.\n\n` +
      `📍 *Workshop Address:* ${shop.shop_address || 'BikeReady Authorized Workshop'}\n` +
      `📞 *Contact / Book Slot:* ${shop.owner_phone}\n\n` +
      `Please visit us today or reply to confirm your visit. Thank you!`;

    return `https://wa.me/${phoneWithCode}?text=${encodeURIComponent(message)}`;
  },

  // ========================
  // SUPER ADMIN & WORKSHOP SAAS LICENSES
  // ========================
  async getAllShops(): Promise<Shop[]> {
    try {
      const { data, error } = await supabase
        .from('shops')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('getAllShops error:', err);
      return [];
    }
  },

  async updateShopLicense(
    shopId: string,
    status: 'active' | 'trial' | 'suspended',
    expiresAt?: string | null
  ): Promise<boolean> {
    try {
      const updates: Partial<Shop> = {
        license_status: status,
      };
      if (expiresAt !== undefined) {
        updates.license_expires_at = expiresAt;
      }
      const { error } = await supabase
        .from('shops')
        .update(updates)
        .eq('id', shopId);

      return !error;
    } catch (err) {
      console.error('updateShopLicense error:', err);
      return false;
    }
  },

  // ========================
  // DATABASE SAVER & ARCHIVE
  // ========================
  async downloadFullDatabaseBackup(shopId: string, shopName: string): Promise<boolean> {
    try {
      const [
        shopRes,
        usersRes,
        customersRes,
        distRes,
        invRes,
        cardsRes,
        itemsRes,
        quicksRes,
        expensesRes,
        attRes,
        payRes,
      ] = await Promise.all([
        supabase.from('shops').select('*').eq('id', shopId),
        supabase.from('users').select('*').eq('shop_id', shopId),
        supabase.from('customers').select('*').eq('shop_id', shopId),
        supabase.from('distributors').select('*').or(`shop_id.eq.${shopId},shop_id.is.null`),
        supabase.from('inventory').select('*').eq('shop_id', shopId),
        supabase.from('job_cards').select('*').eq('shop_id', shopId),
        supabase.from('job_card_items').select('*').eq('shop_id', shopId),
        supabase.from('quick_jobs').select('*').eq('shop_id', shopId),
        supabase.from('shop_expenses').select('*').eq('shop_id', shopId),
        supabase.from('staff_attendance').select('*').eq('shop_id', shopId),
        supabase.from('staff_payments').select('*').or(`shop_id.eq.${shopId},shop_id.is.null`),
      ]);

      const backupData = {
        exportTimestamp: new Date().toISOString(),
        appName: 'BikeReady Auto Center Automation',
        shopId,
        shopName,
        databaseVersion: '2.0-SaaS',
        tables: {
          shops: shopRes.data || [],
          users: usersRes.data || [],
          customers: customersRes.data || [],
          distributors: distRes.data || [],
          inventory: invRes.data || [],
          job_cards: cardsRes.data || [],
          job_card_items: itemsRes.data || [],
          quick_jobs: quicksRes.data || [],
          shop_expenses: expensesRes.data || [],
          staff_attendance: attRes.data || [],
          staff_payments: payRes.data || [],
        },
      };

      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().split('T')[0];
      a.download = `BikeReady_FullBackup_${shopName.replace(/\s+/g, '_')}_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return true;
    } catch (err) {
      console.error('downloadFullDatabaseBackup error:', err);
      return false;
    }
  },

  async purgeOldAuditLogs(shopId: string, daysOlderThan: number = 365): Promise<{ purged: number; success: boolean }> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOlderThan);
      const cutoffIso = cutoffDate.toISOString();

      // Delete quick_jobs older than cutoff
      const { data: qData, error: qErr } = await supabase
        .from('quick_jobs')
        .delete()
        .eq('shop_id', shopId)
        .lt('created_at', cutoffIso)
        .select('id');

      if (qErr) console.warn('Purge quick_jobs warn:', qErr);

      // Delete shop_expenses older than cutoff (except staff_upad)
      const { data: eData, error: eErr } = await supabase
        .from('shop_expenses')
        .delete()
        .eq('shop_id', shopId)
        .neq('expense_type', 'staff_upad')
        .lt('created_at', cutoffIso)
        .select('id');

      if (eErr) console.warn('Purge shop_expenses warn:', eErr);

      const totalPurged = (qData?.length || 0) + (eData?.length || 0);
      return { purged: totalPurged, success: true };
    } catch (err) {
      console.error('purgeOldAuditLogs error:', err);
      return { purged: 0, success: false };
    }
  },

  async restoreDatabaseBackup(
    shopId: string,
    rawBackup: any
  ): Promise<{ success: boolean; message: string; count: number }> {
    try {
      if (!rawBackup || typeof rawBackup !== 'object') {
        return { success: false, message: 'Invalid JSON file format.', count: 0 };
      }

      const tables = rawBackup.tables || rawBackup.data || rawBackup;
      let totalInserted = 0;

      const restoreTable = async (tableName: string, rows: any[]) => {
        if (!Array.isArray(rows) || rows.length === 0) return 0;
        // Strictly scope all records to this workshop tenant
        const sanitized = rows.map((r) => ({
          ...r,
          shop_id: shopId,
        }));

        let count = 0;
        for (let i = 0; i < sanitized.length; i += 50) {
          const chunk = sanitized.slice(i, i + 50);
          const { error } = await supabase.from(tableName).upsert(chunk, { onConflict: 'id' });
          if (!error) {
            count += chunk.length;
          } else {
            console.warn(`Error restoring ${tableName}:`, error);
          }
        }
        return count;
      };

      if (tables.customers) totalInserted += await restoreTable('customers', tables.customers);
      if (tables.distributors) totalInserted += await restoreTable('distributors', tables.distributors);
      if (tables.inventory) totalInserted += await restoreTable('inventory', tables.inventory);
      if (tables.job_cards) totalInserted += await restoreTable('job_cards', tables.job_cards);
      if (tables.job_card_items) totalInserted += await restoreTable('job_card_items', tables.job_card_items);
      if (tables.quick_jobs) totalInserted += await restoreTable('quick_jobs', tables.quick_jobs);
      if (tables.shop_expenses) totalInserted += await restoreTable('shop_expenses', tables.shop_expenses);
      if (tables.staff_attendance) totalInserted += await restoreTable('staff_attendance', tables.staff_attendance);
      if (tables.staff_payments) totalInserted += await restoreTable('staff_payments', tables.staff_payments);

      return {
        success: true,
        message: `Database restore complete! Successfully imported ${totalInserted} records across all workshop tables.`,
        count: totalInserted,
      };
    } catch (err: any) {
      console.error('restoreDatabaseBackup error:', err);
      return {
        success: false,
        message: err?.message || 'Database restore failed.',
        count: 0,
      };
    }
  },

  // -------------------------------------------------------------
  // MULTI-TIER AUTO-VAULT, BACKUP & UNIVERSAL EXPORT (TASK 6)
  // -------------------------------------------------------------

  async saveAutoVaultSnapshot(shopId: string, shopName: string): Promise<{ success: boolean; tiersUpdated: string[] }> {
    try {
      if (!shopId) return { success: false, tiersUpdated: [] };

      // Collect data from cache and Supabase
      const [shop, jobCards, customers, inventoryResult, expenses, staffPayments] = await Promise.all([
        this.getShopById(shopId),
        this.getJobCards(shopId),
        this.getCustomers(shopId),
        this.getInventory(shopId),
        this.getExpenses(shopId),
        this.getStaffPayments(shopId),
      ]);

      const inventoryList: InventoryItem[] = Array.isArray(inventoryResult)
        ? inventoryResult
        : (inventoryResult?.items || []);

      const now = new Date();
      const timestamp = now.getTime();
      const dateStr = now.toISOString().split('T')[0];
      const yearStr = `${now.getFullYear()}`;
      const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      // Calculate ISO week
      const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
      const dayNum = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
      const weekStr = `${now.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;

      const snapshotPayload = {
        version: '2.0-AutoVault',
        shopId,
        shopName,
        timestamp,
        dateStr,
        counts: {
          jobCards: jobCards.length,
          customers: customers.length,
          inventory: inventoryList.length,
          expenses: expenses.length,
          staffPayments: staffPayments.length,
        },
        data: {
          shop: shop ? [shop] : [],
          job_cards: jobCards,
          job_card_items: jobCards.flatMap((j: JobCard) => (j.items || []).map((it: JobCardItem) => ({ ...it, job_card_id: j.id, shop_id: shopId }))),
          customers,
          inventory: inventoryList,
          shop_expenses: expenses,
          staff_payments: staffPayments,
        }
      };

      const serialized = JSON.stringify(snapshotPayload);
      const tiersUpdated: string[] = ['Latest (Live)'];

      // Tier 1: Always update latest
      localStorage.setItem(`br_vault_latest_${shopId}`, serialized);

      // Tier 2: Minute Vault (every ~60 seconds)
      const lastMinTs = Number(localStorage.getItem(`br_vault_min_ts_${shopId}`) || '0');
      if (timestamp - lastMinTs > 55000) {
        localStorage.setItem(`br_vault_minute_${shopId}`, serialized);
        localStorage.setItem(`br_vault_min_ts_${shopId}`, String(timestamp));
        tiersUpdated.push('Minute Vault');
      }

      // Tier 3: Daily Vault
      const lastDaily = localStorage.getItem(`br_vault_daily_date_${shopId}`);
      if (lastDaily !== dateStr) {
        localStorage.setItem(`br_vault_daily_${shopId}`, serialized);
        localStorage.setItem(`br_vault_daily_date_${shopId}`, dateStr);
        tiersUpdated.push('Daily Vault');
      }

      // Tier 4: Weekly Vault
      const lastWeekly = localStorage.getItem(`br_vault_weekly_val_${shopId}`);
      if (lastWeekly !== weekStr) {
        localStorage.setItem(`br_vault_weekly_${shopId}`, serialized);
        localStorage.setItem(`br_vault_weekly_val_${shopId}`, weekStr);
        tiersUpdated.push('Weekly Vault');
      }

      // Tier 5: Monthly Vault
      const lastMonthly = localStorage.getItem(`br_vault_monthly_val_${shopId}`);
      if (lastMonthly !== monthStr) {
        localStorage.setItem(`br_vault_monthly_${shopId}`, serialized);
        localStorage.setItem(`br_vault_monthly_val_${shopId}`, monthStr);
        tiersUpdated.push('Monthly Vault');
      }

      // Tier 6: Yearly Vault
      const lastYearly = localStorage.getItem(`br_vault_yearly_val_${shopId}`);
      if (lastYearly !== yearStr) {
        localStorage.setItem(`br_vault_yearly_${shopId}`, serialized);
        localStorage.setItem(`br_vault_yearly_val_${shopId}`, yearStr);
        tiersUpdated.push('Yearly Vault');
      }

      return { success: true, tiersUpdated };
    } catch (err) {
      console.error('saveAutoVaultSnapshot error:', err);
      return { success: false, tiersUpdated: [] };
    }
  },

  getAutoVaultSnapshots(shopId: string): Array<{
    key: string;
    tierLabel: string;
    description: string;
    timestamp: number;
    dateFormatted: string;
    totalRecords: number;
    sizeKb: number;
    raw: any;
  }> {
    const tiers = [
      { key: `br_vault_latest_${shopId}`, tierLabel: '🟢 Latest Live Snapshot', desc: 'Realtime on-mutation state' },
      { key: `br_vault_minute_${shopId}`, tierLabel: '⏱️ 60-Sec Rolling Vault', desc: 'Recent 1-minute automated checkpoint' },
      { key: `br_vault_daily_${shopId}`, tierLabel: '📅 Daily Snapshot', desc: 'Start-of-day safety backup' },
      { key: `br_vault_weekly_${shopId}`, tierLabel: '🗓️ Weekly Audit Vault', desc: 'Weekly consolidated workshop archive' },
      { key: `br_vault_monthly_${shopId}`, tierLabel: '📦 Monthly Ledger Archive', desc: 'Monthly closing records' },
      { key: `br_vault_yearly_${shopId}`, tierLabel: '🏛️ Yearly Historical Vault', desc: 'Year-end financial preservation' },
    ];

    const results = [];
    for (const t of tiers) {
      const stored = localStorage.getItem(t.key);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          const totalRecords =
            (parsed.counts?.jobCards || 0) +
            (parsed.counts?.customers || 0) +
            (parsed.counts?.inventory || 0) +
            (parsed.counts?.expenses || 0) +
            (parsed.counts?.staffPayments || 0);
          results.push({
            key: t.key,
            tierLabel: t.tierLabel,
            description: t.desc,
            timestamp: parsed.timestamp || 0,
            dateFormatted: new Date(parsed.timestamp || Date.now()).toLocaleString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }),
            totalRecords,
            sizeKb: Math.round((stored.length / 1024) * 10) / 10,
            raw: parsed,
          });
        } catch {
          // invalid json
        }
      }
    }
    return results;
  },

  async restoreFromVaultSnapshot(shopId: string, rawData: any): Promise<{ success: boolean; message: string; count: number }> {
    const payload = rawData?.data || rawData?.tables || rawData;
    return this.restoreDatabaseBackup(shopId, { tables: payload });
  },

  exportWorkshopCsv(
    shopId: string,
    shopName: string,
    timeframe: 'today' | 'week' | 'month' | 'year' | 'all' = 'all',
    jobCards: JobCard[] = [],
    inventory: InventoryItem[] = [],
    expenses: ShopExpense[] = []
  ): void {
    const now = new Date();
    const isWithinTimeframe = (dateString?: string) => {
      if (!dateString || timeframe === 'all') return true;
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return true;
      if (timeframe === 'today') {
        return d.toDateString() === now.toDateString();
      }
      if (timeframe === 'week') {
        const diffDays = (now.getTime() - d.getTime()) / (1000 * 3600 * 24);
        return diffDays >= 0 && diffDays <= 7;
      }
      if (timeframe === 'month') {
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }
      if (timeframe === 'year') {
        return d.getFullYear() === now.getFullYear();
      }
      return true;
    };

    const filteredCards = jobCards.filter(jc => isWithinTimeframe(jc.created_at));
    const filteredExpenses = expenses.filter(e => isWithinTimeframe(e.created_at || (e as any).expense_date));

    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const csvLines: string[] = [];

    // Header Metadata
    csvLines.push(escapeCsv(`BIKEREADY WORKSHOP EXCEL AUDIT REPORT - ${shopName.toUpperCase()}`));
    csvLines.push(escapeCsv(`Generated: ${new Date().toLocaleString('en-IN')} | Timeframe: ${timeframe.toUpperCase()}`));
    csvLines.push('');

    // SECTION 1: JOB CARDS & BILLING
    csvLines.push(escapeCsv('--- 1. JOB CARDS & BILLING LEDGER ---'));
    csvLines.push([
      'Invoice / Job #',
      'Date & Time',
      'Customer Name',
      'Mobile Number',
      'Vehicle Number',
      'Vehicle Model',
      'Status',
      'Service / Parts Breakdown',
      'Parts Total (Rs)',
      'Labour (Rs)',
      'Consumables (Rs)',
      'Gross Total (Rs)',
      'Advance Paid (Rs)',
      'Net Payable (Rs)',
      'Cash Paid (Rs)',
      'UPI Paid (Rs)',
      'Transferred To Khata / Due (Rs)',
      'Total Paid (Rs)',
      'UPI Ref #',
      'Payment Status',
      'Mechanic Notes'
    ].map(escapeCsv).join(','));

    for (const jc of filteredCards) {
      const partsSum = (jc.items || []).reduce((s, it) => s + (Number(it.unit_price) || 0) * (Number(it.quantity) || 1), 0);
      const labour = Number(jc.labour_charge || 0);
      const consumables = Number(jc.consumable_charge !== undefined ? jc.consumable_charge : 20);
      const gross = partsSum + labour + consumables;
      const advance = Number(jc.advance_paid || 0);
      const netPayable = Math.max(0, gross - advance);
      const cash = Number(jc.mandatory_cash_to_collect || jc.cash_collected || 0);
      const upi = Number(jc.upi_collected || 0);
      const khata = Number(jc.transferred_to_khata !== undefined ? jc.transferred_to_khata : Math.max(0, netPayable - cash - upi));
      const totalPaid = advance + cash + upi;

      const itemsDesc = (jc.items || [])
        .map(it => `${it.item_name || 'Part'} (x${it.quantity || 1} @ Rs.${it.unit_price || 0})`)
        .join('; ');

      csvLines.push([
        jc.bike_number || jc.id.slice(0, 8),
        new Date(jc.created_at).toLocaleString('en-IN'),
        jc.customer?.customer_name || 'Walk-in Customer',
        jc.customer?.phone || '-',
        jc.bike_number || '-',
        jc.bike_model || '-',
        jc.status || 'ACTIVE',
        itemsDesc || 'General Service',
        partsSum.toFixed(2),
        labour.toFixed(2),
        consumables.toFixed(2),
        gross.toFixed(2),
        advance.toFixed(2),
        netPayable.toFixed(2),
        cash.toFixed(2),
        upi.toFixed(2),
        khata.toFixed(2),
        totalPaid.toFixed(2),
        jc.upi_ref_number || '-',
        khata > 0 ? 'PARTIAL_KHATA' : 'PAID',
        jc.mechanic_notes || '-'
      ].map(escapeCsv).join(','));
    }

    csvLines.push('');
    csvLines.push(escapeCsv('--- 2. MASTER INVENTORY IN STOCK ---'));
    csvLines.push([
      'Part Name',
      'Category',
      'In Stock Quantity',
      'Cost Price (Rs)',
      'Selling Price (Rs)',
      'Total Stock Value (Rs)',
      'Low Stock Alert Level'
    ].map(escapeCsv).join(','));

    for (const inv of inventory) {
      const stock = Number(inv.stock_quantity || 0);
      const cost = Number(inv.cost_price || 0);
      const selling = Number(inv.unit_price || 0);
      csvLines.push([
        inv.part_name || 'Part',
        inv.part_category || 'General',
        stock,
        cost.toFixed(2),
        selling.toFixed(2),
        (stock * cost).toFixed(2),
        inv.min_stock_limit || 2
      ].map(escapeCsv).join(','));
    }

    csvLines.push('');
    csvLines.push(escapeCsv('--- 3. WORKSHOP EXPENSES ---'));
    csvLines.push([
      'Date',
      'Expense Description',
      'Category / Type',
      'Amount (Rs)',
      'Payment Mode',
      'Notes'
    ].map(escapeCsv).join(','));

    for (const exp of filteredExpenses) {
      csvLines.push([
        new Date(exp.created_at || Date.now()).toLocaleDateString('en-IN'),
        exp.title || 'Expense',
        exp.expense_type || exp.category || 'General',
        Number(exp.amount || 0).toFixed(2),
        exp.payment_mode || 'CASH',
        exp.category || '-'
      ].map(escapeCsv).join(','));
    }

    // UTF-8 BOM (\uFEFF) ensures Excel renders ₹ and UTF-8 characters cleanly
    const csvContent = '\uFEFF' + csvLines.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const dateFormatted = now.toISOString().split('T')[0];
    link.download = `BikeReady_Audit_${shopName.replace(/\s+/g, '_')}_${timeframe}_${dateFormatted}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  exportMasterAuditPdf(
    shopId: string,
    shopName: string,
    timeframe: 'today' | 'week' | 'month' | 'year' | 'all' = 'all',
    jobCards: JobCard[] = [],
    expenses: ShopExpense[] = []
  ): void {
    const now = new Date();
    const isWithinTimeframe = (dateString?: string) => {
      if (!dateString || timeframe === 'all') return true;
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return true;
      if (timeframe === 'today') return d.toDateString() === now.toDateString();
      if (timeframe === 'week') return (now.getTime() - d.getTime()) / (1000 * 3600 * 24) <= 7;
      if (timeframe === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      if (timeframe === 'year') return d.getFullYear() === now.getFullYear();
      return true;
    };

    const cards = jobCards.filter(jc => isWithinTimeframe(jc.created_at));
    const totalGross = cards.reduce((sum, jc) => {
      const parts = (jc.items || []).reduce((s, it) => s + (Number(it.unit_price) || 0) * (Number(it.quantity) || 1), 0);
      return sum + parts + Number(jc.labour_charge || 0) + Number(jc.consumable_charge !== undefined ? jc.consumable_charge : 20);
    }, 0);
    const totalCash = cards.reduce((sum, jc) => sum + Number(jc.mandatory_cash_to_collect || jc.cash_collected || 0), 0);
    const totalUpi = cards.reduce((sum, jc) => sum + Number(jc.upi_collected || 0), 0);
    const totalKhata = cards.reduce((sum, jc) => sum + Number(jc.transferred_to_khata || 0), 0);
    const totalAdvance = cards.reduce((sum, jc) => sum + Number(jc.advance_paid || 0), 0);

    const rowsHtml = cards.map(jc => {
      const parts = (jc.items || []).reduce((s, it) => s + (Number(it.unit_price) || 0) * (Number(it.quantity) || 1), 0);
      const labour = Number(jc.labour_charge || 0);
      const gross = parts + labour + Number(jc.consumable_charge !== undefined ? jc.consumable_charge : 20);
      const paid = Number(jc.advance_paid || 0) + Number(jc.mandatory_cash_to_collect || jc.cash_collected || 0) + Number(jc.upi_collected || 0);
      const due = Number(jc.transferred_to_khata || 0);
      return `
        <tr>
          <td><strong>${jc.bike_number || jc.id.slice(0, 8)}</strong></td>
          <td>${new Date(jc.created_at).toLocaleDateString('en-IN')}<br><small>${jc.customer?.customer_name || 'Walk-in'}</small></td>
          <td>${jc.bike_number || '-'}<br><small>${jc.bike_model || ''}</small></td>
          <td>${jc.status || 'ACTIVE'}</td>
          <td style="text-align:right">₹${parts.toFixed(0)}</td>
          <td style="text-align:right">₹${labour.toFixed(0)}</td>
          <td style="text-align:right"><strong>₹${gross.toFixed(0)}</strong></td>
          <td style="text-align:right; color: #16a34a">₹${paid.toFixed(0)}</td>
          <td style="text-align:right; color: ${due > 0 ? '#dc2626' : '#6b7280'}; font-weight: bold;">₹${due.toFixed(0)}</td>
        </tr>
      `;
    }).join('');

    const auditHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>BikeReady Master Audit Report - ${shopName}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 24px; color: #1f2937; }
          .header { border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 20px; }
          .title { font-size: 24px; font-weight: bold; color: #1e3a8a; }
          .meta { font-size: 13px; color: #6b7280; margin-top: 4px; }
          .stats-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 24px; }
          .stat-box { background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; text-align: center; }
          .stat-val { font-size: 18px; font-weight: bold; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 16px; }
          th { background: #1e3a8a; color: white; padding: 8px; text-align: left; }
          td { padding: 8px; border-bottom: 1px solid #e5e7eb; }
          tr:nth-child(even) { background: #f9fafb; }
          @media print {
            .no-print { display: none; }
            body { margin: 0; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 16px; text-align: right;">
          <button onclick="window.print()" style="background:#2563eb; color:white; border:none; padding:8px 16px; border-radius:6px; cursor:pointer; font-weight:bold;">🖨️ Print / Save as PDF</button>
        </div>
        <div class="header">
          <div class="title">${shopName} — Master Audit Dossier</div>
          <div class="meta">Audit Timeframe: ${timeframe.toUpperCase()} | Generated: ${now.toLocaleString('en-IN')} | Total Job Cards: ${cards.length}</div>
        </div>
        <div class="stats-grid">
          <div class="stat-box">
            <div style="font-size:11px; color:#6b7280;">GROSS BILLING</div>
            <div class="stat-val" style="color:#1e3a8a;">₹${totalGross.toFixed(0)}</div>
          </div>
          <div class="stat-box">
            <div style="font-size:11px; color:#6b7280;">ADVANCE COLLECTED</div>
            <div class="stat-val" style="color:#0284c7;">₹${totalAdvance.toFixed(0)}</div>
          </div>
          <div class="stat-box">
            <div style="font-size:11px; color:#6b7280;">CASH IN HAND</div>
            <div class="stat-val" style="color:#16a34a;">₹${totalCash.toFixed(0)}</div>
          </div>
          <div class="stat-box">
            <div style="font-size:11px; color:#6b7280;">UPI / BANK</div>
            <div class="stat-val" style="color:#7c3aed;">₹${totalUpi.toFixed(0)}</div>
          </div>
          <div class="stat-box">
            <div style="font-size:11px; color:#6b7280;">KHATA / DUE BALANCE</div>
            <div class="stat-val" style="color:#dc2626;">₹${totalKhata.toFixed(0)}</div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Job ID</th>
              <th>Date / Customer</th>
              <th>Vehicle</th>
              <th>Status</th>
              <th style="text-align:right">Parts</th>
              <th style="text-align:right">Labour</th>
              <th style="text-align:right">Gross Total</th>
              <th style="text-align:right">Total Paid</th>
              <th style="text-align:right">Khata Due</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="9" style="text-align:center; padding:20px;">No job cards recorded for this timeframe.</td></tr>'}
          </tbody>
        </table>
        <div style="margin-top: 30px; font-size: 11px; color: #9ca3af; text-align: center; border-top: 1px dashed #e5e7eb; padding-top: 12px;">
          Generated by BikeReady Pro Workshop Suite • Official Audit Record • All Rights Reserved
        </div>
      </body>
      </html>
    `;

    const printWin = window.open('', '_blank');
    if (printWin) {
      printWin.document.open();
      printWin.document.write(auditHtml);
      printWin.document.close();
    }
  },
};

