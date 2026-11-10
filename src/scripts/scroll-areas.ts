// A table wider than the page scrolls sideways in its box (.table-scroll), and so does the homepage's
// price tape while it's paused ([data-scroll-area="<name>"]). While a box can scroll, it joins the Tab
// order with a name, so a keyboard can scroll it too (Chrome and Firefox allow that by themselves,
// Safari doesn't) and a screen reader says what it is. A box that fits stays out of the Tab order.

const boxes = [...document.querySelectorAll<HTMLElement>(".table-scroll, [data-scroll-area]")];

/** The box's own name, or its table's caption, or else the nearest heading above it. */
function nameOf(box: HTMLElement) {
  if (box.dataset.scrollArea) return box.dataset.scrollArea;
  const caption = box.querySelector("caption")?.textContent?.trim();
  if (caption) return caption;
  const above = [...document.querySelectorAll("h1, h2, h3, h4")].filter((h) => h.compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING);
  const heading = above.at(-1)?.textContent?.trim();
  return heading ? `${heading}, table` : "Table";
}

function check(box: HTMLElement) {
  const scrolls = /auto|scroll/.test(getComputedStyle(box).overflowX) && box.scrollWidth > box.clientWidth + 1;
  if (scrolls === box.hasAttribute("tabindex")) return;
  if (scrolls) {
    box.tabIndex = 0;
    box.setAttribute("role", "region");
    box.setAttribute("aria-label", nameOf(box));
  } else {
    box.removeAttribute("tabindex");
    box.removeAttribute("role");
    box.removeAttribute("aria-label");
  }
}

if (boxes.length) {
  // The box resizes with the page, and what's in it can change width too (a lab redraws its table).
  const watch = new ResizeObserver((entries) => {
    for (const e of entries) {
      const box = (e.target as HTMLElement).closest<HTMLElement>(".table-scroll, [data-scroll-area]");
      if (box) check(box);
    }
  });
  for (const box of boxes) {
    watch.observe(box);
    if (box.firstElementChild) watch.observe(box.firstElementChild);
  }
  // Pausing the homepage's motion turns the tape into a box that scrolls.
  document.addEventListener("zth:motion", () => boxes.forEach(check));
}
