// Site search: a dialog opened with ⌘K, Ctrl+K or "/", backed by the Pagefind index that the build
// writes to /pagefind/. The index loads on first open, and every search runs in the browser.

type SubResult = { title: string; url: string; excerpt: string; weighted_locations?: { balanced_score: number }[] };
type Data = { url: string; excerpt: string; meta: { title?: string; kind?: string }; sub_results?: SubResult[] };
type Pagefind = {
  options(o: object): Promise<void>;
  debouncedSearch(q: string, o?: object, ms?: number): Promise<{ results: { data(): Promise<Data> }[] } | null>;
};

const dialog = document.querySelector<HTMLDialogElement>("#search");
const input = dialog?.querySelector<HTMLInputElement>("input");
const list = dialog?.querySelector<HTMLElement>("#search-results");
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

function showSuggestions() {
  if (!list) return;
  active = -1;
  input?.removeAttribute("aria-activedescendant");
  list.innerHTML = `<p class="search-note">Try ${suggestions.map((s) => `<button type="button" class="chip" data-q="${s}">${s}</button>`).join(" ")}</p>`;
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
    list.innerHTML = `<p class="search-note">Search isn't available here. It's built with the site, so it only works on a production build.</p>`;
    return;
  }
  const res = await pf.debouncedSearch(q, {}, 120);
  if (!res) return; // a newer search replaced this one
  const data = await Promise.all(res.results.slice(0, 8).map((r) => r.data()));
  if (input && input.value !== q) return;
  if (!data.length) {
    list.innerHTML = `<p class="search-note">Nothing matches “${q.replace(/[<>&"]/g, "")}”. Try a shorter word, or an API name like <code>l2Book</code>.</p>`;
    return;
  }
  let n = 0;
  list.innerHTML = data
    .map((d) => {
      const subs = bestSections(d);
      return `<div class="hit-group">
        <a role="option" id="hit-${n++}" class="hit" href="${d.url}">
          <span class="hit-kind">${clean(d.meta.kind ?? "Page")}</span>
          <span class="hit-title">${clean(d.meta.title ?? d.url)}</span>
          <span class="hit-excerpt">${clean(d.excerpt)}</span>
        </a>
        ${subs
          .map((s) => `<a role="option" id="hit-${n++}" class="hit sub" href="${s.url}"><span class="hit-title"># ${clean(s.title)}</span><span class="hit-excerpt">${clean(s.excerpt)}</span></a>`)
          .join("")}
      </div>`;
    })
    .join("");
  setActive(0);
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
