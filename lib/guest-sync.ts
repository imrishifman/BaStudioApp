import { prisma } from '@/lib/prisma'

interface EpisodeGuestData {
  id: string
  guestName?: string | null
  guestBio?: string | null
  guestPhotoUrl?: string | null
  guestLinkedinUrl?: string | null
  guestTwitterUrl?: string | null
  guestWebsiteUrl?: string | null
}

/**
 * Make sure an episode's guest exists in the Guest CRM. Creates a Warm
 * (confirmed) guest the first time, or links the episode to an existing one.
 * Never throws — guest sync must not block saving an episode.
 */
export async function ensureGuestFromEpisode(
  ownerEmail: string,
  ep: EpisodeGuestData
) {
  const name = ep.guestName?.trim()
  if (!name) return

  try {
    const existing = await prisma.guest.findFirst({ where: { ownerEmail, name } })

    if (existing) {
      if (!existing.episodeIds.includes(ep.id)) {
        await prisma.guest.update({
          where: { id: existing.id },
          data: { episodeIds: { set: [...existing.episodeIds, ep.id] } },
        })
      }
      return
    }

    await prisma.guest.create({
      data: {
        name,
        ownerEmail,
        pipelineStatus: 'confirmed',
        episodeIds: [ep.id],
        bio: ep.guestBio ?? undefined,
        photoUrl: ep.guestPhotoUrl ?? undefined,
        linkedinUrl: ep.guestLinkedinUrl ?? undefined,
        twitterUrl: ep.guestTwitterUrl ?? undefined,
        websiteUrl: ep.guestWebsiteUrl ?? undefined,
      },
    })
  } catch {
    /* non-fatal */
  }
}
