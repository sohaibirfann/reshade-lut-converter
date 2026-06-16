function reflect(button: HTMLButtonElement, theme: string): void {
  button.setAttribute("aria-pressed", String(theme === "light"));
  button.title = theme === "light" ? "Switch to dark theme" : "Switch to light theme";
}

// The initial theme is set by an inline <head> script (no flash); this wires the toggle.
export function initThemeToggle(button: HTMLButtonElement): void {
  reflect(button, document.documentElement.getAttribute("data-theme") ?? "dark");
  button.addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    reflect(button, next);
  });
}
