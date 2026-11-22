import { describe, expect, it } from "vitest";
import { initHelp } from "./help";

function setup() {
  document.body.innerHTML = "";
  const overlay = document.createElement("div");
  overlay.className = "win-hidden";
  const btn = document.createElement("button");
  document.body.append(btn, overlay);
  return { overlay, btn, view: initHelp(overlay, btn) };
}

describe("help overlay", () => {
  it("opens from the button and explains the rules", () => {
    const { overlay, btn } = setup();
    expect(overlay.classList.contains("win-hidden")).toBe(true);
    btn.click();
    expect(overlay.classList.contains("win-hidden")).toBe(false);
    expect(overlay.textContent).toContain("every row");
    expect(overlay.textContent).toContain("not even diagonally");
  });

  it("closes via Got it, the backdrop and Escape", () => {
    const { overlay, btn, view } = setup();
    btn.click();
    overlay.querySelector<HTMLButtonElement>(".help-close")!.click();
    expect(view.isOpen()).toBe(false);

    btn.click();
    overlay.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(view.isOpen()).toBe(false);

    btn.click();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(view.isOpen()).toBe(false);
    expect(document.activeElement).toBe(btn);
  });

  it("ignores clicks inside the box", () => {
    const { overlay, btn, view } = setup();
    btn.click();
    overlay.querySelector<HTMLElement>(".help-box")!.click();
    expect(view.isOpen()).toBe(true);
  });
});
