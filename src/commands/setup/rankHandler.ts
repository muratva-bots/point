import { GuildModel, IRank, PointClass } from '@/models';
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    Interaction,
    Message,
    ModalBuilder,
    RoleSelectMenuBuilder,
    StringSelectMenuBuilder,
    TextInputBuilder,
    TextInputStyle,
    bold,
    inlineCode,
    roleMention,
} from 'discord.js';
import mainHandler from './mainHandler';
import { Client } from '@/structures';
import ms from 'ms';

export async function rankHandler(client: Client, message: Message, guildData: PointClass, question: Message) {
    await question.edit({
        content: '',
        components: createRow(message, guildData.ranks),
    });

    const filter = (i: Interaction) => i.user.id === message.author.id;
    const collector = await question.createMessageComponentCollector({
        filter,
        time: 1000 * 60 * 10,
    });

    collector.on('collect', async (i: Interaction) => {
        if (i.isButton() && i.customId === 'back') {
            collector.stop('FINISH');
            i.deferUpdate();
            mainHandler(client, message, guildData, question);
            return;
        }

        if (i.isButton() && i.customId === 'add') {
            const roleRow = new ActionRowBuilder<RoleSelectMenuBuilder>({
                components: [
                    new RoleSelectMenuBuilder({
                        custom_id: 'role',
                        placeholder: 'Rol ara..',
                    }),
                ],
            });
            i.reply({
                content: 'Yetkili rolünü seçin.',
                components: [roleRow],
                ephemeral: true,
            });

            const interactionMessage = await i.fetchReply();
            const roleCollected = await interactionMessage.awaitMessageComponent({
                time: 1000 * 60 * 10,
                componentType: ComponentType.RoleSelect,
            });
            if (roleCollected) {
                roleCollected.deferUpdate();

                const extraRoleRow = new ActionRowBuilder<RoleSelectMenuBuilder>({
                    components: [
                        new RoleSelectMenuBuilder({
                            custom_id: 'extra-role',
                            placeholder: 'Rol ara..',
                        }),
                    ],
                });

                const skipRow = new ActionRowBuilder<ButtonBuilder>({
                    components: [
                        new ButtonBuilder({
                            custom_id: 'skip',
                            label: 'Geç',
                            style: ButtonStyle.Success,
                        }),
                    ],
                });

                i.editReply({
                    content: 'Ekstra rolünü seçin. (Ceo, Co-Ceo vb.)',
                    components: [extraRoleRow, skipRow],
                });

                const extraRoleCollected = await interactionMessage.awaitMessageComponent({ time: 1000 * 60 * 10 });
                if (extraRoleCollected) {
                    const extraRole = extraRoleCollected.isStringSelectMenu()
                        ? extraRoleCollected.values[0]
                        : undefined;

                    const pointRow = new ActionRowBuilder<TextInputBuilder>({
                        components: [
                            new TextInputBuilder({
                                custom_id: 'point',
                                placeholder: '10000',
                                label: 'Puan:',
                                style: TextInputStyle.Short,
                                required: true,
                            }),
                        ],
                    });

                    const taskCountRow = new ActionRowBuilder<TextInputBuilder>({
                        components: [
                            new TextInputBuilder({
                                custom_id: 'task-count',
                                placeholder: 'Varsa eğer sayı yoksa 0 yaz geç.',
                                label: 'Görev Sayısı:',
                                style: TextInputStyle.Short,
                                required: true,
                            }),
                        ],
                    });

                    const roleTimeRow = new ActionRowBuilder<TextInputBuilder>({
                        components: [
                            new TextInputBuilder({
                                custom_id: 'role-time',
                                placeholder: '7d',
                                label: 'Gün:',
                                style: TextInputStyle.Short,
                                required: true,
                            }),
                        ],
                    });

                    const maxSleepRow = new ActionRowBuilder<TextInputBuilder>({
                        components: [
                            new TextInputBuilder({
                                custom_id: 'max-sleep',
                                placeholder: '10000',
                                label: 'Max Sleep Puan:',
                                style: TextInputStyle.Short,
                                required: true,
                            }),
                        ],
                    });

                    const modal = new ModalBuilder({
                        custom_id: 'modal',
                        title: 'Rol Ayarları',
                        components: [pointRow, taskCountRow, roleTimeRow, maxSleepRow],
                    });

                    await extraRoleCollected.showModal(modal);

                    const modalCollected = await extraRoleCollected.awaitModalSubmit({
                        time: 1000 * 60 * 3,
                    });
                    if (modalCollected) {
                        modalCollected.deferUpdate();

                        const point = Number(modalCollected.fields.getTextInputValue('point'));
                        if (!point) {
                            i.editReply({
                                content: 'Puan sayı olmak zorundadır.',
                                components: [],
                            });
                            return;
                        }

                        const taskCount = Number(modalCollected.fields.getTextInputValue('task-count'));
                        if (!taskCount && taskCount !== 0) {
                            i.editReply({
                                content: 'Görev sayısı sayı olmak zorundadır.',
                                components: [],
                            });
                            return;
                        }

                        const roleTime = ms(modalCollected.fields.getTextInputValue('role-time'));
                        if (!roleTime) {
                            i.editReply({
                                content: 'Rol süresi zaman biçiminde olmak zorundadır.',
                                components: [],
                            });
                            return;
                        }

                        const maxSleep = Number(modalCollected.fields.getTextInputValue('max-sleep'));
                        if (!maxSleep) {
                            i.editReply({
                                content: 'Max sleep puanı sayı olmak zorundadır.',
                                components: [],
                            });
                            return;
                        }

                        const roleTimeDays = roleTime / (1000 * 60 * 60 * 24);
                        guildData.ranks = [
                            ...(guildData.ranks || []),
                            {
                                maxSleep: maxSleep,
                                point: point,
                                role: roleCollected.values[0],
                                extraRole: extraRole,
                                roleTime: roleTimeDays,
                                taskCount: taskCount,
                            },
                        ];

                        await GuildModel.updateOne(
                            { id: question.guildId },
                            { $set: { 'point.ranks': guildData.ranks } },
                            { upsert: true, setDefaultsOnInsert: true },
                        );

                        question.edit({
                            components: createRow(question, guildData.ranks),
                        });

                        i.editReply({
                            content: `${roleMention(roleCollected.values[0])} (${inlineCode(
                                roleCollected.values[0],
                            )}) rolü ayarlandı.`,
                            components: [],
                        });
                    } else i.deleteReply();
                } else i.deleteReply();
            } else i.deleteReply();
        }

        if (i.isStringSelectMenu()) {
            const newData = (guildData.ranks || []) as IRank[];
            guildData.ranks = newData.filter((d) => !i.values.includes(d.role));

            await GuildModel.updateOne({ id: message.guildId }, { $set: { 'point.ranks': guildData.ranks } });

            i.reply({
                content: `Başarıyla ${i.values
                    .map((r) => `${roleMention(r)} (${inlineCode(r)})`)
                    .join(', ')} adlı ayardan kaldırıldı.`,
                ephemeral: true,
            });

            question.edit({
                components: createRow(message, guildData.ranks),
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
}

function createRow(message: Message, ranks: IRank[]) {
    const datas = (ranks || []).filter((r) => message.guild.roles.cache.has(r.role));
    return [
        new ActionRowBuilder<StringSelectMenuBuilder>({
            components: [
                new StringSelectMenuBuilder({
                    custom_id: 'data',
                    disabled: !datas.length,
                    placeholder: 'Yetkili Rolleri',
                    max_values: datas.length === 0 ? 1 : datas.length,
                    options: datas.length
                        ? datas.map((r) => ({
                              label: message.guild.roles.cache.get(r.role).name,
                              value: r.role,
                              description: `${r.point} puan - ${r.maxSleep} max sleep - ${r.taskCount} görev - ${r.roleTime} gün`,
                          }))
                        : [{ label: 'test', value: 'a' }],
                }),
            ],
        }),
        new ActionRowBuilder<ButtonBuilder>({
            components: [
                new ButtonBuilder({
                    custom_id: 'back',
                    label: 'Geri',
                    style: ButtonStyle.Danger,
                }),
                new ButtonBuilder({
                    custom_id: 'add',
                    label: 'Ekle',
                    style: ButtonStyle.Success,
                }),
            ],
        }),
    ];
}
