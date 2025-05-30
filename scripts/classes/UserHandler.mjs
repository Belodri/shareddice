import { MODULE_ID, USER_FLAG } from "../CONSTS.mjs";
import { getSetting } from "../settings.mjs";
import { log } from "../utils.mjs";
import DiceType from "./DiceType.mjs";

/**
 * @import User from "@client/documents/user.mjs"
 */

/**
 * An object representing the collection of dice held by a user.
 * Keys are strings representing dice IDs, and values are numbers indicating the quantity of each die.
 * @typedef {Record<string, number>} UserDiceData
 */

/**
 * Helper function to get the user from an argument that's either a user or a userId 
 * @param {User|string} userOrId 
 * @returns {User}
 */
export function getUser(userOrId) {
    const user = userOrId instanceof User ? userOrId : game.users.get(userOrId);
    if( !(user instanceof User)) throw new Error("Invalid user.");
    return user;
}

/**
 * Get the quantity of a specific die from a user's flag data.
 * @param {User|string} userOrId 
 * @param {string} diceId 
 * @returns {number|undefined}
 */
export function getQuant(userOrId, diceId) {
    return getUser(userOrId)?.getFlag(MODULE_ID, `${USER_FLAG}.${diceId}`);
}

/**
 * Gets an object of all dice and their quantities from a user's flag data.
 * @param {User|string} userOrId 
 * @returns {Record<string, number>}
 */
export function getAllQuants(userOrId) {
    return getUser(userOrId)?.getFlag(MODULE_ID, `${USER_FLAG}`) ?? {};
}

/**
 * Does the source user have the required role permissions to edit (add/remove) this die on the target user?
 * @param {User|string} sourceUserOrId      The user attempting the action
 * @param {User|string} targetUserOrId      The user whose dice would be affected
 * @param {string} diceId                   The ID of the die type in question
 * @returns {boolean}
 */
export function canEdit(sourceUserOrId, targetUserOrId, diceId) {
    const sourceUser = getUser(sourceUserOrId);
    const sourceUserRoleName = CONST.USER_ROLE_NAMES[sourceUser.role];
    const diceType = DiceType.getFromId(diceId);
    const dicePerm = diceType.editPermissions[sourceUserRoleName];

    if( dicePerm === DiceType.EDIT_PERMISSIONS.ALL ) return true;
    if( dicePerm === DiceType.EDIT_PERMISSIONS.NONE ) return false;

    const targetUser = getUser(targetUserOrId);
    return targetUser === sourceUser && dicePerm === DiceType.EDIT_PERMISSIONS.SELF;
}

/**
 * Cleans invalid flag data for a given user.
 * Deletes invalid dice ids (those not defined in settings), and updates quantities of 
 * user dice to be between 0 and the type's limit.
 * @param {User|string} userOrId 
 * @returns {Promise<boolean|User>}
 */
export async function cleanInvalidFlagData(userOrId) {
    const user = getUser(userOrId);
    if(!user.testUserPermission(game.user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER)) return false;

    const allTypes = DiceType.getCollection();
    const flagData = getAllQuants(user);

    const userFlagUpdates = {};
    for(const [diceId, quant] of Object.entries(flagData)) {
        const type = allTypes.get(diceId);

        if(!type) userFlagUpdates[`-=${diceId}`] = null;
        else if(quant < 0 || quant > type.limit) userFlagUpdates[diceId] = Math.clamp(quant, 0, type.limit);
    }

    if(foundry.utils.isEmpty(userFlagUpdates)) {
        log("debug", "No invalid flag data", { userId: user.id });
        return true;
    }

    log("debug", "Cleaning invalid flag data", { userId: user.id, changes: userFlagUpdates });
    return user.update({[`flags.${MODULE_ID}.${USER_FLAG}`]: userFlagUpdates})
}


/**
 * Cleans invalid flag data for all users. GM only function.
 * @throws {Error} If called by a non-GM user. 
 * @returns {Promise<Array<boolean|User>>}
 */
export async function cleanAllUserFlagsData() {
    if(!game.user.isGM) throw new Error(`Function 'cleanAllUserFlags' can only be executed by GM users.`);

    const promises = game.users.map(u => cleanInvalidFlagData(u));
    return Promise.all(promises);
}
