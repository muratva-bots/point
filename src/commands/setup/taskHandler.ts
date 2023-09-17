import { GuildModel, IGuildTask, IResponsibilityChannel, PointClass } from '@/models';
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    ChannelSelectMenuBuilder,
    ChannelSelectMenuInteraction,
    ChannelType,
    ComponentType,
    Interaction,
    Message,
    ModalBuilder,
    RoleSelectMenuBuilder,
    RoleSelectMenuInteraction,
    StringSelectMenuBuilder,
    StringSelectMenuInteraction,
    TextInputBuilder,
    TextInputStyle,
    inlineCode,
    roleMention,
} from 'discord.js';
import mainHandler from './mainHandler';
import { Client } from '@/structures';
import { TaskFlags } from '@/enums';

export async function taskHandler(client: Client, message: Message, guildData: PointClass, question: Message) {
    await question.edit({
        content: '',
        components: createRow(client, message, guildData.tasks),
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

            const skipRow = new ActionRowBuilder<ButtonBuilder>({
                components: [
                    new ButtonBuilder({
                        custom_id: 'skip',
                        label: 'Geç',
                        style: ButtonStyle.Success,
                    }),
                ],
            });

            i.reply({
                content: 'Yetkili rolünü seçin. Herkese verilecek bir görev ise geç butonuna bas.',
                components: [roleRow, skipRow],
                ephemeral: true,
            });

            const interactionMessage = await i.fetchReply();
            const roleCollected = await interactionMessage.awaitMessageComponent({
                time: 1000 * 60 * 10,
            });
            if (roleCollected) {
                roleCollected.deferUpdate();

                const typeRow = new ActionRowBuilder<StringSelectMenuBuilder>({
                    components: [
                        new StringSelectMenuBuilder({
                            custom_id: 'type',
                            placeholder: 'Türü seçin.',
                            options: [
                                { label: 'Davet', value: 'invite' },
                                { label: 'Ses', value: 'voice' },
                                { label: 'Mesaj', value: 'message' },
                                { label: 'Taglı', value: 'tagged' },
                                { label: 'Yetkili', value: 'staff' },
                                { label: 'Kayıt', value: 'register' },
                            ],
                        }),
                    ],
                });

                i.editReply({
                    content: 'Türü seçin.',
                    components: [typeRow],
                });

                const typeCollected = await interactionMessage.awaitMessageComponent({
                    time: 1000 * 60 * 10,
                    componentType: ComponentType.StringSelect,
                });
                if (typeCollected) {
                    if (typeCollected.values[0] === 'voice') {
                        typeCollected.deferUpdate();

                        const channelRow = new ActionRowBuilder<ChannelSelectMenuBuilder>({
                            components: [
                                new ChannelSelectMenuBuilder({
                                    custom_id: "channel",
                                    channel_types: [ChannelType.GuildVoice, ChannelType.GuildCategory],
                                }),
                            ],
                        });

                        i.editReply({
                            content: 'Kanalı belirt.',
                            components: [channelRow],
                        });

                        const channelCollected = await interactionMessage.awaitMessageComponent({
                            time: 1000 * 60 * 2,
                            componentType: ComponentType.ChannelSelect,
                        });
                        if (channelCollected)
                            createModal(
                                client,
                                i,
                                channelCollected,
                                roleCollected as any,
                                typeCollected,
                                guildData,
                                question,
                                channelCollected.values[0],
                            );
                        else i.deleteReply();
                    } else createModal(client, i, typeCollected, roleCollected as any, typeCollected, guildData, question);
                } else i.deleteReply();
            } else i.deleteReply();
        }

        if (i.isStringSelectMenu()) {
            const newData = (guildData.responsibilityChannels || []) as IResponsibilityChannel[];
            guildData.responsibilityChannels = newData.filter((d) => !i.values.includes(d.role));

            await GuildModel.updateOne(
                { id: message.guildId },
                { $set: { 'point.responsibilityChannels': guildData.responsibilityChannels } },
            );

            i.reply({
                content: `Başarıyla ${i.values
                    .map((r) => `${roleMention(r)} (${inlineCode(r)})`)
                    .join(', ')} adlı ayardan kaldırıldı.`,
                ephemeral: true,
            });

            question.edit({
                components: createRow(client, message, guildData.tasks),
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

function createRow(client: Client, message: Message, responsibilityChannels: IGuildTask[]) {
    const datas = (responsibilityChannels || []).filter((r) => message.guild.roles.cache.has(r.role));
    return [
        new ActionRowBuilder<StringSelectMenuBuilder>({
            components: [
                new StringSelectMenuBuilder({
                    custom_id: 'data',
                    disabled: !datas.length,
                    placeholder: 'Görevler',
                    max_values: datas.length === 0 ? 1 : datas.length,
                    options: datas.length
                        ? datas.map((r) => ({
                              label: message.guild.roles.cache.get(r.role).name,
                              value: r.role,
                              description: r.type === TaskFlags.Voice ? client.utils.numberToString(r.count) : `${r.count}`,
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

const types = {
    message: TaskFlags.Message,
    voice: TaskFlags.Voice,
    invite: TaskFlags.Invite,
    staff: TaskFlags.Staff,
    tagged: TaskFlags.Tagged,
    register: TaskFlags.Register
};

async function createModal(
    client: Client,
    mainInteraction: ButtonInteraction,
    interaction: ChannelSelectMenuInteraction | StringSelectMenuInteraction,
    roleCollected: RoleSelectMenuInteraction | ButtonInteraction,
    typeCollected: StringSelectMenuInteraction,
    guildData: PointClass,
    question: Message,
    channel?: string,
) {
    const titleRow = new ActionRowBuilder<TextInputBuilder>({
        components: [
            new TextInputBuilder({
                custom_id: 'title',
                placeholder: 'Kayıt Görevi (Sorumluluk)',
                label: 'Görev Adı:',
                style: TextInputStyle.Short,
                required: true,
            }),
        ],
    });

    const countRow = new ActionRowBuilder<TextInputBuilder>({
        components: [
            new TextInputBuilder({
                custom_id: 'count',
                placeholder: '10',
                label: typeCollected.values[0] === "voice" ? 'Saat:' : 'Sayı:',
                style: TextInputStyle.Short,
                required: true,
            }),
        ],
    });

    const descriptionRow = new ActionRowBuilder<TextInputBuilder>({
        components: [
            new TextInputBuilder({
                custom_id: 'description',
                placeholder: 'Sunucumuza 10 adet yeni hesap olmayan kullanıcı çekmelisin.',
                label: 'Açıklama:',
                style: TextInputStyle.Short,
                required: true,
            }),
        ],
    });

    const modal = new ModalBuilder({
        custom_id: 'modal',
        title: 'Görev Ekleme',
        components: [titleRow, descriptionRow, countRow],
    });

    await interaction.showModal(modal);

    const modalCollected = await interaction.awaitModalSubmit({
        time: 1000 * 60 * 3,
    });
    if (modalCollected) {
        modalCollected.deferUpdate();

        const count = Number(modalCollected.fields.getTextInputValue('count'));
        if (!count) {
            mainInteraction.editReply({
                content: 'Sayı sayı olmak zorundadır.',
                components: [],
            });
            return;
        }

        guildData.tasks = [
            ...(guildData.tasks || []),
            {
                channel: channel,
                count: typeCollected.values[0] === "voice" ? 1000 * 60 * count : count,
                type: types[typeCollected.values[0]],
                title: modalCollected.fields.getTextInputValue('title'),
                role: roleCollected.isButton() ? undefined : roleCollected.values[0],
                isGeneral: roleCollected.isButton(),
                description: modalCollected.fields.getTextInputValue('description')
            },
        ];

        await GuildModel.updateOne(
            { id: question.guildId },
            { $set: { 'point.tasks': guildData.tasks } },
            { upsert: true, setDefaultsOnInsert: true },
        );

        question.edit({
            components: createRow(client, question, guildData.tasks),
        });

        mainInteraction.editReply({
            content: `${
                roleCollected.isButton()
                    ? 'Herkese göre rol'
                    : `${roleMention(roleCollected.values[0])} (${inlineCode(roleCollected.values[0])}) rolü`
            } ayarlandı.`,
            components: [],
        });
    }
}
