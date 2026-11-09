export const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://127.0.0.1:8000');

export function clearSession() {
  sessionStorage.removeItem('sklad_token');
}

export async function request(path, method = 'GET', data) {
  const token = sessionStorage.getItem('sklad_token');
  const response = await fetch(API_URL + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  if (response.status === 204) return null;
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && path !== '/auth/login') {
      clearSession();
      window.dispatchEvent(new Event('sklad:expired'));
    }
    const details = body.errors?.map(error => error.message).join('; ');
    throw new Error((body.message || 'Не вдалося виконати запит') + (details ? `: ${details}` : ''));
  }
  return body;
}

export async function allProducts() {
  const products = [];
  for (let offset = 0; ; offset += 1000) {
    const page = await request(`/products?limit=1000&offset=${offset}`);
    products.push(...page);
    if (page.length < 1000) return products;
  }
}

export const roles = { Admin: 'Адміністратор', Storekeeper: 'Комірник', Manager: 'Менеджер' };
export const money = value => new Intl.NumberFormat('uk-UA', { style: 'currency', currency: 'UAH' }).format(Number(value || 0));
export const number = value => new Intl.NumberFormat('uk-UA').format(value || 0);
export const dateTime = value => value ? new Intl.DateTimeFormat('uk-UA', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Kyiv' }).format(new Date(value)) : '—';
export const fullName = user => `${user.first_name} ${user.last_name}`;

export function downloadJSON(data, name) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
