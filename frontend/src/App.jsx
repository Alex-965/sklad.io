import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutDashboard, Package, ArrowLeftRight, Users as UsersIcon, Settings as SettingsIcon, FileText, Sun, Moon, Bell, Box, LogOut, Shield, Activity, UserRound, ChevronDown, RefreshCw, Menu, X, Check, CheckCheck, AlertTriangle, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { request, allProducts, clearSession, roles, fullName, dateTime, API_URL } from './api';
import { Button } from './ui';
import { Dashboard, Products, Transactions, Users, Reports, Settings, Profile, Audit, Documentation } from './views';
import Editor from './editors';
import './warehouse.css';

const initialData = { products: [], transactions: [], users: [], categories: [], suppliers: [] };
const navigation = [
  ['dashboard', LayoutDashboard, 'Огляд'], ['products', Package, 'Номенклатура'], ['transactions', ArrowLeftRight, 'Рух товарів'],
  ['reports', FileText, 'Звіти'], ['users', UsersIcon, 'Користувачі'], ['settings', SettingsIcon, 'Налаштування'],
];
function saved(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function save(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

export default function App() {
  const [user, setUser] = useState(null), [booting, setBooting] = useState(true), [data, setData] = useState(initialData);
  const [view, setView] = useState(() => saved('sklad.view', 'dashboard')), [lowFilter, setLowFilter] = useState(false);
  const [preferences, setPreferences] = useState(() => ({ theme: 'dark', compact: false, notifications: true, ...saved('sklad.preferences', {}) }));
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  const [modal, setModal] = useState(null), [popup, setPopup] = useState(null), [mobileMenu, setMobileMenu] = useState(false);
  const [toast, setToast] = useState(null), [refreshing, setRefreshing] = useState(false), [loaded, setLoaded] = useState(false), [updated, setUpdated] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [clock, setClock] = useState(new Date()), [loginMessage, setLoginMessage] = useState('');
  const [readNotifications, setReadNotifications] = useState(() => saved('sklad.notifications', {}));
  const headerRef = useRef(null);
  const dark = preferences.theme === 'system' ? systemDark : preferences.theme === 'dark';
  const writable = user && user.role !== 'Manager';
  const closeModal = useCallback(() => setModal(null), []);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const changed = event => setSystemDark(event.matches);
    media.addEventListener('change', changed); return () => media.removeEventListener('change', changed);
  }, []);
  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; document.documentElement.dataset.density = preferences.compact ? 'compact' : 'comfortable'; save('sklad.preferences', preferences); }, [dark, preferences]);
  useEffect(() => { const timer = setInterval(() => setClock(new Date()), 30000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    let active = true;
    if (sessionStorage.getItem('sklad_token')) request('/auth/me').then(value => { if (active) setUser(value); }).catch(() => {}).finally(() => { if (active) setBooting(false); });
    else setBooting(false);
    const expired = () => { setUser(null); setData(initialData); setModal(null); setPopup(null); setLoginMessage('Сеанс завершився. Увійдіть знову.'); };
    window.addEventListener('sklad:expired', expired);
    return () => { active = false; window.removeEventListener('sklad:expired', expired); };
  }, []);
  useEffect(() => {
    function outside(event) { if (!headerRef.current?.contains(event.target)) setPopup(null); }
    function escape(event) { if (event.key === 'Escape') { setPopup(null); setMobileMenu(false); } }
    document.addEventListener('mousedown', outside); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('mousedown', outside); document.removeEventListener('keydown', escape); };
  }, []);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(null), toast.error ? 8000 : 4500); return () => clearTimeout(timer); }, [toast]);

  const refresh = useCallback(async () => {
    if (!user) return;
    setRefreshing(true);
    setLoadError('');
    try {
      const me = await request('/auth/me');
      const [products, transactions, categories, suppliers, users] = await Promise.all([allProducts(), request('/transactions'), request('/categories'), request('/suppliers'), me.role === 'Admin' ? request('/users') : Promise.resolve([])]);
      setUser(current => current && ['email', 'first_name', 'last_name', 'role'].every(key => current[key] === me[key]) ? current : me);
      setData({ products, transactions, categories, suppliers, users }); setLoaded(true); setUpdated(new Date());
    } catch (error) { setLoadError(error.message); throw error; }
    finally { setRefreshing(false); }
  }, [user?.id, user?.role]);
  useEffect(() => { if (user) refresh().catch(e => setToast({ text: e.message, error: true })); }, [refresh]);
  useEffect(() => { if (user && user.role !== 'Admin' && ['users', 'activity'].includes(view)) setView('dashboard'); }, [user, view]);

  function updatePreference(key, value) { setPreferences(current => ({ ...current, [key]: value })); }
  function navigate(next, low = false) { setLowFilter(low); setView(next); save('sklad.view', next); setPopup(null); setMobileMenu(false); }
  async function run(fn, message = 'Операцію виконано') {
    try { await fn(); setToast({ text: message }); return true; }
    catch (error) { setToast({ text: error.message, error: true }); return false; }
  }
  async function logout() {
    const ok = await run(() => request('/auth/logout', 'POST'), 'Ви вийшли з облікового запису');
    if (ok) { clearSession(); setUser(null); setData(initialData); setLoaded(false); setPopup(null); setLoginMessage(''); }
  }
  const notifications = useMemo(() => preferences.notifications ? data.products.filter(p => p.stock_quantity <= p.min_stock_level).map(p => ({ ...p, notificationKey: `${user?.id}:${p.id}:${p.stock_quantity}:${p.min_stock_level}` })) : [], [data.products, preferences.notifications, user?.id]);
  const unread = notifications.filter(p => !readNotifications[p.notificationKey]).length;
  function markRead(keys) { const next = { ...readNotifications }; keys.forEach(key => { next[key] = true; }); setReadNotifications(next); save('sklad.notifications', next); }
  const date = new Intl.DateTimeFormat('uk-UA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Kyiv' }).format(clock);

  if (booting) return <div className="boot-screen"><Brand /><RefreshCw size={22} className="spin" /><p>Відкриваємо робочий простір…</p></div>;
  if (!user) return <Login dark={dark} toggleTheme={() => updatePreference('theme', dark ? 'light' : 'dark')} message={loginMessage} onLogin={value => { setUser(value); setLoginMessage(''); setLoaded(false); navigate('dashboard'); }} />;

  function content() {
    const common = { data, user, open: setModal, writable };
    switch (view) {
      case 'products': return <Products key={`products-${lowFilter}`} {...common} initialLow={lowFilter} />;
      case 'transactions': return <Transactions {...common} />;
      case 'users': return user.role === 'Admin' && <Users {...common} />;
      case 'reports': return <Reports />;
      case 'settings': return <Settings {...common} preferences={preferences} updatePreference={updatePreference} />;
      case 'profile': return <Profile user={user} run={run} refreshUser={setUser} />;
      case 'security': return <Profile user={user} run={run} security onPasswordChanged={() => { clearSession(); setUser(null); setData(initialData); setLoaded(false); setLoginMessage('Пароль змінено. Увійдіть із новим паролем.'); }} />;
      case 'activity': return user.role === 'Admin' && <Audit data={data} />;
      case 'documentation': return <Documentation />;
      default: return <Dashboard {...common} navigate={navigate} />;
    }
  }

  return <div className="app-layout">
    {mobileMenu && <button className="sidebar-scrim" aria-label="Закрити меню" onClick={() => setMobileMenu(false)} />}
    <aside className={`sidebar ${mobileMenu ? 'mobile-open' : ''}`}>
      <div className="sidebar-brand"><Brand /><span className="workspace-tag">WORKSPACE</span></div>
      <div className="workspace-card"><span className="workspace-icon"><Box size={19} /></span><div><strong>Основний склад</strong><small>Робочий простір Sklad.io</small></div><span className="live-dot" /></div>
      <div className="nav-label">РОБОЧИЙ ПРОСТІР</div>
      <nav aria-label="Головне меню">{navigation.filter(([id]) => id !== 'users' || user.role === 'Admin').map(([id, Icon, label]) => <button key={id} aria-label={label} onClick={() => navigate(id)} className={view === id ? 'selected' : ''} aria-current={view === id ? 'page' : undefined}><Icon size={18} /><span>{label}</span>{id === 'products' && <span className="nav-count">{data.products.length}</span>}{id === 'dashboard' && <span className="nav-active-dot" />}</button>)}</nav>
      <div className="sidebar-bottom"><button className={`documentation-link ${view === 'documentation' ? 'selected' : ''}`} onClick={() => navigate('documentation')}><FileText size={17} /><span>Документація API</span><ArrowRight size={14} /></button><div className="sidebar-status"><span className="live-dot" /><span>{updated ? 'Підключено до складу' : 'Завантаження даних'}</span><small>v1.1</small></div></div>
    </aside>
    <div className="workspace-main">
      <header className="topbar" ref={headerRef}>
        <div className="topbar-left"><button className="icon-button mobile-toggle" aria-label="Відкрити меню" onClick={() => setMobileMenu(true)}><Menu size={21} /></button><div className="current-date"><span className="date-mark" /><time dateTime={clock.toISOString()}>{date}</time></div></div>
        <div className="topbar-actions"><button className="icon-button" aria-label="Оновити дані" title={updated ? `Оновлено ${dateTime(updated)}` : 'Оновити дані'} disabled={refreshing} onClick={() => run(refresh, 'Дані оновлено')}><RefreshCw size={17} className={refreshing ? 'spin' : ''} /></button><button className="icon-button" aria-label={dark ? 'Увімкнути світлу тему' : 'Увімкнути темну тему'} title="Змінити тему" onClick={() => updatePreference('theme', dark ? 'light' : 'dark')}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
          <div className="popup-anchor"><button className={`icon-button notification-button ${popup === 'notifications' ? 'pressed' : ''}`} aria-label={`Сповіщення${unread ? `: ${unread} нових` : ''}`} aria-expanded={popup === 'notifications'} onClick={() => setPopup(popup === 'notifications' ? null : 'notifications')}><Bell size={18} />{unread > 0 && <span className="notification-dot" />}</button>
            {popup === 'notifications' && <section className="dropdown notifications"><div className="dropdown-title"><h2>Сповіщення {unread > 0 && <span className="count">{unread}</span>}</h2>{unread > 0 && <button className="icon-button" aria-label="Позначити всі прочитаними" title="Позначити всі прочитаними" onClick={() => markRead(notifications.map(p => p.notificationKey))}><CheckCheck size={17} /></button>}</div>{notifications.length ? <div className="notification-list">{notifications.map(p => <button key={p.id} className={`notification-item ${readNotifications[p.notificationKey] ? 'read' : ''}`} onClick={() => { markRead([p.notificationKey]); navigate('products', true); }}><span className="stat-icon amber"><AlertTriangle size={17} /></span><div><strong>{p.stock_quantity === 0 ? 'Товар закінчився' : 'Низький залишок'}</strong><p>{p.name}</p><small>{p.stock_quantity} од. · мінімум {p.min_stock_level}</small></div>{!readNotifications[p.notificationKey] && <i />}</button>)}</div> : <div className="notification-empty"><Bell size={29} /><strong>{preferences.notifications ? 'Усе під контролем' : 'Сповіщення вимкнені'}</strong><p>{preferences.notifications ? 'Товарів із низькими залишками немає.' : 'Їх можна увімкнути в налаштуваннях.'}</p></div>}<div className="dropdown-footer">Оновлюється разом із залишками складу</div></section>}
          </div>
          <div className="header-divider" />
          <div className="popup-anchor"><button className="profile-button" aria-label="Меню профілю" aria-expanded={popup === 'profile'} onClick={() => setPopup(popup === 'profile' ? null : 'profile')}><span className="avatar">{user.first_name[0]}{user.last_name[0]}</span><span className="profile-name"><strong>{fullName(user)}</strong><small>{roles[user.role]}</small></span><ChevronDown size={14} /></button>
            {popup === 'profile' && <div className="dropdown profile-dropdown"><div className="profile-dropdown-heading"><strong>{fullName(user)}</strong><small>{user.email}</small></div>{[['profile', UserRound, 'Мій профіль'], ['security', Shield, 'Налаштування безпеки'], ...(user.role === 'Admin' ? [['activity', Activity, 'Історія активності']] : [])].map(([id, Icon, label]) => <button key={id} onClick={() => navigate(id)}><Icon size={16} />{label}</button>)}<div className="dropdown-rule" /><button className="logout" onClick={logout}><LogOut size={16} />Вийти</button></div>}
          </div>
        </div>
      </header>
      <main className="main-content" id="main-content"><div className="content-wrap">{!loaded ? <div className="loading-data">{loadError ? <><AlertTriangle size={27} /><h2>Не вдалося завантажити склад</h2><p role="alert">{loadError}</p><Button onClick={() => run(refresh, 'Дані оновлено')}>Спробувати ще раз</Button></> : <><RefreshCw size={25} className="spin" /><h2>Завантажуємо дані складу</h2></>}</div> : <>{loadError && <p className="inline-error" role="alert">Не вдалося оновити дані: {loadError}. Показано останні завантажені записи.</p>}{content()}</>}<footer className="page-footer"><span>Sklad.io <span>·</span> Система складського обліку</span><span>{updated ? `Оновлено о ${new Intl.DateTimeFormat('uk-UA', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Kyiv' }).format(updated)}` : 'Дані ще не завантажено'}</span></footer></div></main>
    </div>
    {modal && <Editor key={`${modal.kind}-${modal.record?.id || ''}`} modal={modal} close={closeModal} data={data} user={user} run={run} refresh={refresh} />}
    {toast && <div className={`toast ${toast.error ? 'error' : ''}`} role={toast.error ? 'alert' : 'status'}>{toast.error ? <AlertTriangle size={19} /> : <Check size={19} />}<span>{toast.text}</span><button className="icon-button" aria-label="Закрити повідомлення" onClick={() => setToast(null)}><X size={16} /></button></div>}
  </div>;
}

function Brand() { return <div className="brand"><span className="brand-icon"><Box size={22} strokeWidth={2} /></span><span>Sklad<span className="brand-accent">.io</span></span></div>; }

function Login({ dark, toggleTheme, onLogin, message }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [visible, setVisible] = useState(false);
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try { const auth = await request('/auth/login', 'POST', Object.fromEntries(new FormData(event.target))); sessionStorage.setItem('sklad_token', auth.access_token); onLogin(await request('/auth/me')); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <main className="login-page"><div className="login-top"><Brand /><button className="icon-button" aria-label={dark ? 'Увімкнути світлу тему' : 'Увімкнути темну тему'} onClick={toggleTheme}>{dark ? <Sun size={20} /> : <Moon size={20} />}</button></div><div className="login-center"><div className="login-badge"><Box size={29} strokeWidth={1.6} /></div><div className="eyebrow">ВАШ РОБОЧИЙ ПРОСТІР</div><h1>Вхід у систему</h1><p>Раді бачити вас знову. Увійдіть, щоб продовжити.</p><form className="login-card" onSubmit={submit}>{message && <div className="login-info" role="status">{message}</div>}{error && <div className="inline-error" role="alert">{error}</div>}<label className="field"><span>Email адреса</span><input name="email" type="email" required autoComplete="username" placeholder="you@company.com" /></label><label className="field"><span>Пароль</span><div className="password-input"><input name="password" type={visible ? 'text' : 'password'} required autoComplete="current-password" placeholder="Введіть ваш пароль" /><button type="button" className="icon-button" aria-label={visible ? 'Приховати пароль' : 'Показати пароль'} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label><Button type="submit" variant="primary" busy={busy}>Увійти до робочого простору <ArrowRight size={17} /></Button><div className="login-protected"><Shield size={14} />Захищений доступ до вашого складу</div></form><p className="login-help">Потрібен обліковий запис? Зверніться до адміністратора.</p></div><footer className="login-footer"><span>© {new Date().getFullYear()} Sklad.io</span><span>Професійна практика · ІПЗ-41</span></footer></main>;
}
