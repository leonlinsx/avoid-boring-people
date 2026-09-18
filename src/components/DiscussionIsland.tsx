import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import {
  DELETED_COMMENT_PLACEHOLDER,
  commentErrorMessages,
  type PublicComment,
} from '../lib/comments/domain.ts';
import {
  commentCount,
  formatCommentTimestamp,
  groupCommentThreads,
  isEdited,
} from '../lib/comments/display.ts';

const TURNSTILE_SCRIPT_URL =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

const EMPTY_STATE = 'No comments yet. Add the first one.';
const UNAVAILABLE = commentErrorMessages.unavailable;
// A list that failed to load is retryable, so it says how. A failed post keeps
// the plainer message: advising a refresh there would discard the draft.
const LOAD_FAILED =
  'Comments could not be loaded. Refresh the page to try again.';
const INVITATION =
  'Thoughtful disagreements, additional evidence, and different ways of looking at the problem are welcome.';

// Every request is bounded, so neither the list nor a submit can sit in a
// permanent loading state when the API never answers.
const REQUEST_TIMEOUT_MS = 15_000;

type TurnstileWidgetId = string;

// The site's existing GA property accepts lightweight interaction events, so the
// discussion reports the three events the design calls for and nothing else: no
// comment analytics subsystem and no per-commenter identifiers.
function trackInteraction(event: string): void {
  const gtag = (window as { gtag?: (...args: unknown[]) => void }).gtag;
  if (typeof gtag !== 'function') return;
  gtag('event', event, { event_category: 'engagement' });
}

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      size?: 'normal' | 'compact' | 'flexible';
      theme?: 'light' | 'dark' | 'auto';
      callback?: (token: string) => void;
      'expired-callback'?: () => void;
      'error-callback'?: () => void;
    },
  ) => TurnstileWidgetId;
  reset: (widgetId?: TurnstileWidgetId) => void;
  remove: (widgetId?: TurnstileWidgetId) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

type Props = {
  slug: string;
  prompt: string;
  turnstileSiteKey: string | null;
  maxNameLength: number;
  maxBodyLength: number;
  emailHref: string;
  emailLabel: string;
};

type LoadState = 'loading' | 'ready' | 'error';

export default function DiscussionIsland({
  slug,
  prompt,
  turnstileSiteKey,
  maxNameLength,
  maxBodyLength,
  emailHref,
  emailLabel,
}: Props) {
  const commentsEndpoint = `/api/comments/${encodeURIComponent(slug)}`;
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [comments, setComments] = useState<PublicComment[]>([]);
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [replyTo, setReplyTo] = useState<PublicComment | null>(null);
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(
    null,
  );
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const widgetContainer = useRef<HTMLDivElement | null>(null);
  const widgetId = useRef<TurnstileWidgetId | null>(null);
  const verificationToken = useRef<string | null>(null);
  const bodyField = useRef<HTMLTextAreaElement | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(commentsEndpoint, {
        headers: { accept: 'application/json' },
        credentials: 'same-origin',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(String(response.status));
      const payload = (await response.json()) as { comments?: PublicComment[] };
      setComments(Array.isArray(payload.comments) ? payload.comments : []);
      setLoadState('ready');
    } catch {
      // A discussion that cannot load says so and leaves the article untouched.
      setLoadState('error');
    }
  }, [commentsEndpoint]);

  useEffect(() => {
    void load();
  }, [load]);

  // The widget is rendered explicitly so the theme can follow the page and so a
  // token can be reset after every submit attempt: Turnstile tokens are
  // single-use.
  useEffect(() => {
    if (!turnstileSiteKey) return;
    let cancelled = false;

    const renderWidget = () => {
      const container = widgetContainer.current;
      if (cancelled || !container || !window.turnstile || widgetId.current)
        return;
      widgetId.current = window.turnstile.render(container, {
        sitekey: turnstileSiteKey,
        size: 'flexible',
        theme: pageTheme(),
        callback: (token) => {
          verificationToken.current = token;
        },
        'expired-callback': () => {
          verificationToken.current = null;
        },
        'error-callback': () => {
          verificationToken.current = null;
        },
      });
    };

    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-turnstile-explicit]',
    );
    if (window.turnstile) {
      renderWidget();
    } else if (existing) {
      existing.addEventListener('load', renderWidget);
    } else {
      const script = document.createElement('script');
      script.src = TURNSTILE_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.dataset.turnstileExplicit = 'true';
      script.addEventListener('load', renderWidget);
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) {
        window.turnstile.remove(widgetId.current);
      }
      widgetId.current = null;
    };
  }, [turnstileSiteKey]);

  const threads = groupCommentThreads(comments);
  const total = commentCount(comments);

  const resetVerification = () => {
    verificationToken.current = null;
    if (widgetId.current && window.turnstile) {
      window.turnstile.reset(widgetId.current);
    }
  };

  const send = async (
    url: string,
    method: 'POST' | 'PATCH' | 'DELETE',
    payload?: Record<string, unknown>,
  ): Promise<{ ok: boolean; data: Record<string, unknown> | null }> => {
    try {
      const response = await fetch(url, {
        method,
        credentials: 'same-origin',
        headers: payload ? { 'content-type': 'application/json' } : undefined,
        body: payload ? JSON.stringify(payload) : undefined,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const data = (await response.json().catch(() => null)) as Record<
        string,
        unknown
      > | null;
      return { ok: response.ok && data?.ok === true, data };
    } catch {
      return { ok: false, data: null };
    }
  };

  const describeFailure = (data: Record<string, unknown> | null) =>
    typeof data?.message === 'string' ? data.message : UNAVAILABLE;

  const onSubmit = async (event: Event) => {
    event.preventDefault();
    if (submitting) return;
    setError(null);
    setNotice(null);

    if (!verificationToken.current) {
      setError(commentErrorMessages.verification_required);
      return;
    }

    setSubmitting(true);
    const result = await send(commentsEndpoint, 'POST', {
      name,
      body,
      parentId: replyTo?.id ?? null,
      turnstileToken: verificationToken.current,
      website: honeypot,
    });
    setSubmitting(false);
    resetVerification();

    if (!result.ok || !result.data?.comment) {
      // The typed text stays in the form so a retry costs nothing, except for
      // the honeypot response, which is identical to success by design.
      // A request that never answered may still have been stored, so the list
      // is reloaded to show the reader whether the comment exists before they
      // retry it.
      if (!result.data) void load();
      if (result.data?.ok !== true) setError(describeFailure(result.data));
      return;
    }

    const created = result.data.comment as PublicComment;
    setComments((previous) => [...previous, created]);
    setBody('');
    setReplyTo(null);
    setHoneypot('');
    setNotice('Comment posted.');
    trackInteraction(replyTo ? 'comment_reply' : 'comment_submit');
  };

  const startReply = (comment: PublicComment) => {
    setReplyTo(comment);
    setError(null);
    setNotice(null);
    bodyField.current?.focus();
  };

  const submitEdit = async (event: Event) => {
    event.preventDefault();
    if (!editing || submitting) return;
    setError(null);
    setNotice(null);
    setSubmitting(true);
    const result = await send(
      `${commentsEndpoint}/${encodeURIComponent(editing.id)}`,
      'PATCH',
      { body: editing.body },
    );
    setSubmitting(false);
    if (!result.ok || !result.data?.comment) {
      setError(describeFailure(result.data));
      return;
    }
    const updated = result.data.comment as PublicComment;
    setComments((previous) =>
      previous.map((comment) =>
        comment.id === updated.id ? updated : comment,
      ),
    );
    setEditing(null);
    setNotice('Comment updated.');
  };

  const removeComment = async (comment: PublicComment) => {
    if (submitting) return;
    setError(null);
    setNotice(null);
    setConfirmDeleteId(null);
    setSubmitting(true);
    const result = await send(
      `${commentsEndpoint}/${encodeURIComponent(comment.id)}`,
      'DELETE',
    );
    setSubmitting(false);
    if (!result.ok) {
      setError(describeFailure(result.data));
      return;
    }
    if (result.data?.removed === 'placeholder') {
      setComments((previous) =>
        previous.map((existing) =>
          existing.id === comment.id
            ? {
                ...existing,
                authorName: '',
                body: DELETED_COMMENT_PLACEHOLDER,
                isDeleted: true,
                canEdit: false,
              }
            : existing,
        ),
      );
    } else {
      setComments((previous) =>
        previous.filter(
          (existing) =>
            existing.id !== comment.id && existing.parentId !== comment.id,
        ),
      );
    }
    setNotice('Comment deleted.');
  };

  return (
    <div class="discussion">
      <h2 id="discussion-heading">
        Discussion{total > 0 ? ` · ${total}` : ''}
      </h2>

      <p class="discussion-prompt">{prompt}</p>
      <p class="discussion-invitation">{INVITATION}</p>

      <div class="discussion-list" aria-labelledby="discussion-heading">
        {/* Without a public site key no comment can be submitted, so the loading
            state is skipped rather than left beside the unavailable message. */}
        {loadState === 'loading' && turnstileSiteKey && (
          <p class="discussion-muted">Loading discussion…</p>
        )}
        {loadState === 'error' && <p class="discussion-muted">{LOAD_FAILED}</p>}
        {loadState === 'ready' && threads.length === 0 && (
          <p class="discussion-muted">{EMPTY_STATE}</p>
        )}
        {threads.map((thread) => (
          <div class="discussion-thread" key={thread.comment.id}>
            <CommentBody
              comment={thread.comment}
              editing={editing}
              confirmDeleteId={confirmDeleteId}
              submitting={submitting}
              maxBodyLength={maxBodyLength}
              onReply={startReply}
              onStartEdit={(comment) =>
                setEditing({ id: comment.id, body: comment.body })
              }
              onCancelEdit={() => setEditing(null)}
              onChangeEditBody={(value) =>
                setEditing((previous) =>
                  previous ? { ...previous, body: value } : previous,
                )
              }
              onSubmitEdit={submitEdit}
              onAskDelete={(id) => setConfirmDeleteId(id)}
              onCancelDelete={() => setConfirmDeleteId(null)}
              onConfirmDelete={removeComment}
              canReply
            />
            {thread.replies.length > 0 && (
              <div class="discussion-replies">
                {thread.replies.map((reply) => (
                  <CommentBody
                    key={reply.id}
                    comment={reply}
                    editing={editing}
                    confirmDeleteId={confirmDeleteId}
                    submitting={submitting}
                    maxBodyLength={maxBodyLength}
                    onReply={startReply}
                    onStartEdit={(comment) =>
                      setEditing({ id: comment.id, body: comment.body })
                    }
                    onCancelEdit={() => setEditing(null)}
                    onChangeEditBody={(value) =>
                      setEditing((previous) =>
                        previous ? { ...previous, body: value } : previous,
                      )
                    }
                    onSubmitEdit={submitEdit}
                    onAskDelete={(id) => setConfirmDeleteId(id)}
                    onCancelDelete={() => setConfirmDeleteId(null)}
                    onConfirmDelete={removeComment}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {turnstileSiteKey ? (
        <form class="discussion-form" method="post" onSubmit={onSubmit}>
          <div class="discussion-field">
            <label for="discussion-name">Display name</label>
            <input
              id="discussion-name"
              name="name"
              type="text"
              autocomplete="nickname"
              required
              maxlength={maxNameLength}
              value={name}
              onInput={(event) => setName(event.currentTarget.value)}
              placeholder="Your name or a pseudonym"
            />
          </div>

          <div class="discussion-field">
            {replyTo ? (
              <label for="discussion-body">
                {`Reply to ${replyTo.authorName || 'comment'}`}
              </label>
            ) : (
              <label class="discussion-visually-hidden" for="discussion-body">
                Add to the discussion
              </label>
            )}
            <textarea
              id="discussion-body"
              name="body"
              rows={5}
              required
              maxlength={maxBodyLength}
              placeholder="Add to the discussion…"
              value={body}
              ref={bodyField}
              onInput={(event) => setBody(event.currentTarget.value)}
            />
          </div>

          <div class="discussion-honeypot" aria-hidden="true">
            <label for="discussion-website">Website</label>
            <input
              id="discussion-website"
              name="website"
              type="text"
              tabindex={-1}
              autocomplete="off"
              value={honeypot}
              onInput={(event) => setHoneypot(event.currentTarget.value)}
            />
          </div>

          <div class="discussion-turnstile" ref={widgetContainer} />

          <div class="discussion-actions">
            <button type="submit" disabled={submitting}>
              {submitting ? 'Posting…' : 'Post'}
            </button>
            {replyTo && (
              <button
                type="button"
                class="discussion-secondary"
                onClick={() => setReplyTo(null)}
              >
                Cancel reply
              </button>
            )}
          </div>

          <p class="discussion-status" role="status" aria-live="polite">
            {error && <span class="discussion-error">{error}</span>}
            {!error && notice}
          </p>
        </form>
      ) : (
        <p class="discussion-muted">{UNAVAILABLE}</p>
      )}

      <p class="discussion-private">
        Prefer a private conversation?{' '}
        <a
          href={emailHref}
          onClick={() => trackInteraction('private_email_click')}
        >
          {emailLabel}
        </a>
        .
      </p>
    </div>
  );
}

type CommentBodyProps = {
  comment: PublicComment;
  editing: { id: string; body: string } | null;
  confirmDeleteId: string | null;
  submitting: boolean;
  maxBodyLength: number;
  onReply: (comment: PublicComment) => void;
  onStartEdit: (comment: PublicComment) => void;
  onCancelEdit: () => void;
  onChangeEditBody: (value: string) => void;
  onSubmitEdit: (event: Event) => void;
  onAskDelete: (id: string) => void;
  onCancelDelete: () => void;
  onConfirmDelete: (comment: PublicComment) => void;
  canReply?: boolean;
};

function CommentBody({
  comment,
  editing,
  confirmDeleteId,
  submitting,
  maxBodyLength,
  onReply,
  onStartEdit,
  onCancelEdit,
  onChangeEditBody,
  onSubmitEdit,
  onAskDelete,
  onCancelDelete,
  onConfirmDelete,
  canReply = false,
}: CommentBodyProps) {
  const isEditing = editing?.id === comment.id;

  // A removed comment keeps its place in the thread so replies stay legible.
  if (comment.isDeleted) {
    return (
      <article class="comment comment-deleted" id={`comment-${comment.id}`}>
        <p class="comment-body-text">
          {comment.body || DELETED_COMMENT_PLACEHOLDER}
        </p>
      </article>
    );
  }

  return (
    <article class="comment" id={`comment-${comment.id}`}>
      <header class="comment-meta">
        <span class="comment-author">
          {comment.authorName}
          {comment.isAuthor && <span class="comment-badge">Author</span>}
        </span>
        <time class="comment-time" dateTime={comment.createdAt}>
          {formatCommentTimestamp(comment.createdAt)}
          {isEdited(comment) && <span class="comment-edited"> · edited</span>}
        </time>
      </header>

      {isEditing ? (
        <form class="comment-edit" method="post" onSubmit={onSubmitEdit}>
          <label class="discussion-visually-hidden" for={`edit-${comment.id}`}>
            Edit comment
          </label>
          <textarea
            id={`edit-${comment.id}`}
            rows={4}
            required
            maxlength={maxBodyLength}
            value={editing?.body ?? ''}
            onInput={(event) => onChangeEditBody(event.currentTarget.value)}
          />
          <div class="discussion-actions">
            <button type="submit" disabled={submitting}>
              Save changes
            </button>
            <button
              type="button"
              class="discussion-secondary"
              onClick={onCancelEdit}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <p class="comment-body-text">{comment.body}</p>
      )}

      {!comment.isDeleted && (
        <div class="comment-actions">
          {canReply && !isEditing && (
            <button type="button" onClick={() => onReply(comment)}>
              Reply
            </button>
          )}
          {comment.canEdit && !isEditing && (
            <button type="button" onClick={() => onStartEdit(comment)}>
              Edit
            </button>
          )}
          {comment.canEdit && !isEditing && (
            <button
              type="button"
              class="discussion-danger"
              onClick={() => onAskDelete(comment.id)}
            >
              Delete
            </button>
          )}
        </div>
      )}

      {confirmDeleteId === comment.id && (
        <div class="comment-confirm" role="alert">
          <p>Delete this comment?</p>
          <div class="discussion-actions">
            <button
              type="button"
              class="discussion-danger"
              disabled={submitting}
              onClick={() => onConfirmDelete(comment)}
            >
              Yes, delete
            </button>
            <button
              type="button"
              class="discussion-secondary"
              onClick={onCancelDelete}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

function pageTheme(): 'light' | 'dark' {
  return document.documentElement.getAttribute('data-theme') === 'dark'
    ? 'dark'
    : 'light';
}
