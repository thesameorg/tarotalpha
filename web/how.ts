/** The method page: the site's styles and the theme switch only; the text is English and static in how.html. */
import "./styles.css";
import { initHeaderControls } from "./header-controls";
import { initTheme } from "./theme";

initTheme();
initHeaderControls({ language: false });
