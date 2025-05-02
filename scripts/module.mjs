import { registerSettings } from "./settings.mjs";
import DiceType from "./classes/DiceType.mjs";
import API from "./classes/api.mjs";
import { MODULE_ID } from "./CONSTS.mjs";


Hooks.once("init", () => {
    registerSettings();
});
Hooks.once("ready", () => {
    
    //ONLY FOR TESTING
    globalThis[MODULE_ID] = {
        DiceType,
        API,
    }
    //game.socket.on(`module.${MODULE_ID}`, SharedDice.handleRequest)
});
// Hooks.on("updateUser", SharedDice.onUpdateUser);

/*
    - Socket (update dice count of other user)
    - UI (display dice count, buttons)
    - Settings (max dice count per user, diceSize)

    
*/

/*
    Settings maybe?

    - Set minimum user role which is allowed to grant dice
*/
