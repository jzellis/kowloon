import { generate, count } from "random-words";
function generatePassword() {
  // Two random words
  const words = generate({
    exactly: 2,
    minLength: 5,
    formatter: (w) => w.charAt(0).toUpperCase() + w.slice(1),
  });
  const base = words.join("");

  // Random number 4 to 6 digits
  const digits = Math.floor(Math.random() * (999999 - 1000 + 1)) + 1000; // 1000 → 999999

  // URL-safe punctuation characters
  const symbols = "!@#$%^&*()-_=+[]{}";
  const symbol = symbols.charAt(Math.floor(Math.random() * symbols.length));

  return `${base}${digits}${symbol}`;
}

export default generatePassword;
