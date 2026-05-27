import { auth } from '@/lib/auth'
import { ReviewClient } from './review-client'

export default async function ReviewPage() {
  const session = await auth()
  return <ReviewClient userEmail={session?.user?.email ?? null} />
}
