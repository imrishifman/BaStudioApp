import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { AccountClient } from './account-client'

export default async function AccountPage() {
  const session = await auth()
  if (!session) redirect('/?signin=1')

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  })

  if (!user) redirect('/?signin=1')

  return <AccountClient user={JSON.parse(JSON.stringify(user))} />
}
