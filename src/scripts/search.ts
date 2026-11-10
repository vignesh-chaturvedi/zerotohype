// Site search: a dialog opened with ⌘K, Ctrl+K or "/", backed by the Pagefind index that the build
// writes to /pagefind/. The index loads on first open, and every search runs in the browser.
// The input is a combobox: the arrow keys move through the results while typing goes on, and a
// screen reader hears the highlighted result and, after each search, how many there are.

type SubResult = { title: string; url: string; excerpt: string; weighted_locations?: { balanced_score: number }[] };
type Data = { url: string; excerpt: string; meta: { title?: string; kind?: string }; sub_results?: SubResult[] };
type Pagefind = {
  options(o: object): Promise<void>;
  debouncedSearch(q: string, o?: object, ms?: number): Promise<{ results: { data(): Promise<Data> }[] } | null>;
};

const dialog = document.querySelector<HTMLDialogElement>("#search");
const input = dialog?.querySelector<HTMLInputElement>("input");
const list = dialog?.querySelector<HTMLElement>("#search-results");
const statusLine = dialog?.querySelector<HTMLElement>("#search-status");
const suggestions = ["builder fee", "setOracle", "nonce", "funding", "HIP-3", "CoreWriter", "TWAP"];

let pagefind: Promise<Pagefind | null> | null = null;
let active = -1;

function load() {
  pagefind ??= (async () => {
    try {
      const url = "/pagefind/pagefind.js";
      const pf = (await import(/* @vite-ignore */ url)) as Pagefind;
      await pf.options({ excerptLength: 22 });
      return pf;
    } catch {
      return null;
    }
  })();
  return pagefind;
}

const hits = () => [...(list?.querySelectorAll<HTMLAnchorElement>("[role=option]") ?? [])];

function setActive(i: number) {
  const all = hits();
  if (!all.length || !input) return;
  active = (i + all.length) % all.length;
  all.forEach((a, j) => a.setAttribute("aria-selected", String(j === active)));
  input.setAttribute("aria-activedescendant", all[active].id);
  all[active].scrollIntoView({ block: "nearest" });
}

/** The results area is a listbox only while it holds results; a note or the suggestions are plain text and buttons. */
function asList(on: boolean) {
  if (!list || !input) return;
  if (on) {
    list.setAttribute("role", "listbox");
    list.setAttribute("aria-label", "Results");
  } else {
    list.removeAttribute("role");
    list.removeAttribute("aria-label");
    input.removeAttribute("aria-activedescendant");
    active = -1;
  }
  input.setAttribute("aria-expanded", String(on));
}

const announce = (text: string) => { if (statusLine) statusLine.textContent = text; };

/** Shows a note instead of results, and says it. */
function note(html: string, said: string) {
  if (!list) return;
  asList(false);
  list.innerHTML = `<p class="search-note">${html}</p>`;
  announce(said);
}

function showSuggestions() {
  if (!list) return;
  asList(false);
  list.innerHTML = `<p class="search-note">Try ${suggestions.map((s) => `<button type="button" class="chip" data-q="${s}">${s}</button>`).join(" ")}</p>`;
  announce("");
}

const clean = (s = "") => s.replace(/<(?!\/?mark>)[^>]*>/g, "");

/** How well a section of a page matches: Pagefind weighs each match, more in headings than in text. */
const score = (s: SubResult) => (s.weighted_locations ?? []).reduce((total, l) => total + l.balanced_score, 0);

/** The two sections of a page that match best, leaving out any that match far worse than the best one. */
function bestSections(d: Data) {
  const subs = (d.sub_results ?? [])
    .filter((s) => s.url !== d.url && s.title && s.title !== d.meta.title && s.excerpt !== d.excerpt)
    .sort((a, b) => score(b) - score(a));
  return subs.filter((s) => score(s) >= score(subs[0]) / 4).slice(0, 2);
}

async function run(q: string) {
  if (!list) return;
  if (!q.trim()) return showSuggestions();
  const pf = await load();
  if (!pf) {
    note("Search isn't available here. It's built with the site, so it only works on a production build.", "Search isn't available here.");
    return;
  }
  const res = await pf.debouncedSearch(q, {}, 120);
  if (!res) return; // a newer search replaced this one
  const data = await Promise.all(res.results.slice(0, 8).map((r) => r.data()));
  if (input && input.value !== q) return;
  if (!data.length) {
    const shown = q.replace(/[<>&"]/g, "");
    note(`Nothing matches “${shown}”. Try a shorter word, or an API name like <code>l2Book</code>.`, `No results for ${shown}.`);
    return;
  }
  let n = 0;
  asList(true);
  // Options stay out of the Tab order: the arrow keys reach them from the input.
  list.innerHTML = data
    .map((d) => {
      const subs = bestSections(d);
      return `<div class="hit-group" role="none">
        <a role="option" id="hit-${n++}" class="hit" href="${d.url}" tabindex="-1">
          <span class="hit-kind">${clean(d.meta.kind ?? "Page")}</span>
          <span class="hit-title">${clean(d.meta.title ?? d.url)}</span>
          <span class="hit-excerpt">${clean(d.excerpt)}</span>
        </a>
        ${subs
          .map((s) => `<a role="option" id="hit-${n++}" class="hit sub" href="${s.url}" tabindex="-1"><span class="hit-title"># ${clean(s.title)}</span><span class="hit-excerpt">${clean(s.excerpt)}</span></a>`)
          .join("")}
      </div>`;
    })
    .join("");
  setActive(0);
  announce(data.length === 1 ? "1 result." : `${data.length} results.`);
}

function open() {
  if (!dialog || dialog.open) return;
  dialog.showModal();
  input?.focus();
  input?.select();
  if (!input?.value) showSuggestions();
  load();
}

if (dialog && input && list) {
  document.querySelectorAll("[data-search-open]").forEach((b) => b.addEventListener("click", open));
  document.addEventListener("keydown", (e) => {
    const typing = (e.target as HTMLElement).closest("input, textarea, select, [contenteditable]");
    if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
      e.preventDefault();
      dialog.open ? dialog.close() : open();
    }
  });
  input.addEventListener("input", () => run(input.value));
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(active + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(active - 1); }
    else if (e.key === "Enter") {
      const hit = hits()[active];
      if (hit) { e.preventDefault(); location.href = hit.href; }
    }
  });
  list.addEventListener("click", (e) => {
    const chip = (e.target as Element).closest<HTMLButtonElement>("[data-q]");
    if (chip) { input.value = chip.dataset.q!; run(input.value); input.focus(); }
  });
  list.addEventListener("pointermove", (e) => {
    const hit = (e.target as Element).closest<HTMLAnchorElement>("[role=option]");
    if (hit) setActive(hits().indexOf(hit));
  });
  // A click on the backdrop closes the dialog.
  dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });
}
