// A lab's control bar stays under the header while the page scrolls (lab.css). Its height is added to the
// space the page keeps clear at the top (--sticky-h in global.css), so a control reached with Tab, or a
// link's target, doesn't end up hidden under the bar. On phones the bar doesn't stick, and adds nothing.

const bar = document.querySelector<HTMLElement>(".panel.controls");
if (bar) {
  const root = document.documentElement;
  new ResizeObserver(() => {
    const sticky = getComputedStyle(bar).position === "sticky";
    // 11px: the gap between the header and the bar (lab.css).
    root.style.setProperty("--sticky-h", sticky ? `${Math.ceil(bar.getBoundingClientRect().height) + 11}px` : "0px");
  }).observe(bar);
}
