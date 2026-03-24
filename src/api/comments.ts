import type { ApiClient } from './client.js';
import type {
  CommentsResponse,
  CommentThread,
  Comment,
  CommentSortBy,
} from '../types/index.js';

export function createCommentsApi(client: ApiClient) {
  return {
    // Backend returns the thread object directly (no success wrapper)
    ensureThread(params: { pageUrl: string; hostname: string }): Promise<CommentThread> {
      return client.post<CommentThread>('/comments/threads/ensure', {
        pageUrl: params.pageUrl,
        hostname: params.hostname,
      });
    },

    // Backend returns { thread, comments } — no success wrapper
    getComments(params: { pageUrl: string; sortBy: CommentSortBy }): Promise<CommentsResponse> {
      const encoded = encodeURIComponent(params.pageUrl);
      return client.get<CommentsResponse>(
        `/comments/comments/by-url?url=${encoded}&sortBy=${params.sortBy}`
      );
    },

    // Backend returns the created comment object directly
    postComment(params: {
      threadId: string;
      content: string;
      parentCommentId?: string | null;
    }): Promise<Comment> {
      return client.post<Comment>('/comments/comments', {
        threadId: params.threadId,
        content: params.content,
        ...(params.parentCommentId ? { parentCommentId: params.parentCommentId } : {}),
      });
    },

    // Backend returns the updated comment object directly
    editComment(commentId: string, content: string): Promise<Comment> {
      return client.put<Comment>(`/comments/comments/${commentId}`, { content });
    },

    // Backend returns the deleted comment object directly
    deleteComment(commentId: string): Promise<Comment> {
      return client.delete<Comment>(`/comments/comments/${commentId}`);
    },

    // Backend returns { success: true, data: { _id, likeCount, hasLiked } }
    toggleLike(commentId: string): Promise<{ success: boolean; data: { _id: string; likeCount: number; hasLiked: boolean } }> {
      return client.post<{ success: boolean; data: { _id: string; likeCount: number; hasLiked: boolean } }>(
        `/comments/comments/${commentId}/toggle-like`,
        {}
      );
    },
  };
}
