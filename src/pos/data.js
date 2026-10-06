import { useEffect, useState, useCallback } from 'react';

const STORAGE_KEY = 'pos-data-v1';

export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const todayISO = () => new Date().toISOString().slice(0, 10);

const defaultData = () => {
  const storeId = uid();
  return {
    stores: [{ id: storeId, name: 'المتجر الرئيسي', address: '', phone: '' }],
    products: [],
    sales: [],
    expenses: [],
    settings: { currency: 'د.ع', businessName: 'إدارة أعمالي', nextInvoice: 1 },
  };
};

const load = () => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : defaultData();
  } catch (e) {
    return defaultData();
  }
};

// All business data lives in one object persisted to localStorage.
export const usePosData = () => {
  const [data, setData] = useState(null);

  useEffect(() => {
    setData(load());
  }, []);

  useEffect(() => {
    if (!data) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      // storage full or blocked: keep working in memory
    }
  }, [data]);

  const update = useCallback((fn) => setData((d) => fn({ ...d })), []);

  return [data, update, setData];
};

export const formatMoney = (value, currency) =>
  `${Math.round(Number(value) || 0).toLocaleString('en-US')} ${currency || ''}`.trim();

// Revenue, cost of goods, expenses and net profit for a set of filters.
export const computeStats = (data, { storeId, from, to }) => {
  const inScope = (rec) =>
    (!storeId || rec.storeId === storeId) &&
    (!from || rec.date.slice(0, 10) >= from) &&
    (!to || rec.date.slice(0, 10) <= to);

  const sales = data.sales.filter((s) => !s.refunded && inScope(s));
  const expenses = data.expenses.filter(inScope);

  const revenue = sales.reduce((sum, s) => sum + s.total, 0);
  const cogs = sales.reduce(
    (sum, s) => sum + s.items.reduce((a, i) => a + i.cost * i.qty, 0),
    0
  );
  const expenseTotal = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const cash = sales
    .filter((s) => s.payment === 'cash')
    .reduce((sum, s) => sum + s.total, 0);

  return {
    count: sales.length,
    revenue,
    cogs,
    grossProfit: revenue - cogs,
    expenses: expenseTotal,
    netProfit: revenue - cogs - expenseTotal,
    cash,
    card: revenue - cash,
    sales,
  };
};
