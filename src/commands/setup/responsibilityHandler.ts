import { GuildModel, IResponsibilityChannel, PointClass } from "@/models";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, ChannelType, ComponentType, Interaction, Message, ModalBuilder, RoleSelectMenuBuilder, StringSelectMenuBuilder, TextInputBuilder, TextInputStyle, bold, inlineCode, roleMention } from "discord.js";
import mainHandler from "./mainHandler";
import { Client } from "@/structures";

export async function responsibilityChannelHandler(
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

                const disabledChannelsRow = new ActionRowBuilder<RoleSelectMenuBuilder>({
                    components: [
                        new ChannelSelectMenuBuilder({
                            custom_id: "disabledChannels",
                            placeholder: "Kanal ara..",
                            channel_types: [ChannelType.GuildVoice]
                        })
                    ]
                });

                const skipRow = new ActionRowBuilder<ButtonBuilder>({
                    components: [
                        new ButtonBuilder({
                            custom_id: "skip",
                            label: "Geç",
                            style: ButtonStyle.Success
                        })
                    ]
                });

                i.editReply({
                    content: "Sayılmayacak kanalları seçin.",
                    components: [disabledChannelsRow, skipRow]
                });

                const disabledChannelsCollected = await interactionMessage.awaitMessageComponent({ time: 1000 * 60 * 10 });
                if (disabledChannelsCollected) {
                    const disabledChannels = disabledChannelsCollected.isStringSelectMenu() ? disabledChannelsCollected.values : [];
                    
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

                    const modal = new ModalBuilder({
                        custom_id: "modal",
                        title: "Kanala Özel Rol Ayarları",
                        components: [pointRow]
                    });

                    await disabledChannelsCollected.showModal(modal);

                    const modalCollected = await disabledChannelsCollected.awaitModalSubmit({
                        time: 1000 * 60 * 3
                    });
                    if (modalCollected) {
                        modalCollected.deferUpdate();

                        const point = Number(modalCollected.fields.getTextInputValue("point"));
                        if (!point) {
                            i.editReply({
                                content: "Puan sayı olmak zorundadır.",
                                components: []
                            })
                            return;
                        }

                        guildData.responsibilityChannels = [
                            ...(guildData.responsibilityChannels || []),
                            {
                                point: point,
                                role: roleCollected.values[0],
                                disabledChannels: disabledChannels,
                                id: roleCollected.values[0]
                            }
                        ];

                        i.editReply({
                            content: `${roleMention(roleCollected.values[0])} (${inlineCode(roleCollected.values[0])}) rolü ayarlandı.`,
                            components: []
                        });
                    } else i.deleteReply();
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