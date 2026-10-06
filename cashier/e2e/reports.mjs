// Phase 4 + extras end-to-end, 100% through the UI.
import { chromium } from "playwright";
// Money is wrapped in bidi isolates (U+2066..U+2069); compare without them.
const strip = (t) => t.replace(/[\u2066-\u2069]/g, "");
import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE || "http://localhost:3000";
const DB = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const SHOTS = import.meta.dirname + "/shots";
mkdirSync(SHOTS, { recursive: true });
const sql = (q) => execSync(`psql -X -At -v ON_ERROR_STOP=1 "${DB}"`, { input: q }).toString().trim();
const ok = (cond, name) => {
  if (!cond) throw new Error("FAIL: " + name);
  console.log("ok - " + name);
};

let browser;
async function newPage(tag) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log(`[${tag} pageerror]`, e.message));
  page.on("dialog", (d) => d.accept());
  return page;
}
async function login(user, password, landing = "**/pos") {
  const page = await newPage(user);
  await page.goto(BASE + "/login");
  await page.getByLabel("البريد أو اسم المستخدم").fill(user);
  await page.getByLabel("كلمة المرور").fill(password);
  await page.getByRole("button", { name: "تسجيل الدخول" }).click();
  await page.waitForURL(landing);
  return page;
}
const dialog = (page) => page.getByRole("dialog");
const row = (page, text) => page.locator("tbody tr").filter({ hasText: text });
const navTo = async (page, label, path) => {
  await page.getByRole("navigation", { name: "الأقسام" }).getByRole("link", { name: label, exact: true }).click();
  await page.waitForURL("**" + path + "*");
};
async function switchStore(page, label) {
  const done = page.waitForResponse((r) => r.request().method() === "POST");
  await page.getByLabel("المتجر").selectOption({ label });
  await done;
  await page.getByText("جارٍ تبديل المتجر").waitFor({ state: "detached" });
}
async function addStaff(owner, { name, login, password, role, stores }) {
  await owner.getByRole("button", { name: "+ موظف جديد" }).click();
  const d = dialog(owner);
  await d.getByLabel("الاسم", { exact: true }).fill(name);
  await d.getByLabel(/اسم المستخدم أو البريد/).fill(login);
  await d.getByLabel("كلمة المرور").fill(password);
  await d.getByRole("radio", { name: new RegExp("^" + role) }).check();
  for (const s of stores) await d.getByRole("checkbox", { name: s }).check();
  await d.getByRole("button", { name: "حفظ" }).click();
  await d.waitFor({ state: "detached" });
}
async function addProduct(page, p) {
  await page.getByRole("button", { name: "+ منتج جديد" }).click();
  const d = dialog(page);
  await d.getByLabel("الاسم", { exact: true }).fill(p.name);
  await d.getByLabel("الباركود").fill(p.barcode);
  await d.getByLabel(/سعر البيع/).fill(String(p.price));
  await d.getByLabel(/سعر التكلفة/).fill(String(p.cost));
  await d.getByLabel("المخزون", { exact: true }).fill(String(p.stock));
  await d.getByRole("button", { name: "حفظ" }).click();
  await d.waitFor({ state: "detached" });
}
async function openShift(page, amount) {
  await page.getByLabel(/النقد الموجود/).fill(String(amount));
  await page.getByRole("button", { name: /فتح الوردية/ }).click();
  await page.getByLabel("الباركود").waitFor();
  await page.getByText("جارٍ تحميل المنتجات").waitFor({ state: "detached" });
}
async function sell(page, codes, method = "cash") {
  for (const c of codes) {
    await page.getByLabel("الباركود").fill(c);
    await page.getByLabel("الباركود").press("Enter");
  }
  if (method === "card") await page.getByRole("radio", { name: "بطاقة" }).click();
  await page.getByRole("button", { name: /إتمام البيع/ }).click();
  await dialog(page).waitFor();
  await dialog(page).getByRole("button", { name: "بيع جديد" }).click();
}

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });

  // ---- Owner: account, business, second store via UI ----
  const owner = await newPage("owner");
  await owner.goto(BASE + "/");
  await owner.waitForURL("**/login");
  await owner.getByRole("button", { name: /أنشئ حساباً/ }).click();
  await owner.getByLabel("البريد الإلكتروني").fill("owner@shop.iq");
  await owner.getByLabel("كلمة المرور").fill("pass1234");
  await owner.getByRole("button", { name: "إنشاء حساب" }).click();
  await owner.waitForURL("**/setup");
  await owner.getByLabel("اسمك").fill("أبو أحمد");
  await owner.getByLabel("اسم النشاط التجاري").fill("أسواق أبو أحمد");
  await owner.getByLabel("اسم أول متجر").fill("فرع الكرادة");
  await owner.getByRole("button", { name: "ابدأ" }).click();
  await owner.waitForURL("**/pos");

  await navTo(owner, "المتاجر", "/stores");
  await owner.getByRole("button", { name: "+ متجر جديد" }).click();
  await dialog(owner).getByLabel("اسم المتجر").fill("فرع المنصور");
  await dialog(owner).getByLabel("العنوان").fill("بغداد - شارع 14 رمضان");
  await dialog(owner).getByLabel("الهاتف").fill("07801234567");
  await dialog(owner).getByRole("button", { name: "حفظ" }).click();
  await owner.locator("li").filter({ hasText: "فرع المنصور" }).waitFor();
  await owner.locator("li").filter({ hasText: "فرع الكرادة" }).getByRole("button", { name: "تعديل" }).click();
  await dialog(owner).getByLabel("العنوان").fill("بغداد - الكرادة داخل");
  await dialog(owner).getByRole("button", { name: "حفظ" }).click();
  await owner.locator("li").filter({ hasText: "الكرادة داخل" }).waitFor();
  ok((await owner.getByLabel("المتجر").locator("option").allInnerTexts().then((a) => a.map(strip))).includes("فرع المنصور"),
     "owner created a second store from the UI; it appears in the switcher");
  await owner.screenshot({ path: SHOTS + "/p4-stores.png" });

  // ---- Staff, one with a plain username ----
  await navTo(owner, "الموظفون", "/staff");
  await addStaff(owner, { name: "علي", login: "ali", password: "ali-pass-1", role: "كاشير", stores: ["فرع الكرادة"] });
  await addStaff(owner, { name: "منى", login: "mona@shop.iq", password: "mona-pass-1", role: "مدير", stores: ["فرع الكرادة"] });
  await addStaff(owner, { name: "سارة", login: "sara", password: "sara-pass-1", role: "كاشير", stores: ["فرع المنصور"] });
  ok((await row(owner, "علي").innerText().then(strip)).includes("ali") && !(await row(owner, "علي").innerText().then(strip)).includes("@"),
     "staff list shows the plain username");

  // ---- Products (store A via default, store B via switcher) ----
  await navTo(owner, "المنتجات", "/products");
  await addProduct(owner, { name: "شاي", barcode: "111", price: 2000, cost: 1200, stock: 10 });
  await addProduct(owner, { name: "سكر", barcode: "222", price: 1500, cost: 1000, stock: 5 });
  await switchStore(owner, "فرع المنصور");
  await owner.getByRole("heading", { name: "منتجات فرع المنصور" }).waitFor();
  await addProduct(owner, { name: "رز", barcode: "333", price: 3000, cost: 2000, stock: 20 });
  await switchStore(owner, "فرع الكرادة");

  // ---- Cashier logs in with username, sells ----
  const ali = await login("ali", "ali-pass-1");
  ok(true, "cashier logged in with a username (no email)");
  ok((await ali.getByRole("navigation", { name: "الأقسام" }).innerText().then(strip)).replace(/\s+/g, " ").trim() === "الكاشير المبيعات الورديات",
     "cashier nav: till, sales, shifts");
  await openShift(ali, 10000);
  await sell(ali, ["111", "111"]);          // #1 cash 4000
  await sell(ali, ["222"], "card");         // #2 card 1500
  await navTo(ali, "المبيعات", "/sales");
  ok((await ali.locator("tbody tr").count()) === 2, "cashier sales log shows today's 2 invoices");
  ok((await ali.getByLabel("من").count()) === 0, "cashier has no date range");
  await row(ali, "#1").click();
  await dialog(ali).waitFor();
  ok((await dialog(ali).innerText().then(strip)).includes("4,000") && (await dialog(ali).getByText("إرجاع الفاتورة").count()) === 0,
     "cashier can reopen a receipt for reprint but cannot refund");
  await dialog(ali).getByRole("button", { name: "إغلاق" }).click();

  const sara = await login("sara", "sara-pass-1");
  await openShift(sara, 0);
  await sell(sara, ["333"]);                // store B #1 cash 3000

  // ---- Owner refunds invoice #1 (cash -> needs a shift) ----
  await owner.goto(BASE + "/pos");
  await openShift(owner, 50000);
  await navTo(owner, "المبيعات", "/sales");
  await row(owner, "#1").click();
  await dialog(owner).getByLabel("سبب الإرجاع").fill("الزبون غيّر رأيه");
  await dialog(owner).getByRole("button", { name: "إرجاع الفاتورة كاملة" }).click();
  await dialog(owner).getByText("*** مُرتجعة ***").waitFor();
  await owner.screenshot({ path: SHOTS + "/p4-refund.png" });
  await dialog(owner).getByRole("button", { name: "إغلاق" }).click();
  await row(owner, "#1").getByText("مُرتجعة").waitFor();
  ok(true, "owner refunded invoice #1 with a reason; log shows it as returned");

  // ---- Stock history ----
  await navTo(owner, "المنتجات", "/products");
  await row(owner, "شاي").getByRole("button", { name: "تعديل" }).click();
  await dialog(owner).getByLabel("المخزون", { exact: true }).fill("15");
  await dialog(owner).getByRole("button", { name: "حفظ" }).click();
  await dialog(owner).waitFor({ state: "detached" });
  await row(owner, "شاي").getByRole("button", { name: "الحركة" }).click();
  await dialog(owner).locator("tbody tr").nth(3).waitFor();
  const hist = (await dialog(owner).locator("tbody tr").allInnerTexts().then((a) => a.map(strip))).map((t) => t.replace(/\s+/g, " "));
  ok(hist.length === 4, "tea has 4 stock movements (got " + hist.length + ")");
  ok(hist[0].includes("تعديل يدوي") && hist[0].includes("+5") && hist[0].includes("أبو أحمد"), "manual edit +5 logged with owner's name");
  ok(hist[1].includes("إرجاع #1") && hist[1].includes("+2"), "refund +2 linked to invoice #1");
  ok(hist[2].includes("بيع #1") && hist[2].includes("-2") && hist[2].includes("علي"), "sale -2 linked to invoice #1 and cashier");
  ok(hist[3].includes("رصيد افتتاحي") && hist[3].includes("+10"), "opening balance +10");
  await owner.screenshot({ path: SHOTS + "/p4-stock-history.png" });
  await dialog(owner).getByRole("button", { name: "إغلاق" }).click();

  // ---- Expense, then dashboard for all stores ----
  await navTo(owner, "المصروفات", "/expenses");
  await owner.getByRole("button", { name: "+ مصروف جديد" }).click();
  await dialog(owner).getByLabel("البند").fill("مولدة");
  await dialog(owner).getByLabel(/المبلغ/).fill("5000");
  await dialog(owner).getByRole("button", { name: "حفظ" }).click();
  await row(owner, "مولدة").waitFor();

  await switchStore(owner, "كل المتاجر");
  await navTo(owner, "لوحة التحكم", "/dashboard");
  const tiles = (await owner.locator("main").innerText().then(strip)).replace(/\s+/g, " ");
  // Revenue: sugar 1,500 (tea refunded) + rice 3,000 = 4,500. COGS 1,000 + 2,000.
  // Expenses 5,000. Net 4,500 - 3,000 - 5,000 = -3,500.
  ok(tiles.includes("الإيرادات 4,500 د.ع"), "dashboard revenue 4,500 (refund excluded)");
  ok(tiles.includes("الربح الإجمالي 1,500 د.ع"), "gross profit 1,500");
  ok(tiles.includes("صافي الربح -3,500 د.ع"), "net profit -3,500");
  ok(tiles.includes("المرتجعات 4,000 د.ع"), "refunds 4,000 shown separately");
  const cmp = owner.locator("section").filter({ hasText: "مقارنة المتاجر" });
  ok((await cmp.locator("tbody tr").count()) === 2, "store comparison lists both stores");
  ok((await row(cmp, "فرع المنصور").innerText().then(strip)).includes("1,000"), "Mansour net profit 1,000");
  ok((await row(cmp, "فرع الكرادة").innerText().then(strip)).includes("-4,500"), "Karrada net profit -4,500");
  await owner.locator('[aria-label*="4,500"]').first().hover();
  await owner.getByText(/صافي الربح: .?-3,500/).waitFor();
  ok(true, "chart tooltip shows today's revenue and net profit on hover");
  await owner.screenshot({ path: SHOTS + "/p4-dashboard.png", fullPage: true });

  // ---- CSV export ----
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Baghdad" }).format(new Date());
  const salesCsv = await (await owner.request.get(`${BASE}/export/sales?from=${today}&to=${today}`)).text();
  ok(salesCsv.charCodeAt(0) === 0xfeff, "CSV starts with UTF-8 BOM for Excel");
  ok(salesCsv.trim().split("\r\n").length === 4 && salesCsv.includes("مُرتجعة") && salesCsv.includes("شاي × 2"),
     "sales CSV: header + 3 invoices, refund status and items");
  const sumCsv = await (await owner.request.get(`${BASE}/export/summary?from=${today}&to=${today}`)).text();
  ok(sumCsv.includes("فرع المنصور") && sumCsv.includes("-4500"), "summary CSV has per-store profit");
  const cashierCsv = await ali.request.get(`${BASE}/export/sales?from=${today}&to=${today}`);
  ok(cashierCsv.status() === 403, "cashier cannot export");

  // ---- Manager scope ----
  const mona = await login("mona@shop.iq", "mona-pass-1", "**/dashboard");
  ok(true, "manager lands on the dashboard");
  const mtext = (await mona.locator("main").innerText().then(strip)).replace(/\s+/g, " ");
  ok(mtext.includes("الإيرادات 1,500 د.ع") && !mtext.includes("مقارنة المتاجر"), "manager dashboard shows only store A");
  await mona.goto(BASE + "/stores");
  await mona.waitForURL("**/pos");
  ok(true, "manager cannot open the stores page");

  // Cashier root goes to the till.
  await ali.goto(BASE + "/");
  await ali.waitForURL("**/pos");
  ok(true, "cashier home is the till");

  await browser.close();
  console.log("E2E PHASE 4 PASSED");
})().catch(async (e) => {
  console.error(e.message.split("\n").slice(0, 8).join("\n"));
  await browser?.close();
  process.exit(1);
});
