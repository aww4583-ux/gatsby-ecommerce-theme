// Staff can sign in with a plain username instead of an email. Supabase
// Auth needs an email, so a username is stored as <username>@STAFF_DOMAIN.
export const STAFF_DOMAIN = "staff.cashier.local";

const USERNAME = /^[a-z0-9][a-z0-9._-]{2,31}$/;

// Returns the auth email for what the person typed, or null if invalid.
export function toLoginEmail(input: string): string | null {
  const v = input.trim().toLowerCase();
  if (v.includes("@")) return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : null;
  return USERNAME.test(v) ? `${v}@${STAFF_DOMAIN}` : null;
}

// How to show a login to people: the username alone when it is one.
export function displayLogin(email: string): string {
  return email.endsWith(`@${STAFF_DOMAIN}`) ? email.slice(0, -STAFF_DOMAIN.length - 1) : email;
}
