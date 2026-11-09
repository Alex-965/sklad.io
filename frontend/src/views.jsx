import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, ArrowRight, Plus, Search, SlidersHorizontal, Pencil, Trash2, TrendingUp, Box, AlertTriangle, Package, Download, Shield, Monitor, Sun, Moon, Check, ExternalLink, Activity, UserRound, LockKeyhole } from 'lucide-react';
import { API_URL, request, money, number, dateTime, fullName, roles, downloadJSON } from './api';
import { Button, PageTitle, Empty, Pagination, Status, Field } from './ui';

export function Dashboard({ data, navigate, open, writable }) {
  const low = data.products.filter(p => p.stock_quantity <= p.min_stock_level);
  const totalValue = data.products.reduce((sum, p) => sum + Number(p.price) * p.stock_quantity, 0);
  const product = id => data.products.find(p => p.id === id);
  return <>
    <PageTitle title="Огляд складу" description="Усе, що відбувається на вашому складі, в одному місці.">
      {writable && <Button variant="primary" icon={Plus} onClick={() => open({ kind: 'movement', type: 'IN' })}>Нове надходження</Button>}
    </PageTitle>
    <div className="stats-grid">
      <Stat label="Загальна вартість запасів" value={money(totalValue)} icon={TrendingUp} color="green" caption={`${number(data.products.length)} позицій у номенклатурі`} />
      <Stat label="Товарів на складі" value={`${number(data.products.reduce((sum, p) => sum + p.stock_quantity, 0))} од.`} icon={Box} color="blue" caption="Поточний облік залишків" />
      <Stat label="Потребують поповнення" value={`${number(low.length)} поз.`} icon={AlertTriangle} color="amber" caption="На рівні мінімального запасу або нижче" />
    </div>
    <div className="dashboard-grid">
      <section className="panel"><div className="panel-heading"><div><h2>Низький залишок <span className="count">{low.length}</span></h2><p>Заплануйте наступне поповнення</p></div><button className="text-button" onClick={() => navigate('products', true)}>Усі товари <ArrowRight size={14} /></button></div>
        {!low.length ? <Empty title="Запасів достатньо">Усі товари мають залишок вище мінімального.</Empty> : <div className="stack-list">{low.slice(0, 5).map(p => <div className="list-row" key={p.id}><div className="product-symbol"><Package size={19} /></div><div className="grow"><strong>{p.name}</strong><small>{p.sku}</small></div><div className="align-right"><strong className="warning-text">{number(p.stock_quantity)} од.</strong><small>мін. {p.min_stock_level}</small></div>{writable && <button aria-label={`Поповнити ${p.name}`} title="Поповнити" className="icon-button" onClick={() => open({ kind: 'movement', type: 'IN', productId: p.id })}><Plus size={17} /></button>}</div>)}</div>}
      </section>
      <section className="panel"><div className="panel-heading"><div><h2>Останні операції</h2><p>Надходження та списання товарів</p></div><button className="text-button" onClick={() => navigate('transactions')}>Уся історія <ArrowRight size={14} /></button></div>
        {!data.transactions.length ? <Empty title="Операцій ще немає">Оформіть перше надходження, щоб почати облік.</Empty> : <div className="stack-list">{data.transactions.slice(0, 5).map(t => <div className="list-row" key={t.id}><MovementIcon type={t.type} /><div className="grow"><strong>{product(t.product_id)?.name || `Товар #${t.product_id}`}</strong><small>{dateTime(t.transaction_date)}</small></div><div className={`movement-number ${t.type === 'IN' ? 'positive' : 'negative'}`}>{t.type === 'IN' ? '+' : '−'}{number(t.quantity)} <small>од.</small></div></div>)}</div>}
      </section>
    </div>
    <section className="overview-footer"><div><span className="live-dot" /> Дані з хмарної бази</div><p>Залишки оновлюються після кожної операції.</p><button className="text-button" onClick={() => navigate('reports')}>Перейти до звітів <ArrowRight size={14} /></button></section>
  </>;
}

function Stat({ label, value, icon: Icon, color, caption }) {
  return <section className="stat panel"><div className="stat-top"><span>{label}</span><div className={`stat-icon ${color}`}><Icon size={19} /></div></div><strong>{value}</strong><p>{caption}</p></section>;
}

function MovementIcon({ type }) {
  return <span className={`movement-icon ${type === 'IN' ? 'green' : 'red'}`}>{type === 'IN' ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}</span>;
}

export function Products({ data, user, open, initialLow }) {
  const [search, setSearch] = useState(''), [category, setCategory] = useState(''), [lowOnly, setLowOnly] = useState(initialLow), [page, setPage] = useState(1);
  const writable = user.role !== 'Manager';
  const filtered = useMemo(() => data.products.filter(p => (`${p.name} ${p.sku}`).toLocaleLowerCase('uk').includes(search.toLocaleLowerCase('uk')) && (!category || p.category_id === Number(category)) && (!lowOnly || p.stock_quantity <= p.min_stock_level)), [data.products, search, category, lowOnly]);
  useEffect(() => setPage(1), [search, category, lowOnly]);
  const pages = Math.max(1, Math.ceil(filtered.length / 15));
  const currentPage = Math.min(page, pages);
  return <>
    <PageTitle title="Номенклатура" description="Каталог товарів, актуальні залишки та контроль запасів.">{writable && <Button variant="primary" icon={Plus} onClick={() => open({ kind: 'product' })}>Додати товар</Button>}</PageTitle>
    <section className="panel"><div className="table-toolbar"><div className="search-field"><Search size={17} /><input aria-label="Пошук товарів" placeholder="Пошук за назвою або артикулом…" value={search} onChange={e => setSearch(e.target.value)} /></div><select aria-label="Фільтр категорії" value={category} onChange={e => setCategory(e.target.value)}><option value="">Усі категорії</option>{data.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><Button icon={SlidersHorizontal} className={lowOnly ? 'active-filter' : ''} aria-pressed={lowOnly} onClick={() => setLowOnly(!lowOnly)}>Низькі залишки</Button></div>
      <div className="table-scroll"><table><thead><tr><th>Товар</th><th>Категорія</th><th className="numeric">Ціна</th><th className="numeric">Залишок</th><th>Статус</th>{writable && <th className="align-right">Дії</th>}</tr></thead><tbody>{filtered.slice((currentPage - 1) * 15, currentPage * 15).map(p => <tr key={p.id}><td><div className="product-cell"><div className="product-symbol"><Package size={19} /></div><div><strong>{p.name}</strong><small className="mono">{p.sku}</small></div></div></td><td><span className="category-label">{data.categories.find(c => c.id === p.category_id)?.name || '—'}</span></td><td className="numeric">{money(p.price)}</td><td className="numeric"><strong>{number(p.stock_quantity)}</strong><small>Мінімум: {p.min_stock_level}</small></td><td><Status stock={p.stock_quantity} minimum={p.min_stock_level} /></td>{writable && <td><div className="row-actions"><button className="icon-button" aria-label={`Редагувати ${p.name}`} onClick={() => open({ kind: 'product', record: p })}><Pencil size={16} /></button>{user.role === 'Admin' && <button className="icon-button danger-hover" aria-label={`Видалити ${p.name}`} onClick={() => open({ kind: 'delete', record: p })}><Trash2 size={16} /></button>}</div></td>}</tr>)}</tbody></table></div>
      {!filtered.length && <Empty title={data.products.length ? 'Нічого не знайдено' : 'Додайте перший товар'}>{data.products.length ? 'Спробуйте інший запит або змініть фільтри.' : 'Створіть картку товару, а потім оформіть його надходження.'}</Empty>}
      <Pagination page={currentPage} pages={pages} count={filtered.length} onChange={setPage} />
    </section>
  </>;
}

export function Transactions({ data, user, open }) {
  const [type, setType] = useState(''), [search, setSearch] = useState(''), [from, setFrom] = useState(''), [to, setTo] = useState(''), [page, setPage] = useState(1);
  const product = id => data.products.find(p => p.id === id);
  const filtered = data.transactions.filter(t => (!type || t.type === type) && (!search || `${product(t.product_id)?.name || ''} ${product(t.product_id)?.sku || ''} ${t.notes}`.toLocaleLowerCase('uk').includes(search.toLocaleLowerCase('uk'))) && (!from || new Date(t.transaction_date) >= new Date(`${from}T00:00:00`)) && (!to || new Date(t.transaction_date) <= new Date(`${to}T23:59:59.999`)));
  useEffect(() => setPage(1), [search, type, from, to]);
  const pages = Math.max(1, Math.ceil(filtered.length / 15)), currentPage = Math.min(page, pages);
  return <><PageTitle title="Рух товарів" description="Прозора історія надходжень і списань на складі.">{user.role !== 'Manager' && <><Button icon={ArrowUpRight} onClick={() => open({ kind: 'movement', type: 'OUT' })}>Списати товар</Button><Button variant="primary" icon={Plus} onClick={() => open({ kind: 'movement', type: 'IN' })}>Надходження</Button></>}</PageTitle>
    <section className="panel"><div className="table-toolbar wrap"><div className="search-field"><Search size={17} /><input aria-label="Пошук операцій" placeholder="Товар, артикул або примітка…" value={search} onChange={e => setSearch(e.target.value)} /></div><select aria-label="Тип операції" value={type} onChange={e => setType(e.target.value)}><option value="">Усі операції</option><option value="IN">Надходження</option><option value="OUT">Списання</option></select><label className="date-filter">З<input type="date" aria-label="Дата початку" value={from} max={to || undefined} onChange={e => setFrom(e.target.value)} /></label><label className="date-filter">До<input type="date" aria-label="Дата завершення" value={to} min={from || undefined} onChange={e => setTo(e.target.value)} /></label><Button icon={Download} aria-label="Завантажити історію руху" onClick={() => downloadJSON(filtered, 'sklad-movements.json')} /></div>
    <div className="table-scroll"><table><thead><tr><th>Операція</th><th>Товар</th><th className="numeric">Кількість</th><th>Дата й час</th><th>Співробітник</th><th>Примітка</th></tr></thead><tbody>{filtered.slice((currentPage - 1) * 15, currentPage * 15).map(t => <tr key={t.id}><td><div className="inline"><MovementIcon type={t.type} /><span>{t.type === 'IN' ? 'Надходження' : 'Списання'}<small className="mono">#{String(t.id).padStart(4, '0')}</small></span></div></td><td><strong>{product(t.product_id)?.name || `Товар #${t.product_id}`}</strong><small className="mono">{product(t.product_id)?.sku}</small></td><td className={`numeric movement-number ${t.type === 'IN' ? 'positive' : 'negative'}`}>{t.type === 'IN' ? '+' : '−'}{number(t.quantity)}</td><td className="nowrap">{dateTime(t.transaction_date)}</td><td>{data.users.find(u => u.id === t.user_id) ? fullName(data.users.find(u => u.id === t.user_id)) : t.user_id === user.id ? fullName(user) : `Співробітник #${t.user_id}`}</td><td className="note-cell">{t.notes || '—'}</td></tr>)}</tbody></table></div>{!filtered.length && <Empty title="Операцій не знайдено">Нові надходження та списання відображатимуться тут.</Empty>}<Pagination page={currentPage} pages={pages} count={filtered.length} onChange={setPage} /></section><p className="footnote">Показано останні 1000 операцій. Кількість змінюється лише через зареєстрований рух товару.</p></>;
}

export function Users({ data, open }) {
  const [search, setSearch] = useState('');
  const filtered = data.users.filter(u => `${fullName(u)} ${u.email}`.toLocaleLowerCase('uk').includes(search.toLocaleLowerCase('uk')));
  return <><PageTitle title="Користувачі" description="Команда, облікові записи та права доступу до складу."><Button variant="primary" icon={Plus} onClick={() => open({ kind: 'user' })}>Додати співробітника</Button></PageTitle><section className="panel"><div className="table-toolbar"><div className="search-field"><Search size={17} /><input aria-label="Пошук користувачів" placeholder="Ім’я або email співробітника…" value={search} onChange={e => setSearch(e.target.value)} /></div><span className="muted">{data.users.length} у команді</span></div><div className="table-scroll"><table><thead><tr><th>Співробітник</th><th>Email</th><th>Роль</th><th>Статус</th><th className="align-right">Дії</th></tr></thead><tbody>{filtered.map(u => <tr key={u.id}><td><div className="inline"><span className="avatar">{u.first_name[0]}{u.last_name[0]}</span><strong>{fullName(u)}</strong></div></td><td>{u.email}</td><td><span className="role-label"><Shield size={13} />{roles[u.role]}</span></td><td><span className={`badge ${u.active ? 'green' : 'red'}`}><i />{u.active ? 'Активний' : 'Заблокований'}</span></td><td><div className="row-actions"><button className="icon-button" aria-label={`Редагувати ${u.email}`} onClick={() => open({ kind: 'user', record: u })}><Pencil size={16} /></button></div></td></tr>)}</tbody></table></div>{!filtered.length && <Empty title="Користувачів не знайдено" />}</section><div className="role-explanation"><Shield size={17} /><p><strong>Права доступу.</strong> Адміністратор керує командою та товарами; комірник веде номенклатуру й рух; менеджер переглядає залишки та звіти.</p></div></>;
}

export function Reports({ run }) {
  const [kind, setKind] = useState('stock'), [report, setReport] = useState(null), [error, setError] = useState('');
  useEffect(() => { let active = true; setReport(null); setError(''); request(`/reports/${kind}`).then(value => { if (active) setReport(value); }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, [kind]);
  return <><PageTitle title="Звіти" description="Залишки, вартість запасів і товари, які потрібно поповнити."><Button icon={Download} disabled={!report} onClick={() => downloadJSON(report, `sklad-${kind}.json`)}>Експортувати JSON</Button></PageTitle><div className="report-tabs"><button className={kind === 'stock' ? 'selected' : ''} onClick={() => setKind('stock')}>Усі залишки</button><button className={kind === 'low-stock' ? 'selected' : ''} onClick={() => setKind('low-stock')}>Низькі залишки</button></div>{error && <p className="inline-error" role="alert">{error}</p>}<section className="panel"><div className="panel-heading"><div><h2>{kind === 'stock' ? 'Звіт про залишки' : 'Потребують поповнення'}</h2><p>Сформовано за актуальними даними складу</p></div><div className="report-total"><small>Загальна вартість</small><strong>{report ? money(report.total_value) : '…'}</strong></div></div><div className="table-scroll"><table><thead><tr><th>Артикул</th><th>Назва товару</th><th className="numeric">Залишок, од.</th><th className="numeric">Вартість</th></tr></thead><tbody>{report?.items.map(p => <tr key={p.sku}><td className="mono">{p.sku}</td><td><strong>{p.name}</strong></td><td className="numeric">{number(p.stock)}</td><td className="numeric">{money(p.value)}</td></tr>)}</tbody></table></div>{report && !report.items.length && <Empty title="Товарів у звіті немає">Спробуйте інший тип звіту або додайте товари.</Empty>}</section></>;
}

export function Settings({ preferences, updatePreference, data, open, writable }) {
  return <><PageTitle title="Налаштування" description="Налаштуйте робочий простір так, як зручно саме вам." /><section className="panel settings-panel"><div className="section-icon"><Monitor size={20} /></div><div className="grow"><h2>Вигляд інтерфейсу</h2><p>Тема застосовується до всіх сторінок і зберігається у цьому браузері.</p><div className="theme-options">{[['dark', Moon, 'Темна', 'Для роботи ввечері'], ['light', Sun, 'Світла', 'Для роботи вдень'], ['system', Monitor, 'Системна', 'Як на вашому пристрої']].map(([value, Icon, label, caption]) => <button key={value} aria-pressed={preferences.theme === value} className={`theme-option ${preferences.theme === value ? 'chosen' : ''}`} onClick={() => updatePreference('theme', value)}><div className={`theme-preview ${value}`}><i /><i /><i /></div><div><Icon size={15} /><strong>{label}</strong>{preferences.theme === value && <Check size={15} />}</div><small>{caption}</small></button>)}</div></div></section>
    <section className="panel settings-panel"><div className="section-icon"><SlidersHorizontal size={20} /></div><div className="grow"><h2>Робочий простір</h2><div className="setting-row"><div><strong>Компактні таблиці</strong><p>Менші відступи для більшої кількості записів на екрані.</p></div><Toggle label="Компактні таблиці" checked={preferences.compact} onChange={value => updatePreference('compact', value)} /></div><div className="setting-row"><div><strong>Повідомлення про залишки</strong><p>Показувати товари, які досягли мінімального запасу.</p></div><Toggle label="Повідомлення про залишки" checked={preferences.notifications} onChange={value => updatePreference('notifications', value)} /></div><small className="muted">Ці параметри змінюють лише ваш інтерфейс у цьому браузері.</small></div></section>
    <div className="dashboard-grid"><Catalogue title="Категорії товарів" items={data.categories} writable={writable} add={() => open({ kind: 'category' })} /><Catalogue title="Постачальники" items={data.suppliers} writable={writable} add={() => open({ kind: 'supplier' })} /></div>
  </>;
}

function Toggle({ label, checked, onChange }) { return <button role="switch" aria-label={label} aria-checked={checked} className={`toggle ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)}><span /></button>; }
function Catalogue({ title, items, writable, add }) { return <section className="panel"><div className="panel-heading"><div><h2>{title} <span className="count">{items.length}</span></h2><p>Спільний довідник складу</p></div>{writable && <Button icon={Plus} onClick={add}>Додати</Button>}</div><div className="catalogue-list">{items.map(p => <div key={p.id}><span className="product-symbol"><Package size={16} /></span><strong>{p.name}</strong></div>)}{!items.length && <Empty title="Довідник порожній" />}</div></section>; }

export function Profile({ user, run, refreshUser, onPasswordChanged, security = false }) {
  const [passwordError, setPasswordError] = useState('');
  const [saving, setSaving] = useState(false);
  async function saveProfile(event) {
    event.preventDefault(); const values = Object.fromEntries(new FormData(event.target)); setSaving(true);
    await run(async () => { const updated = await request('/auth/me', 'PUT', values); refreshUser(updated); }, 'Профіль збережено'); setSaving(false);
  }
  async function savePassword(event) {
    event.preventDefault(); setPasswordError(''); const form = event.target, values = Object.fromEntries(new FormData(form));
    if (values.new_password !== values.confirm_password) { setPasswordError('Нові паролі не збігаються'); return; }
    setSaving(true);
    const ok = await run(() => request('/auth/password', 'POST', { old_password: values.old_password, new_password: values.new_password }), 'Пароль змінено. Увійдіть із новим паролем.');
    setSaving(false); if (ok) onPasswordChanged();
  }
  return <><PageTitle title={security ? 'Безпека облікового запису' : 'Мій профіль'} description={security ? 'Керуйте паролем і захистом свого облікового запису.' : 'Ваші особисті дані та доступ до робочого простору.'} />
    {!security ? <section className="panel profile-panel"><div className="profile-summary"><span className="avatar large">{user.first_name[0]}{user.last_name[0]}</span><h2>{fullName(user)}</h2><p>{user.email}</p><span className="badge green"><Shield size={12} />{roles[user.role]}</span></div><form onSubmit={saveProfile}><div className="form-grid"><Field label="Ім’я" name="first_name" required maxLength={100} defaultValue={user.first_name} /><Field label="Прізвище" name="last_name" required maxLength={100} defaultValue={user.last_name} /></div><Field label="Email" type="email" value={user.email} readOnly hint="Адресу облікового запису може змінити адміністратор." /><div className="form-footer"><Button variant="primary" busy={saving} type="submit">Зберегти зміни</Button></div></form></section> : <section className="panel security-panel"><div className="inline"><span className="section-icon"><LockKeyhole size={21} /></span><div><h2>Зміна пароля</h2><p>Після зміни всі попередні сеанси завершаться.</p></div></div><form onSubmit={savePassword}><Field label="Поточний пароль" name="old_password" type="password" autoComplete="current-password" required maxLength={128} /><Field label="Новий пароль" name="new_password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} hint="8–128 символів: великі й малі літери, цифра та спеціальний символ." /><Field label="Повторіть новий пароль" name="confirm_password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} />{passwordError && <p role="alert" className="inline-error">{passwordError}</p>}<Button variant="primary" busy={saving} type="submit">Змінити пароль</Button></form></section>}
  </>;
}

const actions = { 'login.success': 'Успішний вхід', 'login.failed': 'Невдала спроба входу', 'stock.IN': 'Надходження товару', 'stock.OUT': 'Списання товару', 'profile.updated': 'Оновлення профілю', 'password.changed': 'Зміна пароля', 'user.updated': 'Оновлення співробітника' };
export function Audit({ data }) {
  const [items, setItems] = useState(null), [error, setError] = useState('');
  useEffect(() => { request('/audit').then(setItems).catch(e => setError(e.message)); }, []);
  return <><PageTitle title="Історія активності" description="Журнал входів, складських операцій і змін облікових записів." />{error && <p className="inline-error" role="alert">{error}</p>}<section className="panel"><div className="table-scroll"><table><thead><tr><th>Подія</th><th>Користувач</th><th>Дата й час</th></tr></thead><tbody>{items?.map(item => <tr key={item.id}><td><div className="inline"><Activity size={16} /><strong>{actions[item.action] || item.action}</strong></div></td><td>{data.users.find(u => u.id === item.user_id)?.email || (item.user_id ? `#${item.user_id}` : 'Невідомий користувач')}</td><td>{dateTime(item.created_at)}</td></tr>)}</tbody></table></div>{items && !items.length && <Empty title="Подій ще немає" />}</section><p className="footnote">Останні 100 подій. Журнал доступний лише адміністратору.</p></>;
}

export function Documentation() {
  return <><PageTitle title="Документація API" description="Відкритий контракт серверної частини Sklad.io."><a className="button primary" href={`${API_URL}/docs`} target="_blank" rel="noreferrer">Відкрити Swagger UI <ExternalLink size={15} /></a></PageTitle><section className="panel documentation"><h2>Як працює система</h2><p>Інтерфейс отримує товари, довідники й історію через REST API. Кожна операція перевіряє вашу роль. Надходження та списання одночасно змінюють залишок і створюють запис історії.</p><div className="endpoint-list">{[['POST', '/auth/login', 'Вхід і отримання токена'], ['GET', '/products', 'Номенклатура та пошук товарів'], ['POST', '/transactions', 'Надходження або списання'], ['GET', '/reports/stock', 'Звіт про залишки'], ['GET', '/reports/low-stock', 'Товари для поповнення'], ['PUT', '/users/{id}', 'Керування співробітниками']].map(([method, path, label]) => <div key={path}><span className="method">{method}</span><code>{path}</code><span>{label}</span></div>)}</div><p>Документація використовує той самий сервер, що й цей застосунок. Для захищених запитів передайте токен через кнопку Authorize.</p></section></>;
}
