import { createShadowHost, injectStyles, removeShadowHost } from '../ui/shadow.js';
import { getCommentStyles } from '../ui/styles.js';
import { el, setTextContent, renderCommentContent, sanitizeUrl } from '../ui/sanitize.js';
import { isMobileDevice } from '../auth/popup.js';
import { login as oauthLogin } from '../auth/oauth.js';
import { tokenStorage } from '../auth/storage.js';
import { getUserIdFromToken } from '../auth/token.js';
import type { createCommentsApi } from '../api/comments.js';
import type { Comment, CommentSortBy, ResolvedConfig } from '../types/index.js';
import type { EventEmitter } from '../core/events.js';

const PANEL_HOST_ID = 'cc-comments-host';

const AVATAR_COLORS = ['#6366f1', '#ec4899', '#8b5cf6', '#14b8a6', '#f59e0b', '#ef4444'];

function avatarColor(name: string): string {
  return AVATAR_COLORS[(name || 'A').charCodeAt(0) % AVATAR_COLORS.length];
}

function initials(first: string, last: string): string {
  return `${first?.[0]?.toUpperCase() ?? ''}${last?.[0]?.toUpperCase() ?? ''}` || '?';
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const day = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${time} · ${day}`;
  } catch { return ''; }
}

export interface CommentPanelApi {
  openPanel(): void;
  closePanel(): void;
  destroy(): void;
}

export function createCommentPanel(
  config: ResolvedConfig,
  commentsApi: ReturnType<typeof createCommentsApi>,
  emitter: EventEmitter,
  onClose: () => void
): CommentPanelApi {
  let root: ShadowRoot | null = null;
  let currentUserId: string | null = null;
  let currentThreadId: string | null = null;
  let currentComments: Comment[] = [];
  let currentSort: CommentSortBy = 'TOP';
  let viewingSubthreadFor: string | null = null;
  let replyingToCommentId: string | null = null;
  let editingCommentId: string | null = null;

  // ── Shadow DOM setup ──────────────────────────────────────────────────────

  function ensureRoot(): ShadowRoot {
    if (root) return root;
    const { root: r } = createShadowHost(PANEL_HOST_ID);
    root = r;
    injectStyles(root, getCommentStyles(config.theme.primaryColor, config.theme.fontFamily));
    return root;
  }

  // ── Auth ──────────────────────────────────────────────────────────────────

  function refreshUser(): void {
    const token = tokenStorage.get();
    if (token) {
      currentUserId = getUserIdFromToken(token);
    } else {
      currentUserId = null;
    }
  }

  async function doLogin(): Promise<void> {
    if (isMobileDevice()) {
      // Full-page redirect — picked up by consumeAuthCodeFromUrl on reload.
      void oauthLogin(config);
      return;
    }

    const ok = await oauthLogin(config);
    if (ok) {
      refreshUser();
      updateLoginOverlay();
      void loadComments();
    }
  }

  // ── Thread & Comments Loading ─────────────────────────────────────────────

  async function loadComments(): Promise<void> {
    const r = ensureRoot();
    const listEl = r.getElementById('cc-comments-list');
    if (!listEl) return;

    renderLoading(listEl);

    try {
      // 1. Ensure a thread exists for this page (backend returns thread object directly)
      const threadRes = await commentsApi.ensureThread({
        pageUrl: config.articleUrl,
        hostname: config.hostName,
      });

      if (!threadRes._id) {
        renderError(listEl, 'Comments are not available for this page.');
        return;
      }

      currentThreadId = threadRes._id;

      // 2. Fetch comments (backend returns { thread, comments } — no success wrapper)
      const commentsRes = await commentsApi.getComments({
        pageUrl: config.articleUrl,
        sortBy: currentSort,
      });

      currentComments = commentsRes.comments ?? [];
      if (commentsRes.thread) currentThreadId = commentsRes.thread._id;

      // Update count badge in header
      const countEl = r.getElementById('cc-header-count');
      if (countEl) setTextContent(countEl, String(currentComments.length));

      renderComments(listEl);
    } catch {
      renderError(listEl, 'Unable to reach the server. Check your connection.');
    }
  }

  // ── Comment Tree Building ─────────────────────────────────────────────────

  function buildTree(comments: Comment[]): Comment[] {
    const map = new Map<string, Comment & { replies: Comment[] }>();
    const roots: Array<Comment & { replies: Comment[] }> = [];

    comments.forEach(c => map.set(c._id, { ...c, replies: [] }));

    comments.forEach(c => {
      const node = map.get(c._id)!;
      if (c.parentCommentId) {
        const parent = map.get(c.parentCommentId);
        if (parent && !parent.parentCommentId) parent.replies.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  }

  function sortTree(roots: Comment[]): Comment[] {
    const sorted = [...roots];
    if (currentSort === 'NEWEST') {
      sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else {
      // TOP — sort by reply count then likes
      sorted.sort((a, b) =>
        ((b.replies?.length ?? 0) - (a.replies?.length ?? 0)) ||
        ((b.likeCount ?? 0) - (a.likeCount ?? 0))
      );
    }
    sorted.forEach(c => {
      if (c.replies?.length) {
        c.replies.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }
    });
    return sorted;
  }

  // ── DOM Rendering ─────────────────────────────────────────────────────────

  function renderLoading(container: HTMLElement): void {
    container.innerHTML = '';
    const div = el('div');
    div.className = 'cc-loading-state';
    const spinner = el('div');
    spinner.className = 'cc-spinner-lg';
    div.appendChild(spinner);
    div.appendChild(el('p', 'Loading comments…'));
    container.appendChild(div);
  }

  function renderError(container: HTMLElement, message: string): void {
    container.innerHTML = '';
    const div = el('div');
    div.className = 'cc-error-state';

    const icon = el('div');
    icon.className = 'cc-error-icon';
    icon.innerHTML = `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;

    div.appendChild(icon);
    div.appendChild(el('p', message));

    const retry = el('button', 'Try Again');
    retry.className = 'cc-retry-btn';
    retry.addEventListener('click', () => void loadComments());
    div.appendChild(retry);
    container.appendChild(div);
  }

  function renderComments(container: HTMLElement): void {
    container.innerHTML = '';

    const r = ensureRoot();

    // Update back button and title
    const backBtn = r.getElementById('cc-back-btn');
    const titleEl = r.getElementById('cc-panel-title');
    if (viewingSubthreadFor) {
      backBtn?.classList.add('cc-visible');
      if (titleEl) setTextContent(titleEl, 'Replies');
    } else {
      backBtn?.classList.remove('cc-visible');
      if (titleEl) setTextContent(titleEl, 'Comments');
    }

    if (viewingSubthreadFor) {
      renderSubthread(container, viewingSubthreadFor);
      return;
    }

    if (currentComments.length === 0) {
      const empty = el('div');
      empty.className = 'cc-empty-state';
      empty.appendChild(el('p', 'No comments yet'));
      const sub = el('span', 'Be the first to share your thoughts');
      empty.appendChild(sub);
      container.appendChild(empty);
      return;
    }

    const tree = sortTree(buildTree(currentComments));
    tree.forEach(c => container.appendChild(buildCommentEl(c, false)));
  }

  function renderSubthread(container: HTMLElement, parentId: string): void {
    const tree = buildTree(currentComments);
    const parent = tree.find(c => c._id === parentId);
    if (!parent) return;

    container.appendChild(buildCommentEl(parent, false));

    const label = el('div', `${parent.replies?.length ?? 0} ${(parent.replies?.length ?? 0) === 1 ? 'REPLY' : 'REPLIES'}`);
    label.className = 'cc-subthread-label';
    container.appendChild(label);

    if (!parent.replies?.length) {
      const empty = el('div');
      empty.className = 'cc-empty-state';
      empty.style.paddingTop = '20px';
      empty.appendChild(el('p', 'No replies yet'));
      container.appendChild(empty);
    } else {
      parent.replies.forEach(r => container.appendChild(buildCommentEl(r, true)));
    }
  }

  /**
   * Hidden/removed comments (moderation fields — design doc §4.1) must render
   * as a placeholder rather than the real content or break the tree. Mirrors
   * the extension's comment widget — keep this in lockstep with
   * content-credits-extension/src/content/commentPanel.ts.
   */
  function buildModeratedCommentEl(comment: Comment, isReply: boolean): HTMLElement {
    const card = el('div');
    card.className = `cc-comment-card cc-comment-removed${isReply ? ' cc-reply' : ''}`;
    card.dataset.commentId = comment._id;

    const body = el('div');
    body.className = 'cc-comment-body cc-comment-removed-text';
    body.appendChild(el('em', comment.hiddenReason || 'This comment was removed by a moderator.'));
    card.appendChild(body);

    // Replies (if any) still render normally underneath a removed parent.
    if (!isReply && comment.replies?.length) {
      const repliesWrap = el('div');
      repliesWrap.className = 'cc-comment-removed-replies';
      comment.replies.forEach(reply => {
        repliesWrap.appendChild(
          reply.isActive === false ? buildModeratedCommentEl(reply, true) : buildCommentEl(reply, true)
        );
      });
      card.appendChild(repliesWrap);
    }

    return card;
  }

  function buildCommentEl(comment: Comment, isReply: boolean): HTMLElement {
    if (comment.isActive === false) {
      return buildModeratedCommentEl(comment, isReply);
    }

    const isOwn = !!(currentUserId && comment.authorId === currentUserId);
    const author = comment.author;
    const authorName = author ? `${author.firstName} ${author.lastName}`.trim() : 'Anonymous';
    const avatarBg = avatarColor(authorName);
    const inis = author ? initials(author.firstName, author.lastName) : '?';

    const card = el('div');
    card.className = `cc-comment-card${isReply ? ' cc-reply' : ''}`;
    card.dataset.commentId = comment._id;

    // Header row
    const header = el('div');
    header.className = 'cc-comment-header';
    const authorRow = el('div');
    authorRow.className = 'cc-comment-author-row';

    // Avatar
    const avatar = el('div');
    avatar.className = 'cc-avatar';
    avatar.style.background = avatarBg;

    if (author?.profilePicture) {
      const safeUrl = sanitizeUrl(
        author.profilePicture.startsWith('http')
          ? author.profilePicture
          : `${config.apiBaseUrl}${author.profilePicture}`
      );
      if (safeUrl) {
        const img = el('img');
        img.setAttribute('src', safeUrl);
        img.setAttribute('alt', authorName);
        img.addEventListener('error', () => {
          img.remove();
          setTextContent(avatar, inis);
        });
        avatar.appendChild(img);
      } else {
        setTextContent(avatar, inis);
      }
    } else {
      setTextContent(avatar, inis);
    }

    const authorMeta = el('div');
    const nameEl = el('div', authorName);
    nameEl.className = 'cc-author-name';
    const timeEl = el('div', formatDate(comment.createdAt));
    timeEl.className = 'cc-comment-time';
    authorMeta.appendChild(nameEl);
    authorMeta.appendChild(timeEl);

    authorRow.appendChild(avatar);
    authorRow.appendChild(authorMeta);
    header.appendChild(authorRow);
    card.appendChild(header);

    // Body — safe DOM construction, never innerHTML of user content
    const body = el('div');
    body.className = 'cc-comment-body';
    body.appendChild(renderCommentContent(comment.content));
    card.appendChild(body);

    // Actions row
    const actions = el('div');
    actions.className = 'cc-comment-actions';

    // Reply button (only on top-level)
    if (!isReply) {
      const replyBtn = el('button');
      replyBtn.className = 'cc-action-btn';
      replyBtn.dataset.commentId = comment._id;
      replyBtn.dataset.action = 'reply';
      replyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transform:scaleX(-1)"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
      replyBtn.appendChild(document.createTextNode(` ${comment.replies?.length || 'Reply'}`));
      actions.appendChild(replyBtn);
    }

    // Like button
    const likeBtn = el('button');
    likeBtn.className = `cc-action-btn${comment.hasLiked ? ' cc-liked' : ''}`;
    likeBtn.dataset.commentId = comment._id;
    likeBtn.dataset.action = 'like';
    likeBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="${comment.hasLiked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
    likeBtn.appendChild(document.createTextNode(` ${comment.likeCount ?? 0}`));
    actions.appendChild(likeBtn);

    // Owner controls
    if (isOwn) {
      const ownerDiv = el('div');
      ownerDiv.className = 'cc-action-btn cc-owner-actions';
      ownerDiv.style.cssText = 'margin-left:auto;display:flex;gap:4px;background:transparent;border:none;padding:0;';

      const editBtn = el('button', 'Edit');
      editBtn.className = 'cc-action-btn';
      editBtn.dataset.commentId = comment._id;
      editBtn.dataset.action = 'edit';

      const deleteBtn = el('button', 'Delete');
      deleteBtn.className = 'cc-action-btn cc-danger';
      deleteBtn.dataset.commentId = comment._id;
      deleteBtn.dataset.action = 'delete';

      ownerDiv.appendChild(editBtn);
      ownerDiv.appendChild(deleteBtn);
      actions.appendChild(ownerDiv);
    }

    card.appendChild(actions);
    return card;
  }

  // ── Panel DOM Structure ───────────────────────────────────────────────────

  function buildPanel(): HTMLElement {
    const panel = el('div');
    panel.className = 'cc-panel';
    panel.id = 'cc-comments-panel';

    // Header
    const header = el('div');
    header.className = 'cc-panel-header';

    const backBtn = el('button');
    backBtn.className = 'cc-back-btn';
    backBtn.id = 'cc-back-btn';
    backBtn.setAttribute('aria-label', 'Back');
    backBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>`;
    backBtn.addEventListener('click', () => {
      viewingSubthreadFor = null;
      replyingToCommentId = null;
      const listEl = root?.getElementById('cc-comments-list');
      if (listEl) renderComments(listEl);
    });

    const titleGroup = el('div');
    titleGroup.style.cssText = 'flex:1;display:flex;align-items:center;gap:6px;';
    const titleEl = el('span', 'Comments');
    titleEl.className = 'cc-panel-title';
    titleEl.id = 'cc-panel-title';
    const countEl = el('span', '');
    countEl.className = 'cc-panel-count';
    countEl.id = 'cc-header-count';
    titleGroup.appendChild(titleEl);
    titleGroup.appendChild(countEl);

    const closeBtn = el('button');
    closeBtn.className = 'cc-panel-close-btn';
    closeBtn.setAttribute('aria-label', 'Close comments');
    closeBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
    closeBtn.addEventListener('click', closePanel);

    header.appendChild(backBtn);
    header.appendChild(titleGroup);
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // Sort bar
    const sortBar = el('div');
    sortBar.className = 'cc-sort-bar';
    const sortLabel = el('span', 'Sort:');
    sortLabel.className = 'cc-sort-label';
    sortBar.appendChild(sortLabel);

    const sortLabels: Record<CommentSortBy, string> = { TOP: 'Top', NEWEST: 'Newest', TIPPED_MOST: 'Most tipped' };
    (['TOP', 'NEWEST'] as CommentSortBy[]).forEach(sort => {
      const btn = el('button', sortLabels[sort]);
      btn.className = `cc-sort-btn${currentSort === sort ? ' cc-active' : ''}`;
      btn.dataset.sort = sort;
      btn.addEventListener('click', () => {
        if (currentSort === sort) return;
        currentSort = sort;
        sortBar.querySelectorAll('.cc-sort-btn').forEach(b => b.classList.remove('cc-active'));
        btn.classList.add('cc-active');
        void loadComments();
      });
      sortBar.appendChild(btn);
    });
    panel.appendChild(sortBar);

    // Comments list
    const list = el('div');
    list.className = 'cc-comments-list';
    list.id = 'cc-comments-list';
    list.addEventListener('click', handleListClick);
    panel.appendChild(list);

    // Compose area
    panel.appendChild(buildCompose());

    return panel;
  }

  function buildCompose(): HTMLElement {
    const compose = el('div');
    compose.className = 'cc-compose';
    compose.id = 'cc-compose';

    const textarea = el('textarea');
    textarea.className = 'cc-compose-textarea';
    textarea.id = 'cc-compose-textarea';
    textarea.setAttribute('placeholder', 'Write a comment…');
    textarea.setAttribute('rows', '3');
    compose.appendChild(textarea);

    const actions = el('div');
    actions.className = 'cc-compose-actions';

    const cancelBtn = el('button', 'Cancel');
    cancelBtn.className = 'cc-compose-cancel';
    cancelBtn.id = 'cc-compose-cancel';
    cancelBtn.addEventListener('click', cancelEdit);
    actions.appendChild(cancelBtn);

    const submitBtn = el('button', 'Post');
    submitBtn.className = 'cc-compose-submit';
    submitBtn.id = 'cc-compose-submit';
    submitBtn.addEventListener('click', () => void handleSubmit());
    actions.appendChild(submitBtn);

    compose.appendChild(actions);

    // Login overlay inside compose
    if (!tokenStorage.has()) {
      compose.appendChild(buildLoginOverlay());
    }

    return compose;
  }

  function buildLoginOverlay(): HTMLElement {
    const overlay = el('div');
    overlay.className = 'cc-login-overlay';
    overlay.id = 'cc-login-overlay';
    overlay.appendChild(el('p', 'Sign in to join the conversation'));
    const btn = el('button', 'Sign in with Content Credits');
    btn.className = 'cc-login-overlay-btn';
    btn.addEventListener('click', () => void doLogin());
    overlay.appendChild(btn);
    return overlay;
  }

  // ── Interactions ──────────────────────────────────────────────────────────

  function handleListClick(e: Event): void {
    const target = e.target as HTMLElement;
    const btn = target.closest<HTMLElement>('[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;
    const commentId = btn.dataset.commentId;
    if (!commentId) return;

    switch (action) {
      case 'reply': handleReply(commentId); break;
      case 'like': void handleLike(commentId); break;
      case 'edit': handleEdit(commentId); break;
      case 'delete': void handleDelete(commentId); break;
    }
  }

  function handleReply(commentId: string): void {
    if (!viewingSubthreadFor) {
      // First click on Reply → drill into the subthread view
      viewingSubthreadFor = commentId;
      const listEl = root?.getElementById('cc-comments-list');
      if (listEl) renderComments(listEl);
    } else {
      // Already in subthread → set the reply target and focus textarea
      replyingToCommentId = commentId;
      editingCommentId = null;
      const textarea = root?.getElementById('cc-compose-textarea') as HTMLTextAreaElement | null;
      if (textarea) {
        textarea.placeholder = 'Write a reply…';
        textarea.focus();
      }
      showCancel();
    }
  }

  async function handleLike(commentId: string): Promise<void> {
    if (!tokenStorage.has()) { void doLogin(); return; }

    // Optimistic update
    const comment = currentComments.find(c => c._id === commentId);
    if (!comment) return;
    const wasLiked = comment.hasLiked;
    comment.hasLiked = !wasLiked;
    comment.likeCount = (comment.likeCount ?? 0) + (comment.hasLiked ? 1 : -1);
    const listEl = root?.getElementById('cc-comments-list');
    if (listEl) renderComments(listEl);

    try {
      // Backend returns { success: true, data: { _id, likeCount, hasLiked } }
      const res = await commentsApi.toggleLike(commentId);
      if (res.success) {
        if (typeof res.data?.hasLiked === 'boolean') comment.hasLiked = res.data.hasLiked;
        if (typeof res.data?.likeCount === 'number') comment.likeCount = res.data.likeCount;
        emitter.emit('comment:liked', { commentId, hasLiked: comment.hasLiked });
      } else {
        // Rollback
        comment.hasLiked = wasLiked;
        comment.likeCount = (comment.likeCount ?? 0) + (wasLiked ? 1 : -1);
      }
      if (listEl) renderComments(listEl);
    } catch {
      comment.hasLiked = wasLiked;
      comment.likeCount = (comment.likeCount ?? 0) + (wasLiked ? 1 : -1);
      if (listEl) renderComments(listEl);
    }
  }

  function handleEdit(commentId: string): void {
    const comment = currentComments.find(c => c._id === commentId);
    if (!comment) return;
    editingCommentId = commentId;
    replyingToCommentId = null;
    const textarea = root?.getElementById('cc-compose-textarea') as HTMLTextAreaElement | null;
    if (textarea) {
      textarea.value = comment.content;
      textarea.placeholder = 'Edit your comment…';
      textarea.focus();
    }
    const submitBtn = root?.getElementById('cc-compose-submit');
    if (submitBtn) setTextContent(submitBtn, 'Update');
    showCancel();
  }

  async function handleDelete(commentId: string): Promise<void> {
    if (!confirm('Delete this comment?')) return;
    try {
      // Backend returns the deleted comment object directly (check _id for success)
      const res = await commentsApi.deleteComment(commentId);
      if (res._id) {
        emitter.emit('comment:deleted', { commentId });
        void loadComments();
      }
    } catch { /* ignore */ }
  }

  async function handleSubmit(): Promise<void> {
    const textarea = root?.getElementById('cc-compose-textarea') as HTMLTextAreaElement | null;
    if (!textarea) return;
    const content = textarea.value.trim();
    if (!content) return;

    if (!tokenStorage.has()) { void doLogin(); return; }
    if (!currentThreadId) return;

    const submitBtn = root?.getElementById('cc-compose-submit') as HTMLButtonElement | null;
    if (submitBtn) { submitBtn.disabled = true; setTextContent(submitBtn, 'Posting…'); }

    try {
      // Both editComment and postComment return the comment object directly
      let res;
      if (editingCommentId) {
        res = await commentsApi.editComment(editingCommentId, content);
      } else {
        res = await commentsApi.postComment({
          threadId: currentThreadId,
          content,
          parentCommentId: replyingToCommentId ?? viewingSubthreadFor,
        });
        emitter.emit('comment:posted', { comment: res });
      }

      if (res._id) {
        textarea.value = '';
        editingCommentId = null;
        replyingToCommentId = null;
        textarea.placeholder = viewingSubthreadFor ? 'Write a reply…' : 'Write a comment…';
        hideCancel();
        if (submitBtn) setTextContent(submitBtn, 'Post');
        void loadComments();
      }
    } catch { /* handled by loadComments */ } finally {
      if (submitBtn) { submitBtn.disabled = false; }
    }
  }

  function showCancel(): void {
    const cancelBtn = root?.getElementById('cc-compose-cancel');
    cancelBtn?.classList.add('cc-visible');
  }

  function hideCancel(): void {
    const cancelBtn = root?.getElementById('cc-compose-cancel');
    cancelBtn?.classList.remove('cc-visible');
  }

  function cancelEdit(): void {
    editingCommentId = null;
    replyingToCommentId = null;
    const textarea = root?.getElementById('cc-compose-textarea') as HTMLTextAreaElement | null;
    if (textarea) { textarea.value = ''; textarea.placeholder = 'Write a comment…'; }
    const submitBtn = root?.getElementById('cc-compose-submit');
    if (submitBtn) setTextContent(submitBtn, 'Post');
    hideCancel();
  }

  function updateLoginOverlay(): void {
    const r = ensureRoot();
    const existing = r.getElementById('cc-login-overlay');
    if (tokenStorage.has() && existing) {
      existing.remove();
    } else if (!tokenStorage.has() && !existing) {
      const compose = r.getElementById('cc-compose');
      compose?.appendChild(buildLoginOverlay());
    }
  }

  // ── Open / Close ──────────────────────────────────────────────────────────

  function openPanel(): void {
    const r = ensureRoot();

    refreshUser();

    // Build panel if not already present
    let backdropEl = r.getElementById('cc-panel-backdrop');
    if (!backdropEl) {
      const newBackdrop = el('div');
      newBackdrop.className = 'cc-panel-backdrop';
      newBackdrop.id = 'cc-panel-backdrop';
      newBackdrop.addEventListener('click', closePanel);
      r.appendChild(newBackdrop);
      r.appendChild(buildPanel());
      backdropEl = newBackdrop;
    }

    // Capture in a const so the rAF callback has a non-nullable reference
    const backdrop = backdropEl;

    // Animate open
    requestAnimationFrame(() => {
      backdrop.classList.add('cc-visible');
      r.getElementById('cc-comments-panel')?.classList.add('cc-open');
    });

    updateLoginOverlay();
    void loadComments();
  }

  function closePanel(): void {
    const r = root;
    if (!r) return;

    const backdrop = r.getElementById('cc-panel-backdrop');
    const panel = r.getElementById('cc-comments-panel');

    backdrop?.classList.remove('cc-visible');
    panel?.classList.remove('cc-open');

    setTimeout(() => {
      backdrop?.remove();
      panel?.remove();
      onClose();
    }, 280);
  }

  function destroy(): void {
    removeShadowHost(PANEL_HOST_ID);
    root = null;
  }

  return { openPanel, closePanel, destroy };
}
