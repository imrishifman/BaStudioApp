This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## SEO & Traffic dashboard (admin)

The admin "SEO & Traffic" section reads Google Search Console + GA4 via a
service account. Set these environment variables (Vercel + `.env.local`):

- `GOOGLE_SERVICE_ACCOUNT_JSON` — the service-account key, as raw JSON or base64
  of the JSON. Read-only scopes (`webmasters.readonly`, `analytics.readonly`).
- `GSC_SITE_URL` — the Search Console property, e.g. `https://bastudiopodcast.com/`.
- `GA4_PROPERTY_ID` — the numeric GA4 property id (GA4 Admin > Property Settings).

Access setup (one time): add the service-account email (the `client_email` in
the key) as a **user** in Search Console (Settings > Users and permissions) and
as a **Viewer** on the GA4 property (Admin > Property Access Management). Until
that's done the dashboard shows a clear "access denied / add the service
account" message rather than data.

Optional (later phases): an SEO-tool API key for rankings/backlinks, and
`ANTHROPIC_API_KEY` (already set) for the daily AI report.
