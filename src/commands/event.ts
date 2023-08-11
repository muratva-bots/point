import { GuildModel } from '@/models';
import { PermissionFlagsBits, time } from 'discord.js';
import ms from 'ms';

const Command: Point.ICommand = {
    usages: ['event'],
    checkPermission: ({ message }) => message.member.permissions.has(PermissionFlagsBits.Administrator),
    execute: async ({ client, message, args, guildData }) => {
        const timing = ms(args.join(' '));
        if (!timing) return client.utils.sendTimedMessage(message, 'Geçerli bir süre belirt!');

        const timestamp = Date.now() + timing;
        message.reply(`Etkinlik başlatıldı. (${time(Math.floor(timestamp / 1000), 'R')})`);
        await GuildModel.updateOne({ id: message.guildId }, { $set: { 'point.eventFinishTimestamp': timestamp } });
        guildData.eventFinishTimestamp = timestamp;
    },
};

export default Command;
