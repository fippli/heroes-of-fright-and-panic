import { Hexagon } from "./core/Hexagon";
import {
  type Bounds,
  clampTranslation,
  edgeScrollDelta,
  formatViewParam,
  parseViewParam,
  translationCenteredOn,
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

export class Canvas {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  translation: Coordinate;
  readonly DOMElement: HTMLDivElement;

  // Mouse position in screen (canvas) space, null when the mouse is not over the canvas
  private screenMouse: Coordinate | null = null;
  // World-space extent of the map; when set, panning is clamped to it
  private contentBounds: Bounds | null = null;
  // Pending debounced write of the view center to the URL
  private viewUrlTimer: number | null = null;

  constructor(canvasElement: HTMLCanvasElement, wrapperElement: HTMLDivElement) {
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext("2d") as CanvasRenderingContext2D;
    this.translation = { x: 0, y: 0 };

    this.DOMElement = wrapperElement;

    this.canvas.width = this.DOMElement.clientWidth;
    this.canvas.height = this.DOMElement.clientHeight;

    this.canvas.addEventListener("mousemove", (event) => {
      const rect = this.canvas.getBoundingClientRect();
      this.screenMouse = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
    });

    this.canvas.addEventListener("mouseleave", () => {
      this.screenMouse = null;
    });

    this.canvas.tabIndex = 0; // make focusable
    this.canvas.focus();

    this.canvas.addEventListener("keydown", (event) => {
      const speed = Hexagon.width * 2;

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

  /**
   * Mouse position in world (map) space, derived from the current translation
   * so it stays correct while the view scrolls under a stationary mouse.
   */
  get mousePosition(): Coordinate {
    if (this.screenMouse === null) {
      return { x: Infinity, y: Infinity };
    }
    return {
      x: this.screenMouse.x - this.translation.x,
      y: this.screenMouse.y - this.translation.y,
    };
  }

  /** World-space point currently in the middle of the canvas */
  get viewCenter(): Coordinate {
    return {
      x: this.width / 2 - this.translation.x,
      y: this.height / 2 - this.translation.y,
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
        : clampTranslation(wanted, this.contentBounds, this, Hexagon.width);
    this.scheduleViewUrlWrite();
  }

  /** Scroll the view so the given world point is in the middle of the canvas */
  centerOn(point: Coordinate) {
    const { x, y } = translationCenteredOn(point, this);
    this.translate(x, y);
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

  /** Scroll the view when the mouse is near an edge. Call once per frame. */
  private edgeScroll() {
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
    this.ctx.translate(this.translation.x, this.translation.y);
  }

  reset() {
    this.ctx.resetTransform();
  }

  click(fn: ({ x, y }: { x: number; y: number }) => void) {
    const handler = (_event: MouseEvent) => {
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
