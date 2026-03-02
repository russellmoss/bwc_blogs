import { BWC_STYLESHEET } from "./css";

/** Google Fonts preconnect + stylesheet links */
export const GOOGLE_FONTS_HTML = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Fraunces:ital,wght@0,400;0,700;1,400&family=Nunito+Sans:wght@300;400;700&family=Trirong&display=swap" rel="stylesheet">`;

/** The full embedded <style> block */
export const STYLE_BLOCK = `<style>\n${BWC_STYLESHEET}\n</style>`;

/** Template version constant */
export const TEMPLATE_VERSION = "2026.1";
