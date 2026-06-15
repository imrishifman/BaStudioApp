import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { isAdmin } from '@/lib/admin'
import { SeoClient } from './seo-client'

// SEO & Traffic dashboard, inside the admin panel. Same auth pattern as the
// rest of /admin: signed-in admins only.
export default async function SeoPage() {
  const session = await auth()
  if (!session) redirect('/?signin=1')
  if (!isAdmin(session.user.email)) redirect('/studio')
  return <SeoClient />
}
