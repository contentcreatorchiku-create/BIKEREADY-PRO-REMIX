import React, { useState, useEffect } from 'react';
import { User, Shop, StaffAttendance, StaffPayment } from '../types/supabase';
import { supabaseService, formatCCTVTimestamp, formatSimpleDate } from '../utils/supabaseService';
import { notify } from './NotificationModal';
import {
  X,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Banknote,
  QrCode,
  Plus,
  ShieldCheck,
  Calendar,
  DollarSign,
  FileText,
  UserCheck,
  Sparkles,
  Trash2,
} from 'lucide-react';

interface StaffDossierModalProps {
  staff: User;
  currentShop: Shop;
  currentUser: User;
  onClose: () => void;
  onRefresh: () => void;
}

export const StaffDossierModal: React.FC<StaffDossierModalProps> = ({
  staff,
  currentShop,
  currentUser,
  onClose,
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState<'attendance' | 'passbook'>('attendance');
  const [monthsRange, setMonthsRange] = useState<number>(1); // 1, 2, 3, 999
  const [attendance, setAttendance] = useState<StaffAttendance[]>([]);
  const [payments, setPayments] = useState<StaffPayment[]>([]);
  const [loading, setLoading] = useState(false);

  // Upad Modal
  const [showUpadModal, setShowUpadModal] = useState(false);
  const [upadAmount, setUpadAmount] = useState<number | ''>('');
  const [upadMode, setUpadMode] = useState<'cash' | 'upi'>('cash');
  const [upadNotes, setUpadNotes] = useState('');

  // Salary Payout Modal
  const [showSalaryModal, setShowSalaryModal] = useState(false);
  const [salaryAmount, setSalaryAmount] = useState<number | ''>('');
  const [salaryMode, setSalaryMode] = useState<'cash' | 'upi'>('cash');
  const [salaryNotes, setSalaryNotes] = useState('Monthly Salary Payout');

  const loadDossierData = async () => {
    setLoading(true);
    try {
      const [att, pay] = await Promise.all([
        supabaseService.getStaffAttendanceDossier(currentShop.id, staff.id, monthsRange),
        supabaseService.getStaffPayments(currentShop.id, staff.id),
      ]);
      setAttendance(att);
      setPayments(pay);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDossierData();
  }, [staff.id, monthsRange]);

  // Early Leave Override by Owner
  const handleApproveEarlyLeave = async (attendanceId: string) => {
    const ok = await supabaseService.approveEarlyLeave(attendanceId);
    if (ok) {
      await loadDossierData();
      onRefresh();
    }
  };

  const handleSetCredit = async (attendanceId: string, credit: number) => {
    const ok = await supabaseService.updateAttendanceCredit(attendanceId, credit);
    if (ok) {
      setAttendance((prev) =>
        prev.map((a) => (a.id === attendanceId ? { ...a, day_credit: credit, status: credit >= 1 ? 'present' : 'half_day' } : a))
      );
      notify.success(`Duty credit updated to ${credit} Day.`);
      onRefresh();
    }
  };

  const handleForcePunchOut = async (attendanceId: string) => {
    const ok = await supabaseService.forcePunchOutAttendance(attendanceId);
    if (ok) {
      await loadDossierData();
      notify.success('Staff duty force punched out.');
      onRefresh();
    }
  };

  const handleDeleteAttendance = async (attendanceId: string) => {
    const ok = await notify.confirm('Permanently delete this attendance record?', 'Delete Attendance');
    if (!ok) return;
    const deleted = await supabaseService.deleteAttendanceRecord(attendanceId);
    if (deleted) {
      setAttendance((prev) => prev.filter((a) => a.id !== attendanceId));
      notify.success('Attendance record deleted.');
      onRefresh();
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    const ok = await notify.confirm('Permanently delete this passbook payment entry?', 'Delete Entry');
    if (!ok) return;
    const deleted = await supabaseService.deleteStaffPayment(paymentId);
    if (deleted) {
      setPayments((prev) => prev.filter((p) => p.id !== paymentId));
      notify.success('Passbook entry deleted & balance updated.');
      onRefresh();
    }
  };

  // Record Upad via unified service method
  const handleRecordUpad = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!upadAmount || Number(upadAmount) <= 0) return;
    await supabaseService.recordStaffUpad({
      shop_id: currentShop.id,
      staff_id: staff.id,
      staff_name: staff.full_name,
      amount: Number(upadAmount),
      payment_mode: upadMode,
      notes: upadNotes || 'Salary Upad Advance',
      recorded_by: currentUser.full_name,
    });
    setShowUpadModal(false);
    setUpadAmount('');
    setUpadNotes('');
    await loadDossierData();
    notify.success(`Upad ₹${upadAmount} recorded.`);
    onRefresh();
  };

  // Record Salary Payout
  const handleRecordSalary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salaryAmount || Number(salaryAmount) <= 0) return;
    await supabaseService.recordStaffPayment({
      shop_id: currentShop.id,
      staff_id: staff.id,
      staff_name: staff.full_name,
      payment_type: 'salary_payout',
      amount: Number(salaryAmount),
      payment_mode: salaryMode,
      notes: salaryNotes || 'Monthly Salary Settlement',
      recorded_by: currentUser.full_name,
    });
    setShowSalaryModal(false);
    await loadDossierData();
    notify.success(`Salary payout of ₹${salaryAmount} settled!`);
    onRefresh();
  };

  const passbookUpadSum = payments
    .filter((p) => p.payment_type === 'upad_advance')
    .reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalUpadLifetime = Math.max(passbookUpadSum, staff.total_upad_taken || 0);

  const totalSalaryPaid = payments
    .filter((p) => p.payment_type === 'salary_payout')
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  const totalDutyDays = attendance.reduce((sum, a) => sum + (a.day_credit ?? (a.status === 'present' ? 1.0 : a.status === 'half_day' ? 0.5 : 0)), 0);

  const dailyRate = Math.round((staff.monthly_salary || 12000) / 30);
  const earnedSalary = Math.round(dailyRate * totalDutyDays);
  const netSalaryPayable = Math.max(0, earnedSalary - totalUpadLifetime - totalSalaryPaid);

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 max-w-3xl w-full max-h-[92vh] overflow-y-auto shadow-2xl space-y-4">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>{staff.full_name}</span>
                <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-slate-800 text-amber-400">
                  {staff.role}
                </span>
                {staff.designation && (
                  <span className="text-xs text-slate-400 font-normal">
                    • {staff.designation}
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400">
                Mobile: <strong className="text-slate-200 font-mono">{staff.phone}</strong> • Base Salary:{' '}
                <strong className="text-amber-300 font-mono">₹{staff.monthly_salary}/mo</strong> • Shift Target:{' '}
                <strong className="text-sky-300 font-mono">{staff.target_duty_hours || 10}h</strong>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 360 Overview KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 text-center">
            <span className="text-[10px] text-slate-500 uppercase block">Duty Credit (Selected)</span>
            <span className="font-mono font-bold text-emerald-400 text-base">{totalDutyDays} Days</span>
          </div>
          <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 text-center">
            <span className="text-[10px] text-slate-500 uppercase block">Min Full Day</span>
            <span className="font-mono font-bold text-slate-200 text-base">{staff.min_full_day_hours || 8}h</span>
          </div>
          <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 text-center">
            <span className="text-[10px] text-slate-500 uppercase block">Lifetime Upad</span>
            <span className="font-mono font-bold text-rose-400 text-base">₹{totalUpadLifetime}</span>
          </div>
          <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 text-center">
            <span className="text-[10px] text-slate-500 uppercase block">Lifetime Salary Paid</span>
            <span className="font-mono font-bold text-sky-400 text-base">₹{totalSalaryPaid}</span>
          </div>
        </div>

        {/* Dossier Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('attendance')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'attendance'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" /> 1. Attendance &amp; Working Hours
            </button>
            <button
              onClick={() => setActiveTab('passbook')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'passbook'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" /> 2. Lifetime Salary &amp; Upad Passbook
            </button>
          </div>

          {activeTab === 'attendance' && (
            <div className="flex items-center gap-1 text-[11px] font-bold">
              <span className="text-slate-500 mr-1">Range:</span>
              {[
                { r: 1, label: 'This Month' },
                { r: 2, label: 'Last 2M' },
                { r: 3, label: 'Last 3M' },
                { r: 999, label: 'All-Time' },
              ].map((opt) => (
                <button
                  key={opt.r}
                  onClick={() => setMonthsRange(opt.r)}
                  className={`px-2 py-1 rounded-lg transition ${
                    monthsRange === opt.r
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {activeTab === 'passbook' && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowUpadModal(true)}
                className="px-3 py-1.5 rounded-xl bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-700/80 text-xs font-bold transition flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> + Give Upad
              </button>
              <button
                onClick={() => {
                  setSalaryAmount(netSalaryPayable > 0 ? netSalaryPayable : (staff.monthly_salary || 12000));
                  setSalaryNotes(`Salary Settlement (${totalDutyDays} Days Worked)`);
                  setShowSalaryModal(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition flex items-center gap-1"
              >
                <DollarSign className="w-3.5 h-3.5" /> + Pay Monthly Salary
              </button>
            </div>
          )}
        </div>

        {/* TAB 1: ATTENDANCE & WORKING HOURS TABLE */}
        {activeTab === 'attendance' && (
          <div className="space-y-2">
            {loading ? (
              <div className="py-8 text-center text-xs text-slate-400">Loading attendance dossier...</div>
            ) : attendance.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500 bg-slate-950/60 rounded-2xl border border-slate-800">
                No attendance punches logged for this period.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-slate-800 text-[10px] uppercase text-slate-400">
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3">CCTV In</th>
                      <th className="py-2 px-3">CCTV Out</th>
                      <th className="py-2 px-3">Hours</th>
                      <th className="py-2 px-3">Credit</th>
                      <th className="py-2 px-3 text-right">Attendance Action / Override</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {attendance.map((rec) => {
                      const isEarlyLeave = rec.is_owner_approved_early_leave;
                      const dayCredit = rec.day_credit ?? (rec.status === 'present' ? 1.0 : rec.status === 'half_day' ? 0.5 : 0.0);

                      return (
                        <tr key={rec.id} className="hover:bg-slate-950/60 transition">
                          <td className="py-2.5 px-3 text-slate-200 font-bold">
                            {formatSimpleDate(rec.attendance_date)}
                          </td>
                          <td className="py-2.5 px-3 text-emerald-400">
                            {formatCCTVTimestamp(rec.punch_in_time).substring(11)}
                          </td>
                          <td className="py-2.5 px-3 text-rose-300">
                            {rec.punch_out_time ? formatCCTVTimestamp(rec.punch_out_time).substring(11) : 'On Duty'}
                          </td>
                          <td className="py-2.5 px-3 text-slate-300">
                            {rec.hours_worked !== null && rec.hours_worked !== undefined
                              ? `${rec.hours_worked}h`
                              : 'In Progress'}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                dayCredit >= 1.0
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : dayCredit >= 0.5
                                  ? 'bg-amber-500/20 text-amber-300'
                                  : 'bg-rose-500/20 text-rose-400'
                              }`}
                            >
                              {dayCredit >= 1.0 ? '1.0 Full' : dayCredit >= 0.5 ? '0.5 Half' : '0.0 Absent'}
                            </span>
                            {isEarlyLeave && (
                              <span className="ml-1 text-[9px] text-sky-400 font-sans font-bold">
                                (Early OK)
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              <button
                                type="button"
                                onClick={() => handleSetCredit(rec.id, 1.0)}
                                className="px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 font-sans font-bold text-[10px] transition"
                                title="Credit 1 Full Duty Day"
                              >
                                ✅ 1 Day
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSetCredit(rec.id, 0.5)}
                                className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 font-sans font-bold text-[10px] transition"
                                title="Credit 0.5 Half Duty Day"
                              >
                                🌓 0.5 Day
                              </button>
                              {!rec.punch_out_time && (
                                <button
                                  type="button"
                                  onClick={() => handleForcePunchOut(rec.id)}
                                  className="px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white font-sans font-bold text-[10px] transition"
                                  title="Force Punch Out Shift"
                                >
                                  🔴 Force Out
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleDeleteAttendance(rec.id)}
                                className="p-1 rounded bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 transition"
                                title="Delete Attendance Record"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: LIFETIME SALARY & UPAD PASSBOOK */}
        {activeTab === 'passbook' && (
          <div className="space-y-2">
            {loading ? (
              <div className="py-8 text-center text-xs text-slate-400">Loading passbook...</div>
            ) : payments.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500 bg-slate-950/60 rounded-2xl border border-slate-800">
                No salary payouts or upad advances recorded yet for this staff member.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-slate-800 text-[10px] uppercase text-slate-400">
                      <th className="py-2 px-3">Date &amp; Time</th>
                      <th className="py-2 px-3">Payment Type</th>
                      <th className="py-2 px-3">Amount (₹)</th>
                      <th className="py-2 px-3">Mode</th>
                      <th className="py-2 px-3">Notes / Purpose</th>
                      <th className="py-2 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {payments.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-950/60 transition">
                        <td className="py-2.5 px-3 text-slate-300">
                          {formatCCTVTimestamp(p.created_at)}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              p.payment_type === 'salary_payout'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : p.payment_type === 'upad_advance'
                                ? 'bg-rose-500/20 text-rose-300'
                                : 'bg-indigo-500/20 text-indigo-300'
                            }`}
                          >
                            {p.payment_type.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-100 text-sm">
                          ₹{p.amount}
                        </td>
                        <td className="py-2.5 px-3 uppercase text-slate-400">
                          {p.payment_mode}
                        </td>
                        <td className="py-2.5 px-3 text-slate-400 font-sans">
                          {p.notes || '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeletePayment(p.id)}
                            className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-300 text-[10px] font-bold font-sans transition inline-flex items-center gap-1"
                            title="Delete Entry & Reverse Balance"
                          >
                            <Trash2 className="w-3 h-3" /> Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* MODAL: GIVE UPAD */}
        {showUpadModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 max-w-sm w-full space-y-3 shadow-2xl">
              <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Plus className="w-4 h-4 text-rose-400" /> Give Staff Upad Advance
              </h4>
              <p className="text-xs text-slate-400">
                Staff: <strong className="text-slate-200">{staff.full_name}</strong>
              </p>

              <form onSubmit={handleRecordUpad} className="space-y-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Upad Amount (₹) *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="e.g. 500"
                    value={upadAmount}
                    onChange={(e) => setUpadAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono font-bold text-rose-300 focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setUpadMode('cash')}
                    className={`py-1.5 rounded-xl text-xs font-bold border transition ${
                      upadMode === 'cash'
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                        : 'bg-slate-950 text-slate-300 border-slate-800'
                    }`}
                  >
                    Cash
                  </button>
                  <button
                    type="button"
                    onClick={() => setUpadMode('upi')}
                    className={`py-1.5 rounded-xl text-xs font-bold border transition ${
                      upadMode === 'upi'
                        ? 'bg-indigo-500 text-slate-100 border-indigo-400'
                        : 'bg-slate-950 text-slate-300 border-slate-800'
                    }`}
                  >
                    UPI
                  </button>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Reason / Note</label>
                  <input
                    type="text"
                    placeholder="e.g. Emergency, Medicine, Grocery"
                    value={upadNotes}
                    onChange={(e) => setUpadNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowUpadModal(false)}
                    className="px-3 py-1.5 rounded-xl border border-slate-700 text-slate-300 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold"
                  >
                    Confirm Upad
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: PAY MONTHLY SALARY (STRUCTURED PRO-RATA CALCULATION) */}
        {showSalaryModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 max-w-md w-full space-y-3.5 shadow-2xl">
              <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-400" /> Pay Staff Salary (Pro-Rata Settlement)
              </h4>
              <p className="text-xs text-slate-400">
                Staff: <strong className="text-slate-200">{staff.full_name}</strong> • Base: <strong className="text-amber-400 font-mono">₹{staff.monthly_salary || 12000}/mo</strong>
              </p>

              {/* Pro-Rata Math Breakdown Card */}
              <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-slate-300">
                  <span>Duty Days Worked:</span>
                  <span className="font-mono font-bold text-emerald-400">{totalDutyDays} Days</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span>Pro-Rata Daily Rate (Monthly / 30):</span>
                  <span className="font-mono text-slate-200">₹{dailyRate} / day</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span>Gross Earned Salary:</span>
                  <span className="font-mono font-bold text-emerald-400">₹{earnedSalary}</span>
                </div>
                <div className="flex items-center justify-between text-rose-400">
                  <span>Less: Total Upad Deductions:</span>
                  <span className="font-mono font-bold">-₹{totalUpadLifetime}</span>
                </div>
                <div className="flex items-center justify-between text-sky-400">
                  <span>Less: Salary Already Paid:</span>
                  <span className="font-mono font-bold">-₹{totalSalaryPaid}</span>
                </div>
                <div className="pt-1.5 border-t border-slate-800 flex items-center justify-between font-bold text-slate-100">
                  <span>Net Balance Payable:</span>
                  <span className="font-mono text-emerald-300 text-sm">₹{netSalaryPayable}</span>
                </div>
              </div>

              <form onSubmit={handleRecordSalary} className="space-y-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Salary Payout Amount (₹) *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={salaryAmount}
                    onChange={(e) => setSalaryAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-emerald-500/60 rounded-xl text-xs font-mono font-bold text-emerald-300 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Payment Mode *</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSalaryMode('cash')}
                      className={`py-2 rounded-xl text-xs font-bold border transition ${
                        salaryMode === 'cash'
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                          : 'bg-slate-950 text-slate-300 border-slate-800'
                      }`}
                    >
                      💵 Cash Drawer
                    </button>
                    <button
                      type="button"
                      onClick={() => setSalaryMode('upi')}
                      className={`py-2 rounded-xl text-xs font-bold border transition ${
                        salaryMode === 'upi'
                          ? 'bg-indigo-500 text-slate-100 border-indigo-400'
                          : 'bg-slate-950 text-slate-300 border-slate-800'
                      }`}
                    >
                      📱 Online UPI
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Remarks / Month Note</label>
                  <input
                    type="text"
                    value={salaryNotes}
                    onChange={(e) => setSalaryNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowSalaryModal(false)}
                    className="px-3 py-1.5 rounded-xl border border-slate-700 text-slate-300 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition shadow-md shadow-emerald-500/20"
                  >
                    Confirm Salary Payout
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
