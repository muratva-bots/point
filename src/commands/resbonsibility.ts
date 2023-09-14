import { GuildModel } from '@/models';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

const Command: Point.ICommand = {
    usages: ['sorumluluk'],
    checkPermission: ({ client, message }) => {
        return client.config.BOT_OWNERS.includes(message.author.id);
    },
    execute: async ({ client, message, guildData }) => {
        const tasks = (guildData.tasks || []).filter((t) => t.isGeneral || message.guild.roles.cache.has(t.role));
        if (!tasks.length) {
            client.utils.sendTimedMessage(message, 'Görevler ayarlanmamış.');
            return;
        }

        const rows: ActionRowBuilder<ButtonBuilder>[] = [];
        const tasksChunkArray = client.utils.chunkArray(tasks, 25);
        for (let i = 0; tasksChunkArray.length > i; i++) {
            const t = tasksChunkArray[i];
            rows.push(
                new ActionRowBuilder<ButtonBuilder>({
                    components: [
                        new ButtonBuilder({
                            custom_id: t.role,
                            label: message.guild.roles.cache.get(t.role)?.name,
                            style: ButtonStyle.Primary,
                        }),
                    ],
                }),
            );
        }

        guildData.responsibilityChannel = message.channelId;
        await GuildModel.updateOne(
            { id: message.guildId },
            { $set: { 'point.responsibilityChannel': message.channelId } },
            { upsert: true, setDefaultsOnInsert: true },
        );

        message.channel.send({
            content:
                'Aşağıdaki butonlardan kendinize uygun olan sorumluluğu seçin! Sahip olduğunuz sorumluluk varsa eğer; butona tekrar basarsanız sorumluluk üzerinizden çekilir.',
            components: rows,
        });
    },
};

export default Command;
