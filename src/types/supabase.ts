export type UserRole = 'owner' | 'manager' | 'mechanic';

export type TrustTier = 'new' | 'regular' | 'trusted' | 'blocked';

export type JobCardStatus = 'draft' | 'pending' | 'in_progress' | 'submitted' | 'approved' | 'completed';

export type PaymentMode = 'cash' | 'upi';

export type ExpenseType = 'shop_expense' | 'staff_upad' | 'scrap_income';

export interface Shop {
  id: string;
  shop_name: string;
  shop_address?: string | null;
  owner_name: string;
  owner_phone: string;
  owner_pin?: string | null;
  upi_id: string;
  recovery_secret?: string | null;
  distributor_phone?: string;
  gst_number?: string | null;
  invoice_terms?: string | null;
  license_status?: 'active' | 'trial' | 'suspended' | null;
  license_expires_at?: string | null;
  default_quick_prices?: Record<string, number>;
  created_at: string;
}

export interface StaffAttendance {
  id: string;
  shop_id: string;
  staff_id: string | null;
  staff_name: string;
  role: string;
  attendance_date: string;
  punch_in_time: string;
  punch_out_time: string | null;
  status: 'present' | 'absent' | 'half_day';
  hours_worked?: number | null;
  day_credit?: number | null;
  is_owner_approved_early_leave?: boolean | null;
  work_value_done?: number | null;
  created_at?: string;
}

export interface User {
  id: string;
  shop_id: string;
  full_name: string;
  phone: string;
  pin_code: string;
  role: UserRole;
  designation?: string | null;
  target_duty_hours?: number;
  min_full_day_hours?: number;
  min_half_day_hours?: number;
  is_temp_manager: boolean;
  temp_manager_expires_at: string | null;
  daily_wallet_limit: number;
  daily_wallet_used: number;
  monthly_salary: number;
  total_upad_taken: number;
  absent_days: number;
  is_active?: boolean;
  left_date?: string | null;
  settlement_notes?: string | null;
  created_at: string;
}

export interface Distributor {
  id: string;
  shop_id: string | null;
  distributor_name: string;
  phone: string;
  supplied_categories: string;
  created_at?: string;
}

export type StaffPaymentType = 'salary_payout' | 'upad_advance' | 'bonus';

export interface StaffPayment {
  id: string;
  shop_id: string | null;
  staff_id: string | null;
  staff_name: string;
  payment_type: StaffPaymentType;
  amount: number;
  payment_mode: 'cash' | 'upi';
  notes: string | null;
  created_at: string;
}

export type CreditLedgerTransactionType =
  | 'cash_paid'
  | 'upi_received'
  | 'udhaar_incurred'
  | 'udhaar_cleared';

export interface CreditLedgerEntry {
  id: string;
  shop_id: string;
  customer_id: string;
  customer_name?: string;
  customer_phone?: string;
  bike_number?: string;
  job_card_id?: string | null;
  invoice_number?: string | null;
  transaction_type: CreditLedgerTransactionType;
  amount: number;
  balance_after: number;
  reference_no?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface Customer {
  id: string;
  shop_id: string;
  customer_name: string;
  phone: string;
  alt_phone?: string | null;
  address?: string | null;
  bike_number: string;
  bike_model?: string | null;
  trust_tier: TrustTier;
  credit_limit: number;
  absolute_max_limit: number;
  current_due: number;
  notes?: string | null;
  created_at: string;
}

export interface InventoryItem {
  id: string;
  shop_id: string;
  part_name: string;
  part_category: string;
  stock_quantity: number;
  unit_price: number;
  cost_price?: number | null;
  min_stock_limit?: number | null;
  distributor_id?: string | null;
  distributor_name?: string | null;
  is_ordered?: boolean | null;
  ordered_qty?: number | null;
  ordered_distributor_name?: string | null;
  ordered_at?: string | null;
  updated_at: string;
}

export interface JobCard {
  id: string;
  shop_id: string;
  customer_id: string | null;
  mechanic_id: string | null;
  bike_number: string;
  bike_model?: string | null;
  vehicle_model?: string | null;
  odometer_km: number;
  fuel_level?: string | null;
  advance_paid?: number;
  estimated_cost?: number;
  customer_complaints?: string | null;
  mechanic_notes?: string | null;
  status: JobCardStatus;
  is_locked_for_mechanic: boolean;
  labour_charge: number;
  consumable_charge: number;
  outside_work_desc: string | null;
  outside_work_shop_cost: number;
  outside_work_customer_price: number;
  extra_discount: number;
  discount_approval_status: 'none' | 'pending' | 'approved' | 'rejected';
  credit_override_status: 'none' | 'pending' | 'approved' | 'rejected';
  credit_override_amount?: number | null;
  total_bill: number;
  mandatory_cash_to_collect: number;
  transferred_to_khata: number;
  cash_collected?: number;
  upi_collected?: number;
  upi_ref_number?: string | null;
  upi_verified?: boolean;
  upi_verified_at?: string | null;
  inspection_status?: 'in_progress' | 'ready_for_inspection' | 'inspected' | null;
  mechanic_notified?: boolean;
  approved_credit_amount?: number | null;
  mandatory_paid_amount?: number | null;
  followup_date?: string | null;
  followup_note?: string | null;
  followup_status?: 'pending' | 'completed' | 'cancelled' | null;
  created_at: string;
  submitted_at: string | null;
  billed_at: string | null;
  // Joined or client enriched
  customer?: Customer;
  customer_name?: string;
  customer_phone?: string;
  payment_mode?: string;
  mechanic?: User;
  items?: JobCardItem[];
}

export interface JobCardItem {
  id: string;
  shop_id: string;
  job_card_id: string;
  part_id: string | null;
  item_name: string;
  is_unlisted_manual: boolean;
  quantity: number;
  unit_price: number;
  total_price?: number;
  added_by_name: string;
  warranty_months: number;
  price_pending_inspection?: boolean;
  price_change_requested?: number | null;
  price_change_status?: 'none' | 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export interface QuickJob {
  id: string;
  shop_id: string;
  worker_id: string;
  worker_name: string;
  service_name: string;
  default_price: number;
  final_price: number;
  is_price_modified: boolean;
  payment_mode: PaymentMode;
  created_at: string;
}

export interface ShopExpense {
  id: string;
  shop_id: string;
  expense_type: ExpenseType;
  staff_id: string | null;
  staff_name: string | null;
  title: string;
  amount: number;
  recorded_by: string;
  payment_mode?: 'cash' | 'upi' | string;
  category?: string | null;
  created_at: string;
}

export interface DailyGallaTally {
  jobCardCash: number;
  jobCardUpi: number;
  quickJobCash: number;
  quickJobUpi: number;
  totalCashIn: number;
  totalUpiIn: number;
  shopExpenses: number;
  staffUpad: number;
  cashExpenses?: number;
  upiExpenses?: number;
  scrapIncome: number;
  totalCashOut: number;
  netCashInGalla: number;
  totalRevenue: number;
  transferredToKhata: number;
  realNetProfit: number;
}
