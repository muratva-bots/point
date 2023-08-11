import { Events } from 'discord.js';

import commandHandler from './commandHandler';
import messageStatHandler from './messageStatHandler';

const MessageCreate: Point.IEvent<Events.MessageCreate> = {
    name: Events.MessageCreate,
    execute: async (client, message) => {
        if (!message.author.bot || !message.guildId) return;

        const guildData = client.servers.get(message.guildId);
        if (!guildData) return;

        commandHandler(client, message, guildData);
        messageStatHandler(client, message, guildData);
    },
};

export default MessageCreate;
