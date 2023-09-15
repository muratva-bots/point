import { GuildModel } from '@/models';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Team } from 'discord.js';

const Command: Point.ICommand = {
    usages: ['sorumluluk'],
    checkPermission: ({ client, message }) => {
        return client.config.BOT_OWNERS.includes(message.author.id);
    },
    execute: async ({ client, message, guildData }) => {
        const tasks = (guildData.tasks || []).filter((t) => message.guild.roles.cache.has(t.role));
        if (!tasks.length) {
            client.utils.sendTimedMessage(message, 'Görevler ayarlanmamış.');
            return;
        }

        const rows: ActionRowBuilder<ButtonBuilder>[] = [];
        const tasksChunkArray = client.utils.chunkArray(tasks, 5);
        for (let i = 0; tasksChunkArray.length > i; i++) {
            const childTasks = tasksChunkArray[Math.floor(i / 25)];
            const row = new ActionRowBuilder<ButtonBuilder>();
            for (const childTask of childTasks) {
                row.addComponents(
                    new ButtonBuilder({
                        custom_id: childTask.role,
                        label: message.guild.roles.cache.get(childTask.role)?.name,
                        style: ButtonStyle.Primary,
                    })
                )
            }
            rows.push(row);
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
