import { Hexagon } from "./core/Hexagon";
import {
  type Bounds,
  clampTranslation,
  edgeScrollDelta,
  formatViewParam,
  parseViewParam,
  translationCenteredOn,
  zoomTranslation,
} from "./core/viewport";
import type { Coordinate } from "./types/coordinate";

/** Distance from the canvas edge (px) within which the view starts scrolling */
const EDGE_SCROLL_MARGIN = 48;
/** Max scroll speed in px per frame when the mouse is right at the edge */
const EDGE_SCROLL_MAX_SPEED = 24;
/** URL query param holding the view center so a refresh keeps the camera */
const VIEW_PARAM = "view";
/** How long the view must be still before it is written to the URL */
const VIEW_URL_DEBOUNCE_MS = 250;
/** Integer zoom steps keep pixel art crisp */
const ZOOM_STEPS = [1, 2, 3] as const;
/** Pointer travel before a press turns into a drag instead of a click */
const DRAG_THRESHOLD_PX = 6;

type Pointer = { readonly id: number; x: number; y: number };

export class Canvas {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  translation: Coordinate;
  scale: number = 1;
  readonly DOMElement: HTMLDivElement;

  // Mouse position in screen (canvas) space, null when the mouse is not over the canvas
  private screenMouse: Coordinate | null = null;
  // World-space extent of the map; when set, panning is clamped to it
  private contentBounds: Bounds | null = null;
  // Pending debounced write of the view center to the URL
  private viewUrlTimer: number | null = null;

  // Active pointers (mouse button held or touches), for drag and pinch
  private readonly pointers = new Map<number, Pointer>();
  private dragging = false;
  private pressStart: Coordinate | null = null;
  private pinchStartDistance: number | null = null;
  private pinchStartScale = 1;
  private suppressNextClick = false;

  constructor(canvasElement: HTMLCanvasElement, wrapperElement: HTMLDivElement) {
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext("2d") as CanvasRenderingContext2D;
    this.translation = { x: 0, y: 0 };

    this.DOMElement = wrapperElement;

    this.canvas.width = this.DOMElement.clientWidth;
    this.canvas.height = this.DOMElement.clientHeight;
    // Pointer events handle panning/pinch; the browser must not scroll or zoom the page
    this.canvas.style.touchAction = "none";

    this.canvas.addEventListener("pointermove", (event) => this.onPointerMove(event));
    this.canvas.addEventListener("pointerdown", (event) => this.onPointerDown(event));
    this.canvas.addEventListener("pointerup", (event) => this.onPointerUp(event));
    this.canvas.addEventListener("pointercancel", (event) => this.onPointerUp(event));
    this.canvas.addEventListener("pointerleave", (event) => {
      if (event.pointerType === "mouse") this.screenMouse = null;
    });
    this.canvas.addEventListener("wheel", (event) => this.onWheel(event), { passive: false });

    this.canvas.tabIndex = 0; // make focusable
    this.canvas.focus();

    this.canvas.addEventListener("keydown", (event) => {
      const speed = Hexagon.width * 2 * this.scale;

      switch (event.key) {
        case "ArrowLeft": {
          return this.translate(this.translation.x + speed, this.translation.y);
        }
        case "ArrowRight": {
          return this.translate(this.translation.x - speed, this.translation.y);
        }
        case "ArrowUp": {
          return this.translate(this.translation.x, this.translation.y + speed);
        }
        case "ArrowDown": {
          return this.translate(this.translation.x, this.translation.y - speed);
        }
        case "+":
        case "=": {
          return this.zoomStep(1);
        }
        case "-": {
          return this.zoomStep(-1);
        }
        default: {
          return;
        }
      }
    });
  }

  get width(): number {
    return this.canvas.width;
  }

  get height(): number {
    return this.canvas.height;
  }

  private screenPoint(event: PointerEvent | WheelEvent): Coordinate {
    const rect = this.canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  /**
   * Mouse position in world (map) space, derived from the current translation
   * and zoom so it stays correct while the view scrolls under a stationary mouse.
   */
  get mousePosition(): Coordinate {
    if (this.screenMouse === null) {
      return { x: Infinity, y: Infinity };
    }
    return {
      x: (this.screenMouse.x - this.translation.x) / this.scale,
      y: (this.screenMouse.y - this.translation.y) / this.scale,
    };
  }

  /** World-space point currently in the middle of the canvas */
  get viewCenter(): Coordinate {
    return {
      x: (this.width / 2 - this.translation.x) / this.scale,
      y: (this.height / 2 - this.translation.y) / this.scale,
    };
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /** Set the world-space extent of the map so panning can be clamped to it */
  setContentBounds(bounds: Bounds) {
    this.contentBounds = bounds;
    this.translate(this.translation.x, this.translation.y);
  }

  translate(x: number, y: number) {
    const wanted = { x, y };
    this.translation =
      this.contentBounds === null
        ? wanted
        : clampTranslation(wanted, this.contentBounds, this, Hexagon.width * this.scale, this.scale);
    this.scheduleViewUrlWrite();
  }

  /** Scroll the view so the given world point is in the middle of the canvas */
  centerOn(point: Coordinate) {
    const { x, y } = translationCenteredOn(point, this, this.scale);
    this.translate(x, y);
  }

  /** Change zoom to an integer step, keeping the world under `anchor` (screen px) still */
  setZoom(scale: number, anchor: Coordinate = { x: this.width / 2, y: this.height / 2 }) {
    const next = ZOOM_STEPS.includes(scale as (typeof ZOOM_STEPS)[number]) ? scale : this.scale;
    if (next === this.scale) return;
    const translation = zoomTranslation(this.translation, this.scale, next, anchor);
    this.scale = next;
    this.translate(translation.x, translation.y);
  }

  zoomStep(direction: 1 | -1, anchor?: Coordinate) {
    const index = ZOOM_STEPS.indexOf(this.scale as (typeof ZOOM_STEPS)[number]);
    const next = ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, Math.max(0, index + direction))];
    this.setZoom(next, anchor);
  }

  /**
   * Restore the view center from the URL (written by earlier scrolling).
   * Returns false when the URL carries no usable view, so callers can fall
   * back to a default focus.
   */
  restoreViewFromUrl(): boolean {
    const center = parseViewParam(
      new URL(window.location.href).searchParams.get(VIEW_PARAM),
    );
    if (center === null) {
      return false;
    }
    this.centerOn(center);
    return true;
  }

  /**
   * Debounced so continuous edge-scrolling doesn't hammer history.replaceState
   * (Safari throttles it); the URL is updated once the view comes to rest.
   */
  private scheduleViewUrlWrite() {
    if (this.viewUrlTimer !== null) {
      window.clearTimeout(this.viewUrlTimer);
    }
    this.viewUrlTimer = window.setTimeout(() => {
      this.viewUrlTimer = null;
      this.writeViewToUrl();
    }, VIEW_URL_DEBOUNCE_MS);
  }

  private writeViewToUrl() {
    const url = new URL(window.location.href);
    url.searchParams.set(VIEW_PARAM, formatViewParam(this.viewCenter));
    // Keep history.state so react-router's own bookkeeping survives
    window.history.replaceState(window.history.state, "", url);
  }

  // ---- pointer handling: hover, drag-to-pan, pinch-to-zoom ----

  private onPointerDown(event: PointerEvent) {
    const point = this.screenPoint(event);
    this.pointers.set(event.pointerId, { id: event.pointerId, ...point });
    this.canvas.setPointerCapture(event.pointerId);
    this.screenMouse = point;
    if (this.pointers.size === 1) {
      this.pressStart = point;
      this.dragging = false;
    } else if (this.pointers.size === 2) {
      this.pinchStartDistance = this.pointerDistance();
      this.pinchStartScale = this.scale;
      this.dragging = true;
    }
  }

  private onPointerMove(event: PointerEvent) {
    const point = this.screenPoint(event);
    const pointer = this.pointers.get(event.pointerId);
    if (event.pointerType === "mouse" || pointer !== undefined) {
      this.screenMouse = point;
    }
    if (pointer === undefined) return;

    if (this.pointers.size === 2 && this.pinchStartDistance !== null) {
      pointer.x = point.x;
      pointer.y = point.y;
      const ratio = this.pointerDistance() / this.pinchStartDistance;
      const wanted = Math.round(this.pinchStartScale * ratio);
      this.setZoom(Math.min(3, Math.max(1, wanted)), this.pointerMidpoint());
      return;
    }

    const dx = point.x - pointer.x;
    const dy = point.y - pointer.y;
    pointer.x = point.x;
    pointer.y = point.y;

    if (!this.dragging && this.pressStart !== null) {
      const travelled = Math.hypot(point.x - this.pressStart.x, point.y - this.pressStart.y);
      if (travelled < DRAG_THRESHOLD_PX) return;
      this.dragging = true;
    }
    if (this.dragging) {
      this.translate(this.translation.x + dx, this.translation.y + dy);
    }
  }

  private onPointerUp(event: PointerEvent) {
    this.pointers.delete(event.pointerId);
    if (this.dragging) {
      // The browser will fire a click for this press; it was a drag, not a tap
      this.suppressNextClick = true;
    }
    if (this.pointers.size < 2) this.pinchStartDistance = null;
    if (this.pointers.size === 0) {
      this.dragging = false;
      this.pressStart = null;
      if (event.pointerType !== "mouse") this.screenMouse = this.screenPoint(event);
    }
  }

  private onWheel(event: WheelEvent) {
    event.preventDefault();
    this.zoomStep(event.deltaY < 0 ? 1 : -1, this.screenPoint(event));
  }

  private pointerDistance(): number {
    const [a, b] = [...this.pointers.values()];
    return a !== undefined && b !== undefined ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  private pointerMidpoint(): Coordinate {
    const [a, b] = [...this.pointers.values()];
    return a !== undefined && b !== undefined ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : { x: this.width / 2, y: this.height / 2 };
  }

  /** Scroll the view when the mouse is near an edge. Call once per frame. */
  private edgeScroll() {
    if (this.dragging || this.pointers.size > 0) return;
    const delta = edgeScrollDelta(
      this.screenMouse,
      this,
      EDGE_SCROLL_MARGIN,
      EDGE_SCROLL_MAX_SPEED,
    );
    if (delta.x !== 0 || delta.y !== 0) {
      this.translate(this.translation.x + delta.x, this.translation.y + delta.y);
    }
  }

  init() {
    this.edgeScroll();
    this.clear();
    this.ctx.setTransform(this.scale, 0, 0, this.scale, this.translation.x, this.translation.y);
  }

  reset() {
    this.ctx.resetTransform();
  }

  click(fn: ({ x, y }: { x: number; y: number }) => void) {
    const handler = (_event: MouseEvent) => {
      if (this.suppressNextClick) {
        this.suppressNextClick = false;
        return;
      }
      fn(this.mousePosition);
    };

    this.canvas.addEventListener("click", handler);
  }

  keydown(keymap: { [key: string]: (position: Coordinate) => void }) {
    const handler = (event: KeyboardEvent) => {
      const name = event.key.toLowerCase();
      const fn = keymap[event.shiftKey ? `shift+${name}` : name] ?? keymap[name];
      if (fn !== undefined && name === " ") event.preventDefault();
      fn?.(this.mousePosition);
    };

    this.canvas.addEventListener("keydown", handler);
  }
}
