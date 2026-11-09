// Gives each code block in a lesson a bar along its top with the language and a Copy button.
// Without JavaScript the blocks simply show without the bar.

const NAMES: Record<string, string> = { bash: "Shell", sh: "Shell", shell: "Shell", json: "JSON", python: "Python", py: "Python", ts: "TypeScript", typescript: "TypeScript", js: "JavaScript", javascript: "JavaScript", rust: "Rust", solidity: "Solidity" };

for (const pre of document.querySelectorAll<HTMLPreElement>(".prose pre.astro-code")) {
  const block = document.createElement("div");
  block.className = "code-block";
  pre.replaceWith(block);

  const bar = document.createElement("div");
  bar.className = "code-bar";
  const lang = pre.dataset.language ?? "";
  if (lang && lang !== "text" && lang !== "plaintext") {
    const name = document.createElement("span");
    name.textContent = NAMES[lang] ?? lang;
    bar.append(name);
  }
  if (navigator.clipboard) {
    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "code-copy";
    copy.textContent = "Copy";
    copy.setAttribute("aria-live", "polite"); // so "Copied" is announced
    let reset = 0;
    copy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(pre.innerText.replace(/\n$/, ""));
        copy.textContent = "Copied";
      } catch {
        copy.textContent = "Couldn't copy";
      }
      clearTimeout(reset);
      reset = window.setTimeout(() => (copy.textContent = "Copy"), 1600);
    });
    bar.append(copy);
  }
  block.append(bar, pre);
}
