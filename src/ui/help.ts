/**
 * "How to play" view: a button that opens an in-page, dismissible overlay with
 * the rules and controls. It is static content with no game state, so the entry
 * point wires it directly without going through the app instance.
 *
 * Closes on the "Got it" button, a tap on the backdrop, or Escape. Focus moves
 * into the dialog on open and back to the opening button on close.
 */

export interface HelpView {
  show(): void;
  hide(): void;
  readonly isOpen: () => boolean;
}

/** Build a paragraph from text and inline glyph chips, e.g. ["Tap ", glyph("x")]. */
function para(...parts: (string | Node)[]): HTMLParagraphElement {
  const p = document.createElement("p");
  p.append(...parts);
  return p;
}

/** A small cell-styled chip showing a board glyph inline in the text. */
function glyph(text: string, kind: "fish" | "ruled" | "conflict"): HTMLElement {
  const span = document.createElement("span");
  span.className = `help-glyph help-glyph-${kind}`;
  span.textContent = text;
  return span;
}

function strong(text: string): HTMLElement {
  const b = document.createElement("strong");
  b.textContent = text;
  return b;
}

function heading(text: string): HTMLHeadingElement {
  const h = document.createElement("h3");
  h.textContent = text;
  return h;
}

/** The two Deep Water rules that link the layers. */
function deepRules(): HTMLUListElement {
  const list = document.createElement("ul");
  list.className = "help-rules help-deep-rules";
  const pillar = document.createElement("li");
  pillar.append(strong("One fish per pillar: "), "no two fish in the same spot in different layers.");
  const touch = document.createElement("li");
  touch.append(
    strong("No touching through the water: "),
    "a fish can't sit right beside, above or below (on the grid) a fish in the other layer. Diagonal is fine.",
  );
  list.append(pillar, touch);
  return list;
}

/** A small ASCII picture of the "+" shadow a fish casts on the next layer. */
function shadowExample(): HTMLElement {
  const fig = document.createElement("figure");
  fig.className = "help-shadow";
  const pre = document.createElement("pre");
  pre.textContent = [
    " surface       deep",
    " . . . . .     . . . . .",
    " . . . . .     . . x . .",
    " . . ><> .     . x x x .",
    " . . . . .     . . x . .",
    " . . . . .     . . . . .",
  ].join("\n");
  const caption = document.createElement("figcaption");
  caption.textContent = "A fish in one layer rules out a + shape in the other layer.";
  fig.append(pre, caption);
  return fig;
}

/** Wire the help button and overlay element; returns its controls. */
export function initHelp(overlay: HTMLElement, openBtn: HTMLButtonElement): HelpView {
  const box = document.createElement("div");
  box.className = "win-box help-box";

  const title = document.createElement("h2");
  title.id = "help-title";
  title.textContent = "How to play";
  overlay.setAttribute("aria-labelledby", title.id);

  const rules = document.createElement("ul");
  rules.className = "help-rules";
  for (const rule of [
    "every row",
    "every column",
    "every pond (each coloured region)",
  ]) {
    const li = document.createElement("li");
    li.textContent = rule;
    rules.appendChild(li);
  }

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "win-share help-close";
  closeBtn.textContent = "Got it";

  box.append(
    title,
    para("Place exactly one fish ", glyph("><>", "fish"), " in:"),
    rules,
    para("Fish can't touch each other, ", strong("not even diagonally"), "."),
    heading("Controls"),
    para("Tap a cell to cycle: empty → ", glyph("x", "ruled"), " (no fish here) → ", glyph("><>", "fish"), " → empty."),
    para("Drag from an empty cell to cross off a run of cells. Drag from an ", glyph("x", "ruled"), " to erase them."),
    para("A fish shown as ", glyph(">x>", "conflict"), " is breaking a rule."),
    heading("Daily puzzle"),
    para("There's a new puzzle every day. Use ‹ › to play past days. The clock runs while a puzzle is open, so share your time when you finish."),
    heading("Deep Water"),
    para("Switch to ", strong("Deep"), " for the hard daily puzzle: a tank of two 8×8 layers, surface and deep. Each layer follows all the rules above. On top of that:"),
    deepRules(),
    shadowExample(),
    para("Neither layer can be solved on its own. Hover over or focus a cell to see the same spot in the other layer."),
    closeBtn,
  );
  overlay.appendChild(box);

  let open = false;

  function onKey(e: KeyboardEvent): void {
    if (e.key === "Escape") view.hide();
  }

  const view: HelpView = {
    show() {
      if (open) return;
      open = true;
      overlay.classList.remove("win-hidden");
      document.addEventListener("keydown", onKey);
      closeBtn.focus();
    },
    hide() {
      if (!open) return;
      open = false;
      overlay.classList.add("win-hidden");
      document.removeEventListener("keydown", onKey);
      openBtn.focus();
    },
    isOpen: () => open,
  };

  openBtn.addEventListener("click", () => view.show());
  closeBtn.addEventListener("click", () => view.hide());
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) view.hide();
  });

  return view;
}
