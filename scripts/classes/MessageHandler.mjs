import DiceType from "./DiceType.mjs";
import { MODULE_ID } from "../CONSTS.mjs";
import { log } from "../utils.mjs";
import { getSetting } from "../settings.mjs";
/** 
 * @import User from "@client/documents/user.mjs"
 * @import ChatMessage from "@client/documents/chat-message.mjs";
 * @import Hooks from "@client/helpers/hooks.mjs";
 * @import ChatMessageData from "@common/documents/_types.mjs";
 */

export default class MessageHandler {
    static #templateRegex = /\[\$(.+?)\]/g;

    static #trackers = new Map();

    /**
     * Sends a chat message, debouncing and accumulating identical messages that are sent in quick succession.
     * Messages are considered identical if they share the same action, diceType, and targetUser.
     * If a message contains custom `messageData`, it will bypass the debouncing and be sent immediately.
     * 
     * @param {"add"|"remove"|"use"|"gift"} action  The type of action to perform.
     * @param {DiceType} diceType                   The type of dice involved in the action.
     * @param {object} [config]                     Optional configuration for the message.
     * @param {User} [config.targetUser]            The user targeted by the action.
     * @param {number} [config.amount=1]            The amount of the die involved to the action.
     * @param {object} [config.messageData]         Additional data for the chat message.
     * @returns {Promise<ChatMessage|true|null>}    Promise that resolves to the created chat message,
     *                                              `true` if the message template for the action was left blank,
     *                                              or `null` if the creation of the message has been cancelled via a hook.
     */
    static async send(action, diceType, {targetUser, amount=1, messageData={}}={}) {
        // Since we cannot easily hash message data and the module itself doesn't pass its own message data,
        // we just don't debounce messages with custom message data.
        if(!foundry.utils.isEmpty(messageData)) return this._send(action, diceType, {targetUser, amount, messageData});

        const trackerId = `${action}_${diceType.id}_${targetUser?.id ?? "NONE"}`;

        if(!this.#trackers.has(trackerId)) {
            log("debug", `Creating chat message send tracker with id: ${trackerId}`);
            this.#trackers.set(trackerId, {
                timeoutId: null,
                accAmount: 0,
                resolvers: []   // Array to store {resolve, reject} pairs
            });
        }

        const tracker = this.#trackers.get(trackerId);
        tracker.accAmount += amount;
        if(tracker.timeoutId) {
            log("debug", `Resetting timeout for chat message send tracker with id: ${trackerId}`);
            clearTimeout(tracker.timeoutId);
        }

        return new Promise((resolve, reject) => {
            tracker.resolvers.push({resolve, reject});

            tracker.timeoutId = setTimeout(async () => {
                const { accAmount, resolvers } = this.#trackers.get(trackerId);
                this.#trackers.delete(trackerId);

                log("debug", `Executing _send of tracker id: ${trackerId}`);
                try {
                    const result = await this._send(action, diceType, {targetUser, amount: accAmount});
                    resolvers.forEach(r => r.resolve(result));
                } catch (err) {
                    resolvers.forEach(r => r.reject(err));
                }
            }, getSetting("msgGroupDelaySec") * 1000);
        });
    }

    /**
     * Directly creates and sends a chat message for actions with configured templates.
     * @param {"add"|"remove"|"use"|"gift"} action  The type of action to perform.
     * @param {DiceType} diceType                   The type of dice involved in the action.
     * @param {object} [config]                     Optional configuration for the message.
     * @param {User} [config.targetUser]            The user targeted by the action.
     * @param {number} [config.amount=1]            The amount of the die involved to the action.
     * @param {object} [config.messageData]         Additional data for the chat message.
     * @returns {Promise<ChatMessage|true|null>}    Promise that resolves to the created chat message,
     *                                              `true` if the message template for the action was left blank,
     *                                              or `null` if the creation of the message has been cancelled via a hook.
     */
    static async _send(action, diceType, {targetUser, amount=1, messageData = {}}={}) {
        log("debug", "Sending Chat Message", {action, diceType, config: { targetUser, amount, messageData }});
        
        const template = this.#getMessageTemplate(action, diceType);
        if(template === "") return true; // Skip message creation if the typeMsg is falsey.
        else if(!template || typeof template !== "string") throw new Error(`Invalid actionType "${action}".`);

        const templateData = this.#getTemplateData({diceType, targetUser, amount});
        const content = this.#formatTemplate(template, templateData);

        const msgData = foundry.utils.mergeObject({
            content,
        }, messageData);

        const diceId = diceType.id;
        /**
         * A hook event that fires before a chat message is created.
         * @function shareddice.preCreateChatMessage
         * @memberof hookEvents
         * @param {"add"|"remove"|"use"|"gift"} action                              The action for which the chat message is about to be created.
         * @param {string} diceId                                                   The id of the dice type of the used in the action.
         * @param {User|undefined} targetUser                                       The target user of the action, if the action has a target. 
         * @param {number} amount                                                   The amount the die was changed by.
         * @param {ChatMessageData} msgData                                         The message data for the chat message about to be created. Can be mutated.
         * @returns {boolean}                                                       Return `false` to prevent the chat message from being created.
         */
        if(Hooks.call(`${MODULE_ID}.preCreateChatMessage`, action, diceId, targetUser, amount, msgData) === false) return null;
        
        const message = await ChatMessage.create(msgData);

        /**
         * A hook event that fires after a chat message is created.
         * @function shareddice.createChatMessage
         * @memberof hookEvents
         * @param {"add"|"remove"|"use"|"gift"} action                              The action for which the chat message has been created.
         * @param {string} diceId                                                   The id of the dice type of the used in the action.
         * @param {User|undefined} targetUser                                       The target user of the action, if the action had a target.
         * @param {number} amount                                                   The amount the die was changed by.
         * @param {ChatMessage} message                                             The created chat message.
         */
        Hooks.callAll(`${MODULE_ID}.createChatMessage`, action, diceId, targetUser, amount, message );

        return message;
    }

    /**
     * Formats the template by replacing any placeholders with the respective values in the template data.
     * @param {string} msgTemplate
     * @param {Record<string,string|number|undefined>} templateData
     * @returns {string}
     */
    static #formatTemplate(msgTemplate, templateData) {
        return msgTemplate.replaceAll(this.#templateRegex, (match, grp) => {
            const trimmed = grp.trim();
            const repVal = templateData[trimmed];
            return repVal ? `${repVal}` : match;
        });
    }

    /**
     * Gets the data object used to format the template.
     * @param {object} data 
     * @returns {Record<string,string|number|undefined>}
     */
    static #getTemplateData(data) {
        return {
            dieName: data.diceType?.name,
            sourceUser: game.user.name,
            targetUser: data.targetUser?.name,
            amount: data.amount
        }
    }

    /**
     * Gets the message template for a given action.
     * @param {string} action 
     * @param {DiceType} diceType 
     * @returns {string|undefined}  Can return an empty string! Returns undefined if no template of a given action exists.
     */
    static #getMessageTemplate(action, diceType) {
        return diceType.messages[action];
    }
}

