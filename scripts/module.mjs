import { registerSettings } from "./settings.mjs";
import { registerAPI } from "./classes/api.mjs";
import UIHandler from "./classes/UIHandler.mjs";
import QueryManager from "./classes/QueryManager.mjs";


Hooks.once("init", () => {
    registerSettings();
});
Hooks.once("ready", () => {
    registerAPI();
    QueryManager.register();
});
Hooks.on("renderPlayers", UIHandler.onRenderPlayers);
