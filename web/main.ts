/** Boot: styles, the UTC clock, the two modals, and the router that picks the landing or a saved reading. */
import "./styles.css";
import { initPaywallModal } from "./paywall-modal";
import { landingView } from "./reading-flow";
import { readingView } from "./reading-page";
import { startRouter } from "./router";
import { initShareModal } from "./share-modal";
import { utcClock } from "./utc-format";

const READING_PATH = /^\/r\/([A-Za-z0-9_-]+)\/?$/;

function tickClock(): void {
  const el = document.getElementById("utc");
  if (el !== null) el.textContent = utcClock(Date.now());
}

const view = document.getElementById("view");
if (view === null) throw new Error("index.html has no #view");

initPaywallModal();
initShareModal();
tickClock();
setInterval(tickClock, 1000);

startRouter(view, (url, navigate) => {
  const id = READING_PATH.exec(url.pathname)?.[1];
  return id === undefined ? landingView(url.searchParams) : readingView(id, navigate);
});
