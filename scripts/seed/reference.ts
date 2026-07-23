// The reference blueprint lives in the app so pages can render it without a
// DB round-trip. The seed script re-exports it here to copy it into Postgres
// (where questions/flashcards/progress join against it).
export { domains, tasks, scenarios } from "../../src/lib/blueprint";
