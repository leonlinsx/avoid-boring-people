// Small purpose-specific confirmation result pages. These are standalone HTML
// documents returned directly by the confirm endpoint: serif headline matching
// the site brand, theme-aware via the site's CSS variables with light fallbacks,
// one primary action each, no user input reflected, no tracking.
const PAGE_STYLE = `<style>:root{color-scheme:light dark}body{margin:0;background:var(--color-bg,#ffffff);color:var(--color-text,#222222);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;line-height:1.6}main{max-width:560px;margin:0 auto;padding:64px 20px}h1{font-family:Merriweather,Georgia,"Times New Roman",serif;font-size:28px;line-height:1.3;margin:0 0 16px}p{margin:0 0 12px}.cta{display:inline-block;margin:20px 0 8px;padding:12px 24px;background-color:#1a1a1a;color:#ffffff !important;text-decoration:none;border-radius:4px;font-size:16px}.sign{margin-top:28px;padding-top:16px;border-top:1px solid var(--color-border,#e0e0e0);color:var(--color-text-subtle,#666666);font-size:14px}.sign a{color:var(--color-link,#0066cc)}</style>`;

function page(title: string, body: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title} — Avoid Boring People</title>${PAGE_STYLE}</head><body><main>${body}<p class="sign">— Leon<br><a href="https://leonlins.com">leonlins.com</a></p></main></body></html>`;
}

export function buildConfirmSuccessPage(): string {
  return page(
    'You’re subscribed',
    `<h1>You’re subscribed.</h1>`
      + `<p>Thanks for confirming — you’re on the list for Avoid Boring People.</p>`
      + `<p>You’ll receive new essays on investing, technology, systems, and whatever else I’m exploring. I publish irregularly, so every email is one I thought was worth sending.</p>`
      + `<p>To make sure they reach your inbox, add newsletter@leonlins.com to your contacts.</p>`
      + `<a class="cta" href="/writing">Read the latest essays</a>`,
  );
}

export function buildConfirmInvalidPage(): string {
  return page(
    'Link no longer valid',
    `<h1>This link is no longer valid.</h1>`
      + `<p>Confirmation links work only once — this one has already been used, or it isn’t quite right.</p>`
      + `<p>If you’d still like to receive Avoid Boring People, just subscribe again.</p>`
      + `<a class="cta" href="/#subscribe">Subscribe</a>`,
  );
}
