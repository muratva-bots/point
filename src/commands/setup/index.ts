import mainHandler from './mainHandler';

const Command: Point.ICommand = {
    usages: ['setup', 'kur'],
    checkPermission: ({ client, message }) => {
       return client.config.BOT_OWNERS.includes(message.author.id);
    },
    execute: ({ client, message, guildData }) => {
        mainHandler(client, message, guildData);
    },
};

export default Command;
