/**
 * Boot: styles, the Telegram host if the client launched us, language, theme and reader, the header switches, the
 * modals, the router. Inside Telegram a `startapp` reading opens first and the client's back arrow leads to the
 * landing; the client shows its placeholder until the shell is up.
 */
import "./styles.css";
import { initHeaderControls } from "./header-controls";
import { initLang } from "./i18n/index";
import { zoneLabel } from "./local-time-format";
import { initPaywallModal } from "./paywall-modal";
import { initReader } from "./reader-choice";
import { initReaderProfile } from "./reader-profile";
import { landingView } from "./reading-flow";
import { readingView } from "./reading-page";
import { startRouter } from "./router";
import { initSettingsModal } from "./settings-modal";
import { initShareModal } from "./share-modal";
import {
  initTelegram,
  telegram,
  telegramBack,
  telegramLanguages,
  telegramReady,
  telegramStartReading,
} from "./telegram";
import { initTheme } from "./theme";

const READING_PATH = /^\/r\/([A-Za-z0-9_-]+)\/?$/;

async function boot(): Promise<void> {
  const view = document.getElementById("view");
  if (view === null) throw new Error("index.html has no #view");

  const zone = document.getElementById("zone");
  if (zone !== null) zone.textContent = zoneLabel(Date.now());

  await initTelegram();
  initLang(new URL(window.location.href).searchParams, telegramLanguages());
  initTheme();
  initReader();
  // Inside Telegram the switches live on the settings screen behind the client's own menu item, not in the header.
  if (telegram() === null) initHeaderControls();
  initReaderProfile();
  initPaywallModal();
  initShareModal();
  initSettingsModal();

  const start = telegramStartReading();
  if (start !== null) window.history.replaceState(null, "", `/r/${start}`);
  startRouter(view, (url, navigate) => {
    const id = READING_PATH.exec(url.pathname)?.[1];
    telegramBack(
      id === undefined
        ? null
        : () => {
            navigate("/");
          },
    );
    return id === undefined ? landingView(url.searchParams) : readingView(id, navigate);
  });
  telegramReady();
}

void boot();
