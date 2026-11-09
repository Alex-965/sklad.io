import React, { useState } from 'react';
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Trash2 } from 'lucide-react';
import { request, roles, number } from './api';
import { Dialog, Field, Button } from './ui';

export default function Editor({ modal, close, data, user, run, refresh }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(String(modal.productId || data.products[0]?.id || ''));
  const record = modal.record, kind = modal.kind;
  const product = data.products.find(p => p.id === Number(selectedProduct));
  const title = kind === 'product' ? record ? 'Редагувати товар' : 'Новий товар' : kind === 'movement' ? modal.type === 'IN' ? 'Надходження товару' : 'Списання товару' : kind === 'user' ? record ? 'Редагувати співробітника' : 'Новий співробітник' : kind === 'delete' ? 'Видалити товар' : kind === 'category' ? 'Нова категорія' : 'Новий постачальник';
  async function save(event) {
    event.preventDefault(); setError(''); setBusy(true);
    const values = Object.fromEntries(new FormData(event.target));
    try {
      if (kind === 'product') {
        const payload = { sku: values.sku, name: values.name, category_id: Number(values.category_id), supplier_id: values.supplier_id ? Number(values.supplier_id) : null, price: values.price, min_stock_level: Number(values.min_stock_level) };
        await request(`/products${record ? `/${record.id}` : ''}`, record ? 'PUT' : 'POST', payload);
      } else if (kind === 'movement') {
        await request('/transactions', 'POST', { product_id: Number(selectedProduct), type: modal.type, quantity: Number(values.quantity), notes: values.notes });
      } else if (kind === 'user') {
        if (record) { values.active = values.active === 'true'; await request(`/users/${record.id}`, 'PUT', values); }
        else await request('/users', 'POST', values);
      } else if (kind === 'delete') await request(`/products/${record.id}`, 'DELETE');
      else await request(kind === 'category' ? '/categories' : '/suppliers', 'POST', values);
      await refresh(); close();
      run(async () => {}, kind === 'delete' ? 'Товар видалено' : 'Зміни збережено');
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  return <Dialog title={title} description={kind === 'product' ? 'Заповніть картку номенклатури. Залишок змінюється через рух товарів.' : kind === 'movement' ? 'Операція збережеться в історії та оновить залишок.' : undefined} onClose={close} busy={busy}>
    <form onSubmit={save}>
      {kind === 'product' && <>
        <Field label="Назва товару" name="name" required maxLength={255} defaultValue={record?.name || ''} placeholder="Наприклад, Ноутбук Dell XPS 15" />
        <div className="form-grid"><Field label="Артикул (SKU)" name="sku" required maxLength={100} defaultValue={record?.sku || ''} placeholder="SKU-1001" /><Field label="Категорія"><select name="category_id" required defaultValue={record?.category_id || data.categories[0]?.id || ''}><option value="" disabled>Оберіть категорію</option>{data.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field></div>
        <div className="form-grid"><Field label="Ціна, грн" name="price" type="number" min="0" max="99999999.99" step="0.01" required defaultValue={record?.price || ''} placeholder="0,00" /><Field label="Мінімальний запас" name="min_stock_level" type="number" min="0" step="1" required defaultValue={record?.min_stock_level ?? 5} /></div>
        <Field label="Постачальник"><select name="supplier_id" defaultValue={record?.supplier_id || ''}><option value="">Не вказано</option>{data.suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
        <div className="form-note"><span className="live-dot" />Поточний залишок: <strong>{record?.stock_quantity || 0} од.</strong>{!record && ' Після створення картки оформіть надходження.'}</div>
      </>}
      {kind === 'movement' && <>
        <div className={`movement-banner ${modal.type === 'IN' ? 'green' : 'red'}`}>{modal.type === 'IN' ? <ArrowDownLeft size={21} /> : <ArrowUpRight size={21} />}<span>{modal.type === 'IN' ? 'Поповнення запасів' : 'Видача або списання зі складу'}</span></div>
        {!data.products.length ? <p className="inline-error">Спочатку додайте товар у номенклатуру.</p> : <><Field label="Товар"><select name="product_id" value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)} required>{data.products.map(p => <option key={p.id} value={p.id}>{p.name} · {p.sku}</option>)}</select></Field><div className="stock-preview"><span>Доступний залишок</span><strong>{number(product?.stock_quantity)} од.</strong></div><Field label="Кількість" name="quantity" type="number" min="1" max={modal.type === 'OUT' ? product?.stock_quantity : 1000000000} step="1" required placeholder="Введіть кількість" /><Field label="Примітка"><textarea name="notes" rows={3} maxLength={1000} placeholder="Номер накладної, причина списання або інша інформація" /></Field></>}
      </>}
      {kind === 'user' && <>
        <div className="form-grid"><Field label="Ім’я" name="first_name" required maxLength={100} defaultValue={record?.first_name || ''} /><Field label="Прізвище" name="last_name" required maxLength={100} defaultValue={record?.last_name || ''} /></div>
        <Field label="Email співробітника" name="email" type="email" required defaultValue={record?.email || ''} />
        {!record && <Field label="Пароль співробітника" name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} hint="Мінімум 8 символів: великі й малі літери, цифра та спеціальний символ." />}
        <Field label="Роль"><select name="role" defaultValue={record?.role || 'Storekeeper'}>{Object.entries(roles).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
        {record && <Field label="Статус"><select name="active" defaultValue={String(record.active)}><option value="true">Активний</option><option value="false">Заблокований</option></select></Field>}
        {record?.id === user.id && <p className="form-note">Власну роль і активність змінювати не можна. Це захищає доступ адміністратора.</p>}
      </>}
      {(kind === 'category' || kind === 'supplier') && <Field label={kind === 'category' ? 'Назва категорії' : 'Назва постачальника'} name="name" required maxLength={150} />}
      {kind === 'delete' && <><div className="delete-symbol"><AlertTriangle size={29} /></div><p className="delete-copy">Видалити <strong>{record.name}</strong> із номенклатури?</p><p className="muted">Товар можна видалити лише за нульового залишку та відсутності операцій. Історія складського обліку залишається захищеною.</p></>}
      {error && <p role="alert" className="inline-error">{error}</p>}
      <div className="form-footer"><Button type="button" onClick={close} disabled={busy}>Скасувати</Button><Button type="submit" variant={kind === 'delete' ? 'danger' : 'primary'} icon={kind === 'delete' ? Trash2 : undefined} busy={busy} disabled={kind === 'movement' && !data.products.length}>{kind === 'delete' ? 'Видалити' : kind === 'movement' ? 'Зберегти операцію' : 'Зберегти'}</Button></div>
    </form>
  </Dialog>;
}
