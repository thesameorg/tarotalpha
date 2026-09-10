/** The five readers in English, the same shape as readers-ru.ts. Content, not code. */
import type { ReaderId } from "../../engine/readers";
import type { ReaderText } from "./readers-ru";

export const READERS_EN: Record<ReaderId, ReaderText> = {
  atr: {
    name: "Madame Vera",
    blurb:
      "Reads the market the plain way: whatever the day's usual swing is, the cards push the price around inside it. No theories, no promises, the oldest hand at the table.",
  },
  reversion: {
    name: "Sister Anemone",
    blurb:
      "Believes everything comes back. Her price is pulled to where it has been sitting lately, and a card only decides how hard the rope pulls and how far it is allowed to stray.",
  },
  analogy: {
    name: "Elder Kofi",
    blurb:
      "Has seen this week before. He finds the stretch of the past week that looks most like the last few hours and lets it play out again, turned whichever way the cards say.",
  },
  garch: {
    name: "Mama Ife",
    blurb:
      "Says trouble travels in company. One violent hour under her hands makes the next hours violent too, and a quiet stretch stays quiet until something breaks it.",
  },
  fractal: {
    name: "The Weaver",
    blurb:
      "Works with one thread and one number. Above the middle the moves agree with each other and the price travels far; below it they argue and the day comes out as a fine saw.",
  },
};
