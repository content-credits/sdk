import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createCommentPanel } from '../src/comments/panel';
import { createEventEmitter } from '../src/core/events';
import type { Comment, CommentThread, CommentsResponse } from '../src/types/index';

// ── Auth / storage mocks ──────────────────────────────────────────────────
// The panel checks tokenStorage.has()/get() and decodes the user id from the
// token to determine ownership (isOwn → Edit/Delete controls). We stub these
// so 'user_1' is always the "current" logged-in user.
vi.mock('../src/auth/storage.js', () => ({
  tokenStorage: {
    has: vi.fn(() => true),
    get: vi.fn(() => 'fake.token.value'),
  },
}));

vi.mock('../src/auth/token.js', () => ({
  getUserIdFromToken: vi.fn(() => 'user_1'),
}));

vi.mock('../src/auth/oauth.js', () => ({
  login: vi.fn(async () => true),
}));

vi.mock('../src/auth/popup.js', () => ({
  isMobileDevice: vi.fn(() => false),
}));

const config = {
  articleUrl: 'https://example.com/post',
  hostName: 'example.com',
  apiBaseUrl: 'https://api.contentcredits.com',
  theme: { primaryColor: '#44C678', fontFamily: 'sans-serif' },
} as any;

function makeOwnComment(overrides: Partial<Comment> = {}): Comment {
  return {
    _id: 'c1',
    threadId: 't1',
    postId: null,
    parentCommentId: null,
    authorId: 'user_1', // matches the mocked current user → isOwn
    content: 'Hello world',
    isActive: true,
    mentions: [],
    likeCount: 3,
    hasLiked: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    author: { _id: 'user_1', firstName: 'Ann', lastName: 'Lee' },
    replies: [
      {
        _id: 'c2',
        threadId: 't1',
        postId: null,
        parentCommentId: 'c1',
        authorId: 'user_2',
        content: 'A reply',
        isActive: true,
        mentions: [],
        likeCount: 0,
        hasLiked: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    ...overrides,
  };
}

function makeCommentsApi(comments: Comment[]) {
  return {
    ensureThread: vi.fn(async (): Promise<CommentThread> => ({
      _id: 't1',
      pageUrl: config.articleUrl,
      hostname: config.hostName,
      isOpen: true,
    })),
    getComments: vi.fn(async (): Promise<CommentsResponse> => ({
      thread: { _id: 't1', pageUrl: config.articleUrl, hostname: config.hostName, isOpen: true },
      comments,
    })),
    postComment: vi.fn(),
    editComment: vi.fn(),
    deleteComment: vi.fn(async (id: string): Promise<Comment> => ({ _id: id } as Comment)),
    toggleLike: vi.fn(async (id: string) => ({
      success: true,
      data: { _id: id, likeCount: 1, hasLiked: true },
    })),
  };
}

function flushPromises(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

describe('comment panel — accessibility + in-panel delete confirm', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
    // jsdom does not implement requestAnimationFrame; openPanel() uses it
    // purely for a CSS transition trigger, so run the callback synchronously.
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback): number => {
      cb(0);
      return 0;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sets aria-labels on the Reply and Like buttons reflecting current counts', async () => {
    const comment = makeOwnComment();
    const commentsApi = makeCommentsApi([comment, comment.replies![0]]);
    const emitter = createEventEmitter();
    const panel = createCommentPanel(config, commentsApi as any, emitter, vi.fn());

    panel.openPanel();
    await flushPromises();

    const root = document.getElementById('cc-comments-host')!.shadowRoot!;
    const replyBtn = root.querySelector<HTMLButtonElement>('[data-action="reply"]')!;
    const likeBtn = root.querySelector<HTMLButtonElement>('[data-action="like"]')!;

    // Visible content unchanged: bare icon + number.
    expect(replyBtn.textContent?.trim()).toBe('1');
    expect(likeBtn.textContent?.trim()).toBe('3');

    // Accessible names added per the audit's literal format.
    expect(replyBtn.getAttribute('aria-label')).toBe('1 replies');
    expect(likeBtn.getAttribute('aria-label')).toBe('Like — 3 likes');

    panel.destroy();
  });

  it('updates the aria-labels on re-render when counts change', async () => {
    const comment = makeOwnComment({ likeCount: 0, hasLiked: false });
    const commentsApi = makeCommentsApi([comment]);
    const emitter = createEventEmitter();
    const panel = createCommentPanel(config, commentsApi as any, emitter, vi.fn());

    panel.openPanel();
    await flushPromises();

    const root = document.getElementById('cc-comments-host')!.shadowRoot!;
    let likeBtn = root.querySelector<HTMLButtonElement>('[data-action="like"]')!;
    expect(likeBtn.getAttribute('aria-label')).toBe('Like — 0 likes');

    likeBtn.click();
    await flushPromises();

    likeBtn = root.querySelector<HTMLButtonElement>('[data-action="like"]')!;
    expect(likeBtn.getAttribute('aria-label')).toBe('Like — 1 likes');

    panel.destroy();
  });

  it('shows an in-panel delete confirmation without calling window.confirm', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    const comment = makeOwnComment();
    const commentsApi = makeCommentsApi([comment]);
    const emitter = createEventEmitter();
    const panel = createCommentPanel(config, commentsApi as any, emitter, vi.fn());

    panel.openPanel();
    await flushPromises();

    const root = document.getElementById('cc-comments-host')!.shadowRoot!;
    const deleteBtn = root.querySelector<HTMLButtonElement>('[data-action="delete"]')!;
    expect(deleteBtn).not.toBeNull();
    deleteBtn.click();

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(root.textContent).toContain('Delete this comment?');
    expect(root.querySelector('[data-action="delete-confirm"]')).not.toBeNull();
    expect(root.querySelector('[data-action="delete-cancel"]')).not.toBeNull();
    // The original Edit/Delete row is swapped out while confirming.
    expect(root.querySelector('[data-action="delete"]')).toBeNull();
    expect(commentsApi.deleteComment).not.toHaveBeenCalled();

    panel.destroy();
  });

  it('cancel restores the normal action row and does not delete', async () => {
    const comment = makeOwnComment();
    const commentsApi = makeCommentsApi([comment]);
    const emitter = createEventEmitter();
    const panel = createCommentPanel(config, commentsApi as any, emitter, vi.fn());

    panel.openPanel();
    await flushPromises();

    const root = document.getElementById('cc-comments-host')!.shadowRoot!;
    root.querySelector<HTMLButtonElement>('[data-action="delete"]')!.click();
    expect(root.querySelector('[data-action="delete-confirm"]')).not.toBeNull();

    root.querySelector<HTMLButtonElement>('[data-action="delete-cancel"]')!.click();

    expect(root.querySelector('[data-action="delete-confirm"]')).toBeNull();
    expect(root.querySelector('[data-action="delete-cancel"]')).toBeNull();
    expect(root.querySelector('[data-action="delete"]')).not.toBeNull();
    expect(commentsApi.deleteComment).not.toHaveBeenCalled();

    panel.destroy();
  });

  it('confirming delete calls the delete API and emits comment:deleted, without window.confirm', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    const comment = makeOwnComment();
    const commentsApi = makeCommentsApi([comment]);
    const emitter = createEventEmitter();
    const emitSpy = vi.spyOn(emitter, 'emit');
    const panel = createCommentPanel(config, commentsApi as any, emitter, vi.fn());

    panel.openPanel();
    await flushPromises();

    const root = document.getElementById('cc-comments-host')!.shadowRoot!;
    root.querySelector<HTMLButtonElement>('[data-action="delete"]')!.click();
    root.querySelector<HTMLButtonElement>('[data-action="delete-confirm"]')!.click();
    await flushPromises();

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(commentsApi.deleteComment).toHaveBeenCalledWith('c1');
    expect(emitSpy).toHaveBeenCalledWith('comment:deleted', { commentId: 'c1' });

    panel.destroy();
  });
});
