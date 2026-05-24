import type { Episode, Show } from '@prisma/client'
import {
  type QSection,
  resolveSections,
  normalizeGenerated,
  chosenQuestionTexts,
  DEFAULT_CLOSING_QUESTION,
} from '@/lib/questions'

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
  episode: Pick<Episode, 'guestName' | 'guestBio' | 'guestResearch' | 'focusAnswers'>,
  show: Pick<Show, 'interviewStyle' | 'hostEnergy' | 'pacing' | 'humorLevel' | 'aiQuestionInstructions' | 'targetAudience'> | null,
  sections: QSection[],
  previousQuestions: string[]
) {
  const focusStr = Array.isArray(episode.focusAnswers)
    ? (episode.focusAnswers as string[]).map((a, i) => `${i + 1}. ${a}`).join('\n')
    : ''

  const prevStr = previousQuestions.length
    ? `\nAvoid repeating these previously-asked questions:\n${previousQuestions.slice(0, 20).join('\n')}`
    : ''

  const customInstructions = show?.aiQuestionInstructions ? `\nCustom instructions: ${show.aiQuestionInstructions}` : ''

  return `You are an expert podcast interview consultant. Generate interview questions for the following guest.

Guest: ${episode.guestName}
Bio: ${episode.guestBio ?? 'Not provided'}
Research: ${episode.guestResearch ?? 'Not provided'}

Episode focus:
${focusStr}

Podcast DNA:
- Interview style: ${show?.interviewStyle ?? 'conversational'}
- Host energy: ${show?.hostEnergy ?? 'warm_casual'}
- Pacing: ${show?.pacing ?? 'balanced'}
- Humor level: ${show?.humorLevel ?? 'light'}
- Audience: ${show?.targetAudience ?? 'general'}${prevStr}${customInstructions}

Return a JSON object whose keys are EXACTLY these section keys (and nothing else):
${sections.map(s => `- "${s.key}"  (${s.name})`).join('\n')}

For each section key, return an array of 4-6 question objects shaped like:
{ "question": "the question text", "strength_score": 8, "context": "what to listen for or why this lands", "go_deeper": ["a sharp follow-up", "another follow-up"] }

- strength_score is 1-10 (10 = your strongest, most revealing question for that section).
- Make every question specific to THIS guest and matched to the show's DNA above — never generic.
- Vary depth and style within each section.

Return ONLY the JSON object, e.g.:
{ ${sections.map(s => `"${s.key}": [ { "question": "...", "strength_score": 9, "context": "...", "go_deeper": ["..."] } ]`).join(', ')} }`
}

export function buildScriptPrompt(
  episode: Pick<Episode, 'guestName' | 'guestBio' | 'guestResearch' | 'introductionScript' | 'generatedQuestions' | 'selectedQuestions' | 'focusAnswers'>,
  show: Pick<Show, 'name' | 'hostName' | 'interviewStyle' | 'openingLine' | 'closingQuestion' | 'guestIntroStyle' | 'aiScriptInstructions' | 'hostEnergy' | 'humorLevel' | 'targetAudience' | 'episodeSections'> | null,
  kind: 'intro' | 'full'
) {
  const hostName = show?.hostName ?? 'the host'
  const showName = show?.name ?? 'the show'

  const { storedSections } = normalizeGenerated(episode.generatedQuestions)
  const sections = resolveSections(show?.episodeSections, storedSections)
  // The host's chosen questions, in section order (closing handled separately).
  const questionTexts = chosenQuestionTexts(episode.generatedQuestions, episode.selectedQuestions, sections, '')
  const customClosing = (episode.selectedQuestions as { _closing?: string } | null)?._closing
  const closingQuestion = customClosing ?? show?.closingQuestion ?? DEFAULT_CLOSING_QUESTION

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
${questionTexts.map((t, i) => `${i + 1}. ${t}`).join('\n')}

Closing question: ${closingQuestion}${customInstructions}

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
