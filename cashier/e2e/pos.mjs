// End-to-end check of phase 2 against a local Supabase + `next start`.
import { chromium } from "playwright";
// Money is wrapped in bidi isolates (U+2066..U+2069); compare without them.
const strip = (t) => t.replace(/[\u2066-\u2069]/g, "");
import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE || "http://localhost:3000";
const DB = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SHOTS = import.meta.dirname + "/shots";
mkdirSync(SHOTS, { recursive: true });

const sql = (q) => execSync(`psql -X -At -v ON_ERROR_STOP=1 "${DB}"`, { input: q }).toString().trim();
const ok = (cond, name) => {
  if (!cond) throw new Error("FAIL: " + name);
  console.log("ok - " + name);
};

async function createUser(email) {
  const r = await fetch("http://127.0.0.1:54321/auth/v1/admin/users", {
    method: "POST",
    headers: { apikey: SR, Authorization: `Bearer ${SR}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "pass1234", email_confirm: true }),
  });
  const j = await r.json();
  if (!j.id) throw new Error("createUser failed " + JSON.stringify(j));
  return j.id;
}

async function login(browser, email) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: "ar" });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log(`[${email} pageerror]`, e.message));
  await page.goto(BASE + "/pos");
  await page.waitForURL("**/login");
  await page.getByLabel("البريد أو اسم المستخدم").fill(email);
  await page.getByLabel("كلمة المرور").fill("pass1234");
  await page.getByRole("button", { name: "تسجيل الدخول" }).click();
  return page;
}

async function openShift(page, amount) {
  await page.getByRole("heading", { name: "فتح وردية" }).waitFor();
  await page.getByLabel(/النقد الموجود/).fill(String(amount));
  await page.getByRole("button", { name: /فتح الوردية/ }).click();
  await page.getByLabel("الباركود").waitFor();
  await page.getByText("جارٍ تحميل المنتجات").waitFor({ state: "detached" });
}

async function scan(page, code) {
  await page.getByLabel("الباركود").fill(code);
  await page.getByLabel("الباركود").press("Enter");
}

const productCard = (page, name) => page.getByRole("listitem").filter({ hasText: name });

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });

  // 1. Owner signs up and creates the business.
  const ownerCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const owner = await ownerCtx.newPage();
  owner.on("pageerror", (e) => console.log("[owner pageerror]", e.message));
  await owner.goto(BASE + "/");
  await owner.waitForURL("**/login");
  ok(true, "signed-out visitor redirected to /login");
  await owner.getByRole("button", { name: /أنشئ حساباً/ }).click();
  await owner.getByLabel("البريد الإلكتروني").fill("owner@shop.iq");
  await owner.getByLabel("كلمة المرور").fill("pass1234");
  await owner.getByRole("button", { name: "إنشاء حساب" }).click();
  await owner.waitForURL("**/setup");
  await owner.getByLabel("اسمك").fill("أبو أحمد");
  await owner.getByLabel("اسم النشاط التجاري").fill("أسواق أبو أحمد");
  await owner.getByLabel("اسم أول متجر").fill("فرع الكرادة");
  await owner.getByRole("button", { name: "ابدأ" }).click();
  await owner.getByRole("heading", { name: "فتح وردية" }).waitFor();
  ok(true, "owner signed up, created organization, landed on open-shift screen");

  // 2. Second store, products, two cashiers (staff UI comes in phase 3).
  const org = sql(`select id from organizations where name = 'أسواق أبو أحمد'`);
  sql(`insert into stores (organization_id, name, address, phone) values ('${org}', 'فرع المنصور', 'بغداد - المنصور', '07700000000');`);
  const storeA = sql(`select id from stores where name = 'فرع الكرادة'`);
  const storeB = sql(`select id from stores where name = 'فرع المنصور'`);
  sql(`insert into products (store_id, name, barcode, sale_price, stock, low_stock_threshold) values
        ('${storeA}', 'شاي', '111', 2000, 10, 2),
        ('${storeA}', 'سكر', '222', 1500, 2, 1),
        ('${storeB}', 'رز', '333', 3000, 5, 1);`);
  const ali = await createUser("ali@shop.iq");
  const sara = await createUser("sara@shop.iq");
  sql(`insert into profiles (user_id, organization_id, full_name, role) values
        ('${ali}', '${org}', 'علي', 'cashier'), ('${sara}', '${org}', 'سارة', 'cashier');
       insert into store_members values ('${ali}', '${storeA}'), ('${sara}', '${storeB}');`);

  // 3. Two cashiers, two stores, two browsers, at the same time.
  const [cA, cB] = await Promise.all([login(browser, "ali@shop.iq"), login(browser, "sara@shop.iq")]);
  await Promise.all([openShift(cA, 50000), openShift(cB, 30000)]);
  ok(true, "both cashiers opened shifts");

  ok(!(await cA.getByLabel("المتجر").count()), "cashier has no store switcher");
  ok((await cA.locator("header").innerText().then(strip)).includes("فرع الكرادة"), "cashier A header shows own store");
  ok(await productCard(cA, "شاي").count() === 1 && await productCard(cA, "رز").count() === 0,
     "cashier A sees only store A products");
  ok(await productCard(cB, "رز").count() === 1 && await productCard(cB, "شاي").count() === 0,
     "cashier B sees only store B products");

  // Owner opens a till in store A too, to watch live stock.
  await openShift(owner, 0);
  await owner.reload();
  await owner.getByText("جارٍ تحميل المنتجات").waitFor({ state: "detached" });
  ok((await productCard(owner, "سكر").innerText().then(strip)).includes("المخزون: 2"), "owner sees sugar stock 2");

  // Cashier A: barcode scans, cash with change.
  await scan(cA, "111");
  await scan(cA, "111");
  await scan(cA, "222");
  await scan(cA, "999");
  ok(await cA.locator("main [role=alert]").innerText().then(strip).then((t) => t.includes("999")), "unknown barcode shows an error");
  await cA.getByLabel("المبلغ المستلم").fill("10000");
  ok((await cA.locator("main").innerText().then(strip)).includes("4,500"), "change shown before paying");
  await cA.screenshot({ path: SHOTS + "/1-cashier-cart.png" });
  await cA.getByRole("button", { name: /إتمام البيع/ }).click();
  const dlgA = cA.getByRole("dialog");
  await dlgA.waitFor();
  const receiptA = await dlgA.innerText().then(strip);
  ok(receiptA.includes("فاتورة رقم") && /فاتورة رقم\s*1\b/.test(receiptA), "store A receipt is invoice 1");
  ok(receiptA.includes("5,500") && receiptA.includes("4,500") && receiptA.includes("علي"),
     "receipt shows total 5,500, change 4,500 and cashier name");
  await cA.screenshot({ path: SHOTS + "/2-receipt.png" });
  await cA.emulateMedia({ media: "print" });
  await cA.screenshot({ path: SHOTS + "/3-print-preview.png", fullPage: true });
  const printVisible = await cA.evaluate(() =>
    [...document.body.children].filter((el) => getComputedStyle(el).display !== "none").map((el) => el.className));
  ok(printVisible.length === 1 && printVisible[0] === "print-root", "print view contains only the receipt");
  await cA.emulateMedia({ media: "screen" });
  await dlgA.getByRole("button", { name: "بيع جديد" }).click();

  // Live stock on the owner's till (no reload).
  await productCard(owner, "سكر").filter({ hasText: "المخزون: 1" }).waitFor({ timeout: 10000 });
  await productCard(owner, "شاي").filter({ hasText: "المخزون: 8" }).waitFor({ timeout: 10000 });
  ok(true, "owner's till updated stock live via Realtime");

  // Cashier B: card sale, independent invoice numbering.
  await scan(cB, "333");
  await cB.getByRole("radio", { name: "بطاقة" }).click();
  await cB.keyboard.press("F9");
  const dlgB = cB.getByRole("dialog");
  await dlgB.waitFor();
  ok(/فاتورة رقم\s*1\b/.test(await dlgB.innerText().then(strip)) && (await dlgB.innerText().then(strip)).includes("فرع المنصور"),
     "store B numbering starts at 1 independently (F9 shortcut works)");
  await dlgB.getByRole("button", { name: "بيع جديد" }).click();

  // Race for the last sugar: owner puts it in the cart, cashier A sells it first.
  await scan(owner, "222");
  await scan(cA, "222");
  await cA.getByRole("button", { name: /إتمام البيع/ }).click();
  await cA.getByRole("dialog").waitFor();
  await cA.getByRole("dialog").getByRole("button", { name: "بيع جديد" }).click();
  await productCard(owner, "سكر").filter({ hasText: "المخزون: 0" }).waitFor({ timeout: 10000 });
  await owner.getByRole("button", { name: /إتمام البيع/ }).click().catch(() => {});
  const ownerMain = await owner.locator("main").innerText().then(strip);
  const rejected = (await owner.getByRole("dialog").count()) === 0;
  ok(rejected, "owner could not sell sugar that was already sold");
  await owner.screenshot({ path: SHOTS + "/4-out-of-stock.png" });

  // Client-side guard: cannot add more than stock.
  await scan(cA, "222");
  ok((await cA.locator("main [role=alert]").innerText().then(strip)).includes("لا يوجد مخزون كافٍ"), "cannot add out-of-stock item");

  // 4. Store switcher for the owner.
  const sel = owner.getByLabel("المتجر");
  ok((await sel.locator("option").allInnerTexts().then((a) => a.map(strip))).join("|") === "كل المتاجر|فرع الكرادة|فرع المنصور",
     "owner switcher lists All stores + both stores");
  await sel.selectOption({ label: "كل المتاجر" });
  await owner.getByText("اختر متجراً محدداً").waitFor();
  ok(true, "All stores mode asks to pick a store for the till");
  await sel.selectOption({ label: "فرع المنصور" });
  await owner.getByRole("heading", { name: "فتح وردية" }).waitFor();
  ok(true, "switching to store B shows its own shift screen");

  // 5. Database truth.
  const rows = sql(`select s.name || ':' || string_agg(sa.invoice_no::text, ',' order by sa.invoice_no)
                    from sales sa join stores s on s.id = sa.store_id group by s.name order by s.name`);
  ok(rows === "فرع الكرادة:1,2\nفرع المنصور:1", "database has invoices A:1,2 and B:1 (got " + rows.replace("\n", " ; ") + ")");
  ok(sql(`select stock from products where barcode = '222'`) === "0", "sugar stock is 0, never negative");

  // 6. Sign out.
  await cB.getByRole("button", { name: "خروج" }).click();
  await cB.waitForURL("**/login");
  await cB.goto(BASE + "/pos");
  await cB.waitForURL("**/login");
  ok(true, "sign out works and /pos is protected again");

  await browser.close();
  console.log("E2E PASSED");
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
