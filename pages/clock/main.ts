const timeEl = document.querySelector<HTMLParagraphElement>("#time")!;
const dateEl = document.querySelector<HTMLParagraphElement>("#date")!;

function render(): void {
  const now = new Date();
  timeEl.textContent = now.toLocaleTimeString();
  dateEl.textContent = now.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

render();
setInterval(render, 1000);
