# Local article translation

`scripts/i18n` generates committed static translations from English Markdown/MDX.
English remains the source of truth, and translation never runs in Astro, Vercel,
or GitHub Actions.

## Local setup

1. Create or select a Google Cloud project with Cloud Translation enabled.
2. Install the Google Cloud CLI and create local Application Default Credentials:

   ```sh
   gcloud auth application-default login
   ```

3. Copy `.env.example` to `.env.local` or add the project to the existing file:

   ```dotenv
   GOOGLE_CLOUD_PROJECT=your-project-id
   ```

Application Default Credentials may instead use a local file named by
`GOOGLE_APPLICATION_CREDENTIALS`. Keep that file outside the repository. Do not add
translation credentials to GitHub or Vercel.

## Commands

Translate one article first, using an existing locale code or short route prefix:

```sh
npm run translations:translate -- --locale ja --slug <article-slug>
```

Then inspect status or resume missing/stale translations:

```sh
npm run translations:status
npm run translations:translate -- --locale ja
```

The CLI uses Google Cloud Translation v3 with the `general/nmt` model. Its public
locale codes and routes remain `ja`, `ko`, `es`, `fr`, `zh-Hans`, and `pt-BR`;
the Google targets are `ja`, `ko`, `es`, `fr`, `zh-CN`, and `pt`.
