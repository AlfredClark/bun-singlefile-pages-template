const valueEl = document.querySelector<HTMLParagraphElement>("#value")!;
const decrementEl = document.querySelector<HTMLButtonElement>("#decrement")!;
const incrementEl = document.querySelector<HTMLButtonElement>("#increment")!;
const resetEl = document.querySelector<HTMLButtonElement>("#reset")!;

let count = 0;

function render(): void {
  valueEl.textContent = String(count);
}

decrementEl.addEventListener("click", () => {
  count -= 1;
  render();
});

incrementEl.addEventListener("click", () => {
  count += 1;
  render();
});

resetEl.addEventListener("click", () => {
  count = 0;
  render();
});

render();
