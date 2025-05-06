import { SOCKET_NAME } from "../CONSTS.mjs";
import { notify } from "../utils.mjs";
import { setQuant } from "./UserHandler.mjs";

export default class SocketManager {
    static log = true;

    /** @type {Record<string, Function> } */
    static #actions = {
        setQuant: setQuant
    }

    static registerSocket() {
        game.socket.on(SOCKET_NAME, SocketManager.handle);
    }

    /**
     * @typedef {object} SocketData
     * @property {string} action        The name of the registered function to be executed.
     * @property {string} senderId      The id of the user who emitted this data.
     * @property {string[]} targetIds   The ids of the users who should execute the action.
     * @property {any[]} [actionParams] An array of parameters for the action function to receive. Must be JSON serializable!
     */

    /**
     * Emits socket data for other clients to handle.
     * @param {string} action           The name of the registered function to be executed.
     * @param {string[]} targetIds      The ids of the users who should execute the action.
     * @param  {any[]} [actionParams]   An array of parameters for the action function to receive. Must be JSON serializable!
     */
    static emit(action, targetIds, actionParams = []) {
        const socketObj = {
            action,
            senderId: game.userId,
            targetIds,
            actionParams
        };

        game.socket.emit(SOCKET_NAME, socketObj);
    }

    /**
     * Handles received socket data.
     * @param {SocketData} data
     */
    static async handle(data) {
        const { action, targetIds, actionParams } = data;
        if (!targetIds.includes?.(game.userId)) return;

        const fn = SocketManager.#actions[action];
        if (!fn) throw new Error(`No registered action named "${action}".`);

        if (SocketManager.log) console.log(`SocketManager | Executing action "${action}".`, { socketData: data });

        try {
            await Promise.resolve(fn(...actionParams));
        } catch (err) {
            console.error(`SocketManager | Execute error for action "${action}".`, { socketData: data, err });
        }
    }

    /**
     * Gets the best owner of the document.
     * If the executing user is the owner, they are the best, otherwise the first currently active owner is returned.
     * If no active owner is found, throws and error and displays a notification.
     * @param {Document} doc
     * @returns {User}
     */
    static getBestOwner(doc) {
        const best = doc.testUserPermission(game.user, "OWNER")
            ? game.user
            : game.users.find(u => u.active && doc.testUserPermission(u, "OWNER"));

        if (!best) {
            notify(`noActiveOwner`, "error", { console: false });
            console.error(`No active owner for document`, doc);
            throw new Error(`No active owner for document`);
        }
        return best;
    }
}
