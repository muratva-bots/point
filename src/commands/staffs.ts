import { StaffModel } from '@/models';
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    ComponentType,
    EmbedBuilder,
    inlineCode,
    roleMention,
    time,
    userMention,
} from 'discord.js';

const Command: Point.ICommand = {
    usages: ['yetkililerim', 'yetkililer'],
    checkPermission: ({ message, guildData }) => {
        const minStaffRole = message.guild.roles.cache.get(guildData.minStaffRole);
        return minStaffRole && message.member.roles.highest.position >= minStaffRole.position;
    },
    execute: async ({ client, message, args, guildData }) => {
        const minStaffRole = message.guild.roles.cache.get(guildData.minStaffRole);

        const member =
            (await client.utils.getMember(message.guild, args[0])) ||
            (message.reference ? (await message.fetchReference()).member : message.member);
        const document = await StaffModel.findOne({ id: member.id, guild: message.guildId });
        if (!document || document.staffTakes.length) {
            client.utils.sendTimedMessage(message, 'Veri bulunmuyor.');
            return;
        }

        if (!guildData.tags?.some((t) => member.user.displayName.toLowerCase().includes(t.toLowerCase()))) {
            client.utils.sendTimedMessage(message, 'Kullanıcı taga sahip değil.');
            return;
        }

        let page = 1;
        const totalData = Math.ceil(document.staffTakes.length / 5);
        const embed = new EmbedBuilder({ color: client.utils.getRandomColor() });
        const mappedDatas = document.staffTakes.map((s) => {
            const takedMember = message.guild.members.cache.get(s.user);
            return [
                `Kullanıcı: ${userMention(s.user)} (${inlineCode(s.user)})`,
                `Yetki Durumu: ${
                    takedMember
                        ? takedMember.roles.highest.position >= minStaffRole.position
                            ? 'Yetkili.'
                            : 'Kullanıcı.'
                        : 'Sunucuda Bulunmuyor.'
                }`,
                `Rol: ${roleMention(s.role)} (${inlineCode(s.role)})`,
                `Tarih: ${time(Math.floor(s.time / 1000), 'D')} (${time(Math.floor(s.time / 1000), 'R')})`,
            ].join('\n');
        });

        const question = await message.channel.send({
            embeds: [embed],
            components: [client.utils.paginationButtons(page, totalData)],
        });

        if (5 > document.staffTakes.length) return;

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
                embeds: [embed.setDescription(mappedDatas.slice(page === 1 ? 0 : page * 5 - 5, page * 5).join(''))],
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
