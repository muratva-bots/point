import { GuildModel, PointClass } from '@/models';
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    Interaction,
    Message,
    StringSelectMenuBuilder,
    bold,
    inlineCode,
} from 'discord.js';
import { Client } from '@/structures';
import mainHandler from './mainHandler';

export interface IBooleanOption {
    name: string;
    value: string;
    description: string;
    type: string;
}

export async function booleanHandler(
    client: Client,
    message: Message,
    option: IBooleanOption,
    guildData: PointClass,
    question: Message,
) {
    await question.edit({
        content: '',
        components: createRow(option.name, guildData[option.value]),
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

        if (i.isButton()) {
            guildData[option.value] = i.customId === 'enable';

            await GuildModel.updateOne(
                { id: message.guildId },
                { $set: { [`point.${option.value}`]: guildData[option.value] } },
            );

            i.reply({
                content: `Başarıyla ${bold(option.name)} adlı ayar ${inlineCode(
                    i.customId === 'enable' ? 'açık' : 'kapalı',
                )} şeklinde ayarlandı.`,
                ephemeral: true,
            });

            question.edit({
                components: createRow(option.name, guildData[option.value]),
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

function createRow(name: string, enabled: boolean) {
    return [
        new ActionRowBuilder<StringSelectMenuBuilder>({
            components: [
                new StringSelectMenuBuilder({
                    custom_id: 'data',
                    disabled: true,
                    placeholder: `${name}: ${enabled ? 'Açık!' : 'Kapalı!'}`,
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
                    custom_id: 'enable',
                    label: 'Aç',
                    disabled: enabled,
                    style: ButtonStyle.Success,
                }),
                new ButtonBuilder({
                    custom_id: 'disable',
                    label: 'Kapat',
                    disabled: !enabled,
                    style: ButtonStyle.Success,
                }),
            ],
        }),
    ];
}
