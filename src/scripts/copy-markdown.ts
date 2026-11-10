// "Copy as Markdown" on a track page: copies the track's Markdown version (/tracks/<id>.md) to paste into
// an assistant or notes. The button shows only where the browser can copy.

for (const btn of document.querySelectorAll<HTMLButtonElement>("[data-copy-md]")) {
  if (!navigator.clipboard) continue;
  const url = btn.dataset.copyMd!;
  const label = btn.textContent;
  let text: Promise<string> | null = null;
  // Fetched as the pointer or focus arrives, so the click can usually copy straight away.
  const load = () =>
    (text ??= fetch(url).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.text();
    }));
  let reset = 0;
  const say = (words: string) => {
    btn.textContent = words;
    clearTimeout(reset);
    reset = window.setTimeout(() => (btn.textContent = label), 1800);
  };
  btn.addEventListener("pointerenter", load, { once: true });
  btn.addEventListener("focus", load, { once: true });
  btn.addEventListener("click", async () => {
    try {
      // Safari only lets a page copy during the click itself, so the text is handed over as a promise.
      if (typeof ClipboardItem === "function") {
        await navigator.clipboard.write([new ClipboardItem({ "text/plain": load().then((t) => new Blob([t], { type: "text/plain" })) })]);
      } else {
        await navigator.clipboard.writeText(await load());
      }
      say("Copied");
    } catch {
      try {
        await navigator.clipboard.writeText(await load());
        say("Copied");
      } catch {
        say("Couldn't copy");
      }
    }
  });
  btn.hidden = false;
}
