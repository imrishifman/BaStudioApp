import { redirect } from 'next/navigation'

// Podcast DNA is now configured per-show: Shows → open a show → Podcast DNA.
export default function PodcastDnaRedirect() {
  redirect('/shows')
}
