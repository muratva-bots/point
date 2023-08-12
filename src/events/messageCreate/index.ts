import { Events } from 'discord.js';

import commandHandler from './commandHandler';
import messageStatHandler from './messageStatHandler';
import { PointClass } from '@/models';

const MessageCreate: Point.IEvent<Events.MessageCreate> = {
    name: Events.MessageCreate,
    execute: async (client, message) => {
        if (message.author.bot || !message.guildId) return;

        const guildData = client.servers.get(message.guildId) || new PointClass();
        commandHandler(client, message, guildData);
        messageStatHandler(client, message, guildData);
    },
};

export default MessageCreate;
