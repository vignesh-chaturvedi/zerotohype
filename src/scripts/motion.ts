// Whether the reader has paused the moving parts of the site: the homepage's live order book and
// price tape, and the dots that travel along the drawings. WCAG 2.2.2 asks for a way to pause anything
// that moves by itself for more than five seconds. The choice is kept in this browser only, under
// "zth:motion", and Base.astro applies it as <html data-motion="paused"> before the page paints.

const KEY = "zth:motion";
const EVENT = "zth:motion";
const root = document.documentElement;

export const isPaused = () => root.dataset.motion === "paused";

export function setPaused(on: boolean) {
  if (on) root.dataset.motion = "paused";
  else delete root.dataset.motion;
  try {
    if (on) localStorage.setItem(KEY, "paused");
    else localStorage.removeItem(KEY);
  } catch {
    // Storage can be blocked; the choice then lasts until the page is left.
  }
  document.dispatchEvent(new CustomEvent(EVENT));
}

/** Calls `fn` whenever the reader pauses or resumes. */
export const onMotionChange = (fn: () => void) => document.addEventListener(EVENT, fn);

/** Each [data-motion-toggle] button says what pressing it will do, and does it. They're hidden until
 *  this runs, since without JavaScript nothing moves and there's nothing to pause. */
export function wireMotionButtons() {
  for (const btn of document.querySelectorAll<HTMLButtonElement>("[data-motion-toggle]")) {
    const label = btn.querySelector("[data-motion-label]") ?? btn;
    const paint = () => {
      const words = isPaused() ? "Resume motion" : "Pause motion";
      label.textContent = words;
      btn.title = words; // where only the icon shows
      btn.dataset.state = isPaused() ? "paused" : "playing";
    };
    btn.addEventListener("click", () => setPaused(!isPaused()));
    onMotionChange(paint);
    paint();
    btn.hidden = false;
  }
}
