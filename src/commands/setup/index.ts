import { Team } from 'discord.js';
import mainHandler from './mainHandler';

const Command: Point.ICommand = {
    usages: ['setup', 'kur'],
    // checkPermission: ({ client, message }) => {
    //     const ownerID =
    //         client.application.owner instanceof Team
    //             ? (client.application.owner as Team).ownerId
    //             : client.application.owner.id;
    //     return ownerID === message.author.id;
    // },
    execute: ({ client, message, guildData }) => {
        mainHandler(client, message, guildData);
    },
};

export default Command;
