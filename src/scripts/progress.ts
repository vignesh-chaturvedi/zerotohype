// "Done" ticks for the tracks. The list lives in this browser's localStorage and is never sent anywhere.
//   [data-done-id="<track id>"]      gets .is-done when that track is ticked
//   [data-done-toggle="<track id>"]  a button that ticks or unticks it
//   [data-progress]                  shows how many of the page's [data-done-id] rows are ticked

const KEY = "zth:done";

function read(): Set<string> {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return new Set(Array.isArray(list) ? list.filter((x) => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

function write(done: Set<string>) {
  try {
    localStorage.setItem(KEY, JSON.stringify([...done]));
  } catch {}
}

function paint() {
  const done = read();
  const rows = [...document.querySelectorAll<HTMLElement>("[data-done-id]")];
  for (const el of rows) el.classList.toggle("is-done", done.has(el.dataset.doneId!));
  for (const btn of document.querySelectorAll<HTMLButtonElement>("[data-done-toggle]")) {
    const on = done.has(btn.dataset.doneToggle!);
    btn.setAttribute("aria-pressed", String(on));
    const label = btn.querySelector(".done-label");
    if (label) label.textContent = on ? "Done" : "Mark as done";
  }
  // Once anything is ticked, the header's Start link points at the first track not yet done.
  for (const start of document.querySelectorAll<HTMLAnchorElement>("a.start[data-tracks]")) {
    const next = start.dataset.tracks!.split(",").map((s) => s.split(":")).find(([id]) => !done.has(id));
    const label = start.querySelector("[data-start-label]");
    if (done.size && next && label) {
      start.href = `/tracks/${next[0]}/`;
      label.textContent = `Continue ${next[1]}`;
    }
  }
  const ids = new Set(rows.map((r) => r.dataset.doneId));
  const n = [...done].filter((id) => ids.has(id)).length;
  for (const box of document.querySelectorAll<HTMLElement>("[data-progress]")) {
    const total = ids.size;
    box.style.setProperty("--done", String(total ? n / total : 0));
    const text = box.querySelector("[data-progress-text]");
    if (text) text.textContent = n === 0 ? `0 of ${total} done` : n === total ? `All ${total} done` : `${n} of ${total} done`;
    box.classList.toggle("has-progress", n > 0);
  }
}

document.addEventListener("click", (e) => {
  const btn = (e.target as Element).closest<HTMLButtonElement>("[data-done-toggle]");
  if (!btn) return;
  const id = btn.dataset.doneToggle!;
  const done = read();
  if (done.has(id)) done.delete(id);
  else done.add(id);
  write(done);
  paint();
});
addEventListener("storage", (e) => { if (e.key === KEY) paint(); });
paint();
