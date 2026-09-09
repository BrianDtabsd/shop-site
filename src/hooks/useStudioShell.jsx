import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

/**
 * Studio shell geometry.
 *
 * The Studio floats OVER the site rather than squeezing it, so the site always
 * renders at its true width — what you see while editing is what visitors get.
 *
 * The cost of floating is occlusion: a panel parked over the thing you are
 * adjusting hides the very change you are trying to judge. Three things address
 * that, and they are the point of this hook:
 *
 *   1. `panelPos` — drag the window anywhere by its header.
 *   2. `dockRight` / `dockLeft` — snap it clear of whichever side you're working on.
 *   3. `isAdjusting` — while a control is actively being dragged, the panel goes
 *      translucent so the site shows through it. See `.studio-panel.is-adjusting`.
 *
 * Below 900px the panel is a bottom sheet instead; `sheetHeight` drives that.
 */

const WIDTH_KEY = 'shopsite-studio-panel-width-v1';
const POS_KEY = 'shopsite-studio-panel-pos-v1';

const MIN_PANEL = 320;
const MAX_PANEL_RATIO = 0.72;
const EDGE_GAP = 16;
/** Keep at least this much of the header grabbable if dragged toward an edge. */
const KEEP_VISIBLE = 120;

const StudioShellContext = createContext(null);

function clampPanelWidth(width, viewport = window.innerWidth) {
  const max = Math.max(MIN_PANEL, Math.floor(viewport * MAX_PANEL_RATIO));
  const min = Math.min(MIN_PANEL, max);
  return Math.min(max, Math.max(min, Math.round(width)));
}

function readStored(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/** Keep the window on screen after a resize or a wild drag. */
function clampPos(pos, width, viewport) {
  if (!pos) return null;
  const vw = viewport?.w ?? window.innerWidth;
  const vh = viewport?.h ?? window.innerHeight;
  return {
    left: Math.min(vw - KEEP_VISIBLE, Math.max(KEEP_VISIBLE - width, Math.round(pos.left))),
    top: Math.min(vh - 60, Math.max(0, Math.round(pos.top))),
  };
}

export function StudioShellProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [panelWidth, setPanelWidth] = useState(() => {
    const stored = readStored(WIDTH_KEY, null);
    const n = Number(stored);
    return Number.isFinite(n) && n > 0 ? n : null;
  });
  /** null → docked to the right edge. Set once the user drags it. */
  const [panelPos, setPanelPos] = useState(() => readStored(POS_KEY, null));
  const [isDragging, setIsDragging] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [sheetHeight, setSheetHeight] = useState(72);

  const resolvedWidth = useMemo(() => {
    if (typeof window === 'undefined') return 420;
    return clampPanelWidth(panelWidth ?? Math.round(window.innerWidth * 0.34));
  }, [panelWidth]);

  useEffect(() => {
    try {
      localStorage.setItem(WIDTH_KEY, String(resolvedWidth));
    } catch {
      /* ignore */
    }
  }, [resolvedWidth]);

  useEffect(() => {
    try {
      if (panelPos) localStorage.setItem(POS_KEY, JSON.stringify(panelPos));
      else localStorage.removeItem(POS_KEY);
    } catch {
      /* ignore */
    }
  }, [panelPos]);

  // A floating window can end up off-screen when the viewport shrinks.
  useEffect(() => {
    if (!isOpen) return undefined;
    const onResize = () => {
      setPanelWidth((prev) => clampPanelWidth(prev ?? window.innerWidth * 0.34));
      setPanelPos((prev) => clampPos(prev, resolvedWidth));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [isOpen, resolvedWidth]);

  const openStudio = useCallback(() => setIsOpen(true), []);
  const closeStudio = useCallback(() => setIsOpen(false), []);
  const toggleStudio = useCallback(() => setIsOpen((v) => !v), []);

  const toggleSheet = useCallback(() => {
    setSheetHeight((height) => (height <= 100 ? Math.min(window.innerHeight * 0.82, 720) : 72));
  }, []);
  const resizeSheet = useCallback((height) => {
    setIsDragging(true);
    const max = Math.min(window.innerHeight * 0.82, 720);
    setSheetHeight(Math.min(max, Math.max(72, height)));
  }, []);
  const endSheetResize = useCallback(() => setIsDragging(false), []);

  // Refs so the drag handlers read live geometry without re-subscribing.
  const widthRef = useRef(resolvedWidth);
  const panelPosRef = useRef(panelPos);
  useEffect(() => {
    widthRef.current = resolvedWidth;
  }, [resolvedWidth]);
  useEffect(() => {
    panelPosRef.current = panelPos;
  }, [panelPos]);

  /** Resize from the window's left edge. */
  const beginResize = useCallback((clientX) => {
    setIsDragging(true);
    // Anchor to the window's right edge so the grip tracks the pointer whether
    // the panel is docked or floating.
    const startRight =
      panelPosRef.current === null
        ? window.innerWidth - EDGE_GAP
        : panelPosRef.current.left + widthRef.current;

    const apply = (x) => setPanelWidth(clampPanelWidth(startRight - x));

    const onMove = (e) => apply(e.clientX);
    const onUp = () => {
      setIsDragging(false);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    apply(clientX);
  }, []);

  /** Drag the whole window by its header. */
  const beginMove = useCallback((clientX, clientY, rect) => {
    setIsMoving(true);
    const grabX = clientX - rect.left;
    const grabY = clientY - rect.top;

    const onMove = (e) => {
      setPanelPos(
        clampPos({ left: e.clientX - grabX, top: e.clientY - grabY }, widthRef.current)
      );
    };
    const onUp = () => {
      setIsMoving(false);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, []);

  const dockRight = useCallback(() => setPanelPos(null), []);
  const dockLeft = useCallback(
    () => setPanelPos({ left: EDGE_GAP, top: EDGE_GAP }),
    []
  );
  const isDocked = panelPos === null;

  const value = useMemo(
    () => ({
      isOpen,
      panelWidth: resolvedWidth,
      panelPos,
      isDocked,
      isDragging,
      isMoving,
      isAdjusting,
      setAdjusting: setIsAdjusting,
      openStudio,
      closeStudio,
      toggleStudio,
      beginResize,
      beginMove,
      dockLeft,
      dockRight,
      toggleSheet,
      resizeSheet,
      endSheetResize,
      sheetHeight,
      isSheetExpanded: sheetHeight > 100,
      setPanelWidth: (w) => setPanelWidth(clampPanelWidth(w)),
    }),
    [
      isOpen,
      resolvedWidth,
      panelPos,
      isDocked,
      isDragging,
      isMoving,
      isAdjusting,
      openStudio,
      closeStudio,
      toggleStudio,
      beginResize,
      beginMove,
      dockLeft,
      dockRight,
      toggleSheet,
      resizeSheet,
      endSheetResize,
      sheetHeight,
    ]
  );

  return (
    <StudioShellContext.Provider value={value}>{children}</StudioShellContext.Provider>
  );
}

export function useStudioShell() {
  const ctx = useContext(StudioShellContext);
  if (!ctx) {
    throw new Error('useStudioShell must be used within StudioShellProvider');
  }
  return ctx;
}
