// Gives each code block in a lesson a bar along its top with the language and a Copy button. When a
// lesson gives the same code in several SDK languages, as blocks one after another, they become tabs,
// and the reader's language is remembered: every tabbed block, on every page, opens in it.
// Without JavaScript the blocks simply show without the bar, one after another.

const NAMES: Record<string, string> = { bash: "Shell", sh: "Shell", shell: "Shell", json: "JSON", python: "Python", py: "Python", ts: "TypeScript", typescript: "TypeScript", js: "JavaScript", javascript: "JavaScript", rust: "Rust", solidity: "Solidity" };
/** Languages a lesson may give the same code in, side by side, as tabs. */
const SDK = new Set(["python", "py", "ts", "typescript", "rust"]);
const LANG_KEY = "zth:code-lang";

const langOf = (pre?: HTMLElement) => pre?.dataset.language ?? "";
/** One name per language, so "py" and "python" count as the same choice. */
const ALIASES: Record<string, string> = { py: "python", typescript: "ts" };
const canonical = (lang: string) => ALIASES[lang] ?? lang;

function copyButton(text: () => string) {
  if (!navigator.clipboard) return null;
  const copy = document.createElement("button");
  copy.type = "button";
  copy.className = "code-copy";
  copy.textContent = "Copy";
  copy.setAttribute("aria-live", "polite"); // so "Copied" is announced
  let reset = 0;
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(text().replace(/\n$/, ""));
      copy.textContent = "Copied";
    } catch {
      copy.textContent = "Couldn't copy";
    }
    clearTimeout(reset);
    reset = window.setTimeout(() => (copy.textContent = "Copy"), 1600);
  });
  return copy;
}

/** Wraps the blocks in a frame with a bar holding `parts` along its top. */
function frame(pres: HTMLPreElement[], ...parts: (Node | null)[]) {
  const block = document.createElement("div");
  block.className = "code-block";
  const bar = document.createElement("div");
  bar.className = "code-bar";
  bar.append(...parts.filter((p): p is Node => p !== null));
  pres[0].before(block);
  block.append(bar, ...pres);
}

function single(pre: HTMLPreElement) {
  const lang = langOf(pre);
  const name = lang && lang !== "text" && lang !== "plaintext" ? document.createElement("span") : null;
  if (name) name.textContent = NAMES[lang] ?? lang;
  frame([pre], name, copyButton(() => pre.innerText));
}

/** Every tab set on the page, each able to switch to a language if it has it. */
const sets: ((lang: string) => void)[] = [];

function remember(lang: string) {
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    // Storage can be blocked; the choice then lasts until the page is left.
  }
  for (const show of sets) show(lang);
}

/** The same code in several languages: a tab for each, and a Copy button for the one showing. */
function tabs(pres: HTMLPreElement[]) {
  const n = sets.length;
  const list = document.createElement("div");
  list.setAttribute("role", "tablist");
  list.setAttribute("aria-label", "Language");
  const buttons = pres.map((pre, i) => {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.id = `code-${n}-tab-${i}`;
    tab.setAttribute("role", "tab");
    tab.dataset.lang = canonical(langOf(pre));
    tab.textContent = NAMES[langOf(pre)] ?? langOf(pre);
    pre.id ||= `code-${n}-panel-${i}`;
    pre.setAttribute("role", "tabpanel");
    pre.setAttribute("aria-labelledby", tab.id);
    tab.setAttribute("aria-controls", pre.id);
    return tab;
  });
  list.append(...buttons);

  let open = 0;
  const show = (i: number) => {
    open = i;
    buttons.forEach((b, j) => {
      b.setAttribute("aria-selected", String(j === i));
      b.tabIndex = j === i ? 0 : -1;
    });
    pres.forEach((p, j) => (p.hidden = j !== i));
  };
  // Choosing a language switches every set on the page, which can change the height of sets above
  // this one; keep this one where it was on screen.
  const choose = (i: number) => {
    const before = list.getBoundingClientRect().top;
    remember(buttons[i].dataset.lang!);
    window.scrollBy(0, list.getBoundingClientRect().top - before);
  };

  list.addEventListener("click", (e) => {
    const i = buttons.indexOf((e.target as Element).closest<HTMLButtonElement>("[role=tab]")!);
    if (i >= 0) choose(i);
  });
  list.addEventListener("keydown", (e) => {
    const last = buttons.length - 1;
    const i = e.key === "ArrowRight" ? (open === last ? 0 : open + 1)
      : e.key === "ArrowLeft" ? (open === 0 ? last : open - 1)
      : e.key === "Home" ? 0 : e.key === "End" ? last : -1;
    if (i < 0) return;
    e.preventDefault();
    choose(i);
    buttons[i].focus();
  });

  frame(pres, list, copyButton(() => pres[open].innerText));
  sets.push((lang) => {
    const i = buttons.findIndex((b) => b.dataset.lang === lang);
    if (i >= 0) show(i);
  });
  show(0);
}

const all = [...document.querySelectorAll<HTMLPreElement>(".prose pre.astro-code")];
for (let i = 0; i < all.length; ) {
  // An SDK block, then the same code in other SDK languages, each directly after the last.
  const run = [all[i]];
  while (SDK.has(langOf(run[0])) && SDK.has(langOf(all[i + run.length])) && all[i + run.length] === run.at(-1)!.nextElementSibling) {
    run.push(all[i + run.length]);
  }
  if (run.length > 1 && new Set(run.map((p) => canonical(langOf(p)))).size === run.length) tabs(run);
  else run.forEach(single);
  i += run.length;
}

let saved: string | null = null;
try {
  saved = localStorage.getItem(LANG_KEY);
} catch {
  // No storage: every set opens on its first language.
}
if (saved) for (const show of sets) show(saved);
