import { MODULE_ID, USER_FLAG } from "../CONSTS.mjs";
import { getSetting } from "../settings.mjs";
import SocketManager from "./SocketManager.mjs";

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
    return userOrId instanceof User ? userOrId : game.users.get(userOrId);
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
 * Set the quantity of a specific die on a user's flag data. 
 * @param {User|string} userOrId 
 * @param {string} diceId 
 * @param {number} newQuant 
 * @returns {Promise<User|void>}    Resolves to either the updated user or void if a socket event was emitted.
 */
export async function setQuant(userOrId, diceId, newQuant) {
    const targetUser = getUser(userOrId);
    const bestOwner = SocketManager.getBestOwner(targetUser);

    return bestOwner.isSelf
        ? targetUser.setFlag(MODULE_ID, `${USER_FLAG}.${diceId}`, newQuant)
        : SocketManager.emit("setQuant", [bestOwner.id], [targetUser.id, diceId, newQuant])
}

/**
 * Does this user have the minimum role required to edit other users' dice?
 * @param {User|string} userOrId 
 * @returns {boolean}
 */
export function hasEditRole(userOrId) {
    return getUser(userOrId)?.role >= getSetting("minRoleToEdit");
}
