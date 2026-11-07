import React, { useState, useEffect } from 'react';
import { User, Shop, JobCard } from './types/supabase';
import { supabaseService, offlineStorage, flushSyncQueue } from './utils/supabaseService';
import { MechanicDashboard } from './components/MechanicDashboard';
import { ManagerDashboard } from './components/ManagerDashboard';
import { OwnerDashboard } from './components/OwnerDashboard';
import { CustomersKhataView } from './components/CustomersKhataView';
import { InvoicePdfModal } from './components/InvoicePdfModal';
import { RegisterShopModal } from './components/RegisterShopModal';
import { LoginModal } from './components/LoginModal';
import { NotificationContainer, notify } from './components/NotificationModal';
import {
  Wrench,
  FileText,
  Users,
  CreditCard,
  Crown,
  LogIn,
  Store,
  RefreshCw,
  Sparkles,
  Shield,
  Layers,
  LogOut,
  Bike,
  Lock,
  Send,
  Phone,
  KeyRound,
  AlertCircle,
} from 'lucide-react';

export default function App() {
  const [allShops, setAllShops] = useState<Shop[]>([]);
  const [currentShop, setCurrentShop] = useState<Shop | null>(() => {
    try {
      const saved = localStorage.getItem('bikeready_session_shop');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('bikeready_session_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Active view: 'workbench' | 'khata' | 'owner_master'
  const [activeTab, setActiveTab] = useState<'workbench' | 'khata' | 'owner_master'>(() => {
    try {
      const saved = localStorage.getItem('bikeready_active_tab');
      if (saved === 'workbench' || saved === 'khata' || saved === 'owner_master') return saved;
      return 'workbench';
    } catch {
      return 'workbench';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('bikeready_active_tab', activeTab);
    } catch {}
  }, [activeTab]);

  const [isUpdatingApp, setIsUpdatingApp] = useState(false);
  const handleUpdateAppLive = async () => {
    if (isUpdatingApp) return;
    setIsUpdatingApp(true);
    notify.alert('Checking for latest updates & clearing old caches...', 'OTA Live Update', 'info');
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          try {
            await registration.update();
            await registration.unregister();
          } catch (e) {
            console.warn('SW unregister error:', e);
          }
        }
      }
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        for (const name of cacheNames) {
          try {
            await caches.delete(name);
          } catch (e) {
            console.warn('Cache delete error:', name, e);
          }
        }
      }
      await bootApp();
      notify.success('BikeReady Pro updated smoothly with latest features!', 'Update Complete');
    } catch (err: any) {
      notify.error('Update encountered an issue: ' + (err?.message || 'Unknown error'));
    } finally {
      setIsUpdatingApp(false);
    }
  };

  // Offline-First Sync & Connectivity State
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(() =>
    offlineStorage.getQueueCount()
  );

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      flushSyncQueue().then(({ synced }) => {
        if (synced > 0) {
          notify.success(`Auto-synced ${synced} offline changes to cloud!`, 'Cloud Synced');
          bootApp();
        }
        setPendingSyncCount(offlineStorage.getQueueCount());
      });
    };
    const handleOffline = () => {
      setIsOnline(false);
      setPendingSyncCount(offlineStorage.getQueueCount());
    };
    const handleQueueUpdated = () => {
      setPendingSyncCount(offlineStorage.getQueueCount());
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('br_queue_updated', handleQueueUpdated);

    // 15-second heartbeat to flush sync queue
    const interval = setInterval(() => {
      if (typeof navigator !== 'undefined' && navigator.onLine && offlineStorage.getQueueCount() > 0) {
        flushSyncQueue().then(({ synced }) => {
          if (synced > 0) {
            bootApp();
          }
          setPendingSyncCount(offlineStorage.getQueueCount());
        });
      } else {
        setPendingSyncCount(offlineStorage.getQueueCount());
      }
    }, 15000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('br_queue_updated', handleQueueUpdated);
      clearInterval(interval);
    };
  }, [currentShop?.id]);

  // Modals & Direct Login State
  const [invoiceModalCard, setInvoiceModalCard] = useState<JobCard | null>(null);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPin, setLoginPin] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Forgot PIN Recovery Modal State
  const [showForgotPinModal, setShowForgotPinModal] = useState(false);
  const [forgotTab, setForgotTab] = useState<'owner' | 'staff'>('owner');
  const [forgotPhone, setForgotPhone] = useState('');
  const [forgotRecoveryKey, setForgotRecoveryKey] = useState('');
  const [forgotNewPin, setForgotNewPin] = useState('');
  const [forgotMsg, setForgotMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [isResettingPin, setIsResettingPin] = useState(false);

  const handleResetOwnerPinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotMsg(null);
    setIsResettingPin(true);
    try {
      const res = await supabaseService.resetOwnerPin(forgotPhone, forgotRecoveryKey, forgotNewPin);
      if (res.success) {
        setForgotMsg({ text: res.message, error: false });
        notify.success(res.message, 'PIN Reset Successful');
        setLoginPhone(forgotPhone.replace(/\D/g, ''));
        setLoginPin(forgotNewPin);
        setTimeout(() => {
          setShowForgotPinModal(false);
          setForgotMsg(null);
          setForgotPhone('');
          setForgotRecoveryKey('');
          setForgotNewPin('');
        }, 1500);
      } else {
        setForgotMsg({ text: res.message, error: true });
        notify.error(res.message, 'Reset Failed');
      }
    } finally {
      setIsResettingPin(false);
    }
  };

  // Sync session with localStorage (stays logged in indefinitely until explicit Logout)
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('bikeready_session_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('bikeready_session_user');
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentShop) {
      localStorage.setItem('bikeready_session_shop', JSON.stringify(currentShop));
    } else {
      localStorage.removeItem('bikeready_session_shop');
    }
  }, [currentShop]);

  const handleLogout = () => {
    localStorage.removeItem('bikeready_session_user');
    localStorage.removeItem('bikeready_session_shop');
    localStorage.removeItem('bikeready_demo_mode');
    setCurrentUser(null);
    setCurrentShop(null);
    setLoginPhone('');
    setLoginPin('');
    setLoginError('');
  };

  // Initial Boot & Data Load
  const bootApp = async () => {
    const shops = await supabaseService.getShops();
    setAllShops(shops);

    // CRITICAL: NEVER auto-select shops[0] when not logged in!
    // currentShop must remain null until authenticated with valid credentials.
    if (!currentUser) {
      setCurrentShop(null);
      return;
    }

    // If logged in, ensure currentShop matches the authenticated user's shop_id
    const targetShop = shops.find((s) => s.id === currentUser.shop_id) || currentShop;
    if (targetShop) {
      setCurrentShop(targetShop);
      const users = await supabaseService.getUsersByShop(targetShop.id);
      setAllUsers(users);

      const fresh = users.find((u) => u.id === currentUser.id);
      if (fresh) setCurrentUser(fresh);
    }
  };

  useEffect(() => {
    bootApp();
  }, [currentUser?.shop_id]);

  // Online / offline event listener for network resilience (e.g. 5G to 4G switch)
  useEffect(() => {
    const handleOnline = () => {
      console.log('BikeReady network reconnected. Auto-resyncing data...');
      bootApp();
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [currentShop?.id]);

  // Direct Login Form Handler
  const handleDirectLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (loginPhone.length < 10) {
      setLoginError('Please enter a valid 10-digit mobile number.');
      return;
    }
    if (loginPin.length < 4) {
      setLoginError('Please enter your 4-digit PIN.');
      return;
    }
    setIsLoggingIn(true);
    try {
      const res = await supabaseService.loginWithPhonePin(loginPhone, loginPin);
      if (res) {
        setCurrentShop(res.shop);
        setCurrentUser(res.user);
        if (res.user.phone === '9999999999') {
          setActiveTab('owner_master');
        } else if (res.user.role === 'owner') {
          setActiveTab('owner_master');
        } else {
          setActiveTab('workbench');
        }
        setLoginPhone('');
        setLoginPin('');
      } else {
        setLoginError('Invalid mobile number or 4-digit PIN. Please enter correct credentials.');
      }
    } catch (err: any) {
      if (err?.message === 'STAFF_DEACTIVATED') {
        setLoginError('🚫 This staff account has been deactivated (Left Job). Please contact the workshop owner to reactivate.');
      } else {
        setLoginError(err?.message || 'Login failed.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Switch Shop (Used by Super Admin or Demo)
  const handleSwitchShop = async (shopId: string) => {
    const shop = allShops.find((s) => s.id === shopId) || null;
    if (shop) {
      setCurrentShop(shop);
      const users = await supabaseService.getUsersByShop(shop.id);
      setAllUsers(users);
      if (currentUser && currentUser.phone !== '9999999999') {
        const owner = users.find((u) => u.role === 'owner') || users[0] || null;
        setCurrentUser(owner);
      }
    }
  };

  // Switch User
  const handleSwitchUser = (user: User) => {
    setCurrentUser(user);
    if (user.role === 'owner') {
      setActiveTab('owner_master');
    } else {
      setActiveTab('workbench');
    }
  };

  const isTempMgrActive =
    currentUser?.is_temp_manager &&
    currentUser.temp_manager_expires_at &&
    new Date(currentUser.temp_manager_expires_at).getTime() > Date.now();

  const isNormalMechanic = currentUser?.role === 'mechanic' && !isTempMgrActive;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* 1. APP HEADER & NAVIGATION BAR (2-Row Clean Layout on Mobile & Desktop) */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 px-3 sm:px-4 py-2 shadow-md">
        <div className="max-w-7xl mx-auto space-y-2">
          {/* ROW 1: Logo + Name on top-left, User Badge + Logout on top-right */}
          <div className="flex items-center justify-between gap-3">
            {/* Top-Left: Logo & Shop Title */}
            <div className="flex items-center gap-2 min-w-0 flex-1 sm:flex-initial">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-slate-950 flex items-center justify-center font-black shadow-lg shadow-amber-500/20 shrink-0">
                <Bike className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h1 className="text-xs sm:text-sm font-black text-slate-100 tracking-tight whitespace-nowrap">
                    BikeReady
                  </h1>
                  <span className="text-[9px] sm:text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 font-mono font-bold">
                    PRO
                  </span>
                </div>
                <p className="text-[10px] sm:text-[11px] text-slate-400 truncate max-w-[120px] xs:max-w-[170px] sm:max-w-xs font-semibold">
                  {currentShop ? currentShop.shop_name : 'HK AUTO CENTER'}
                </p>
              </div>
            </div>

            {/* Top-Right: Active User Badge & Session Controls */}
            <div className="flex items-center gap-2 shrink-0">
              {currentUser ? (
                <div className="flex items-center gap-2">
                  <div className="flex flex-col text-right min-w-0 max-w-[100px] sm:max-w-[160px]">
                    <span className="text-xs font-bold text-slate-200 truncate">
                      {currentUser.full_name}
                    </span>
                    <span className="text-[10px] text-amber-400 capitalize font-medium truncate">
                      {currentUser.phone === '9999999999'
                        ? '👑 Super Admin'
                        : currentUser.role === 'owner'
                        ? '👑 Workshop Owner'
                        : currentUser.role === 'manager'
                        ? '👔 Manager'
                        : isTempMgrActive
                        ? '⏳ 4h Temp Mgr'
                        : '🔧 Mechanic'}
                    </span>
                  </div>

                  {/* Status Pill: Online & Synced OR Offline Mode */}
                  {isOnline && pendingSyncCount === 0 ? (
                    <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[11px] font-semibold">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span>🟢 Online &amp; Synced</span>
                    </span>
                  ) : (
                    <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/40 text-[11px] font-semibold">
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                      <span>
                        {isOnline
                          ? `Syncing (${pendingSyncCount})`
                          : `📡 Offline (${pendingSyncCount})`}
                      </span>
                    </span>
                  )}

                  {/* In-app live sync icon */}
                  <button
                    onClick={handleUpdateAppLive}
                    disabled={isUpdatingApp}
                    className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-semibold transition border border-amber-500/20 shadow-sm cursor-pointer flex items-center gap-1 shrink-0"
                    title="Live Over-The-Air Update & Sync"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isUpdatingApp ? 'animate-spin' : ''}`} />
                    <span className="hidden md:inline">Sync</span>
                  </button>

                  {/* Logout Button */}
                  <button
                    onClick={handleLogout}
                    className="p-1.5 sm:p-2 rounded-xl bg-slate-800 hover:bg-rose-950 hover:text-rose-300 text-slate-400 text-xs transition cursor-pointer shrink-0"
                    title="Logout from Workshop"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowRegisterModal(true)}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition cursor-pointer"
                  >
                    + Register Workshop
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ROW 2: Main Navigation Tabs cleanly spanning the width */}
          {currentUser && (
            <nav className="flex items-center gap-1.5 overflow-x-auto pb-0.5 pt-1 border-t border-slate-800/80">
              {currentUser.phone === '9999999999' ? (
                <button
                  onClick={() => setActiveTab('owner_master')}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 flex items-center gap-1.5"
                >
                  <Crown className="w-3.5 h-3.5 text-slate-950" />
                  <span>👑 Software Seller Master Panel</span>
                </button>
              ) : (
                <>
                  <button
                    onClick={() => setActiveTab('workbench')}
                    className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 whitespace-nowrap ${
                      activeTab === 'workbench'
                        ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <Wrench className="w-3.5 h-3.5 shrink-0" />
                    <span>{isNormalMechanic ? 'Mechanic Desk' : 'Job Cards & Billing'}</span>
                  </button>

                  {/* Khata / Udhaar tab: Strictly HIDDEN for Normal Mechanics */}
                  {!isNormalMechanic && (
                    <button
                      onClick={() => setActiveTab('khata')}
                      className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 whitespace-nowrap ${
                        activeTab === 'khata'
                          ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      <CreditCard className="w-3.5 h-3.5 shrink-0" />
                      <span>Khata / Udhaar</span>
                    </button>
                  )}

                  {currentUser.role === 'owner' && (
                    <button
                      onClick={() => setActiveTab('owner_master')}
                      className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 whitespace-nowrap ${
                        activeTab === 'owner_master'
                          ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      <Crown className="w-3.5 h-3.5 shrink-0" />
                      <span>Owner Master</span>
                    </button>
                  )}
                </>
              )}
            </nav>
          )}
        </div>
      </header>

      {/* 3. MAIN BODY CONTAINER */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-4 md:p-6 pb-24">
        {!currentUser ? (
          /* STRICT LOGIN SCREEN FIRST - No auto login into Owner account */
          <div className="min-h-[72vh] flex flex-col items-center justify-center p-3 sm:p-4">
            <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
              <div className="text-center space-y-2">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center shadow-lg shadow-amber-500/10">
                  <Bike className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-black text-slate-100 tracking-tight">
                  Sign In to Workshop
                </h2>
                <p className="text-xs text-slate-400">
                  Enter Mobile Number &amp; 4-Digit Security PIN
                </p>
              </div>

              {loginError && (
                <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-800/80 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{loginError}</span>
                </div>
              )}

              <form onSubmit={handleDirectLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-amber-400" /> Mobile Number
                  </label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    placeholder="Enter 10-digit mobile"
                    value={loginPhone}
                    onChange={(e) => setLoginPhone(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-amber-500 font-mono tracking-wide"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-amber-400" /> 4-Digit Security PIN
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    required
                    placeholder="••••"
                    value={loginPin}
                    onChange={(e) => setLoginPin(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-amber-500 font-mono tracking-widest text-center text-lg"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-sm transition shadow-lg shadow-amber-500/20 disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
                >
                  <LogIn className="w-4 h-4" />
                  <span>{isLoggingIn ? 'Authenticating...' : 'Sign In to Workshop'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPinModal(true);
                    setForgotMsg(null);
                  }}
                  className="w-full text-center text-xs font-semibold text-slate-400 hover:text-amber-400 transition pt-1 flex items-center justify-center gap-1.5"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>🔑 Forgot PIN / Reset Password?</span>
                </button>
              </form>

              <div className="pt-3 border-t border-slate-800 text-center space-y-2">
                <p className="text-xs text-slate-400">
                  Don't have a workshop account yet?
                </p>
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(true)}
                  className="mt-0.5 text-xs font-bold text-amber-400 hover:text-amber-300 transition cursor-pointer"
                >
                  + Register New Workshop
                </button>
              </div>
            </div>
          </div>
        ) : !currentShop ? (
          <div className="min-h-[50vh] flex flex-col items-center justify-center text-center p-6 bg-slate-900 border border-slate-800 rounded-3xl">
            <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mb-3" />
            <h3 className="text-base font-bold text-slate-100">
              Loading Workshop Data...
            </h3>
          </div>
        ) : currentShop.license_status === 'suspended' && currentUser.phone !== '9999999999' ? (
          <div className="min-h-[55vh] flex flex-col items-center justify-center text-center p-8 bg-slate-900 border-2 border-rose-600/70 rounded-3xl max-w-lg mx-auto my-10 shadow-2xl space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
              <Lock className="w-8 h-8" />
            </div>
            <div>
              <span className="px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 text-xs font-bold uppercase tracking-wider border border-rose-500/40">
                🔴 Software License Suspended
              </span>
              <h2 className="text-xl font-bold text-slate-100 mt-3">
                {currentShop.shop_name}
              </h2>
              <p className="text-xs text-slate-400 mt-2 max-w-sm leading-relaxed mx-auto">
                Your workshop license for this garage has been suspended or expired. Please contact BikeReady Software Support to renew your workshop subscription and instantly resume full access.
              </p>
            </div>

            <div className="w-full pt-2 space-y-2">
              <a
                href={`https://wa.me/919999999999?text=${encodeURIComponent(
                  `Hi BikeReady Support, I would like to renew the software license for my workshop: ${currentShop.shop_name} (Owner: ${currentShop.owner_name}, Phone: ${currentShop.owner_phone}).`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm transition shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" /> Renew via WhatsApp (Support)
              </a>
              <button
                onClick={handleLogout}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs transition"
              >
                Logout from Workshop
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* TAB 1: WORKBENCH (Adapts automatically to Mechanic vs Manager vs Owner) */}
            {activeTab === 'workbench' && (
              <>
                {isNormalMechanic ? (
                  <MechanicDashboard
                    currentUser={currentUser}
                    currentShop={currentShop}
                    onRefreshData={bootApp}
                    onOpenInvoiceModal={(card) => setInvoiceModalCard(card)}
                  />
                ) : (
                  <ManagerDashboard
                    currentUser={currentUser}
                    currentShop={currentShop}
                    onRefreshData={bootApp}
                    onOpenInvoiceModal={(card) => setInvoiceModalCard(card)}
                  />
                )}
              </>
            )}

            {/* TAB 2: KHATA / UDHAAR LEDGER (Hidden for normal mechanics) */}
            {activeTab === 'khata' && !isNormalMechanic && (
              <CustomersKhataView
                currentShop={currentShop}
                currentUser={currentUser}
                onRefreshData={bootApp}
              />
            )}

            {/* TAB 3: OWNER MASTER COMMAND CENTER (or Super Admin Master) */}
            {activeTab === 'owner_master' && (currentUser.role === 'owner' || currentUser.phone === '9999999999') && (
              <OwnerDashboard
                currentUser={currentUser}
                currentShop={currentShop}
                onRefreshData={bootApp}
                onOpenInvoiceModal={(card) => setInvoiceModalCard(card)}
              />
            )}
          </>
        )}
      </main>

      {/* 4. MODALS */}
      {/* Official Printable Invoice PDF Modal */}
      <InvoicePdfModal
        jobCard={invoiceModalCard}
        shop={currentShop}
        isOpen={!!invoiceModalCard}
        onClose={() => setInvoiceModalCard(null)}
      />

      {/* Register New Shop Modal */}
      <RegisterShopModal
        isOpen={showRegisterModal}
        onClose={() => setShowRegisterModal(false)}
        onRegistered={(newShop, newOwner) => {
          setAllShops((prev) => [newShop, ...prev]);
          setCurrentShop(newShop);
          setAllUsers([newOwner]);
          setCurrentUser(newOwner);
          setActiveTab('owner_master');
        }}
      />

      {/* Mobile + PIN Login Modal */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onLoginSuccess={(user, shop) => {
          setCurrentShop(shop);
          setCurrentUser(user);
        }}
        onOpenRegister={() => setShowRegisterModal(true)}
      />

      {/* 5. FORGOT PIN / PASSWORD RECOVERY MODAL */}
      {showForgotPinModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-slate-900 border-2 border-amber-500/50 w-full max-w-md rounded-3xl p-6 shadow-2xl relative text-slate-100 my-auto space-y-4">
            <button
              onClick={() => setShowForgotPinModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition"
            >
              <LogOut className="w-4 h-4 rotate-180" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                <KeyRound className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">
                  Password &amp; PIN Recovery
                </h3>
                <p className="text-xs text-slate-400">
                  Reset 4-Digit Security PIN for your workshop account
                </p>
              </div>
            </div>

            {/* Tab switch between Owner Reset and Staff Reset */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-2xl border border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setForgotTab('owner');
                  setForgotMsg(null);
                }}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition ${
                  forgotTab === 'owner'
                    ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                👑 Owner PIN Reset
              </button>
              <button
                type="button"
                onClick={() => {
                  setForgotTab('staff');
                  setForgotMsg(null);
                }}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition ${
                  forgotTab === 'staff'
                    ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                🔧 Staff / Worker PIN
              </button>
            </div>

            {forgotMsg && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                  forgotMsg.error
                    ? 'bg-rose-950/80 border-rose-700 text-rose-300'
                    : 'bg-emerald-950/80 border-emerald-600 text-emerald-300'
                }`}
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{forgotMsg.text}</span>
              </div>
            )}

            {forgotTab === 'owner' ? (
              <form onSubmit={handleResetOwnerPinSubmit} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Registered Owner Mobile Number *
                  </label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    placeholder="Enter 10-digit mobile"
                    value={forgotPhone}
                    onChange={(e) => setForgotPhone(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 font-mono tracking-wide"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Secret Recovery Passcode *
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Enter Secret Recovery Key"
                    value={forgotRecoveryKey}
                    onChange={(e) => setForgotRecoveryKey(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 font-mono tracking-wider"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Set New 4-Digit Security PIN *
                  </label>
                  <input
                    type="password"
                    required
                    maxLength={4}
                    placeholder="e.g. 5678"
                    value={forgotNewPin}
                    onChange={(e) => setForgotNewPin(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 font-mono text-center tracking-widest text-base"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isResettingPin}
                  className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-sm transition shadow-lg shadow-amber-500/20 disabled:opacity-50 mt-2"
                >
                  {isResettingPin ? 'Updating PIN in Cloud...' : '🔑 Reset Owner PIN Now'}
                </button>

                <div className="pt-2 text-center border-t border-slate-800/80 mt-3">
                  <a
                    href="https://wa.me/919999999999?text=Hello%20BikeReady%20Admin%2C%20I%20need%20help%20recovering%20my%20login%20PIN%20for%20workshop."
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition font-semibold"
                  >
                    <Send className="w-3.5 h-3.5" /> 📲 Request Reset Help from Software Admin
                  </a>
                </div>
              </form>
            ) : (
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3 text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-amber-400" />
                  <span className="font-bold text-slate-100">Staff Worker PIN Policy</span>
                </div>
                <p className="leading-relaxed">
                  Mechanic and Manager PINs can be viewed or changed anytime directly by the Workshop Owner.
                </p>
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-2 text-[11px]">
                  <div>
                    1. Ask your Workshop Owner to log in to their account.
                  </div>
                  <div>
                    2. Go to <strong className="text-amber-400">Owner Master &rarr; Staff Payroll &amp; Attendance</strong>.
                  </div>
                  <div>
                    3. On each worker's card, click <strong className="text-emerald-400">"🔑 Reset PIN"</strong> to set a new 4-digit code in 1 second.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Global In-App Alert and Confirmation Modal */}
      <NotificationContainer />
    </div>
  );
}
