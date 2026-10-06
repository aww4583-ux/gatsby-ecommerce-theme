// Row shapes as returned by Supabase. Money fields are whole dinars.

export type AppRole = "owner" | "manager" | "cashier";
export type PaymentMethod = "cash" | "card";

export type Store = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
};

export type Profile = {
  user_id: string;
  organization_id: string;
  full_name: string;
  role: AppRole;
  is_active: boolean;
};

export type Product = {
  id: string;
  store_id: string;
  name: string;
  barcode: string | null;
  category: string | null;
  sale_price: number;
  stock: number;
  low_stock_threshold: number;
  is_active: boolean;
};

export type Shift = {
  id: string;
  store_id: string;
  cashier_id: string;
  opening_cash: number;
  closing_cash: number | null;
  expected_cash: number | null;
  opened_at: string;
  closed_at: string | null;
};

export type ReceiptItem = {
  product_id: string;
  name: string;
  qty: number;
  unit_price: number;
  line_total: number;
};

// Returned by the complete_sale / refund_sale RPCs. Contains no cost data.
export type Receipt = {
  id: string;
  store_id: string;
  store_name: string;
  store_address: string | null;
  store_phone: string | null;
  invoice_no: number;
  cashier_name: string;
  created_at: string;
  subtotal: number;
  discount: number;
  total: number;
  payment_method: PaymentMethod;
  paid: number;
  change_amount: number;
  status: "completed" | "refunded";
  refunded_at: string | null;
  items: ReceiptItem[];
};

export const ROLE_LABELS: Record<AppRole, string> = {
  owner: "مالك",
  manager: "مدير",
  cashier: "كاشير",
};

export type ProductWithCost = Product & { product_costs: { cost_price: number } | null };

export type Expense = {
  id: string;
  store_id: string;
  category: string;
  amount: number;
  note: string | null;
  date: string;
  created_at: string;
  store: { name: string } | null;
  creator: { full_name: string } | null;
};

export type ShiftRow = Shift & {
  closed_by: string | null;
  cashier: { full_name: string } | null;
  store: { name: string } | null;
};

export type StaffMember = {
  user_id: string;
  email: string;
  full_name: string;
  role: AppRole;
  is_active: boolean;
  store_ids: string[];
  created_at: string;
};

export type StoreStats = {
  store_id: string;
  name: string;
  sales_count: number;
  revenue: number;
  discounts: number;
  cash: number;
  card: number;
  cogs: number;
  gross_profit: number;
  expenses: number;
  net_profit: number;
  refunds_count: number;
  refunds_total: number;
};

export type DashboardStats = {
  stores: StoreStats[];
  days: { day: string; revenue: number; net_profit: number }[];
  top_products: { product_id: string; name: string; qty: number; revenue: number; profit: number }[];
};

export type SaleRow = {
  id: string;
  store_id: string;
  invoice_no: number;
  created_at: string;
  total: number;
  discount: number;
  payment_method: PaymentMethod;
  status: "completed" | "refunded";
  refund_reason: string | null;
  cashier: { full_name: string } | null;
  store: { name: string } | null;
};

export type StockMovement = {
  id: number;
  change: number;
  stock_after: number;
  reason: "initial" | "sale" | "refund" | "adjustment";
  created_at: string;
  sale: { invoice_no: number } | null;
  actor: { full_name: string } | null;
};
