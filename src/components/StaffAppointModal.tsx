import React, { useState } from 'react';
import { Shop, User, UserRole } from '../types/supabase';
import { supabaseService } from '../utils/supabaseService';
import { X, UserPlus, Phone, KeyRound, DollarSign, Clock, ShieldCheck } from 'lucide-react';

interface StaffAppointModalProps {
  isOpen: boolean;
  currentShop: Shop;
  onClose: () => void;
  onSaved: () => void;
}

export const StaffAppointModal: React.FC<StaffAppointModalProps> = ({
  isOpen,
  currentShop,
  onClose,
  onSaved,
}) => {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('mechanic');
  const [designation, setDesignation] = useState('Senior Mechanic');
  const [pinCode, setPinCode] = useState('1234');
  const [monthlySalary, setMonthlySalary] = useState<number>(12000);
  const [targetDutyHours, setTargetDutyHours] = useState<number>(10);
  const [minFullDayHours, setMinFullDayHours] = useState<number>(8);
  const [minHalfDayHours, setMinHalfDayHours] = useState<number>(4.5);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !phone.trim()) return;

    setIsSubmitting(true);
    try {
      await supabaseService.saveStaffUser({
        shop_id: currentShop.id,
        full_name: fullName.trim(),
        phone: phone.trim(),
        pin_code: pinCode.trim() || '1234',
        role,
        designation: designation.trim() || (role === 'manager' ? 'Floor Manager' : 'Senior Mechanic'),
        monthly_salary: Number(monthlySalary) || 12000,
        target_duty_hours: Number(targetDutyHours) || 10,
        min_full_day_hours: Number(minFullDayHours) || 8,
        min_half_day_hours: Number(minHalfDayHours) || 4.5,
      });

      onSaved();
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 max-w-md w-full shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                + Appoint New Staff / Position
              </h3>
              <p className="text-[11px] text-slate-400">
                Register employee in {currentShop.shop_name} with custom working hour rules
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Full Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Ramesh Kumar"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Mobile Number *
              </label>
              <input
                type="tel"
                required
                maxLength={10}
                placeholder="10 Digits"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                4-Digit Login PIN *
              </label>
              <input
                type="password"
                required
                maxLength={4}
                value={pinCode}
                onChange={(e) => setPinCode(e.target.value.replace(/\D/g, ''))}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono font-bold text-amber-300 text-center tracking-widest"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Role *
              </label>
              <select
                value={role}
                onChange={(e) => {
                  const r = e.target.value as UserRole;
                  setRole(r);
                  if (r === 'manager') setDesignation('Floor Manager');
                  else setDesignation('Senior Mechanic');
                }}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100"
              >
                <option value="mechanic">Mechanic</option>
                <option value="manager">Manager</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Designation / Position
              </label>
              <input
                type="text"
                placeholder="Senior Mechanic, Helper, Washer"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Monthly Salary (₹)
              </label>
              <input
                type="number"
                min="1000"
                value={monthlySalary}
                onChange={(e) => setMonthlySalary(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono font-bold text-emerald-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Shift Target (Hours)
              </label>
              <input
                type="number"
                min="4"
                max="16"
                value={targetDutyHours}
                onChange={(e) => setTargetDutyHours(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono font-bold text-sky-400"
              />
            </div>
          </div>

          {/* Smart Working Hours Gatekeeper */}
          <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-2 text-xs">
            <span className="font-bold text-slate-300 block text-[11px] uppercase tracking-wide">
              Smart Attendance Duty Thresholds:
            </span>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Min Full-Day Hours</label>
                <input
                  type="number"
                  step="0.5"
                  min="4"
                  max="14"
                  value={minFullDayHours}
                  onChange={(e) => setMinFullDayHours(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono font-bold text-slate-200"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Min Half-Day Hours</label>
                <input
                  type="number"
                  step="0.5"
                  min="2"
                  max="10"
                  value={minHalfDayHours}
                  onChange={(e) => setMinHalfDayHours(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono font-bold text-slate-200"
                />
              </div>
            </div>
            <p className="text-[10px] text-slate-500">
              Hours &lt; {minHalfDayHours}h logged as Short/Absent. Owner can approve early leave anytime.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold transition disabled:opacity-40"
            >
              {isSubmitting ? 'Appointing...' : 'Appoint Staff'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
