// Admin allow-list. Set ADMIN_EMAILS to a comma-separated list to support
// multiple admins (falls back to the legacy single ADMIN_EMAIL).
const ADMIN_EMAILS = (
  process.env.ADMIN_EMAILS ??
  process.env.ADMIN_EMAIL ??
  'imri@babalata.com'
)
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)

export function isAdmin(email?: string | null): boolean {
  if (!email) return false
  return ADMIN_EMAILS.includes(email.trim().toLowerCase())
}
