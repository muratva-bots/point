import { StaffModel } from '@/models';
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    ComponentType,
    EmbedBuilder,
    bold,
    inlineCode,
    userMention,
} from 'discord.js';

const Command: Point.ICommand = {
    usages: ['srol', 'roletop', 'role-top', 'rtop', 'r-top', 's-rol'],
    checkPermission: ({ message, guildData }) => {
        const minStaffRole = message.guild.roles.cache.get(guildData.minStaffRole);
        return minStaffRole && message.member.roles.highest.position >= minStaffRole.position;
    },
    execute: async ({ client, message, args, guildData }) => {
        const role = message.mentions.roles.first() || message.guild.roles.cache.get(args[0]);
        if (!role) {
            client.utils.sendTimedMessage(message, 'Geçerli bir rol belirt.');
            return;
        }

        if (!(guildData.ranks || []).some((r) => r.role === role.id)) {
            client.utils.sendTimedMessage(message, 'Belirttiğin rol yetkili rolü değil.');
            return;
        }

        const documents = await StaffModel.find({ id: { $in: role.members.map((m) => m.id) }, guild: message.guildId });
        if (!documents.length) {
            client.utils.sendTimedMessage(message, 'Belirttiğin role sahip yetkili verisi bulunmuyor.');
            return;
        }

        let page = 1;
        const embed = new EmbedBuilder({ color: client.utils.getRandomColor() });
        const totalData = Math.ceil(documents.length / 10);
        const sortedDatas = documents.sort((a, b) => a.totalPoints - b.totalPoints);
        const mappedDatas = sortedDatas.map(
            (d, i) => `${inlineCode(`${i + 1}`)}. ${userMention(d.id)} ${bold(`${d.totalPoints} puan`)}`,
        );

        const question = await message.channel.send({
            embeds: [embed.setDescription(mappedDatas.slice(page === 1 ? 0 : page * 10 - 10, page * 10).join('\n'))],
            components: [client.utils.paginationButtons(page, totalData)],
        });

        if (10 > mappedDatas.length) return;

        const filter = (i: ButtonInteraction) => i.user.id === message.author.id && i.isButton();
        const collector = question.createMessageComponentCollector({
            filter,
            time: 1000 * 60 * 5,
            componentType: ComponentType.Button,
        });

        collector.on('collect', (i: ButtonInteraction) => {
            i.deferUpdate();

            if (i.customId === 'first') page = 1;
            if (i.customId === 'previous') page -= 1;
            if (i.customId === 'next') page += 1;
            if (i.customId === 'last') page = totalData;

            question.edit({
                embeds: [embed.setDescription(mappedDatas.slice(page === 1 ? 0 : page * 10 - 10, page * 10).join('\n'))],
                components: [client.utils.paginationButtons(page, totalData)],
            });
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
