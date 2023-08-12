import { TaskFlags } from '@/enums';
import { StaffModel } from '@/models';
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    ComponentType,
    EmbedBuilder,
    inlineCode,
} from 'discord.js';

const Command: Point.ICommand = {
    usages: ['taglı', 'tagged'],
    checkPermission: ({ message, guildData }) => {
        const minStaffRole = message.guild.roles.cache.get(guildData.minStaffRole);
        return minStaffRole && message.member.roles.highest.position >= minStaffRole.position;
    },
    execute: async ({ client, message, args, guildData }) => {
        const member =
            (await client.utils.getMember(message.guild, args[0])) ||
            (message.reference ? (await message.fetchReference()).member : undefined);
        if (!member) {
            client.utils.sendTimedMessage(message, 'Geçerli bir kullanıcı belirt!');
            return;
        }

        if (!(guildData.tags || []).some((t) => member.user.displayName.toLowerCase().includes(t.toLowerCase()))) {
            client.utils.sendTimedMessage(message, 'Kullanıcı taga sahip değil.');
            return;
        }

        const hasTagged = await StaffModel.exists({ guild: message.guildId, 'taggeds.user': member.id });
        if (hasTagged) {
            client.utils.sendTimedMessage(message, 'Belirttiğin kullanıcıyı başka yetkili taga çekmiş :c');
            return;
        }

        const buttonRow = new ActionRowBuilder<ButtonBuilder>({
            components: [
                new ButtonBuilder({
                    custom_id: 'accept',
                    label: 'Evet',
                    style: ButtonStyle.Success,
                }),
                new ButtonBuilder({
                    custom_id: 'deaccept',
                    label: 'Hayır',
                    style: ButtonStyle.Danger,
                }),
            ],
        });

        const embed = new EmbedBuilder({ color: client.utils.getRandomColor() });

        const question = await message.channel.send({
            content: member.toString(),
            embeds: [
                embed.setDescription(
                    `${message.author} (${inlineCode(
                        message.author.id,
                    )}) adlı kullanıcı seni taglı olarak çekmek istiyor, onaylıyor musun?`,
                ),
            ],
            components: [buttonRow],
        });

        const filter = (i: ButtonInteraction) => i.user.id === member.id;
        const collected = await question.awaitMessageComponent({
            filter,
            time: 1000 * 60 * 2,
            componentType: ComponentType.Button,
        });
        if (collected) {
            if (collected.customId === 'deaccept') {
                question.edit({
                    content: '',
                    embeds: [
                        embed.setDescription(
                            `${member} (${inlineCode(member.id)}) adlı kullanıcı ${message.author} (${inlineCode(
                                message.author.id,
                            )}) adlı kullanıcının tagı alma teklifini red etti.`,
                        ),
                    ],
                    components: [],
                });
                return;
            }

            const authorDocument = await StaffModel.findOneAndUpdate(
                { id: message.author.id, guild: message.guildId },
                { $push: { taggeds: { user: member.id, time: Date.now() } } },
                { new: true, upsert: true, setDefaultsOnInsert: true },
            );

            const task = authorDocument.tasks.find((t) => t.type === TaskFlags.Tagged);
            if (task) {
                task.currentCount = task.currentCount + 1;
                if (task.currentCount >= task.count) task.currentCount = task.count;
                task.completed = task.currentCount >= task.count;
                authorDocument.markModified('tasks');
                await authorDocument.save();
            }

            question.edit({
                content: '',
                embeds: [
                    embed.setDescription(
                        `${member} (${inlineCode(member.id)}) adlı kullanıcı ${message.author} (${inlineCode(
                            message.author.id,
                        )}) adlı kullanıcının tagı alma teklifini kabul etti.`,
                    ),
                ],
                components: [],
            });
        } else {
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
    },
};

export default Command;
