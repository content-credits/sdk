import { createCommentWidget } from './widget.js';
import { createCommentPanel } from './panel.js';
import type { createCommentsApi } from '../api/comments.js';
import type { EventEmitter } from '../core/events.js';
import type { ResolvedConfig } from '../types/index.js';

export function createComments(
  config: ResolvedConfig,
  commentsApi: ReturnType<typeof createCommentsApi>,
  emitter: EventEmitter
) {
  const panel = createCommentPanel(config, commentsApi, emitter, () => widget.show());
  const widget = createCommentWidget(config.theme.primaryColor, () => {
    widget.hide();
    panel.openPanel();
  });

  function init(): void {
    widget.mount();
  }

  function open(): void {
    widget.hide();
    panel.openPanel();
  }

  function close(): void {
    panel.closePanel();
  }

  function destroy(): void {
    panel.destroy();
    widget.destroy();
  }

  return { init, open, close, destroy };
}
