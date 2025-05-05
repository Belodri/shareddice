import DiceTypesSettingMenu from "./applications/DiceTypesSettingMenu.mjs";
import { MODULE_ID } from "./CONSTS.mjs";
import UIHandler from "./classes/UIHandler.mjs";

const SETTINGS = {
    diceTypes: {
        scope: "world",
        config: false,
        type: Object,
        default: {},
        onChange: () => UIHandler.rerender(),   // Triggers on all since it's a world setting.    
    },
    minRoleToEdit: {
        name: "SHAREDDICE.Settings.MinRoleToEdit.Name",
        hint: "SHAREDDICE.Settings.MinRoleToEdit.Hint",
        scope: "world",
        config: true,
        type: Number,
        choices: {
            2: "USER.RoleTrusted",
            3: "USER.RoleAssistant",
            4: "USER.RoleGamemaster"
        },
        default: 4,
        onChange: () => UIHandler.rerender(),
    }
}

/**
 * Registers settings and settings menu.
 */
export function registerSettings() {
    Object.entries(SETTINGS).forEach(([k, v]) => {
        game.settings.register(MODULE_ID, k, v);
    });

    game.settings.registerMenu(MODULE_ID, "diceTypesSettingMenu", {
        name: "SHAREDDICE.Settings.ConfigureDiceTypes.Name",
        label: "SHAREDDICE.Settings.ConfigureDiceTypes.Label",     
        hint: "SHAREDDICE.Settings.ConfigureDiceTypes.Hint",
        icon: "fa-solid fa-dice-d20",                                        
        type: DiceTypesSettingMenu,                            
        restricted: true
    });

}

/**
 * Sets the value one of the module's pre-registered settings.
 * @param {string} key      The setting key. Throws an error if not registered.
 * @param {object} data     The data object to store
 * @returns {Promise<any>}  The assigned setting value
 */
export async function setSetting(key, data) {
    if(!Object.keys(SETTINGS).includes(key)) throw new Error(`Non-registered settings are not permitted. | key: "${key}"`);
    return game.settings.set(MODULE_ID, key, data);
}

/**
 * Gets the value of one of the module's settings.
 * @param {string} key      The setting key.
 * @returns {any}
 */
export function getSetting(key) {
    return game.settings.get(MODULE_ID, key);
}
