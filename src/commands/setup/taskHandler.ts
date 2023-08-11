import { GuildModel, IResponsibilityChannel, PointClass } from "@/models";
import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChannelSelectMenuBuilder, ChannelSelectMenuInteraction, ChannelType, ComponentType, Interaction, Message, ModalBuilder, RoleSelectMenuBuilder, RoleSelectMenuInteraction, StringSelectMenuBuilder, StringSelectMenuInteraction, TextInputBuilder, TextInputStyle, bold, inlineCode, roleMention } from "discord.js";
import mainHandler from "./mainHandler";
import { Client } from "@/structures";

export async function taskHandler(
    client: Client,
    message: Message,
    guildData: PointClass,
    question: Message,
) {
    await question.edit({
        content: '',
        components: createRow(message, guildData.responsibilityChannels),
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

        if (i.isButton() && i.customId === "add") {
            const roleRow = new ActionRowBuilder<RoleSelectMenuBuilder>({
                components: [
                    new RoleSelectMenuBuilder({
                        custom_id: "role",
                        placeholder: "Rol ara.."
                    })
                ]
            })
            i.reply({
                content: "Yetkili rolünü seçin.",
                components: [roleRow],
                ephemeral: true
            });

            const interactionMessage = await i.fetchReply();
            const roleCollected = await interactionMessage.awaitMessageComponent({
                time: 1000 * 60 * 10,
                componentType: ComponentType.RoleSelect,
            });
            if (roleCollected) {
                roleCollected.deferUpdate();

                const typeRow = new ActionRowBuilder<StringSelectMenuBuilder>({
                    components: [
                        new StringSelectMenuBuilder({
                            custom_id: "type",
                            placeholder: "Türü seçin.",
                            options: [
                                { label: "Davet", value: "invite" },
                                { label: "Ses", value: "voice" },
                                { label: "Genel", value: "general" },
                            ]
                        })
                    ]
                });

                i.editReply({
                    content: "Türü seçin.",
                    components: [typeRow]
                });

                const typeCollected = await interactionMessage.awaitMessageComponent({ 
                    time: 1000 * 60 * 10, 
                    componentType: ComponentType.StringSelect 
                });
                if (typeCollected) {
                    if (typeCollected.values[0] === "voice") {
                        const channelRow = new ActionRowBuilder<ChannelSelectMenuBuilder>({
                            components: [
                                new ChannelSelectMenuBuilder({
                                    channel_types: [ChannelType.GuildVoice]
                                })
                            ]
                        })
    
                        i.editReply({
                            content: "Kanalı belirt.",
                            components: [channelRow]
                        })

                        const channelCollected = await interactionMessage.awaitMessageComponent({ 
                            time: 1000 * 60 *2,
                            componentType: ComponentType.ChannelSelect
                        });
                        if (channelCollected) createModal(i, typeCollected, roleCollected, typeCollected, guildData, channelCollected.values[0]);
                        else i.deleteReply();
                    } else createModal(i, typeCollected, roleCollected, typeCollected, guildData);
                } else i.deleteReply();
            } else i.deleteReply();
        }

        if (i.isStringSelectMenu()) {
            const newData = (guildData.responsibilityChannels || []) as IResponsibilityChannel[];
            guildData.responsibilityChannels = newData.filter((d) => !i.values.includes(d.role));

            await GuildModel.updateOne(
                { id: message.guildId },
                { $set: { 'point.ranks': guildData.responsibilityChannel }, },
            );

            i.reply({
                content: `Başarıyla ${i.values.map(r => `${roleMention(r)} (${inlineCode(r)})`).join(", ")} adlı ayardan kaldırıldı.`,
                ephemeral: true,
            });

            question.edit({
                components: createRow(message, guildData.responsibilityChannels),
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

function createRow(message: Message, responsibilityChannels: IResponsibilityChannel[]) {
    const datas = (responsibilityChannels || []).filter((r) => message.guild.roles.cache.has(r.role));
    return [
        new ActionRowBuilder<StringSelectMenuBuilder>({
            components: [
                new StringSelectMenuBuilder({
                    custom_id: 'data',
                    disabled: !datas.length,
                    placeholder: "Kanala Özel Puan",
                    max_values: datas.length === 0 ? 1 : datas.length,
                    options: datas.length
                        ? datas.map((r) => ({
                            label: message.guild.roles.cache.get(r.role).name,
                            value: r.role,
                            description: `${r.point} puan - ${message.guild.channels.cache.get(r.id)?.name || "silinmiş kanal"}`,
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

async function createModal(
    mainInteraction: ButtonInteraction, 
    interaction: ChannelSelectMenuInteraction | StringSelectMenuInteraction,
    roleCollected: RoleSelectMenuInteraction,
    typeCollected: StringSelectMenuInteraction,
    guildData: PointClass,
    channel?: string
) {
    const pointRow = new ActionRowBuilder<TextInputBuilder>({
        components: [
            new TextInputBuilder({
                custom_id: "point",
                placeholder: "10000",
                label: "Puan:",
                style: TextInputStyle.Short,
                required: true
            })
        ]
    });

    const titleRow = new ActionRowBuilder<TextInputBuilder>({
        components: [
            new TextInputBuilder({
                custom_id: "title",
                placeholder: "Kayıt Görevi (Sorumluluk)",
                label: "Görev Adı:",
                style: TextInputStyle.Short,
                required: true
            })
        ]
    });

    const countRow = new ActionRowBuilder<TextInputBuilder>({
        components: [
            new TextInputBuilder({
                custom_id: "count",
                placeholder: "10000",
                label: "Sayı:",
                style: TextInputStyle.Short,
                required: true
            })
        ]
    });

    const modal = new ModalBuilder({
        custom_id: "modal",
        title: "Görev Ekleme",
        components: [pointRow, titleRow, countRow]
    });

    await interaction.showModal(modal);

    const modalCollected = await interaction.awaitModalSubmit({
        time: 1000 * 60 * 3
    });
    if (modalCollected) {
        modalCollected.deferUpdate();

        const point = Number(modalCollected.fields.getTextInputValue("point"));
        if (!point) {
            mainInteraction.editReply({
                content: "Puan sayı olmak zorundadır.",
                components: []
            })
            return;
        }

        const count = Number(modalCollected.fields.getTextInputValue("count"));
        if (!count) {
            mainInteraction.editReply({
                content: "Sayı sayı olmak zorundadır.",
                components: []
            })
            return;
        }

        guildData.tasks = [
            ...(guildData.tasks || []),
            {
                channel: channel,
                count: count,
                isGeneral: typeCollected.values[0] === "general",
                isInvite: typeCollected.values[0] === "invite",
                isVoice: typeCollected.values[0] === "voice",
                title: modalCollected.fields.getTextInputValue("title"),
                role: roleCollected.values[0]
            }
        ];

        mainInteraction.editReply({
            content: `${roleMention(roleCollected.values[0])} (${inlineCode(roleCollected.values[0])}) rolü ayarlandı.`,
            components: []
        });
    }
}