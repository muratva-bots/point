import { SETTINGS } from '@/assets';
import { GuildModel, PointClass } from '@/models';
import { Client } from '@/structures';
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    Message,
    StringSelectMenuBuilder,
    StringSelectMenuInteraction,
} from 'discord.js';
import { IRoleOption, roleHandler } from './roleHandler';
import { IChannelOption, channelHandler } from './channelHandler';
import { IBooleanOption, booleanHandler } from './booleanHandler';
import { IStringOption, stringHandler } from './stringHandler';
import { rankHandler } from './rankHandler';
import { responsibilityChannelHandler } from './responsibilityHandler';
import { taskHandler } from './taskHandler';

async function mainHandler(client: Client, message: Message, guildData: PointClass, botMessage?: Message) {
    const query = {
        content: 'Aşağıdaki menüden düzenleyeceğiniz ayarı seçiniz.',
        components: [
            new ActionRowBuilder<StringSelectMenuBuilder>({
                components: [
                    new StringSelectMenuBuilder({
                        customId: `change-setting`,
                        placeholder: 'Değişilecek ayarı seçiniz!',
                        options: [
                            ...SETTINGS.map((o) => ({
                                label: o.name as string,
                                description: o.description as string,
                                value: o.value as string,
                                emoji: {
                                    id: '1134954912543944835',
                                },
                            })),
                            {
                                label: 'Ayarları Sıfırla',
                                value: 'reset',
                                description: 'Sunucunun ayarlanmış bütün ayarlarını sıfırlar.',
                                emoji: {
                                    id: '1134953250748117082',
                                },
                            },
                        ],
                    }),
                ],
            }),
        ],
    };
    const question = await (botMessage ? botMessage.edit(query) : message.channel.send(query));

    const filter = (i: StringSelectMenuInteraction) => i.user.id === message.author.id;
    const collector = await question.createMessageComponentCollector({
        filter,
        time: 1000 * 60 * 10,
        max: 1,
    });

    collector.on('collect', async (i: StringSelectMenuInteraction) => {
        i.deferUpdate();
        collector.stop('FINISHED');

        if (i.values[0] === "reset") {
            await GuildModel.deleteOne({ id: message.guildId });

            const document = await GuildModel.create({ id: message.guildId });
            guildData = document.point;

            question.edit({
                content: "Ayarlar sıfırlandı.",
                components: []
            });
            return;
        }

        const option = SETTINGS.find((o) => o.value === i.values[0]);
        if (option.type === 'role') roleHandler(client, message, option as IRoleOption, guildData, question);
        if (option.type === 'channel') channelHandler(client, message, option as IChannelOption, guildData, question);
        if (option.type === 'boolean') booleanHandler(client, message, option as IBooleanOption, guildData, question);
        if (option.type === 'string') stringHandler(client, message, option as IStringOption, guildData, question);
        if (option.type === 'ranks') rankHandler(client, message, guildData, question);
        if (option.type === 'responsibilitys') responsibilityChannelHandler(client, message, guildData, question);
        if (option.type === 'tasks') taskHandler(client, message, guildData, question);
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

export default mainHandler;
