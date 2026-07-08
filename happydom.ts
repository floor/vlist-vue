// Test preload: register happy-dom globals before any test module (incl. vue's
// runtime-dom, which caches `document` at import time) is evaluated.
import { GlobalRegistrator } from "@happy-dom/global-registrator";
GlobalRegistrator.register();
