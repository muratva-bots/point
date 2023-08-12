import { GuildModel } from '@/models';
import { PermissionFlagsBits, time } from 'discord.js';
import ms from 'ms';

const Command: Point.ICommand = {
    usages: ['event'],
    checkPermission: ({ message }) => message.member.permissions.has(PermissionFlagsBits.Administrator),
    execute: async ({ client, message, args, guildData }) => {
        const timing = args.join(' ');
        const now = Date.now();

        if (['bitir', 'finish'].includes(timing?.toLowerCase())) {
            message.reply(`Etkinlik bitirildi.`);
            await GuildModel.updateOne({ id: message.guildId }, { $set: { 'point.eventFinishTimestamp': now } });
            guildData.eventFinishTimestamp = now;
            return;
        }

        if (!timing || isNaN(ms(timing))) {
            client.utils.sendTimedMessage(message, 'Geçerli bir süre belirt!');
            return;
        }

        if (ms(timing) > ms('3d') || ms(timing) < ms('1m')) {
            client.utils.sendTimedMessage(message, 'Maksimum 3 gün minimum 1 dakikalık etkinlik başlatabilirsiniz!');
            return;
        }

        const timestamp = now + ms(timing);
        message.reply(
            `Etkinlik başlatıldı. (${time(
                Math.floor(timestamp / 1000),
                'R',
            )}) boyunca yetkililer 2 katı puan kazanacak.`,
        );
        await GuildModel.updateOne({ id: message.guildId }, { $set: { 'point.eventFinishTimestamp': timestamp } });
        guildData.eventFinishTimestamp = timestamp;
    },
};

export default Command;
