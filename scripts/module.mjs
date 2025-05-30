import { registerSettings } from "./settings.mjs";
import { registerAPI } from "./classes/api.mjs";
import UIHandler from "./classes/UIHandler.mjs";
import QueryManager from "./classes/QueryManager.mjs";
import { log } from "./utils.mjs";


Hooks.once("init", () => {
    registerSettings();
});
Hooks.once("ready", () => {
    registerAPI();
    QueryManager.register();
    log("info", "Ready");
});
Hooks.on("renderPlayers", UIHandler.onRenderPlayers);
