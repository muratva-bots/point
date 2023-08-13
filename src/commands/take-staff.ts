import { StaffTakeFlags, TaskFlags } from '@/enums';
import { StaffModel } from '@/models';
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    ComponentType,
    EmbedBuilder,
    EmbedField,
    TextChannel,
    inlineCode,
    roleMention,
    time,
    userMention,
} from 'discord.js';

const titles = {
    [StaffTakeFlags.Start]: 'Yeni Yetkili',
    [StaffTakeFlags.Up]: 'Yetki Yükseltme',
    [StaffTakeFlags.Down]: 'Yetki Düşürme',
};

const Command: Point.ICommand = {
    usages: ['yetkili-al', 'yver', 'y-ver', 'yetkiver', 'yetki-ver', 'yetki'],
    checkPermission: ({ message, guildData }) => {
        const minStaffRole = message.guild.roles.cache.get(guildData.minStaffRole);
        return minStaffRole && message.member.roles.highest.position >= minStaffRole.position;
    },
    execute: async ({ client, message, args, guildData }) => {
        const minStaffRole = message.guild.roles.cache.get(guildData.minStaffRole);
        if (!minStaffRole) {
            message.channel.send('En alt yetkili rolü ayarlanmamış.');
            return;
        }

        if (!guildData.ranks.length) {
            message.channel.send('Rol ayarları yapılmamış');
            return;
        }

        const member =
            (await client.utils.getMember(message.guild, args[0])) ||
            (message.reference ? (await message.fetchReference()).member : undefined);
        if (!member) {
            client.utils.sendTimedMessage(message, 'Geçerli bir kullanıcı belirt!');
            return;
        }

        const now = Date.now();
        const sortedRanks = guildData.ranks.sort((a, b) => a.point - b.point);
        const embed = new EmbedBuilder({ color: client.utils.getRandomColor() });
        const timeFinished = new ActionRowBuilder<ButtonBuilder>({
            components: [
                new ButtonBuilder({
                    custom_id: 'finished',
                    disabled: true,
                    emoji: { name: '⏱️' },
                    label: 'Mesajın Kullanım Süresi Doldu.',
                }),
            ],
        });

        if (member.roles.highest.position > minStaffRole.position) {
            if (!client.utils.checkStaff(member, guildData)) {
                client.utils.sendTimedMessage(message, 'Belirttiğin kullanıcı üst yetkili kurucularla konuşmalısın.');
                return;
            }

            if (client.utils.checkUser(message, member)) return;

            const currentIndex = sortedRanks.findIndex((r) => member.roles.cache.has(r.role));

            const buttonRow = new ActionRowBuilder<ButtonBuilder>({
                components: [
                    new ButtonBuilder({
                        custom_id: 'up',
                        disabled: currentIndex + 1 === guildData.ranks.length,
                        label: 'Yükselt',
                        style: ButtonStyle.Success,
                    }),
                    new ButtonBuilder({
                        custom_id: 'down',
                        disabled: currentIndex === 0,
                        label: 'Düşür',
                        style: ButtonStyle.Success,
                    }),
                ],
            });

            const question = await message.channel.send({
                embeds: [
                    embed.setDescription(
                        `${member} (${inlineCode(member.id)}) adlı kullanıcıya yapacağınız yetki işlemini seçin.`,
                    ),
                ],
                components: [buttonRow],
            });

            const filter = (i: ButtonInteraction) => i.user.id === message.author.id;
            const collected = await question.awaitMessageComponent({
                filter,
                time: 1000 * 60 * 3,
                componentType: ComponentType.Button,
            });
            if (collected) {
                const newRank = sortedRanks[currentIndex + (collected.customId === 'up' ? 1 : -1)];
                if (!member.roles.cache.has(sortedRanks[currentIndex].role)) member.roles.remove(sortedRanks[currentIndex].role);
                if (!member.roles.cache.has(newRank.role)) member.roles.add([newRank.role]);

                await StaffModel.updateOne(
                    { id: member.id, guild: message.guildId },
                    {
                        $set: {
                            pointsRating: client.utils.pointsRating(message.guild, newRank),
                            bonusPoints: 0,
                            inviteUsers: [],
                            messagePoints: 0,
                            publicPoints: 0,
                            registerPoints: 0,
                            responsibilityPoints: 0,
                            sleepPoints: 0,
                            totalPoints: 0,
                            inGeneralMeeting: false,
                            inPersonalMeeting: false,
                            roleStartTime: now,
                            staffTakes: [],
                            problemResolves: [],
                            tasks: [],
                            bonusLogs: [],
                        },
                        $push: {
                            oldRoles: {
                                startTimestamp: now,
                                admin: message.author.id,
                                role: newRank.role,
                                type: collected.customId === 'up' ? StaffTakeFlags.Up : StaffTakeFlags.Down,
                            },
                        },
                    },
                    { upsert: true, setDefaultsOnInsert: true },
                );

                const defaultMessage = `${roleMention(sortedRanks[currentIndex].role)} ${inlineCode(
                    sortedRanks[currentIndex].role,
                )} rolünden ${roleMention(newRank.role)} (${inlineCode(newRank.role)}) rolüne ${
                    collected.customId === 'up' ? 'yükseltildi' : 'düşürüldü'
                }`;

                question.edit({
                    embeds: [
                        embed.setDescription(
                            `${member} (${inlineCode(member.id)}) adlı kullanıcı başarıyla ${defaultMessage}`,
                        ),
                    ],
                    components: [],
                });

                const channel = message.guild.channels.cache.find((c) => c.name === 'staff-logs') as TextChannel;
                if (channel) {
                    channel.send({
                        embeds: [
                            new EmbedBuilder({
                                color: client.utils.getRandomColor(),
                                description: `${member} (${inlineCode(member.id)}) adlı kullanıcı ${message.author} (${
                                    message.author.id
                                }) tarafından ${defaultMessage}!`,
                            }),
                        ],
                    });
                }
            } else question.edit({ components: [timeFinished] });
            return;
        }

        const staffDocument = await StaffModel.findOne({ id: member.id, guild: message.guildId });

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

        const question = await message.channel.send({
            content: member.toString(),
            embeds: [
                embed
                    .setDescription(
                        `${message.author} (${inlineCode(
                            message.author.id,
                        )}) adlı yetkili seni yetkili olarak almak istiyor, onaylıyor musun?`,
                    )
                    .setFields(
                        [
                            staffDocument && staffDocument.oldRoles.length
                                ? ({
                                      name: 'Eski Rolleri:',
                                      value: staffDocument.oldRoles
                                          .map((o) =>
                                              [
                                                  `Yetkili: ${
                                                      o.admin === '?'
                                                          ? 'Bilinmiyor.'
                                                          : `${userMention(o.admin)} (${inlineCode(o.admin)})`
                                                  }`,
                                                  `İşlem: ${titles[o.type]}`,
                                                  `Rol: ${roleMention(o.role)} (${inlineCode(o.role)})`,
                                                  `Yetkiye Başlama: ${time(
                                                      Math.floor(o.startTimestamp / 1000),
                                                      'D',
                                                  )} (${time(Math.floor(o.startTimestamp / 1000), 'R')})`,
                                                  o.finishTimestamp ? `Yetki Bitiş: ${time(
                                                      Math.floor(o.finishTimestamp / 1000),
                                                      'D',
                                                  )} (${time(Math.floor(o.finishTimestamp / 1000), 'R')})` : undefined,
                                              ].filter(Boolean).join('\n'),
                                          )
                                          .join('\n\n'),
                                      inline: false,
                                  } as EmbedField)
                                : undefined,
                        ].filter(Boolean),
                    ),
            ],
            components: [buttonRow],
        });

        const filter = (i: ButtonInteraction) => i.user.id === member.id;
        const collected = await question.awaitMessageComponent({
            filter,
            time: 1000 * 60 * 3,
            componentType: ComponentType.Button,
        });
        if (collected) {
            embed.setFields([]);
            if (collected.customId === 'deaccept') {
                question.edit({
                    content: '',
                    embeds: [
                        embed.setDescription(
                            `${member} (${inlineCode(member.id)}) adlı kullanıcı ${message.author} (${inlineCode(
                                message.author.id,
                            )}) adlı kullanıcının yetkili olma teklifini red etti.`,
                        ),
                    ],
                    components: [],
                });
                return;
            }

            const authorDocument = await StaffModel.findOneAndUpdate(
                { id: message.author.id, guild: message.guildId },
                { $push: { staffTakes: { user: member.id, time: now, role: sortedRanks[0].role } } },
                { upsert: true, setDefaultsOnInsert: true },
            );

            const task = authorDocument.tasks.find((t) => t.type === TaskFlags.Staff);
            if (task) {
                task.currentCount = task.currentCount + 1;
                if (task.currentCount >= task.count) task.currentCount = task.count;
                task.completed = task.currentCount >= task.count;
                authorDocument.markModified('tasks');
                await authorDocument.save();
            }

            await StaffModel.updateOne(
                { id: member.id, guild: message.guildId },
                {
                    $set: {
                        pointsRating: client.utils.pointsRating(message.guild, sortedRanks[0]),
                        bonusPoints: 0,
                        inviteUsers: [],
                        messagePoints: 0,
                        publicPoints: 0,
                        registerPoints: 0,
                        responsibilityPoints: 0,
                        sleepPoints: 0,
                        totalPoints: 0,
                        inGeneralMeeting: false,
                        inPersonalMeeting: false,
                        roleStartTime: now,
                        staffTakes: [],
                        problemResolves: [],
                        tasks: [],
                    },
                    $push: {
                        oldRoles: {
                            startTimestamp: now,
                            admin: message.author.id,
                            role: sortedRanks[0].role,
                            type: StaffTakeFlags.Start,
                        },
                    },
                },
                { upsert: true, setDefaultsOnInsert: true },
            );

            member.roles.add([sortedRanks[0].role, guildData.minStaffRole]);

            question.edit({
                content: '',
                embeds: [
                    embed.setDescription(
                        `${member} (${inlineCode(member.id)}) adlı kullanıcı ${message.author} (${inlineCode(
                            message.author.id,
                        )}) adlı kullanıcının yetkili olma teklifini kabul etti.`,
                    ),
                ],
                components: [],
            });

            const channel = message.guild.channels.cache.find((c) => c.name === 'staff-logs') as TextChannel;
            if (channel) {
                channel.send({
                    embeds: [
                        new EmbedBuilder({
                            color: client.utils.getRandomColor(),
                            description: `${member} (${inlineCode(member.id)}) adlı kullanıcı ${message.author} (${
                                message.author.id
                            }) tarafından yetkiye başlatıldı!`,
                        }),
                    ],
                });
            }
        } else question.edit({ components: [timeFinished] });
    },
};

export default Command;
