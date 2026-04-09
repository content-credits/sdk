import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createComments } from '../src/comments/index';
import { createEventEmitter } from '../src/core/events';

const widgetApi = {
  mount: vi.fn(),
  setCount: vi.fn(),
  show: vi.fn(),
  hide: vi.fn(),
  destroy: vi.fn(),
};

const panelApi = {
  openPanel: vi.fn(),
  closePanel: vi.fn(),
  destroy: vi.fn(),
};

vi.mock('../src/comments/widget.js', () => ({
  createCommentWidget: vi.fn(() => widgetApi),
}));

vi.mock('../src/comments/panel.js', () => ({
  createCommentPanel: vi.fn(() => panelApi),
}));

describe('comments module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('coordinates widget and panel lifecycle methods', () => {
    const comments = createComments({
      theme: {
        primaryColor: '#44C678',
        fontFamily: 'sans-serif',
      },
    } as any, {} as any, createEventEmitter());

    comments.init();
    expect(widgetApi.mount).toHaveBeenCalledTimes(1);

    comments.open();
    expect(widgetApi.hide).toHaveBeenCalledTimes(1);
    expect(panelApi.openPanel).toHaveBeenCalledTimes(1);

    comments.close();
    expect(panelApi.closePanel).toHaveBeenCalledTimes(1);

    comments.destroy();
    expect(panelApi.destroy).toHaveBeenCalledTimes(1);
    expect(widgetApi.destroy).toHaveBeenCalledTimes(1);
  });
});
