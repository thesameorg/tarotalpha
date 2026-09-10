/** Boot: styles, the tech panel, the zone label, the two modals, and the router that picks the landing or a reading. */
import "./styles.css";
import { zoneLabel } from "./local-time-format";
import { initPaywallModal } from "./paywall-modal";
import { landingView } from "./reading-flow";
import { readingView } from "./reading-page";
import { startRouter } from "./router";
import { initShareModal } from "./share-modal";
import { initTechPanel } from "./tech-panel";

const READING_PATH = /^\/r\/([A-Za-z0-9_-]+)\/?$/;

const view = document.getElementById("view");
if (view === null) throw new Error("index.html has no #view");

const zone = document.getElementById("zone");
if (zone !== null) zone.textContent = zoneLabel(Date.now());

initTechPanel();
initPaywallModal();
initShareModal();

startRouter(view, (url, navigate) => {
  const id = READING_PATH.exec(url.pathname)?.[1];
  return id === undefined ? landingView(url.searchParams) : readingView(id, navigate);
});
