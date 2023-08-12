import { TaskFlags } from '@/enums';
import { IGuildTask, IRank, PointClass, StaffModel } from '@/models';
import { Client } from '@/structures';
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    ComponentType,
    EmbedBuilder,
    Message,
    codeBlock,
    inlineCode,
} from 'discord.js';

const Command: Point.ICommand = {
    usages: ['göreval', 'gorev-al', 'görev-al'],
    checkPermission: ({ message, guildData }) => {
        const minStaffRole = message.guild.roles.cache.get(guildData.minStaffRole);
        return minStaffRole && message.member.roles.highest.position >= minStaffRole.position;
    },
    execute: async ({ client, message, guildData }) => {
        if (!client.utils.checkStaff(message.member, guildData)) {
            client.utils.sendTimedMessage(message, 'Yönetim görev alamaz.');
            return;
        }

        if (!(guildData.ranks || []).length) {
            client.utils.sendTimedMessage(message, 'Roller ayarlanmamış.');
            return;
        }

        if (!(guildData.tasks || []).length) {
            client.utils.sendTimedMessage(message, 'Görevler ayarlanmamış.');
            return;
        }

        const rank = guildData.ranks.find((r) => message.member.roles.cache.has(r.role));
        if (!rank.taskCount) {
            client.utils.sendTimedMessage(message, 'Sahip olduğun rolün görev yapma zorunluluğu bulunmuyor.');
            return;
        }

        if (
            rank.taskCount >
            guildData.tasks.filter(
                (t) => [TaskFlags.Message, TaskFlags.Invite].includes(t.type) || message.member.roles.cache.has(t.role),
            ).length
        ) {
            const responsibilityChannel = message.guild.channels.cache.get(guildData.responsibilityChannel);
            client.utils.sendTimedMessage(
                message,
                `Yeterli sorumluluğun bulunmuyor ${
                    responsibilityChannel ? `${responsibilityChannel} kanalından` : 'yetkililerden sorumluluk'
                } almalısın.`,
            );
            return;
        }

        const embed = new EmbedBuilder({ color: client.utils.getRandomColor() });
        const buttonRow = new ActionRowBuilder<ButtonBuilder>({
            components: [
                new ButtonBuilder({
                    customId: 'new-task',
                    emoji: {
                        id: '1056657891043590164',
                    },
                    style: ButtonStyle.Secondary,
                }),
                new ButtonBuilder({
                    customId: 'accept',
                    emoji: {
                        id: '992499335830978610',
                    },
                    style: ButtonStyle.Secondary,
                }),
            ],
        });

        let currentTasks: IGuildTask[] = createNewTasks(message, guildData, rank);
        const question = await message.channel.send({
            embeds: [embed.setDescription(createTaskContent(client, currentTasks))],
            components: [buttonRow],
        });

        const filter = (btn: ButtonInteraction) => btn.user.id === message.author.id;
        const collector = await question.createMessageComponentCollector({
            filter,
            time: 1000 * 60 * 2,
            componentType: ComponentType.Button,
        });

        collector.on('collect', async (i: ButtonInteraction) => {
            if (i.customId === 'accept') {
                collector.stop('FINISHED');
                question.edit({
                    embeds: [
                        embed.setDescription(
                            `${codeBlock('ansi', '[2;36mAşağıda görünen veriler artık senin görevin.[0m')}\n${
                                embed.data.description
                            }`,
                        ),
                    ],
                    components: [],
                });

                const query = { id: message.author.id, guild: message.guildId };
                const document = (await StaffModel.findOne(query)) || new StaffModel(query);
                currentTasks.forEach((t) =>
                    document.tasks.push({
                        completed: false,
                        count: t.count,
                        currentCount: 0,
                        channel: t.channel,
                        type: t.type,
                    }),
                );
                document.save();
            } else {
                currentTasks = createNewTasks(message, guildData, rank);
                question.edit({
                    embeds: [embed.setDescription(createTaskContent(client, currentTasks))],
                });
            }
        });

        collector.on('end', (_, reason) => {
            if (reason === 'time') {
                const timeFinished = new ActionRowBuilder<ButtonBuilder>({
                    components: [
                        new ButtonBuilder({
                            custom_id: 'timefinished',
                            disabled: true,
                            emoji: { name: '⏱️' },
                            style: ButtonStyle.Danger,
                        }),
                    ],
                });

                question.edit({ components: [timeFinished] });
            }
        });
    },
};

export default Command;

function createNewTasks(message: Message, guildData: PointClass, rank: IRank) {
    let usableTasks = guildData.tasks.filter((t) => t.isGeneral || message.member.roles.cache.has(t.role));
    const userTasks = [];
    for (let i = 0; rank.taskCount > i; i++) {
        const task = usableTasks[Math.floor(Math.random() * usableTasks.length)];
        usableTasks = usableTasks.filter((t) => t.title !== task.title);
        userTasks.push(task);
    }

    return userTasks;
}

function createTaskContent(client: Client, tasks: IGuildTask[]) {
    return tasks
        .map(
            (task) =>
                `${inlineCode(`• ${task.title}:`)} ${
                    task.type === TaskFlags.Voice ? client.utils.numberToString(task.count) : task.count
                }`,
        )
        .join('\n');
}
