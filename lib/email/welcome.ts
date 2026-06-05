// Welcome email: sent once, immediately after signup (email + Google).
// Walks the new user through the four first-step actions inside Ba Studio so
// they don't sit on an empty dashboard wondering what to do. Each step links
// straight to the screen that owns it. Localized to English or Hebrew based on
// the User.language column.

import { SITE_URL } from '@/lib/site'
import { getResend, RESEND_FROM } from './client'
import { emailLayout, emailButton, escapeHtml } from './layout'

interface WelcomeArgs {
  to: string
  firstName?: string | null
  language?: string | null
}

function welcomeHtmlEn(firstName?: string | null): string {
  const greeting = firstName ? `Hi ${escapeHtml(firstName)},` : 'Hi there,'
  const body = `
    <h1 style="margin:8px 0 12px 0;color:#eaeaf0;font-size:26px;line-height:32px;font-weight:700;">Welcome to Ba Studio</h1>
    <p style="margin:0 0 16px 0;color:#c7c7cf;font-size:15px;line-height:23px;">${greeting}</p>
    <p style="margin:0 0 16px 0;color:#c7c7cf;font-size:15px;line-height:23px;">
      Ba Studio takes you from a guest's name to a finished, on-brand episode in minutes.
      Here is the fastest path to your first episode.
    </p>
    <ol style="margin:0 0 8px 18px;padding:0;color:#c7c7cf;font-size:15px;line-height:24px;">
      <li style="margin-bottom:10px;"><a href="${SITE_URL}/shows" style="color:#eaeaf0;font-weight:600;text-decoration:underline;">Create your first show</a> , the home for your podcast.</li>
      <li style="margin-bottom:10px;"><a href="${SITE_URL}/shows" style="color:#eaeaf0;font-weight:600;text-decoration:underline;">Set up your Show DNA</a> , the secret sauce. It teaches the AI your voice, format, and tone so every episode sounds unmistakably like you.</li>
      <li style="margin-bottom:10px;"><a href="${SITE_URL}/guests" style="color:#eaeaf0;font-weight:600;text-decoration:underline;">Add a guest</a> , we research them automatically and surface the angles worth covering.</li>
      <li style="margin-bottom:10px;"><a href="${SITE_URL}/episodes/new" style="color:#eaeaf0;font-weight:600;text-decoration:underline;">Build your first episode</a> , the wizard walks you from idea to recording-ready.</li>
    </ol>
    ${emailButton(`${SITE_URL}/studio`, 'Open Ba Studio')}
    <p style="margin:18px 0 0 0;color:#8b8b95;font-size:13px;line-height:20px;">Reply to this email any time if you get stuck. We read every message.</p>
  `
  return emailLayout({
    preheader: 'Your first episode in four steps inside Ba Studio.',
    body,
  })
}

function welcomeHtmlHe(firstName?: string | null): string {
  const greeting = firstName ? `שלום ${escapeHtml(firstName)},` : 'שלום,'
  const body = `
    <h1 style="margin:8px 0 12px 0;color:#eaeaf0;font-size:26px;line-height:32px;font-weight:700;">ברוכים הבאים ל-Ba Studio</h1>
    <p style="margin:0 0 16px 0;color:#c7c7cf;font-size:15px;line-height:23px;">${greeting}</p>
    <p style="margin:0 0 16px 0;color:#c7c7cf;font-size:15px;line-height:23px;">
      Ba Studio לוקח אתכם משם של אורח לפרק מוגמר ועל המותג, תוך דקות.
      הנה הדרך המהירה ביותר לפרק הראשון שלכם.
    </p>
    <ol style="margin:0 18px 8px 0;padding:0;color:#c7c7cf;font-size:15px;line-height:24px;">
      <li style="margin-bottom:10px;"><a href="${SITE_URL}/shows" style="color:#eaeaf0;font-weight:600;text-decoration:underline;">צרו את התוכנית הראשונה</a> , הבית של הפודקאסט שלכם.</li>
      <li style="margin-bottom:10px;"><a href="${SITE_URL}/shows" style="color:#eaeaf0;font-weight:600;text-decoration:underline;">הגדירו את ה-DNA של התוכנית</a> , הקסם האמיתי. זה מלמד את ה-AI את הקול, הפורמט והטון שלכם.</li>
      <li style="margin-bottom:10px;"><a href="${SITE_URL}/guests" style="color:#eaeaf0;font-weight:600;text-decoration:underline;">הוסיפו אורח</a> , אנחנו חוקרים אותו אוטומטית ומציפים את הזוויות החשובות.</li>
      <li style="margin-bottom:10px;"><a href="${SITE_URL}/episodes/new" style="color:#eaeaf0;font-weight:600;text-decoration:underline;">בנו את הפרק הראשון</a> , הוויזרד מוביל אתכם מהרעיון עד להקלטה.</li>
    </ol>
    ${emailButton(`${SITE_URL}/studio`, 'פתחו את Ba Studio')}
    <p style="margin:18px 0 0 0;color:#8b8b95;font-size:13px;line-height:20px;">תוכלו להשיב למייל הזה בכל שאלה. אנחנו קוראים כל הודעה.</p>
  `
  return emailLayout({
    preheader: 'הפרק הראשון שלכם בארבעה צעדים בתוך Ba Studio.',
    body,
    dir: 'rtl',
  })
}

// Send the welcome email. Best-effort: never throws to the caller so a Resend
// outage can't break signup. Returns true when the email was queued.
export async function sendWelcomeEmail({ to, firstName, language }: WelcomeArgs): Promise<boolean> {
  const resend = getResend()
  if (!resend) {
    console.warn('RESEND_API_KEY missing - skipping welcome email')
    return false
  }
  const lang = (language ?? 'en').toLowerCase()
  const isHebrew = lang === 'he'
  const subject = isHebrew
    ? 'ברוכים הבאים ל-Ba Studio'
    : 'Welcome to Ba Studio, your first episode in 4 steps'
  const html = isHebrew ? welcomeHtmlHe(firstName) : welcomeHtmlEn(firstName)

  try {
    await resend.emails.send({
      from: RESEND_FROM,
      to,
      subject,
      html,
    })
    return true
  } catch (err) {
    console.error('Welcome email send failed:', err)
    return false
  }
}
