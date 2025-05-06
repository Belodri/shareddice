import { registerSettings } from "./settings.mjs";
import { registerAPI } from "./classes/api.mjs";
import UIHandler from "./classes/UIHandler.mjs";
import SocketManager from "./classes/SocketManager.mjs";


Hooks.once("init", () => {
    registerSettings();
});
Hooks.once("ready", () => {
    registerAPI();
    SocketManager.registerSocket();
});
Hooks.on("renderPlayers", UIHandler.onRenderPlayers);
