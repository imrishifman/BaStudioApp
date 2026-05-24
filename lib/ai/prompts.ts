import type { Episode, Show } from '@prisma/client'

type DnaShow = Pick<
  Show,
  | 'name'
  | 'hostName'
  | 'targetAudience'
  | 'aiResearchInstructions'
  | 'interviewStyle'
  | 'hostEnergy'
  | 'pacing'
  | 'humorLevel'
  | 'episodeSections'
  | 'openingLine'
  | 'closingQuestion'
  | 'guestIntroStyle'
>

// A compact summary of the show's Podcast DNA so the AI shapes its output to fit
// the show's identity (voice, structure, audience) rather than producing generic work.
function buildDnaSection(show: DnaShow): string {
  const sectionNames = Array.isArray(show.episodeSections)
    ? (show.episodeSections as { name: string }[]).map((s) => s.name).filter(Boolean)
    : []
  const lines = [
    show.name && `- Show: "${show.name}"${show.hostName ? `, hosted by ${show.hostName}` : ''}`,
    show.targetAudience && `- Audience: ${show.targetAudience}`,
    show.interviewStyle && `- Interview style: ${show.interviewStyle}`,
    show.hostEnergy && `- Host energy: ${show.hostEnergy}`,
    show.pacing && `- Pacing: ${show.pacing}`,
    show.humorLevel && `- Humor level: ${show.humorLevel}`,
    sectionNames.length && `- Episode structure: ${sectionNames.join(' → ')}`,
    show.openingLine && `- Signature opening: ${show.openingLine}`,
    show.closingQuestion && `- Signature closing question: ${show.closingQuestion}`,
  ].filter(Boolean)
  return lines.length ? `\n\nPodcast DNA (shape everything to fit this show):\n${lines.join('\n')}` : ''
}

export function buildResearchPrompt(
  guestName: string,
  links: string[],
  extraContext: string | null,
  mode: 'initial' | 'deep',
  show: DnaShow | null
) {
  const linksSection = links.length ? `\nLinks: ${links.join(', ')}` : ''
  const extra = extraContext ? `\nExtra context / bio from host: ${extraContext}` : ''
  const dna = show ? buildDnaSection(show) : ''
  const depth = mode === 'deep' ? 'Do an extremely thorough job. Find obscure stories, lesser-known projects, and unique angles.' : ''
  const customInstructions = show?.aiResearchInstructions ? `\nCustom instructions: ${show.aiResearchInstructions}` : ''

  return `You are a world-class podcast researcher. Research the following guest for a podcast interview.

Guest: ${guestName}${linksSection}${extra}${dna}${customInstructions}

${depth}

Use the Podcast DNA above to decide what to dig into: surface the stories, themes, and angles that fit this show's audience and style. Lean on the provided links and host context to stay focused on the right person.

Return a JSON object with:
- bio: A compelling 2-3 paragraph bio suitable for reading on air, in a tone that matches the show's DNA
- research: Detailed research notes (stories, achievements, controversies, unique angles, fun facts, talking points) tailored to this show — minimum 400 words
- funFacts: An array of 3-5 surprising or interesting facts about this person
- photoUrl: Best available professional headshot URL if known (or null)

Focus on what makes this guest interesting and unique for THIS show's audience. Surface stories they haven't heard before.`
}

export function buildQuestionsPrompt(
  episode: Pick<Episode, 'guestName' | 'guestBio' | 'guestResearch' | 'focusAnswers' | 'interviewInfluences'>,
  show: Pick<Show, 'episodeSections' | 'interviewStyle' | 'hostEnergy' | 'pacing' | 'humorLevel' | 'aiQuestionInstructions' | 'openingLine' | 'closingQuestion'> | null,
  previousQuestions: string[]
) {
  const sections = (show?.episodeSections as { name: string; purpose: string }[] | null) ?? [
    { name: 'Opening', purpose: 'Warm up, establish rapport' },
    { name: 'Origin & Background', purpose: 'Guest journey and key turning points' },
    { name: 'Core Insight', purpose: 'Main value the episode delivers' },
    { name: 'Challenge & Growth', purpose: 'Obstacles overcome and lessons learned' },
    { name: 'Future & Close', purpose: 'Where things are heading, closing thoughts' },
  ]

  const focusStr = Array.isArray(episode.focusAnswers)
    ? (episode.focusAnswers as string[]).map((a, i) => `${i + 1}. ${a}`).join('\n')
    : ''

  const prevStr = previousQuestions.length
    ? `\nAVOID these previously-asked questions (flag if similar):\n${previousQuestions.slice(0, 20).join('\n')}`
    : ''

  const customInstructions = show?.aiQuestionInstructions ? `\nCustom instructions: ${show.aiQuestionInstructions}` : ''

  return `You are an expert podcast interview consultant. Generate interview questions for the following guest.

Guest: ${episode.guestName}
Bio: ${episode.guestBio ?? 'Not provided'}
Research: ${episode.guestResearch ?? 'Not provided'}

Episode focus:
${focusStr}

Interview style: ${show?.interviewStyle ?? 'conversational'}
Host energy: ${show?.hostEnergy ?? 'warm_casual'}
Pacing: ${show?.pacing ?? 'balanced'}${prevStr}${customInstructions}

Generate 4-6 questions for each of these sections:
${sections.map(s => `- ${s.name}: ${s.purpose}`).join('\n')}

Return JSON with this structure:
{
  "questions": [
    { "id": "unique-id", "text": "question text", "section": "section name", "isRepeat": false }
  ]
}

Make questions specific to this guest, not generic. Vary the depth and style within each section.`
}

export function buildScriptPrompt(
  episode: Pick<Episode, 'guestName' | 'guestBio' | 'guestResearch' | 'introductionScript' | 'generatedQuestions' | 'favoriteQuestions' | 'focusAnswers'>,
  show: Pick<Show, 'name' | 'hostName' | 'interviewStyle' | 'openingLine' | 'closingQuestion' | 'guestIntroStyle' | 'aiScriptInstructions' | 'hostEnergy' | 'humorLevel' | 'targetAudience'> | null,
  kind: 'intro' | 'full'
) {
  const hostName = show?.hostName ?? 'the host'
  const showName = show?.name ?? 'the show'
  const favoriteQs = (episode.favoriteQuestions as string[] | null) ?? []
  const allQs = (episode.generatedQuestions as { id: string; text: string; section: string }[] | null) ?? []
  const questions = favoriteQs.length
    ? allQs.filter(q => favoriteQs.includes(q.id))
    : allQs

  const customInstructions = show?.aiScriptInstructions ? `\nCustom instructions: ${show.aiScriptInstructions}` : ''

  if (kind === 'intro') {
    return `Write a compelling podcast intro script for ${hostName} introducing ${episode.guestName} on ${showName}.

Bio to work from: ${episode.guestBio ?? 'Not provided'}
Research: ${episode.guestResearch?.slice(0, 800) ?? 'Not provided'}

Podcast DNA (match this voice):
- Audience: ${show?.targetAudience ?? 'general'}
- Host energy: ${show?.hostEnergy ?? 'warm_casual'}
- Humor level: ${show?.humorLevel ?? 'light'}
- Intro style: ${show?.guestIntroStyle ?? 'host_reads_bio'}
- Opening line template: ${show?.openingLine ?? 'none'}${customInstructions}

The intro should be warm, specific to this guest, draw on the research, and match the show's DNA above so it sounds like this host on this show. Make the listener want to keep listening.
Write it as spoken word, ready to read on air. 150-250 words.

Return JSON: { "script": "the intro text" }`
  }

  return `Write a full interview script for ${hostName} interviewing ${episode.guestName} on ${showName}.

Guest Bio: ${episode.guestBio ?? 'Not provided'}
Research: ${episode.guestResearch ?? 'Not provided'}
Interview style: ${show?.interviewStyle ?? 'conversational'}

Questions to weave in:
${questions.map((q, i) => `${i + 1}. [${q.section}] ${q.text}`).join('\n')}

Closing question: ${show?.closingQuestion ?? 'What advice would you give your younger self?'}${customInstructions}

Write a full conversational script with:
- Transitions between questions
- Follow-up prompts marked with [FOLLOW-UP]
- Natural segue phrases
- The closing

Format as readable script the host can follow during the interview.

Return JSON: { "script": "the full script text" }`
}

export function buildSocialPrompt(
  episode: Pick<Episode, 'guestName' | 'guestBio' | 'guestResearch' | 'introductionScript' | 'fullScript'>,
  show: Pick<Show, 'name' | 'hostName' | 'targetAudience' | 'aiSocialInstructions'> | null,
  releaseDate?: string
) {
  const customInstructions = show?.aiSocialInstructions ? `\nCustom instructions: ${show.aiSocialInstructions}` : ''
  const dateStr = releaseDate ? `Release date: ${releaseDate}` : ''

  return `You are a social media expert for podcasters. Create promotional content for a new podcast episode.

Show: ${show?.name ?? 'the podcast'}
Host: ${show?.hostName ?? 'the host'}
Guest: ${episode.guestName}
Bio: ${episode.guestBio ?? 'Not provided'}
Key insights: ${episode.guestResearch?.slice(0, 300) ?? 'Not provided'}
${dateStr}${customInstructions}

Generate all four of these:

1. linkedin_post: A thought-leadership LinkedIn post (200-300 words) that shares 2-3 key insights from the episode. End with a CTA to listen.

2. twitter_thread: A 5-tweet thread that teases the best moments. Format as numbered tweets.

3. instagram_caption: An engaging caption with 5-10 relevant hashtags.

4. episode_description: A podcast show-notes description (150-200 words) suitable for RSS and podcast directories.

Return JSON with keys: linkedin_post, twitter_thread, instagram_caption, episode_description`
}

export function buildChatPrompt(
  message: string,
  episodeContext: Partial<Episode> | null,
  page: string | null
) {
  const ctx = episodeContext
    ? `Current episode: guest "${episodeContext.guestName}", status "${episodeContext.status}", step ${episodeContext.currentStep}`
    : ''
  const pageCtx = page ? `User is on page: ${page}` : ''

  return `You are Ba-Studio's AI assistant — a knowledgeable, concise podcast production coach.
${ctx}
${pageCtx}

User message: ${message}

Respond helpfully and concisely. If they're working on an episode, give specific, actionable advice.
Keep responses under 200 words unless a longer answer is genuinely needed.`
}
