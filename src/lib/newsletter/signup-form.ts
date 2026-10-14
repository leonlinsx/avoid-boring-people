import { attributionPayload, firstTouchAttribution } from './attribution';

const ERROR_MESSAGE =
  'Unable to complete the request. Please try again later. No confirmation delivery has been confirmed.';

export function initializeNewsletterForms() {
  let attribution: Record<string, string> | undefined;
  try {
    attribution = attributionPayload(
      firstTouchAttribution(
        {
          search: location.search,
          pathname: location.pathname,
          host: location.host,
          referrer: document.referrer,
        },
        window.localStorage,
      ),
    );
  } catch {
    // Storage is best effort; unavailable attribution never blocks signup.
  }

  for (const form of document.querySelectorAll<HTMLFormElement>(
    '[data-newsletter-form]',
  )) {
    const message = document.getElementById(`${form.id}-message`);
    const button = form.querySelector<HTMLButtonElement>(
      'button[type="submit"]',
    );
    if (!message || !button) continue;
    let submitting = false;
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (submitting || !form.reportValidity()) return;
      submitting = true;
      button.disabled = true;
      form.setAttribute('aria-busy', 'true');
      message.textContent = '';
      message.className = 'subscribe-message';
      const fields = new FormData(form);
      try {
        const response = await fetch(form.action, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: fields.get('email'),
            source: fields.get('source'),
            website: fields.get('website'),
            attribution,
          }),
        });
        const result = await response.json();
        if (!response.ok || result?.ok !== true)
          throw new Error('Signup failed');
        // The generic API response does not attest to delivery or membership.
        message.textContent = form.classList.contains('compact')
          ? form.dataset.successCompact!
          : form.dataset.successFull!;
        message.className = 'subscribe-message success';
      } catch {
        message.textContent = ERROR_MESSAGE;
        message.className = 'subscribe-message error';
      } finally {
        submitting = false;
        button.disabled = false;
        form.removeAttribute('aria-busy');
      }
    });
  }
}
