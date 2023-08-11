import { GuildModel, PointClass } from '@/models';
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelSelectMenuBuilder,
    ChannelType,
    Interaction,
    Message,
    StringSelectMenuBuilder,
    bold,
    channelMention,
    inlineCode,
} from 'discord.js';
import { Client } from '@/structures';
import mainHandler from './mainHandler';

export interface IChannelOption {
    name: string;
    value: string;
    description: string;
    type: string;
    isParent: boolean;
    isVoice: boolean;
}

export async function channelHandler(
    client: Client,
    message: Message,
    option: IChannelOption,
    guildData: PointClass,
    question: Message,
) {
    const rowTwo = new ActionRowBuilder<ChannelSelectMenuBuilder>({
        components: [
            new ChannelSelectMenuBuilder({
                custom_id: 'channel',
                placeholder: 'Kanal ara..',
                channel_types: option.isVoice
                    ? [ChannelType.GuildVoice]
                    : option.isParent
                    ? [ChannelType.GuildCategory]
                    : [ChannelType.GuildText],
            }),
        ],
    });

    const rowThree = new ActionRowBuilder<ButtonBuilder>({
        components: [
            new ButtonBuilder({
                custom_id: 'back',
                label: 'Geri',
                style: ButtonStyle.Danger,
            }),
        ],
    });

    await question.edit({
        content: '',
        components: [createComponent(message, option, guildData), rowTwo, rowThree],
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

        if (i.isChannelSelectMenu()) {
            guildData[option.value] = i.values[0];

            await GuildModel.updateOne(
                { id: message.guildId },
                { $set: { [`point.${option.value}`]: guildData[option.value] } },
                { upsert: true },
            );

            i.reply({
                content: `Başarıyla ${bold(option.name)} adlı ayar ${channelMention(i.values[0])} (${inlineCode(
                    i.values[0],
                )}) şeklinde ayarlandı.`,
                ephemeral: true,
            });

            question.edit({
                components: [createComponent(message, option, guildData), rowTwo, rowThree],
            });
        }

        if (i.isStringSelectMenu()) {
            guildData[option.value] = undefined;

            await GuildModel.updateOne(
                { id: message.guildId },
                { $unset: { [`point.${option.value}`]: 1 } },
                { upsert: true },
            );

            i.reply({
                content: `Başarıyla ${bold(option.name)} adlı ayardan ${channelMention(i.values[0])} (${inlineCode(
                    i.values[0],
                )}) kaldırdı.`,
                ephemeral: true,
            });

            question.edit({
                components: [createComponent(message, option, guildData), rowTwo, rowThree],
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

function createComponent(message: Message, option: IChannelOption, guildData: PointClass) {
    const hasChannel = message.guild.channels.cache.has(guildData[option.value]);
    return new ActionRowBuilder<StringSelectMenuBuilder>({
        components: [
            new StringSelectMenuBuilder({
                custom_id: 'data',
                placeholder: option.name,
                disabled: !hasChannel,
                options: [
                    hasChannel
                        ? {
                              label: message.guild.channels.cache.get(guildData[option.value]).name,
                              value: guildData[option.value],
                              description: 'Kaldırmak için tıkla!',
                              emoji: {
                                  id: option.isVoice ? '1135211149885976686' : '1135211232597651516',
                              },
                          }
                        : {
                              label: 'no setting',
                              value: 'no-setting',
                          },
                ],
            }),
        ],
    });
}