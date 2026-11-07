import React, { useState } from 'react';
import { supabaseService } from '../utils/supabaseService';
import { Shop, User } from '../types/supabase';
import { Store, UserCircle, Phone, QrCode, KeyRound, X, CheckCircle, AlertCircle } from 'lucide-react';

interface RegisterShopModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegistered: (shop: Shop, user: User) => void;
}

export const RegisterShopModal: React.FC<RegisterShopModalProps> = ({
  isOpen,
  onClose,
  onRegistered,
}) => {
  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [upiId, setUpiId] = useState('bikeready@upi');
  const [pinCode, setPinCode] = useState('1234');
  const [masterKey, setMasterKey] = useState('');
  const [shopAddress, setShopAddress] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [invoiceTerms, setInvoiceTerms] = useState('Thank you for choosing our workshop. 30 days warranty on standard service.');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!shopName.trim() || !ownerName.trim() || !ownerPhone.trim()) {
      setErrorMsg('Please fill in Shop Name, Owner Name, and Mobile Number.');
      return;
    }

    if (!masterKey.trim() || masterKey.trim().toUpperCase() !== 'BIKEREADY2026') {
      setErrorMsg('Invalid Master Activation Key. Please enter a valid license key or contact the Software Seller.');
      return;
    }

    if (pinCode.length < 4) {
      setErrorMsg('PIN must be 4 digits.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await supabaseService.registerShop(
        shopName,
        ownerName,
        ownerPhone,
        upiId,
        pinCode,
        masterKey,
        shopAddress,
        gstNumber,
        invoiceTerms
      );

      if (res) {
        onRegistered(res.shop, res.user);
        onClose();
      } else {
        setErrorMsg('Failed to register shop. Please check database connectivity.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
              <Store className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">
                Register New Workshop
              </h2>
              <p className="text-xs text-slate-400">
                Multi-Tenant Isolated Database Tenant
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-700/60 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Store className="w-3.5 h-3.5 text-amber-400" /> Shop / Center Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Apex MotoCare / Sai Auto Works"
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <UserCircle className="w-3.5 h-3.5 text-amber-400" /> Owner Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Rajesh Kumar"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-amber-400" /> Mobile Number *
              </label>
              <input
                type="tel"
                required
                maxLength={10}
                placeholder="10-digit mobile"
                value={ownerPhone}
                onChange={(e) => setOwnerPhone(e.target.value.replace(/\D/g, ''))}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <QrCode className="w-3.5 h-3.5 text-amber-400" /> UPI ID (For Invoices)
              </label>
              <input
                type="text"
                placeholder="e.g. shop@okaxis"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-amber-400" /> 4-Digit Owner PIN
              </label>
              <input
                type="password"
                maxLength={4}
                required
                value={pinCode}
                onChange={(e) => setPinCode(e.target.value.replace(/\D/g, ''))}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-amber-500 tracking-widest text-center font-mono font-bold"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-amber-400 mb-1.5 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-amber-400" /> Master SaaS Activation Key *
            </label>
            <input
              type="password"
              required
              placeholder="••••••••••••"
              value={masterKey}
              onChange={(e) => setMasterKey(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-amber-500/50 rounded-xl text-amber-300 font-mono text-sm tracking-wider focus:outline-none focus:border-amber-400"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Required to activate lifetime commercial garage software license
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Shop Address (On Invoices)
              </label>
              <input
                type="text"
                placeholder="e.g. Station Road, Sector 4"
                value={shopAddress}
                onChange={(e) => setShopAddress(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                GSTIN / Trade Lic. (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. 27ABCDE1234F1Z5"
                value={gstNumber}
                onChange={(e) => setGstNumber(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-amber-500 uppercase"
              />
            </div>
          </div>

          <p className="text-[11px] text-slate-400">
            * Automatically initializes initial inventory and Owner account under your new isolated <code className="text-amber-400">shop_id</code>.
          </p>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-sm font-bold shadow-lg shadow-amber-500/20 transition disabled:opacity-50 flex items-center gap-1.5"
            >
              {isSubmitting ? 'Creating Workshop...' : 'Create Workshop'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
