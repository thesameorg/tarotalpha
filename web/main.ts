/**
 * Boot: styles, the Telegram host if the client launched us, language, theme and reader, the header switches, the
 * modals, the router, then the mana and "my readings" in the header, which every page shares. Inside Telegram a
 * `startapp` reading opens first and the client's back arrow leads to the landing; the client shows its placeholder
 * until the shell is up.
 */
import "./styles.css";
import { required } from "./dom-lookup";
import { initHeaderControls } from "./header-controls";
import { initLang } from "./i18n/index";
import { initManaPanel, mountManaMeter, mountPaidMeter } from "./mana-meter";
import { refreshPaid } from "./paid-mana";
import { initMyReadings } from "./my-readings";
import { mountMyReadings } from "./my-readings-list";
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
  telegramCloudStorage,
  telegramLanguages,
  telegramReady,
  telegramStartReading,
} from "./telegram";
import { initTheme } from "./theme";

const READING_PATH = /^\/r\/([A-Za-z0-9_-]+)\/?$/;

async function boot(): Promise<void> {
  const view = document.getElementById("view");
  if (view === null) throw new Error("index.html has no #view");

  await initTelegram();
  initMyReadings(telegramCloudStorage());
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
  const navigate = startRouter(view, (url, navigate) => {
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
  initManaPanel();
  mountManaMeter(required(document, "#mana", HTMLElement));
  mountPaidMeter(required(document, "#mana-paid", HTMLElement));
  // The bought balance lives on the server, so the gold flask is empty until the first answer comes back.
  void refreshPaid();
  mountMyReadings(required(document, "#mine", HTMLElement), navigate);
  telegramReady();
}

void boot();
