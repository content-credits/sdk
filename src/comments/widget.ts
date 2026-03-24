const POSITION_KEY = 'cc-widget-pos';
const WIDGET_HEIGHT = 60;

export function createCommentWidget(
  primaryColor: string,
  onOpen: () => void
): { mount(): void; setCount(n: number): void; show(): void; hide(): void; destroy(): void } {
  let widget: HTMLElement | null = null;
  let badgeEl: HTMLElement | null = null;

  function mount(): void {
    if (document.getElementById('cc-comment-widget')) return;

    // Restore saved vertical position
    let topPercent = 50;
    try {
      const saved = localStorage.getItem(POSITION_KEY);
      if (saved) topPercent = JSON.parse(saved) as number;
    } catch { /* ignore */ }

    widget = document.createElement('div');
    widget.id = 'cc-comment-widget';
    // Inline styles so no external stylesheet dependency and no shadow DOM needed
    // (widget is a minimal host-page element, panel uses shadow DOM)
    widget.style.cssText = `
      position:fixed;top:${topPercent}%;right:0;transform:translateY(-50%);
      height:${WIDGET_HEIGHT}px;background:${primaryColor};border-radius:10px 0 0 10px;
      display:flex;align-items:center;gap:8px;padding:0 8px 0 12px;
      z-index:2147483646;box-shadow:-2px 0 16px rgba(0,0,0,.12);
      cursor:pointer;user-select:none;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
      transition:filter .2s;
    `;
    widget.setAttribute('role', 'button');
    widget.setAttribute('aria-label', 'Open comments');
    widget.tabIndex = 0;

    // Chat icon
    const icon = document.createElement('div');
    icon.style.cssText = 'color:#fff;display:flex;align-items:center;flex-shrink:0;';
    icon.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;

    // Comment count badge
    badgeEl = document.createElement('span');
    badgeEl.style.cssText = `
      background:#fff;color:${primaryColor};border-radius:12px;
      padding:2px 7px;font-size:12px;font-weight:700;min-width:20px;
      text-align:center;display:none;
    `;

    // Drag handle
    const handle = document.createElement('div');
    handle.style.cssText = 'color:rgba(255,255,255,.65);cursor:grab;display:flex;align-items:center;padding:0 2px;flex-shrink:0;';
    handle.innerHTML = `<svg width="8" height="22" viewBox="0 0 8 22" fill="none"><circle cx="4" cy="4" r="2" fill="currentColor"/><circle cx="4" cy="11" r="2" fill="currentColor"/><circle cx="4" cy="18" r="2" fill="currentColor"/></svg>`;

    // Click to open panel
    icon.addEventListener('click', onOpen);
    badgeEl.addEventListener('click', onOpen);

    // Drag to reposition
    let dragging = false;
    let startY = 0;
    let startTop = 0;

    function beginDrag(y: number): void {
      dragging = true;
      startY = y;
      startTop = widget!.getBoundingClientRect().top;
      handle.style.cursor = 'grabbing';
    }

    function moveDrag(y: number): void {
      if (!dragging || !widget) return;
      const delta = y - startY;
      const newTop = Math.max(0, Math.min(window.innerHeight - WIDGET_HEIGHT, startTop + delta));
      const pct = (newTop / window.innerHeight) * 100;
      widget.style.top = `${pct}%`;
    }

    function endDrag(): void {
      if (!dragging || !widget) return;
      dragging = false;
      handle.style.cursor = 'grab';
      const rect = widget.getBoundingClientRect();
      const pct = (rect.top / window.innerHeight) * 100;
      try { localStorage.setItem(POSITION_KEY, JSON.stringify(pct)); } catch { /* ignore */ }
    }

    handle.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); beginDrag(e.clientY); });
    handle.addEventListener('touchstart', e => { e.preventDefault(); beginDrag(e.touches[0].clientY); }, { passive: false });
    document.addEventListener('mousemove', e => moveDrag(e.clientY));
    document.addEventListener('touchmove', e => moveDrag(e.touches[0].clientY), { passive: true });
    document.addEventListener('mouseup', endDrag);
    document.addEventListener('touchend', endDrag);

    widget.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') onOpen(); });

    widget.appendChild(icon);
    widget.appendChild(badgeEl);
    widget.appendChild(handle);
    document.body.appendChild(widget);
  }

  function setCount(n: number): void {
    if (!badgeEl) return;
    if (n > 0) {
      badgeEl.textContent = n > 99 ? '99+' : String(n);
      badgeEl.style.display = 'inline-block';
    } else {
      badgeEl.style.display = 'none';
    }
  }

  function show(): void {
    if (widget) widget.style.display = 'flex';
  }

  function hide(): void {
    if (widget) widget.style.display = 'none';
  }

  function destroy(): void {
    widget?.remove();
    widget = null;
    badgeEl = null;
  }

  return { mount, setCount, show, hide, destroy };
}
