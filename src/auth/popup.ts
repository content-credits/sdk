const POPUP_NAME = 'ccAuthPopup';
const POPUP_SPECS = 'scrollbars=no,resizable=no,status=no,location=no,toolbar=no,menubar=no,width=600,height=650';

function centeredSpecs(): string {
  const width = 600;
  const height = 650;
  const left = Math.round(window.screenX + (window.outerWidth - width) / 2);
  const top = Math.round(window.screenY + (window.outerHeight - height) / 2);
  return `${POPUP_SPECS},left=${left},top=${top}`;
}

export function isMobileDevice(): boolean {
  // Use the user-agent to detect genuine mobile/tablet devices where popups
  // are either blocked by the OS or produce a terrible UX (full-screen tab).
  // We intentionally do NOT gate on window.innerWidth — a desktop user with
  // a narrow window or DevTools open still deserves a popup, not a redirect
  // that navigates them away from the article they were reading.
  const ua = navigator.userAgent;
  if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
    return true;
  }

  // Touch-capable desktop Chrome devices can report a coarse pointer even when
  // the primary experience is still desktop. Treat coarse pointer as mobile
  // only when it also looks like a small-screen device.
  if (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches &&
    window.matchMedia('(max-width: 768px)').matches
  ) {
    return true;
  }
  return false;
}

/** Open a centered popup window. Returns null if it was blocked. */
export function openCenteredPopup(url: string): Window | null {
  let popup: Window | null = null;
  try {
    popup = window.open(url, POPUP_NAME, centeredSpecs());
  } catch {
    return null;
  }
  if (!popup || popup.closed) return null;
  return popup;
}
