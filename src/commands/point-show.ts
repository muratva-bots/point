import { IRank, PointClass, StaffClass, StaffModel } from '@/models';
import { Client } from '@/structures';
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    ComponentType,
    EmbedBuilder,
    GuildMember,
    bold,
    codeBlock,
    inlineCode,
    time,
    userMention,
} from 'discord.js';

const Command: Point.ICommand = {
    usages: ['ystat', 'point', 'points', 'puan', 'task', 'tasks', 'görev', 'görevler'],
    checkPermission: ({ message, guildData }) => {
        const minStaffRole = message.guild.roles.cache.get(guildData.minStaffRole);
        return minStaffRole && message.member.roles.highest.position >= minStaffRole.position;
    },
    execute: async ({ client, message, args, guildData }) => {
        const member =
            (await client.utils.getMember(message.guild, args[0])) ||
            (message.reference ? (await message.fetchReference()).member : message.member);

        if (!client.utils.checkStaff(member, guildData)) {
            client.utils.sendTimedMessage(message, 'Belirttiğin kullanıcı yetkili değil.');
            return;
        }

        const document = await StaffModel.findOne({ id: member.id, guild: message.guildId });
        if (!document) {
            client.utils.sendTimedMessage(message, 'Belirttiğin kullanıcının verisi bulunmuyor.');
            return;
        }

        const rankIndex = guildData.ranks?.findIndex((r) => member.roles.cache.has(r.role));
        if (rankIndex === guildData.ranks?.length - 1) {
            client.utils.sendTimedMessage(message, 'Yükselecek yetkin bulunmuyor, yönetime alınmayı bekle.');
            return;
        }

        const rank = guildData.ranks?.find((r) => member.roles.cache.has(r.role));
        const embed = new EmbedBuilder({
            color: client.utils.getRandomColor(),
            author: {
                name: member.user.displayName,
                icon_url: member.displayAvatarURL({ size: 4096, forceStatic: true }),
            },
            description: getGeneralContent(client, member, document, rank, guildData),
        });

        const buttonRow = new ActionRowBuilder<ButtonBuilder>({
            components: [
                new ButtonBuilder({
                    custom_id: 'task',
                    label: 'Görevlere Bak',
                    style: ButtonStyle.Primary,
                }),
            ],
        });

        const question = await message.channel.send({
            embeds: [embed],
            components: rank.taskCount ? [buttonRow] : [],
        });

        if (!rank.taskCount) return;

        const filter = (i: ButtonInteraction) => i.user.id === message.author.id;
        const collector = await question.createMessageComponentCollector({
            filter,
            time: 1000 * 60 * 2,
            componentType: ComponentType.Button,
        });

        collector.on('collect', (i: ButtonInteraction) => {
            if (i.customId === 'general') {
                buttonRow.components[0].setLabel('Görevlere Bak').setCustomId('task');

                question.edit({
                    embeds: [embed.setDescription(getGeneralContent(client, member, document, rank, guildData))],
                    components: [buttonRow],
                });
            } else {
                buttonRow.components[0].setLabel('Genel Bilgilere Bak').setCustomId('general');

                const userRoleTimeDay = Math.floor(Date.now() - (document.roleStartTime / 1000) * 60 * 60 * 24 * 7);
                const complatedTasks = document.tasks.filter((t) => t.completed).length;
                const needRoleTime = rank.roleTime ? rank.roleTime - userRoleTimeDay : 0;
                const tasksMapped = document.tasks.map((t) => {
                    const task = guildData.tasks.find((tt) => tt.channel === t.channel);
                    return `${inlineCode(`• ${task.title}:`)} ${client.utils.createBar(
                        t.currentCount,
                        t.count,
                    )} (${inlineCode(
                        task.isVoice
                            ? `${client.utils.numberToString(t.currentCount)}/${client.utils.numberToString(t.count)}`
                            : `${t.currentCount}/${t.count}`,
                    )})`;
                });

                question.edit({
                    embeds: [
                        embed.setDescription(
                            document.tasks.length
                                ? [
                                      `${member} (${inlineCode(member.id)}) adlı kullanıcının görevleri;\n`,
                                      tasksMapped.join('\n'),
                                      getStatus(document, rank, complatedTasks, needRoleTime),
                                  ].join('\n')
                                : 'Görev verin bulunmuyor. Görev alarak görevlerine bakabilirsin.',
                        ),
                    ],
                    components: [buttonRow],
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

function getGeneralContent(
    client: Client,
    member: GuildMember,
    document: StaffClass,
    rank: IRank,
    guildData: PointClass,
) {
    const lastRole = document.oldRoles[document.oldRoles.length - 1] || { admin: '?', startTimestamp: 0 };
    const userRoleTime = Date.now() - document.roleStartTime;
    const userRoleTimeDay = Math.floor((userRoleTime / 1000) * 60 * 60 * 24);
    const complatedTasks = document.tasks.filter((t) => t.completed).length;
    const needRoleTime = rank.roleTime ? rank.roleTime - userRoleTimeDay * 7 : 0;

    const needRating = document.pointsRating - document.allPoints;
    const needCount = (rank.roleTime || 0) + rank.point + (rank.taskCount || 0) + document.pointsRating;
    const complatedCount =
        (rank.roleTime ? userRoleTimeDay * 7 : 0) + document.allPoints + complatedTasks + needRating > 0
            ? needRating
            : document.pointsRating;

    return [
        `${member} (${inlineCode(member.id)}) adlı kullanıcının puan bilgileri;\n`,
        `${inlineCode('• Yetkiyi Veren/Tarih:')} ${
            lastRole.admin === '?' && lastRole.startTimestamp === 0
                ? 'Bilinmiyor.'
                : `${userMention(lastRole.admin)} / ${time(Math.floor(lastRole.startTimestamp / 1000), 'R')}`
        }`,
        `${inlineCode(`• Değerlendirme Puanı:`)} ${document.allPoints} (${bold(`Min: ${document.pointsRating}`)}) ${
            document.allPoints > document.pointsRating ? '🟩' : '🟥'
        }`,
        rank.roleTime
            ? `${inlineCode(`• Yetki Süresi:`)} ${client.utils
                  .getEmoji('tik')
                  .repeat(userRoleTimeDay * 7)}${client.utils
                  .getEmoji('carpi')
                  .repeat(rank.roleTime - userRoleTime)} (${bold(`${userRoleTimeDay} Gün / ${rank.roleTime} Gün`)})`
            : undefined,
        `${inlineCode(`• Bireysel/Genel Toplantı:`)} ${
            document.inPersonalMeeting ? client.utils.getEmoji('tik') : client.utils.getEmoji('carpi')
        }/${document.inGeneralMeeting ? client.utils.getEmoji('tik') : client.utils.getEmoji('carpi')}`,
        rank.taskCount
            ? `${inlineCode('• Görev Durumu:')}\n${client.utils.createBar(rank.taskCount, complatedTasks)}`
            : undefined,
        `${inlineCode('• İlerleme Durumu:')}\n${client.utils.createBar(needCount, complatedCount)}`,
        `### Puan Bilgileri`,
        `${inlineCode('• Toplam/Gereken Puan:')} ${bold(`${document.allPoints}/${rank.point}`)}`,
        `${inlineCode('• Kayıt Puan:')} ${document.registerPoints}`,
        `${inlineCode('• Davet Puan:')} ${document.inviteUsers.length * guildData.invitePoint}`,
        `${inlineCode('• Public Puan:')} ${document.publicPoints}`,
        `${inlineCode('• Mesaj Puan:')} ${document.messagePoints}`,
        `${inlineCode('• Ekstra Puan:')} ${document.bonusPoints}`,
        `${inlineCode('• Sorumluluk Puan:')} ${document.responsibilityPoints}`,
        `${inlineCode('• AFK Puan:')} ${document.sleepPoints} (${bold(`Max: ${rank.maxSleep}`)})`,
        getStatus(document, rank, complatedTasks, needRoleTime),
    ]
        .filter(Boolean)
        .join('\n');
}

function getStatus(document: StaffClass, rank: IRank, complatedTasks: number, needRoleTime: number) {
    let status;
    if (document.pointsRating > document.allPoints) status = 'Değerlendirme puanında ilerlemelisin.';
    else if (!document.tasks.length && rank.taskCount > 0) status = 'Yetki atlaman için görev almalısın.';
    else if (complatedTasks > rank.taskCount)
        status = `Seçtiğin görevlerin [2;36m${rank.taskCount - complatedTasks}[0m adetini tamamlaman gerekiyor.`;
    else if (rank.roleTime && rank.roleTime > needRoleTime)
        status = `Yetki atlaman için şuanki rolünde [2;36m${needRoleTime}[0m gün daha durmalısın.`;
    return codeBlock('ansi', `[2;35m[1;35m${status}[0m[2;35m[0m`);
}
