import { GuildModel, PointClass } from '@/models';
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    Interaction,
    Message,
    RoleSelectMenuBuilder,
    StringSelectMenuBuilder,
    bold,
    inlineCode,
    roleMention,
} from 'discord.js';
import { Client } from '@/structures';
import mainHandler from './mainHandler';

export interface IRoleOption {
    name: string;
    value: string;
    description: string;
    type: string;
    isMultiple: boolean;
}

export async function roleHandler(
    client: Client,
    message: Message,
    option: IRoleOption,
    guildData: PointClass,
    question: Message,
) {
    const rowTwo = new ActionRowBuilder<RoleSelectMenuBuilder>({
        components: [
            new RoleSelectMenuBuilder({
                custom_id: 'role',
                placeholder: 'Rol ara..',
                max_values: option.isMultiple ? 25 : 1,
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

        if (i.isRoleSelectMenu()) {
            if (option.isMultiple) guildData[option.value] = i.values;
            else guildData[option.value] = i.values[0];

            await GuildModel.updateOne(
                { id: message.guildId },
                { $set: { [`point.${option.value}`]: guildData[option.value] } },
            );

            i.reply({
                content: `Başarıyla ${bold(option.name)} adlı ayar ${roleMention(i.values[0])} (${inlineCode(
                    i.values[0],
                )}) şeklinde ayarlandı.`,
                ephemeral: true,
            });

            question.edit({
                components: [createComponent(message, option, guildData), rowTwo, rowThree],
            });
        }

        if (i.isStringSelectMenu()) {
            if (option.isMultiple) {
                const newData = guildData[option.value] || ([] as string[]);
                guildData[option.value] = newData.filter((r) => !i.values.includes(r));
            } else guildData[option.value] = undefined;

            const updateQuery = option.isMultiple
                ? { [`point.${option.value}`]: guildData[option.value] }
                : { $unset: { [`point.${option.value}`]: 1 } };
            await GuildModel.updateOne({ id: message.guildId }, updateQuery);

            i.reply({
                content: `Başarıyla ${bold(option.name)} adlı ayardan ${roleMention(i.values[0])} (${inlineCode(
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

function createComponent(message: Message, option: IRoleOption, guildData: PointClass) {
    const roles = [...(option.isMultiple ? guildData[option.value] || [] : [guildData[option.value]])].filter((r) =>
        message.guild.roles.cache.has(r),
    ) as string[];
    return new ActionRowBuilder<StringSelectMenuBuilder>({
        components: [
            new StringSelectMenuBuilder({
                custom_id: 'data',
                placeholder: option.name,
                disabled: !roles.length,
                max_values: roles.length === 0 ? 1 : roles.length,
                options: roles.length
                    ? roles.map((r) => ({
                          label: message.guild.roles.cache.get(r).name,
                          value: r,
                          description: 'Kaldırmak için tıkla!',
                          emoji: {
                              id: '1135214115804172338',
                          },
                      }))
                    : [
                          {
                              label: 'no setting',
                              value: 'no-setting',
                          },
                      ],
            }),
        ],
    });
}
