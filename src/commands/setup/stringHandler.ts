import { GuildModel, PointClass } from '@/models';
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    Interaction,
    Message,
    ModalBuilder,
    StringSelectMenuBuilder,
    TextInputBuilder,
    TextInputStyle,
    bold,
    inlineCode,
} from 'discord.js';
import { Client } from '@/structures';
import mainHandler from './mainHandler';

export interface IStringOption {
    name: string;
    value: string;
    description: string;
    type: string;
    isMultiple: boolean;
    isNumber: boolean;
}

export async function stringHandler(
    client: Client,
    message: Message,
    option: IStringOption,
    guildData: PointClass,
    question: Message,
) {
    await question.edit({
        content: '',
        components: createRow(option.name, guildData[option.value], option.isMultiple),
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

        if (i.isButton() && i.customId === 'change') {
            const row = new ActionRowBuilder<TextInputBuilder>({
                components: [
                    new TextInputBuilder({
                        customId: 'value',
                        value: option.isMultiple
                            ? guildData[option.value] ? (guildData[option.value] as string[]).join(', ') : undefined
                            : guildData[option.value],
                        label: 'Yeni Ayar:',
                        max_length: 60,
                        required: true,
                        style: TextInputStyle.Short,
                    }),
                ],
            });

            const modal = new ModalBuilder({
                title: `${option.name} Ayarını Değiştirme`,
                custom_id: 'modal',
                components: [row],
            });

            await i.showModal(modal);

            const modalCollector = await i.awaitModalSubmit({
                filter,
                time: 1000 * 60 * 3,
            });
            if (modalCollector) {
                const value = modalCollector.fields.getTextInputValue('value');
                if (option.isMultiple) guildData[option.value] = value.split(',').map((v) => v.trimStart().trimEnd());
                else if (option.isNumber) {
                    if (!Number(value)) {
                        modalCollector.reply({
                            content: 'Geçerli bir sayı gir!',
                            ephemeral: true,
                        });
                        return;
                    }
                    guildData[option.value] = Number(value);
                } else guildData[option.value] = value;

                await GuildModel.updateOne(
                    { id: message.guildId },
                    { $set: { [`point.${option.value}`]: guildData[option.value] } },
                );

                modalCollector.reply({
                    content: `Başarıyla ${bold(option.name)} adlı ayar ${inlineCode(value)} şeklinde ayarlandı.`,
                    ephemeral: true,
                });

                question.edit({
                    components: createRow(option.name, guildData[option.value], option.isMultiple),
                });
            }
        }

        if (i.isButton() && i.customId === 'reset') {
            guildData[option.value] = undefined;

            await GuildModel.updateOne({ id: message.guildId }, { $unset: { [`point.${option.value}`]: 1 } });

            i.reply({
                content: `Başarıyla ${bold(option.name)} adlı ayar sıfırlandı.`,
                ephemeral: true,
            });

            question.edit({
                components: createRow(option.name, guildData[option.value], option.isMultiple),
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

function createRow(name: string, value: string, isMultiple: boolean) {
    return [
        new ActionRowBuilder<StringSelectMenuBuilder>({
            components: [
                new StringSelectMenuBuilder({
                    custom_id: 'data',
                    disabled: true,
                    placeholder: `${name}: ${
                        isMultiple
                            ? ((value || []) as string[]).join(', ') || 'Ayarlanmamış!'
                            : value || 'Ayarlanmamış!'
                    }`,
                    options: [{ label: 'test', value: 'a' }],
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
                    custom_id: 'change',
                    label: 'Değiştir',
                    style: ButtonStyle.Success,
                }),
                new ButtonBuilder({
                    custom_id: 'reset',
                    label: 'Sıfırla',
                    style: ButtonStyle.Success,
                }),
            ],
        }),
    ];
}
