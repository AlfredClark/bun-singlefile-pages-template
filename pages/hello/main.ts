const formEl = document.querySelector<HTMLFormElement>("#form")!;
const nameEl = document.querySelector<HTMLInputElement>("#name")!;
const outputEl = document.querySelector<HTMLParagraphElement>("#output")!;

formEl.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = nameEl.value.trim();
  outputEl.textContent = name ? `Hello, ${name}!` : "Hello, stranger!";
});
