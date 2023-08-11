import { StaffModel } from '@/models';
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    ComponentType,
    EmbedBuilder,
    PermissionFlagsBits,
    TextChannel,
    inlineCode,
    time,
    userMention,
} from 'discord.js';

const Command: Point.ICommand = {
    usages: ['meeting', 'toplantı'],
    checkPermission: ({ message }) => message.member.permissions.has(PermissionFlagsBits.Administrator),
    execute: async ({ client, message, guildData }) => {
        if (!message.guild.roles.cache.has(guildData.meetingRole)) {
            client.utils.sendTimedMessage(message, 'Rol ayarlanmamış');
            return;
        }

        if (!message.member.voice.channelId) {
            client.utils.sendTimedMessage(message, 'Bir ses kanalına katılıp kullanman lazım!');
            return;
        }

        const buttonRow = new ActionRowBuilder<ButtonBuilder>({
            components: [
                new ButtonBuilder({
                    custom_id: 'general',
                    label: 'Genel Toplantı',
                    style: ButtonStyle.Primary,
                }),
                new ButtonBuilder({
                    custom_id: 'personal',
                    label: 'Bireysel Toplantı',
                    style: ButtonStyle.Primary,
                }),
                new ButtonBuilder({
                    custom_id: 'role',
                    label: 'Rol Toplantısı',
                    style: ButtonStyle.Primary,
                }),
            ],
        });

        const question = await message.channel.send({
            content: 'Yapacağınız toplantı işlemi seçin.',
            components: [buttonRow],
        });

        const filter = (i: ButtonInteraction) => i.user.id === message.author.id;
        const collected = await question.awaitMessageComponent({
            filter,
            componentType: ComponentType.Button,
        });
        if (collected) {
            const meetingLog = message.guild.channels.cache.find(
                (channel) => channel.name === 'meeting-log',
            ) as TextChannel;
            const channel = message.member.voice.channel;
            const staffMembers = channel.members.filter((m) => client.utils.checkStaff(m, guildData)).map((m) => m.id);

            if (collected.customId === 'general') {
                if (guildData.meetingRole && message.guild.roles.cache.has(guildData.meetingRole)) {
                    message.guild.members.cache
                        .filter(
                            (member) =>
                                !channel.members.has(member.id) && member.roles.cache.has(guildData.meetingRole),
                        )
                        .forEach((member) => member.roles.remove(guildData.meetingRole));
                    channel.members
                        .filter((member) => !member.user.bot && !member.roles.cache.has(guildData.meetingRole))
                        .forEach((member) => member.roles.add(guildData.meetingRole));
                }

                question.edit({
                    embeds: [
                        new EmbedBuilder({
                            color: client.utils.getRandomColor(),
                            author: {
                                name: message.author.username,
                                icon_url: message.author.displayAvatarURL({ forceStatic: true, size: 4096 }),
                            },
                            description: `${channel} odasındaki üyelere toplantıya katıldı rolü verildi. ${client.utils.getEmoji(
                                'greentick',
                            )}`,
                        }),
                    ],
                    components: [],
                });

                if (meetingLog) {
                    const arr = client.utils.splitMessage(
                        [
                            `${time(Math.floor(Date.now() / 1000), 'D')} tarihinde yapılan toplantıya ${inlineCode(
                                channel.members.size.toString(),
                            )} adet üye katıldı. Katılan üyeler;\n`,
                            channel.members.map((member) => `${member} (${inlineCode(member.id)})`).join('\n'),
                        ].join('\n'),
                        { maxLength: 2000, char: ',' },
                    );
                    for (const newText of arr) meetingLog.send({ content: newText });
                }

                if (staffMembers.length) {
                    await StaffModel.updateMany(
                        { id: { $in: staffMembers }, guild: message.guildId, inGeneralMeeting: false },
                        {
                            $set: { inGeneralMeeting: true },
                            $inc: { allPoints: guildData.meetingPoint, totalPoints: guildData.meetingPoint },
                        },
                        { upsert: true },
                    );

                    await StaffModel.updateMany(
                        { id: { $nin: staffMembers }, guild: message.guildId, inPersonalMeeting: true },
                        { $set: { inGeneralMeeting: false } },
                    );
                }
            } else if (collected.customId === 'personal') {
                if (!staffMembers.length) {
                    question.edit({
                        content: 'Seste yetkili bulunmuyor.',
                        components: [],
                    });
                    return;
                }

                if (staffMembers.length > 3) {
                    question.edit({
                        content: 'Bireysel toplantı mı yapıyorsun yoksa genel toplantı mı?!',
                        components: [],
                    });
                    return;
                }

                const staffDocument = await StaffModel.findOne({ id: staffMembers[0], guild: message.guildId });
                if (staffDocument.inPersonalMeeting) {
                    question.edit({
                        content: 'Kullanıcının bireysel toplantısı yapılmış zaten.',
                        components: [],
                    });
                    return;
                }

                question.edit({
                    content: `${userMention(staffMembers[0])} adlı kullanıcının bireysel toplantısı yapıldı.`,
                    components: [],
                });

                if (meetingLog) {
                    meetingLog.send({
                        content: `${time(Math.floor(Date.now() / 1000), 'D')} tarihinde ${userMention(
                            staffMembers[0],
                        )} (${inlineCode(staffMembers[0])}) adlı yetkiliyle ${message.author} (${inlineCode(
                            message.author.id,
                        )}) adlı yetkili bireysel toplantı yaptı.`,
                    });
                }

                await StaffModel.updateMany(
                    { id: staffMembers[0], guild: message.guildId },
                    {
                        $set: { inPersonalMeeting: true },
                        $inc: { allPoints: guildData.meetingPoint, totalPoints: guildData.meetingPoint },
                    },
                    { upsert: true },
                );
            } else {
                question.edit({
                    embeds: [
                        new EmbedBuilder({
                            color: client.utils.getRandomColor(),
                            author: {
                                name: message.author.username,
                                icon_url: message.author.displayAvatarURL({ forceStatic: true, size: 4096 }),
                            },
                            description: `${channel} odasındaki üyelere puanları verildi. ${client.utils.getEmoji(
                                'greentick',
                            )}`,
                        }),
                    ],
                    components: [],
                });

                if (meetingLog) {
                    const arr = client.utils.splitMessage(
                        [
                            `${time(
                                Math.floor(Date.now() / 1000),
                                'D',
                            )} tarihinde yapılan rol toplantısına ${inlineCode(
                                channel.members.size.toString(),
                            )} adet üye katıldı. Katılan üyeler;\n`,
                            channel.members.map((member) => `${member} (${inlineCode(member.id)})`).join('\n'),
                        ].join('\n'),
                        { maxLength: 2000, char: ',' },
                    );
                    for (const newText of arr) meetingLog.send({ content: newText });
                }

                if (staffMembers.length) {
                    await StaffModel.updateMany(
                        { id: { $in: staffMembers }, guild: message.guildId, inRoleMeeting: false },
                        {
                            $set: { inRoleMeeting: true },
                            $inc: { allPoints: guildData.meetingPoint, totalPoints: guildData.meetingPoint },
                        },
                        { upsert: true },
                    );

                    await StaffModel.updateMany(
                        { id: { $nin: staffMembers }, guild: message.guildId, inRoleMeeting: true },
                        { $set: { inRoleMeeting: false } },
                    );
                }
            }
        } else {
            const timeFinished = new ActionRowBuilder<ButtonBuilder>({
                components: [
                    new ButtonBuilder({
                        custom_id: 'finished',
                        emoji: { name: '⏱️' },
                        label: 'Mesajın Kullanım Süresi Doldu.',
                        disabled: true,
                        style: ButtonStyle.Danger,
                    }),
                ],
            });
            question.edit({ components: [timeFinished] });
        }
    },
};

export default Command;
