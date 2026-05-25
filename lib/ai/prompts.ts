import type { Episode, Show } from '@prisma/client'
import {
  type QSection,
  resolveSections,
  normalizeGenerated,
  chosenQuestionTexts,
  chosenQuestionsBySection,
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
  show: DnaShow | null,
  existingResearch?: string
) {
  const linksSection = links.length
    ? `\nPrimary sources — check these first with web_search:\n${links.map((l) => `- ${l}`).join('\n')}`
    : ''
  const extra = extraContext ? `\nContext / bio from the host: ${extraContext}` : ''
  const dna = show ? buildDnaSection(show) : ''
  const depth = mode === 'deep'
    ? 'Be exhaustive: run multiple searches across career timeline, publications, awards, quotes, companies, controversies, personal interests, and upcoming projects.'
    : 'Run a few focused searches to verify the key facts.'
  const customInstructions = show?.aiResearchInstructions ? `\nCustom instructions: ${show.aiResearchInstructions}` : ''
  const deepDelta = mode === 'deep' && existingResearch
    ? `\n\nYou already have the research below. Find ONLY NEW information not already covered here — do not repeat anything from it:\n"""\n${existingResearch.slice(0, 4000)}\n"""\nReturn just the NEW findings as additional markdown sections.`
    : ''

  return `You are a world-class podcast researcher with live web access. Research ${guestName} for a podcast interview.

Use the web_search tool to verify facts from real sources. Treat the provided links as primary sources and check them first.${linksSection}${extra}${dna}${customInstructions}${deepDelta}

${depth}

IMPORTANT — accuracy over completeness: only include verifiable facts you actually found. Do NOT fabricate, invent, or infer details, dates, quotes, or achievements. If unsure, leave it out.

Use the Podcast DNA above to decide what matters: surface the stories and angles that fit this show's audience and style.

Write a structured research brief in markdown with these sections:
## Background & origin story
## Notable achievements
## Recent work & current focus
## Areas of expertise
## Angles & stories worth exploring on this show

Output ONLY the brief — no preamble, no closing remarks.`
}

// Distills the research brief into an on-air bio. Length + energy are tunable so
// Step 2 can produce a richer "expanded bio" or a punchier regeneration.
export function buildBioPrompt(
  research: string,
  guestName: string,
  show: Pick<Show, 'hostEnergy' | 'targetAudience'> | null,
  opts: { sentences?: string; punchy?: boolean } = {}
) {
  const length = opts.sentences ?? '2-3 sentences'
  const punch = opts.punchy
    ? ' Make this version punchier and more exciting than a standard bio — a different angle from anything generic.'
    : ''
  return `Using ONLY the research below, write a clean ${length} on-air bio for ${guestName}, focused on their current role and most notable achievement. Match the tone — host energy: ${show?.hostEnergy ?? 'warm_casual'}, audience: ${show?.targetAudience ?? 'general'}. Do not add anything not present in the research.${punch}

Research:
${research}

Return only the bio text — no preamble, no quotation marks.`
}

// Extracts verifiable fun facts from the research brief (count tunable).
export function buildFunFactsPrompt(research: string, guestName: string, count = 5) {
  return `From the research below about ${guestName}, extract ${count} accurate, verifiable, genuinely interesting facts. Use ONLY facts present in the research — do not invent or infer.

Research:
${research}

Return JSON exactly in this shape: { "facts": ["fact 1", "fact 2", ...] } with ${count} items.`
}

export function buildQuestionsPrompt(
  episode: Pick<Episode, 'guestName' | 'guestBio' | 'guestResearch' | 'focusAnswers'>,
  show: Pick<Show, 'interviewStyle' | 'hostEnergy' | 'pacing' | 'humorLevel' | 'aiQuestionInstructions' | 'targetAudience'> | null,
  sections: QSection[],
  previousQuestions: string[],
  influences: string[] = [],
  targetTotal = 40
) {
  const focusStr = Array.isArray(episode.focusAnswers)
    ? (episode.focusAnswers as string[]).map((a, i) => `${i + 1}. ${a}`).join('\n')
    : ''

  const prevStr = previousQuestions.length
    ? `\nAvoid repeating these previously-asked questions:\n${previousQuestions.slice(0, 20).join('\n')}`
    : ''

  const influenceStr = influences.length
    ? `\nInterview style influences — emulate how these hosts ask questions: ${influences.join(', ')}.`
    : ''

  const perSection = Math.max(3, Math.round(targetTotal / Math.max(1, sections.length)))

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
- Audience: ${show?.targetAudience ?? 'general'}${influenceStr}${prevStr}${customInstructions}

Generate roughly ${targetTotal} questions total — about ${perSection} per section (weight more toward the core/middle sections). Return a JSON object whose keys are EXACTLY these section keys (and nothing else):
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
  episode: Pick<Episode, 'guestName' | 'guestBio' | 'guestResearch' | 'introductionScript' | 'generatedQuestions' | 'selectedQuestions' | 'focusAnswers' | 'funFacts'>,
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

The intro should be warm, specific to this guest, draw on the research, and match the show's DNA so it sounds like this host on this show. The goal: make a listener who has never heard of the guest want to keep listening.

Format it as 3-4 short paragraphs, each prefixed with "HOST:" — written word-for-word for the host to read on air.

Return JSON: { "script": "HOST: ...\\n\\nHOST: ...\\n\\nHOST: ..." }`
  }

  // Rich question block, grouped by section with context + go-deeper notes.
  const bySection = chosenQuestionsBySection(episode.generatedQuestions, episode.selectedQuestions, sections)
  const questionsBlock = bySection.length
    ? bySection
        .map((sec) =>
          `### ${sec.name}\n` +
          sec.questions
            .map((q, i) => {
              const ctx = q.context ? `\n   - Context: ${q.context}` : ''
              const deeper = q.go_deeper?.length ? `\n   - Go deeper: ${q.go_deeper.join(' / ')}` : ''
              return `${i + 1}. ${q.question}${ctx}${deeper}`
            })
            .join('\n')
        )
        .join('\n\n')
    : questionTexts.map((t, i) => `${i + 1}. ${t}`).join('\n')

  const funFacts = (episode.funFacts as string[] | null) ?? []

  return `Produce a complete, professional interview guide document for ${hostName} interviewing ${episode.guestName} on "${showName}". Output clean markdown.

SOURCE MATERIAL
Guest bio: ${episode.guestBio ?? 'Not provided'}
Fun facts (host background knowledge):
${funFacts.length ? funFacts.map((f) => `- ${f}`).join('\n') : '- (none)'}
Verbatim intro to use EXACTLY as written:
"""
${episode.introductionScript ?? '(no intro yet — write a short one)'}
"""
Selected questions by section (with notes):
${questionsBlock}

Closing question: ${closingQuestion}
Interview style: ${show?.interviewStyle ?? 'conversational'}${customInstructions}

Build the document with these sections in order:
1. # Title — show, host, guest
2. ## How to use this guide — 2-3 lines on running the interview
3. ## Fun facts — the host's background knowledge (use the facts above)
4. ## Intro (read word-for-word) — the verbatim intro above, unchanged
5. ## Interview — every section as a "## " heading; under each, the questions in order, each with a short italic context note and any "Go deeper" follow-ups indented beneath
6. ## Closing — the closing question, framed warmly
7. ## Outro — a short scripted sign-off for the host to read

Return JSON: { "script": "the full markdown document" }`
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
