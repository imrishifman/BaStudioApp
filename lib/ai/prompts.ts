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

export interface ResearchInput {
  guestName: string
  socialLinks?: { linkedin?: string | null; twitter?: string | null; instagram?: string | null; website?: string | null }
  knownBio?: string | null
  extraContext?: string | null
  mode: 'initial' | 'deep'
  show: DnaShow | null
  existingResearch?: string | null
}

export function buildResearchPrompt(input: ResearchInput): string {
  const { guestName, socialLinks = {}, knownBio, extraContext, mode, show, existingResearch } = input

  const linkLines: string[] = []
  if (socialLinks.linkedin) linkLines.push(`  LinkedIn: ${socialLinks.linkedin}`)
  if (socialLinks.twitter) linkLines.push(`  Twitter/X: ${socialLinks.twitter}`)
  if (socialLinks.instagram) linkLines.push(`  Instagram: ${socialLinks.instagram}`)
  if (socialLinks.website) linkLines.push(`  Website: ${socialLinks.website}`)
  const linksBlock = linkLines.length
    ? `\nPROFILE LINKS - use these to confirm you're researching the RIGHT person (disambiguation only, NOT your only sources):\n${linkLines.join('\n')}`
    : ''
  const bioBlock = knownBio?.trim()
    ? `\nKNOWN BIO (pre-extracted from guest document - treat as ground truth):\n  ${knownBio.trim().replace(/\n/g, '\n  ')}`
    : ''
  const ctxBlock = extraContext?.trim()
    ? `\nADDITIONAL CONTEXT (from host's notes or uploaded document):\n  ${extraContext.trim().replace(/\n/g, '\n  ')}`
    : ''
  const dnaBlock = show ? buildDnaSection(show) : ''
  const customInstructions = show?.aiResearchInstructions
    ? `\nCustom instructions from the host: ${show.aiResearchInstructions}`
    : ''

  // INITIAL pass - the foundational deep-research brief.
  if (mode === 'initial') {
    return `You are a world-class podcast researcher with live web access. Research the following guest for a podcast interview.

GUEST NAME: "${guestName}"${linksBlock}${bioBlock}${ctxBlock}${dnaBlock}${customInstructions}

Research broadly on the internet using web_search. Run multiple searches across Google, news sites, official sites, podcasts, articles, Wikipedia - wherever the best information lives. Use the PROFILE LINKS above only to confirm you have the right person (cross-check identity), not as the only sources.

Return a single Markdown brief that covers:
- Full name and current title/role
- Professional background and full work history with dates (4-6 sentences)
- Key achievements, awards, or recognition
- Recent projects, books, companies, or news (last 2-3 years)
- Core areas of expertise and thought leadership topics
- Personal journey: origin story, formative experiences, turning points
- Family background (parents, upbringing, siblings, spouse/children) - only what is publicly known
- Hobbies, passions, interests outside their work
- Verified social media and website links
- General web research that confirms this is the right person

CRITICAL GUARDRAILS:
- Research broadly across the internet. Do NOT limit yourself to the profile links.
- Use the profile links to confirm identity and disambiguate from people with similar names.
- Only include facts you can verify. If something is uncertain, omit it.
- Do not fabricate achievements, dates, or quotes.
- WRITING STYLE: never use em-dashes (-) in the output. Use hyphens, commas, or periods. Never apologize for missing information; just omit what you do not have.

Return the brief text only, no preamble.`
  }

  // DEEP pass - find ONLY new info across the 12 categories.
  const existing = (existingResearch ?? '').slice(0, 5000) || '(no prior research)'
  return `You are a world-class podcast researcher with live web access. You have already produced the brief below about ${guestName}. Do not repeat anything from it.

We already know the following about this person - DO NOT repeat any of this:
"""
${existing}
"""${linksBlock}${bioBlock}${ctxBlock}${dnaBlock}${customInstructions}

Find ONLY NEW information across these twelve categories, using web_search:
1. Full career timeline with specific dates
2. Every major publication, book, article, podcast appearance, or media feature
3. Awards, recognitions, and accolades (with years)
4. Key quotes and philosophies expressed publicly
5. Business ventures, companies founded (with details)
6. Educational background and mentors/influences
7. Controversies or pivotal career moments
8. Community involvement, charities, or causes
9. Personal interests, hobbies, or passions (publicly known)
10. Upcoming projects, announcements, or events
11. Unique or contrarian views in their field
12. What peers and industry leaders say about them

CRITICAL GUARDRAILS:
- Only include facts you can verify. If something is uncertain, omit it.
- Do not fabricate achievements, dates, or quotes.
- Be highly specific - include names, numbers, or dates wherever possible.

Return the new findings only, as Markdown with one section per category that has new info. Omit categories with no verified new info.`
}

// Distills the research brief into an on-air bio. Mode/opts let Step 2 produce
// either a punchier regeneration or a richer 4-5 sentence "expanded bio".
export function buildBioPrompt(
  research: string,
  guestName: string,
  show: Pick<Show, 'hostEnergy' | 'targetAudience'> | null,
  opts: { sentences?: '2-3' | '4-5'; punchy?: boolean; expanded?: boolean } = {}
) {
  const length = opts.sentences ?? '2-3'
  // Universal tone rule - never apologize for gaps.
  const tone = ` Write confidently and positively. Lead with what's distinctive, interesting, and impressive. NEVER say things like "couldn't find", "not enough information", "limited public details", or any other phrase that points out gaps - just work with what the research provides.`

  // Default (initial pass) - spec wording.
  if (length === '2-3' && !opts.punchy) {
    return `Based ONLY on the verified research below, write a clear and accurate 2-3 sentence bio for ${guestName}. Focus on their current role, most notable achievement, and what makes them distinctive.${tone}

Research:
${research}

Return only the bio text - no preamble, no quotation marks.`
  }
  // "Regenerate Bio" - punchier 2-3 sentence, deliberately different.
  if (length === '2-3' && opts.punchy) {
    return `Based ONLY on the verified research below, write a NEW 2-3 sentence on-air bio for ${guestName} that's punchier and more exciting than a standard bio - and clearly different from a vanilla retelling. Tone: host energy ${show?.hostEnergy ?? 'warm_casual'}, audience ${show?.targetAudience ?? 'general'}.${tone}

Research:
${research}

Return only the bio text - no preamble, no quotation marks.`
  }
  // Deep "expanded bio" - 4-5 sentences highlighting lesser-known details.
  return `Based ONLY on the verified research below, write an "expanded bio" for ${guestName}: 4-5 sentences that highlight lesser-known details and specific achievements with dates or numbers wherever the research supports them. Tone: host energy ${show?.hostEnergy ?? 'warm_casual'}, audience ${show?.targetAudience ?? 'general'}.${tone}

Research:
${research}

Return only the bio text - no preamble, no quotation marks.`
}

// Per-interviewer style profile across the 7 dimensions. Saved as text and
// later injected into question generation under INTERVIEW STYLE INFLUENCES.
export function buildInfluencerProfilePrompt(name: string): string {
  return `Create a detailed interviewer personality profile for: "${name}".

1. Questioning Philosophy - short punchy questions or long setup questions?
2. Opening Style - small talk, direct dive, provocative opener?
3. Silence & Pacing - how they handle silence and pauses
4. Emotional Tone - warm / challenging / playful / reverent?
5. What They Never Do - behaviors or approaches they avoid
6. Signature Move - one distinctive thing they always do that makes their interviews stand out
7. Example Question Formats - 3 specific question formats typical of their style

Be specific and actionable - this profile will be used to guide AI question generation.
Return clean markdown with one section per item. No preamble.`
}

// URL-based show research → structured JSON profile.
export function buildShowFromUrlPrompt(url: string): string {
  return `Identify the podcast at this URL and research its interviewing style: "${url}"

Approach (use web_search):
1. Look at the URL - extract any show name, host name, or keywords visible in the domain or path.
2. Run web_search with the URL itself, plus a separate search for the extracted name/keywords + the word "podcast", to identify which show this is.
3. Once identified, run 1-2 more searches to learn the host's interviewing style.
4. If the URL clearly points to Apple Podcasts, Spotify, YouTube, or a podcast site, the show name is almost always derivable - don't give up too quickly.

Return JSON with:
- show_name (string, or null only if you genuinely cannot identify the show after searching)
- host_name (string, or null)
- vibe (one sentence overall vibe)
- questioning_philosophy
- opening_style
- emotional_register (warm / cold / challenging / reverent / playful / investigative / etc.)
- pacing
- what_they_never_do
- signature_move
- example_question_formats (array of 3 format descriptions)
- full_profile (rich paragraph combining all of the above - for use in AI prompts)

Return ONLY the JSON object.`
}

// Extracts verifiable fun facts from the research brief. Count + specificity
// tunable so the Deep pass can request 10 highly-specific facts.
export function buildFunFactsPrompt(
  research: string,
  guestName: string,
  count = 5,
  opts: { specific?: boolean } = {}
) {
  const specific = opts.specific
    ? ' Each fact must be highly specific and surprising - include names, numbers, or dates wherever possible.'
    : ''
  return `Based ONLY on the verified research below, extract ${count} interesting and accurate facts about ${guestName}. IMPORTANT: Only include facts explicitly supported by the research. Do not invent or infer.${specific}

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
  influenceProfiles: Record<string, string> = {},
  // Capped to fit the 60s serverless function limit. With Haiku (2-3x faster
  // than Sonnet) we can land ~30 richly-annotated questions in time.
  targetTotal = 30
) {
  const focusStr = Array.isArray(episode.focusAnswers)
    ? (episode.focusAnswers as string[]).map((a, i) => `${i + 1}. ${a}`).join('\n')
    : ''

  const prevStr = previousQuestions.length
    ? `\nAvoid repeating these previously-asked questions:\n${previousQuestions.slice(0, 20).join('\n')}`
    : ''

  // Researched influencers contribute a full style profile; unresearched ones
  // only contribute their name - so researched ones carry more weight.
  const influenceBlock = influences.length
    ? `\n\nINTERVIEW STYLE INFLUENCES:\nGenerate questions in the spirit of these interview styles:\n\n${influences
        .map((name) => {
          const profile = influenceProfiles[name]?.trim()
          return profile ? `${name}:\n${profile}` : `${name}:\n(name only - style profile not researched)`
        })
        .join('\n---\n')}\n\nDo not copy their questions - adopt their questioning instincts.`
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
- Audience: ${show?.targetAudience ?? 'general'}${prevStr}${customInstructions}${influenceBlock}

Generate roughly ${targetTotal} questions total - about ${perSection} per section (weight more toward the core/middle sections). Return a JSON object whose keys are EXACTLY these section keys (and nothing else):
${sections.map(s => `- "${s.key}"  (${s.name})`).join('\n')}

For each section key, return an array of 4-6 question objects shaped like:
{ "question": "the question text", "strength_score": 8, "context": "what to listen for or why this lands", "go_deeper": ["a sharp follow-up", "another follow-up"] }

- strength_score is 1-10 (10 = your strongest, most revealing question for that section).
- Make every question specific to THIS guest and matched to the show's DNA above - never generic.
- Vary depth and style within each section.

Return ONLY the JSON object, e.g.:
{ ${sections.map(s => `"${s.key}": [ { "question": "...", "strength_score": 9, "context": "...", "go_deeper": ["..."] } ]`).join(', ')} }`
}

export function buildScriptPrompt(
  episode: Pick<Episode, 'guestName' | 'guestBio' | 'guestResearch' | 'introductionScript' | 'generatedQuestions' | 'selectedQuestions' | 'focusAnswers' | 'funFacts' | 'hostName'>,
  show: Pick<Show, 'name' | 'hostName' | 'interviewStyle' | 'openingLine' | 'closingQuestion' | 'guestIntroStyle' | 'aiScriptInstructions' | 'hostEnergy' | 'humorLevel' | 'targetAudience' | 'episodeSections'> | null,
  kind: 'intro' | 'full'
) {
  // Per-episode override takes precedence; otherwise the show's host name; finally a generic fallback.
  const hostName = episode.hostName?.trim() || show?.hostName || 'the host'
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

The intro should be specific to this guest, draw on the research, and match the show's DNA. The goal: make a listener who has never heard of the guest want to keep listening.

Format it as 1-2 short paragraphs, each prefixed with "HOST:" - written word-for-word for the host to read on air.

Hard constraints:
- MAXIMUM 750 characters total (count letters, not words). Be ruthless - cut every spare word.
- Excited, high-energy, punchy delivery. Pack it tight; every sentence earns its spot.

Return JSON: { "script": "HOST: ...\\n\\nHOST: ..." }`
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
${episode.introductionScript ?? '(no intro yet - write a short one)'}
"""
Selected questions by section (with notes):
${questionsBlock}

Closing question: ${closingQuestion}
Interview style: ${show?.interviewStyle ?? 'conversational'}${customInstructions}

Build the document with these sections in order:
1. # Title - show, host, guest
2. ## How to use this guide - 2-3 lines on running the interview
3. ## Fun facts - the host's background knowledge (use the facts above)
4. ## Intro (read word-for-word) - the verbatim intro above, unchanged
5. ## Interview - every section as a "## " heading; under each, the questions in order, each with a short italic context note and any "Go deeper" follow-ups indented beneath
6. ## Closing - the closing question, framed warmly
7. ## Outro - a short scripted sign-off for the host to read

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

  return `You are Ba-Studio's AI assistant - a knowledgeable, concise podcast production coach.
${ctx}
${pageCtx}

User message: ${message}

Respond helpfully and concisely. If they're working on an episode, give specific, actionable advice.
Keep responses under 200 words unless a longer answer is genuinely needed.`
}
