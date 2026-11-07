import React, { useState } from 'react';
import { Shop, Customer, JobCard } from '../types/supabase';
import { generateWhatsAppLink, generateSmsLink, formatSimpleDate } from '../utils/supabaseService';
import {
  Calendar,
  Clock,
  Send,
  Copy,
  Check,
  CheckCircle2,
  Megaphone,
  MessageSquare,
  Users,
  Bike,
  Phone,
  Sparkles,
} from 'lucide-react';

interface CustomerBroadcastViewProps {
  currentShop: Shop;
  customers: Customer[];
  followupJobCards: JobCard[];
  onRefresh: () => void;
  onUpdateFollowupStatus: (jobCardId: string, status: 'completed' | 'cancelled') => Promise<void>;
}

export const CustomerBroadcastView: React.FC<CustomerBroadcastViewProps> = ({
  currentShop,
  customers,
  followupJobCards,
  onRefresh,
  onUpdateFollowupStatus,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'followups' | 'service_due' | 'broadcast'>('followups');
  const [copiedBroadcast, setCopiedBroadcast] = useState(false);
  const [copiedOnlyNumbers, setCopiedOnlyNumbers] = useState(false);
  const [sentMap, setSentMap] = useState<Record<string, boolean>>({});
  const [includeBlocked, setIncludeBlocked] = useState(false);

  const TEMPLATES = {
    festival:
      `🪔 *Festival Special Offer from ${currentShop.shop_name}!*\n` +
      `Get FREE 15-Point Safety Checkup + 10% OFF on Engine Oil & Labour this festive week!\n` +
      `🛵 Keep your bike running smooth and reliable for festival journeys.\n` +
      `📍 Visit: ${currentShop.shop_name}\n` +
      `📞 Contact: ${currentShop.owner_phone}\n` +
      `Reply "YES" to reserve your priority workshop slot!`,
    monsoon:
      `🌧️ *Monsoon Safety Alert from ${currentShop.shop_name}!*\n` +
      `Riding in the rain? Ensure your motorcycle is 100% road safe!\n` +
      `✅ FREE Brake Shoe & Disc Pad Inspection\n` +
      `✅ FREE Chain Cleaning, Lubrication & Tightening\n` +
      `✅ Spark Plug & Electrical Waterproofing\n` +
      `📍 Visit: ${currentShop.shop_name} | 📞 ${currentShop.owner_phone}\n` +
      `Bring your bike today for instant safety inspection!`,
    service_due:
      `🛵 *Periodic Service Due Reminder - ${currentShop.shop_name}*\n` +
      `Namaste! Your motorcycle service is now due to maintain engine life and peak mileage.\n` +
      `🛠️ Complete oil service, carburettor/FI tuning, brake setting, and 20-point mechanical checkup.\n` +
      `📍 Visit: ${currentShop.shop_name} | 📞 ${currentShop.owner_phone}\n` +
      `Reply to confirm your preferred visit time!`,
    sunday_express:
      `⚡ *Sunday Express Service at ${currentShop.shop_name}!*\n` +
      `Short on time? Fast 45-minute oil change, chain lube, wash, and brake checkup without long waiting.\n` +
      `📍 Visit: ${currentShop.shop_name} | 📞 ${currentShop.owner_phone}\n` +
      `Walk-ins welcome all Sunday from 9:00 AM to 8:00 PM!`,
  };

  const [broadcastOfferMsg, setBroadcastOfferMsg] = useState(TEMPLATES.festival);

  const blockedCount = customers.filter((c) => c.trust_tier === 'blocked').length;
  const broadcastCustomers = customers.filter((c) => (includeBlocked ? true : c.trust_tier !== 'blocked'));

  const validPhones = broadcastCustomers
    .map((c) => c.phone?.replace(/\D/g, ''))
    .filter((p) => p && p.length === 10);
  const uniquePhones = Array.from(new Set(validPhones));

  // Option A1: 1-Click Copy All Numbers (Clean comma-separated for bulk SMS / WhatsApp Broadcast)
  const handleCopyOnlyNumbers = () => {
    navigator.clipboard.writeText(uniquePhones.join(', '));
    setCopiedOnlyNumbers(true);
    setTimeout(() => setCopiedOnlyNumbers(false), 3000);
  };

  // Option A2: Copy Numbers + Message
  const handleCopyBroadcastList = () => {
    const exportText =
      `=== WHATSAPP BROADCAST RECIPIENTS (${uniquePhones.length} CUSTOMERS) ===\n` +
      uniquePhones.join(', ') +
      `\n\n=== BROADCAST MESSAGE ===\n` +
      broadcastOfferMsg;

    navigator.clipboard.writeText(exportText);
    setCopiedBroadcast(true);
    setTimeout(() => setCopiedBroadcast(false), 3000);
  };

  const handleMarkSent = (customerId: string) => {
    setSentMap((prev) => ({ ...prev, [customerId]: true }));
  };

  const pendingFollowups = followupJobCards.filter((jc) => jc.followup_status !== 'completed');
  const serviceDueCustomers = customers.filter((c) => c.current_due > 0 || c.trust_tier === 'trusted' || c.trust_tier === 'regular');

  return (
    <div className="space-y-4">
      {/* Sub-tab Navigation */}
      <div className="flex items-center gap-1.5 border-b border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('followups')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
            activeSubTab === 'followups'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Check-up Follow-ups ({pendingFollowups.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('service_due')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
            activeSubTab === 'service_due'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>90-Day Periodic Service ({serviceDueCustomers.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('broadcast')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
            activeSubTab === 'broadcast'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <Megaphone className="w-3.5 h-3.5" />
          <span>📢 Dual Offer Broadcast Center</span>
        </button>
      </div>

      {/* VIEW 1: CHECK-UP RE-INSPECTION FOLLOW-UPS */}
      {activeSubTab === 'followups' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>Check-up Re-inspections Scheduled by Manager</span>
              </h4>
              <p className="text-xs text-slate-400">
                Customers due for 3/7/15 day post-repair verification (chain tension, oil leaks, break-in)
              </p>
            </div>
          </div>

          {pendingFollowups.length === 0 ? (
            <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-2xl text-xs text-slate-400 space-y-1">
              <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-400" />
              <p className="font-bold text-slate-200">No Pending Follow-ups</p>
              <p className="text-slate-500">
                When finalizing job cards, choose "Schedule Check-up Follow-up" to queue customer re-inspections.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {pendingFollowups.map((jc) => {
                const custName = jc.customer?.customer_name || 'Walk-in Customer';
                const custPhone = jc.customer?.phone || '';
                const msg = `Namaste ${custName}! Friendly follow-up from ${currentShop.shop_name} regarding your bike ${jc.bike_number}.\nReminder for your scheduled check-up: "${jc.followup_note || 'Quick inspection'}". Please bring your bike by today for a free 5-minute check!`;

                return (
                  <div
                    key={jc.id}
                    className="p-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-md flex flex-col justify-between space-y-3"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-slate-100 text-sm">{custName}</span>
                        <span className="px-2 py-0.5 rounded font-mono font-bold text-xs uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          {jc.bike_number}
                        </span>
                      </div>

                      <div className="text-xs space-y-1 text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                          <span>Due Date: <strong className="text-slate-200">{jc.followup_date || 'Today'}</strong></span>
                        </div>
                        {jc.followup_note && (
                          <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-amber-200">
                            📝 Note: {jc.followup_note}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
                      <button
                        onClick={() => onUpdateFollowupStatus(jc.id, 'completed')}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                      >
                        ✓ Mark Checked
                      </button>

                      {custPhone && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <a
                            href={generateWhatsAppLink(custPhone, msg)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition"
                          >
                            <Send className="w-3.5 h-3.5" /> WhatsApp
                          </a>
                          <a
                            href={generateSmsLink(custPhone, msg)}
                            className="px-2.5 py-1.5 rounded-xl bg-sky-600/30 hover:bg-sky-600/50 text-sky-200 font-bold text-xs flex items-center gap-1 border border-sky-600/50 transition"
                            title="Send SMS"
                          >
                            <MessageSquare className="w-3.5 h-3.5" /> SMS
                          </a>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(msg);
                              setSentMap((prev) => ({ ...prev, [jc.id]: true }));
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center gap-1 border border-slate-700 transition"
                            title="Copy message"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: 90-DAY PERIODIC SERVICE DUE */}
      {activeSubTab === 'service_due' && (
        <div className="space-y-3">
          <div>
            <h4 className="text-sm font-bold text-slate-100">
              Customer Periodic Service Due (+90 Days)
            </h4>
            <p className="text-xs text-slate-400">
              Reach out to regular and trusted customers via tailored 1-click WhatsApp message
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {serviceDueCustomers.map((cust) => (
              <div
                key={cust.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-slate-100 text-sm">{cust.customer_name}</span>
                    <span className="px-2 py-0.5 rounded font-mono font-bold text-xs uppercase bg-slate-950 text-amber-400">
                      {cust.bike_number || 'BIKE'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Mobile: {cust.phone} • Tier: <span className="uppercase text-amber-300 font-bold">{cust.trust_tier}</span>
                  </p>
                  {cust.current_due > 0 && (
                    <div className="mt-1 text-xs text-rose-400 font-mono font-bold">
                      Pending Khata Due: ₹{cust.current_due}
                    </div>
                  )}
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-end">
                  {cust.phone && (() => {
                    const reminderMsg = `Namaste ${cust.customer_name}!\nIt's time for regular maintenance of your bike ${cust.bike_number || ''} at ${currentShop.shop_name}.\nVisit today for quick engine oil change & tune-up!`;
                    return (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <a
                          href={generateWhatsAppLink(cust.phone, reminderMsg)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition"
                        >
                          <Send className="w-3.5 h-3.5" /> WhatsApp
                        </a>
                        <a
                          href={generateSmsLink(cust.phone, reminderMsg)}
                          className="px-2.5 py-1.5 rounded-xl bg-sky-600/30 hover:bg-sky-600/50 text-sky-200 font-bold text-xs flex items-center gap-1 border border-sky-600/50 transition"
                          title="Send SMS"
                        >
                          <MessageSquare className="w-3.5 h-3.5" /> SMS
                        </a>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(reminderMsg);
                            setSentMap((prev) => ({ ...prev, [cust.id]: true }));
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center gap-1 border border-slate-700 transition"
                          title="Copy message"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW 3: DUAL OFFER BROADCAST CENTER */}
      {activeSubTab === 'broadcast' && (
        <div className="space-y-5">
          {/* Top Audience & Reachability Metric Banner */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-lg flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <span>Workshop Broadcast &amp; Festival Offer Center</span>
                </h4>
                <p className="text-xs text-slate-400">
                  Total Reachable Unique Verified Phone Numbers: <strong className="text-amber-300 font-mono text-sm">{uniquePhones.length}</strong> (Out of {broadcastCustomers.length} total profiles)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={includeBlocked}
                  onChange={(e) => setIncludeBlocked(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500"
                />
                <span>Include Blocked Customers</span>
                {!includeBlocked && blockedCount > 0 && (
                  <span className="text-[10px] text-rose-400 font-bold bg-rose-950/60 px-1.5 py-0.2 rounded border border-rose-800">
                    {blockedCount} excluded
                  </span>
                )}
              </label>
            </div>
          </div>

          {/* Offer Template Editor with Pre-built Editable Templates */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-lg space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-amber-400" />
                <span>Pre-Built Offer Templates &amp; Message Editor</span>
              </h4>
              <span className="text-[11px] text-slate-400">Click a template below to load &amp; customize:</span>
            </div>

            {/* Template Presets */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setBroadcastOfferMsg(TEMPLATES.festival)}
                className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-amber-500/40 text-amber-300 text-xs font-semibold flex items-center gap-1.5 transition text-left"
              >
                <span>🪔</span>
                <span className="truncate">Festival Free Oil Checkup</span>
              </button>

              <button
                type="button"
                onClick={() => setBroadcastOfferMsg(TEMPLATES.monsoon)}
                className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-sky-500/40 text-sky-300 text-xs font-semibold flex items-center gap-1.5 transition text-left"
              >
                <span>🌧️</span>
                <span className="truncate">Monsoon Brake &amp; Chain</span>
              </button>

              <button
                type="button"
                onClick={() => setBroadcastOfferMsg(TEMPLATES.service_due)}
                className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-indigo-500/40 text-indigo-300 text-xs font-semibold flex items-center gap-1.5 transition text-left"
              >
                <span>🛵</span>
                <span className="truncate">Service Due Reminder</span>
              </button>

              <button
                type="button"
                onClick={() => setBroadcastOfferMsg(TEMPLATES.sunday_express)}
                className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 transition text-left"
              >
                <span>⚡</span>
                <span className="truncate">Sunday Express Maintenance</span>
              </button>
            </div>

            <textarea
              rows={4}
              value={broadcastOfferMsg}
              onChange={(e) => setBroadcastOfferMsg(e.target.value)}
              className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 font-sans focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* METHOD A: 1-CLICK COPY ALL NUMBERS (BULK SMS & WHATSAPP) */}
          <div className="p-4 bg-gradient-to-r from-sky-950/80 to-slate-900 border border-sky-600/70 rounded-2xl shadow-lg flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold">
                <Copy className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-100">
                  Option A: 1-Click Copy All Reachable Numbers ({uniquePhones.length} verified)
                </h4>
                <p className="text-xs text-slate-300">
                  Clean comma-separated format (<code>9823456789, 9811223344</code>) ready to paste into WhatsApp Broadcast or SMS gateway.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleCopyOnlyNumbers}
                className="px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md transition"
              >
                {copiedOnlyNumbers ? (
                  <>
                    <Check className="w-4 h-4" /> ✅ Copied {uniquePhones.length} Numbers!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" /> 📋 1-Click Copy All Numbers
                  </>
                )}
              </button>

              <button
                onClick={handleCopyBroadcastList}
                className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1.5 border border-slate-700 transition"
              >
                {copiedBroadcast ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" /> ✅ Copied Full Message!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-amber-400" /> Copy Numbers &amp; Offer
                  </>
                )}
              </button>
            </div>
          </div>

          {/* METHOD B: RAPID-FIRE CUSTOMER QUEUE */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>(Method B) Rapid-Fire Customer Queue</span>
                </h4>
                <p className="text-xs text-slate-400">
                  Tap to launch personalized WhatsApp chat for each customer. Marked with green badge once sent.
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-400">
                {Object.keys(sentMap).length} / {broadcastCustomers.length} Sent
              </span>
            </div>

            <div className="overflow-x-auto bg-slate-900 border border-slate-800 rounded-2xl">
              <table className="w-full text-left text-xs font-sans">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] uppercase text-slate-400 bg-slate-950/60">
                    <th className="py-2.5 px-3">Customer</th>
                    <th className="py-2.5 px-3">Bike Number</th>
                    <th className="py-2.5 px-3">Mobile Number</th>
                    <th className="py-2.5 px-3">Trust Tier</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {broadcastCustomers.map((c) => {
                    const isSent = !!sentMap[c.id];
                    return (
                      <tr key={c.id} className="hover:bg-slate-950/40 transition">
                        <td className="py-2.5 px-3 font-bold text-slate-200">
                          {c.customer_name}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-amber-300 uppercase">
                          {c.bike_number || '—'}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-400">
                          {c.phone}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-800 text-slate-300">
                            {c.trust_tier}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {c.phone ? (
                            <div className="inline-flex items-center gap-1.5 justify-end">
                              <a
                                href={generateWhatsAppLink(c.phone, broadcastOfferMsg)}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => handleMarkSent(c.id)}
                                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1 transition ${
                                  isSent
                                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/80'
                                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                                }`}
                              >
                                {isSent ? (
                                  <>
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>Sent</span>
                                  </>
                                ) : (
                                  <>
                                    <Send className="w-3.5 h-3.5" />
                                    <span>WhatsApp</span>
                                  </>
                                )}
                              </a>
                              <a
                                href={generateSmsLink(c.phone, broadcastOfferMsg)}
                                className="px-2 py-1.5 rounded-xl bg-sky-600/30 hover:bg-sky-600/50 text-sky-200 font-bold text-xs inline-flex items-center gap-1 border border-sky-600/50 transition"
                                title="Send SMS"
                              >
                                <MessageSquare className="w-3.5 h-3.5" /> SMS
                              </a>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(broadcastOfferMsg);
                                  handleMarkSent(c.id);
                                }}
                                className="px-2 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs inline-flex items-center gap-1 border border-slate-700 transition"
                                title="Copy offer message"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-500">No Mobile</span>
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
    </div>
  );
};
