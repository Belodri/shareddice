import { MODULE_ID, USER_FLAG } from "../CONSTS.mjs";
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
 * @returns {UserDiceData}
 */
export function getAllQuants(userOrId) {
    return getUser(userOrId)?.getFlag(MODULE_ID, `${USER_FLAG}`);
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
