// Phase 3 end-to-end: staff, products, expenses, shifts — through the UI.
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
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log(`[${tag} pageerror]`, e.message));
  page.on("dialog", (d) => d.accept());
  return page;
}
async function login(email, password, landing = "**/pos") {
  const page = await newPage(email);
  await page.goto(BASE + "/login");
  await page.getByLabel("البريد أو اسم المستخدم").fill(email);
  await page.getByLabel("كلمة المرور").fill(password);
  await page.getByRole("button", { name: "تسجيل الدخول" }).click();
  await page.waitForURL(landing);
  return page;
}
const nav = async (page) => (await page.getByRole("navigation", { name: "الأقسام" }).innerText().then(strip)).replace(/\s+/g, " ").trim();
const dialog = (page) => page.getByRole("dialog");
const row = (page, text) => page.locator("tbody tr").filter({ hasText: text });

async function addStaff(owner, { name, email, password, role, stores }) {
  await owner.getByRole("button", { name: "+ موظف جديد" }).click();
  const d = dialog(owner);
  await d.getByLabel("الاسم", { exact: true }).fill(name);
  await d.getByLabel(/اسم المستخدم أو البريد/).fill(email);
  await d.getByLabel("كلمة المرور").fill(password);
  await d.getByRole("radio", { name: new RegExp("^" + role) }).check();
  for (const s of stores) await d.getByRole("checkbox", { name: s }).check();
  await d.getByRole("button", { name: "حفظ" }).click();
}

async function saveProduct(page, p) {
  const d = dialog(page);
  if (p.name !== undefined) await d.getByLabel("الاسم", { exact: true }).fill(p.name);
  if (p.barcode !== undefined) await d.getByLabel("الباركود").fill(p.barcode);
  if (p.price !== undefined) await d.getByLabel(/سعر البيع/).fill(String(p.price));
  if (p.cost !== undefined) await d.getByLabel(/سعر التكلفة/).fill(String(p.cost));
  if (p.stock !== undefined) await d.getByLabel("المخزون", { exact: true }).fill(String(p.stock));
  if (p.low !== undefined) await d.getByLabel(/تنبيه عند/).fill(String(p.low));
  await d.getByRole("button", { name: "حفظ" }).click();
}

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });

  // ---- Owner setup ----
  const owner = await newPage("owner");
  await owner.goto(BASE + "/login");
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
  const org = sql(`select id from organizations`);
  sql(`insert into stores (organization_id, name) values ('${org}', 'فرع المنصور')`); // no store UI yet
  await owner.reload();
  ok((await nav(owner)) === "لوحة التحكم الكاشير المبيعات الورديات المنتجات المصروفات الموظفون المتاجر", "owner nav has all sections");

  // ---- Staff management ----
  await owner.getByRole("link", { name: "الموظفون" }).click();
  await owner.waitForURL("**/staff");
  await addStaff(owner, { name: "علي", email: "ali@shop.iq", password: "ali-pass-1", role: "كاشير", stores: ["فرع الكرادة"] });
  await row(owner, "ali@shop.iq").waitFor();
  await addStaff(owner, { name: "منى", email: "mona@shop.iq", password: "mona-pass-1", role: "مدير", stores: ["فرع الكرادة"] });
  await row(owner, "mona@shop.iq").waitFor();
  await addStaff(owner, { name: "سارة", email: "sara@shop.iq", password: "sara-pass-1", role: "كاشير", stores: ["فرع المنصور"] });
  await row(owner, "sara@shop.iq").waitFor();
  ok(true, "owner created 2 cashiers and 1 manager from the UI");
  ok((await row(owner, "منى").innerText().then(strip)).includes("مدير") && (await row(owner, "منى").innerText().then(strip)).includes("فرع الكرادة"),
     "staff list shows role and store");

  await addStaff(owner, { name: "مكرر", email: "ali@shop.iq", password: "whatever-1", role: "كاشير", stores: ["فرع الكرادة"] });
  await dialog(owner).getByRole("alert").filter({ hasText: "مسجّل مسبقاً" }).waitFor();
  ok(true, "duplicate email rejected with a clear message");
  await dialog(owner).getByRole("button", { name: "إلغاء" }).click();
  ok(sql(`select count(*) from auth.users`) === "4", "no orphan login left behind by the failed attempt");
  await owner.screenshot({ path: SHOTS + "/p3-staff.png" });

  // ---- Products (owner, store A) ----
  await owner.getByRole("link", { name: "المنتجات" }).click();
  await owner.waitForURL("**/products");
  await owner.getByRole("button", { name: "+ منتج جديد" }).click();
  await saveProduct(owner, { name: "شاي", barcode: "111", price: 2000, cost: 1200, stock: 10, low: 3 });
  await row(owner, "شاي").waitFor();
  await owner.getByRole("button", { name: "+ منتج جديد" }).click();
  await saveProduct(owner, { name: "سكر", barcode: "222", price: 1500, cost: 1000, stock: 2, low: 2 });
  await row(owner, "سكر").waitFor();
  await owner.getByRole("button", { name: "+ منتج جديد" }).click();
  await saveProduct(owner, { name: "نسخة", barcode: "111", price: 1, cost: 1, stock: 1 });
  await dialog(owner).getByRole("alert").filter({ hasText: "الباركود مستخدم" }).waitFor();
  ok(true, "duplicate barcode rejected");
  await dialog(owner).getByRole("button", { name: "إلغاء" }).click();
  await row(owner, "شاي").getByRole("button", { name: "تعديل" }).click();
  await saveProduct(owner, { price: 2500 });
  await row(owner, "شاي").filter({ hasText: "2,500" }).waitFor();
  ok((await row(owner, "شاي").innerText().then(strip)).includes("1,300"), "edit price; profit per unit = 2,500 - 1,200 = 1,300");
  ok((await row(owner, "سكر").innerText().then(strip)).includes("⚠"), "low-stock warning shown");
  ok(sql(`select cost_price from product_costs c join products p on p.id = c.product_id where p.name = 'شاي'`) === "1200",
     "cost stored in product_costs");
  await owner.screenshot({ path: SHOTS + "/p3-products.png" });

  // ---- Cashier Ali ----
  const ali = await login("ali@shop.iq", "ali-pass-1");
  ok((await nav(ali)) === "الكاشير المبيعات الورديات", "cashier nav: till, sales, shifts");
  await ali.goto(BASE + "/products");
  await ali.waitForURL("**/pos");
  await ali.goto(BASE + "/staff");
  await ali.waitForURL("**/pos");
  ok(true, "cashier is redirected away from products and staff");
  await ali.getByLabel(/النقد الموجود/).fill("50000");
  await ali.getByRole("button", { name: /فتح الوردية/ }).click();
  await ali.getByLabel("الباركود").waitFor();
  await ali.getByText("جارٍ تحميل المنتجات").waitFor({ state: "detached" });
  await ali.getByLabel("الباركود").fill("111");
  await ali.getByLabel("الباركود").press("Enter");
  await ali.getByLabel("الباركود").fill("111");
  await ali.getByLabel("الباركود").press("Enter");
  await ali.getByRole("button", { name: /إتمام البيع/ }).click();
  await dialog(ali).getByText("5,000").first().waitFor();
  await dialog(ali).getByRole("button", { name: "بيع جديد" }).click();
  ok(true, "cashier sold 2 x 2,500 cash with the edited price");

  await ali.getByRole("link", { name: "الورديات" }).click();
  await ali.waitForURL("**/shifts");
  const mine = ali.locator("section").filter({ hasText: "ورديتي الحالية" });
  ok(!(await mine.innerText().then(strip)).includes("55,000"), "expected cash is hidden before counting (blind count)");
  await mine.getByLabel(/عُدّ النقد/).fill("54000");
  await mine.getByRole("button", { name: "إغلاق الوردية" }).click();
  const res = ali.locator("section").filter({ hasText: "تم إغلاق الوردية" });
  await res.waitFor();
  const resText = await res.innerText().then(strip);
  ok(resText.includes("55,000") && resText.includes("54,000") && resText.includes("عجز 1,000"),
     "closing shows expected 55,000, counted 54,000, shortage 1,000");
  await ali.screenshot({ path: SHOTS + "/p3-shift-closed.png" });
  await ali.goto(BASE + "/pos");
  await ali.getByRole("heading", { name: "فتح وردية" }).waitFor();
  ok(true, "after closing, the till asks for a new shift");

  // ---- Manager Mona ----
  const mona = await login("mona@shop.iq", "mona-pass-1", "**/dashboard");
  ok((await nav(mona)) === "لوحة التحكم الكاشير المبيعات الورديات المنتجات المصروفات", "manager nav has no staff or stores section");
  await mona.goto(BASE + "/staff");
  await mona.waitForURL("**/pos");
  ok(true, "manager is redirected away from staff");
  await mona.goto(BASE + "/shifts");
  ok((await row(mona, "علي").innerText().then(strip)).includes("عجز 1,000"), "manager sees cashier's shift shortage");
  await mona.goto(BASE + "/expenses");
  await mona.getByRole("button", { name: "+ مصروف جديد" }).click();
  await dialog(mona).getByLabel("البند").fill("مولدة");
  await dialog(mona).getByLabel(/المبلغ/).fill("75000");
  await dialog(mona).getByLabel("ملاحظة").fill("اشتراك شهر 10");
  await dialog(mona).getByRole("button", { name: "حفظ" }).click();
  await row(mona, "مولدة").waitFor();
  await row(mona, "مولدة").getByRole("button", { name: "تعديل" }).click();
  await dialog(mona).getByLabel(/المبلغ/).fill("80000");
  await dialog(mona).getByRole("button", { name: "حفظ" }).click();
  await row(mona, "مولدة").filter({ hasText: "80,000" }).waitFor();
  ok(true, "manager adds and edits an expense");
  ok((await row(mona, "مولدة").getByRole("button", { name: "حذف" }).count()) === 0, "manager has no delete button");
  ok((await mona.locator("aside").innerText().then(strip)).includes("80,000"), "period total updated");

  // ---- Cashier Sara (store B) ----
  const sara = await login("sara@shop.iq", "sara-pass-1");
  await sara.getByLabel(/النقد الموجود/).fill("20000");
  await sara.getByRole("button", { name: /فتح الوردية/ }).click();
  await sara.getByLabel("الباركود").waitFor();
  await sara.goto(BASE + "/shifts");
  ok((await row(sara, "علي").count()) === 0, "store B cashier cannot see store A shifts");

  // ---- Owner: all stores ----
  await owner.getByLabel("المتجر").selectOption({ label: "كل المتاجر" });
  await owner.waitForResponse((r) => r.request().method() === "POST");
  await owner.goto(BASE + "/expenses");
  ok((await row(owner, "مولدة").innerText().then(strip)).includes("فرع الكرادة"), "owner sees the expense in all-stores view with store name");
  await row(owner, "مولدة").getByRole("button", { name: "حذف" }).click();
  await row(owner, "مولدة").waitFor({ state: "detached" });
  ok(sql(`select count(*) from expenses`) === "0", "owner deleted the expense");

  await owner.goto(BASE + "/shifts");
  await row(owner, "سارة").getByRole("button", { name: /إغلاق/ }).click();
  await dialog(owner).getByLabel(/عُدّ النقد/).fill("20000");
  await dialog(owner).getByRole("button", { name: "إغلاق الوردية" }).click();
  await row(owner, "سارة").filter({ hasText: "مطابق" }).waitFor();
  ok(true, "owner closed store B cashier's shift from the list (matched)");
  await owner.screenshot({ path: SHOTS + "/p3-shifts.png" });

  // Deactivate Ali, reset Sara's password.
  await owner.goto(BASE + "/staff");
  await row(owner, "علي").getByRole("button", { name: "إيقاف" }).click();
  await row(owner, "علي").filter({ hasText: "موقوف" }).waitFor();
  await ali.goto(BASE + "/pos");
  await ali.getByText("الحساب معطّل").waitFor();
  ok(true, "deactivated cashier is locked out immediately");

  await row(owner, "سارة").getByRole("button", { name: "تعديل" }).click();
  await dialog(owner).getByLabel(/كلمة مرور جديدة/).fill("sara-new-pass");
  await dialog(owner).getByRole("button", { name: "حفظ" }).click();
  await dialog(owner).waitFor({ state: "detached" });
  const sara2 = await login("sara@shop.iq", "sara-new-pass");
  ok(sara2.url().endsWith("/pos"), "owner reset a cashier's password");

  await browser.close();
  console.log("E2E PHASE 3 PASSED");
})().catch(async (e) => {
  console.error(e.message.split("\n").slice(0, 6).join("\n"));
  await browser?.close();
  process.exit(1);
});
