import { BonusLogFlags } from '@/enums';
import { StaffModel } from '@/models';
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    ComponentType,
    EmbedBuilder,
    ModalBuilder,
    ModalSubmitInteraction,
    PermissionFlagsBits,
    TextInputBuilder,
    TextInputStyle,
    bold,
    codeBlock,
    inlineCode,
} from 'discord.js';

const titles = {
    [BonusLogFlags.Add]: 'Ekleme',
    [BonusLogFlags.Remove]: 'Çıkarma',
};

const Command: Point.ICommand = {
    usages: ['bonus', 'bonusekle', 'bonuskaldır', 'bonusdüşür', 'bonusliste', 'bonusadd', 'bonusremove', 'bonuslist'],
    checkPermission: ({ message }) => message.member.permissions.has(PermissionFlagsBits.Administrator),
    execute: async ({ client, message, args, guildData }) => {
        const member =
            (await client.utils.getMember(message.guild, args[0])) ||
            (message.reference ? (await message.fetchReference()).member : undefined);
        if (member) {
            client.utils.sendTimedMessage(message, 'Geçerli bir kullanıcı belirt!');
            return;
        }

        if (!client.utils.checkStaff(member, guildData)) {
            client.utils.sendTimedMessage(message, 'Belirttiğin kullanıcı yetkili değil.');
            return;
        }

        const query = { id: member.id, guild: member.guild.id };
        const document = (await StaffModel.findOne(query)) || new StaffModel(query);
        const embed = new EmbedBuilder({ color: client.utils.getRandomColor() });
        const buttonRow = new ActionRowBuilder<ButtonBuilder>({
            components: [
                new ButtonBuilder({
                    custom_id: 'add',
                    label: 'Ekle',
                    style: ButtonStyle.Success,
                }),
                new ButtonBuilder({
                    custom_id: 'remove',
                    label: 'Kaldır',
                    style: ButtonStyle.Danger,
                }),
            ],
        });

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

        const question = await message.channel.send({
            embeds: [
                embed.setDescription(
                    document.bonusLogs.length
                        ? document.bonusLogs
                              .map((b) => {
                                  const staff = message.guild.members.cache.get(b.staff);
                                  return codeBlock(
                                      'fix',
                                      [
                                          `Yetkili: ${staff ? `${staff.user.displayName} (${staff.id})` : b.staff}`,
                                          `İşlem: ${titles[b.type]}`,
                                          `Puan: ${b.point}`,
                                          `Sebep: ${b.reason}`,
                                      ].join('\n'),
                                  );
                              })
                              .join('')
                        : 'Önceden eklenmiş bonus puanı bulunmuyor.',
                ),
            ],
            components: [buttonRow],
        });

        const filter = (i: ButtonInteraction) => i.user.id === message.author.id;
        const collected = await question.awaitMessageComponent({
            filter,
            time: 1000 * 60 * 2,
            componentType: ComponentType.Button,
        });
        if (collected) {
            const pointRow = new ActionRowBuilder<TextInputBuilder>({
                components: [
                    new TextInputBuilder({
                        custom_id: 'point',
                        label: 'Puan Miktarı:',
                        maxLength: 5,
                        style: TextInputStyle.Short,
                        required: true,
                    }),
                ],
            });

            const reasonRow = new ActionRowBuilder<TextInputBuilder>({
                components: [
                    new TextInputBuilder({
                        custom_id: 'reason',
                        label: 'Sebep:',
                        maxLength: 5,
                        style: TextInputStyle.Short,
                        required: true,
                    }),
                ],
            });

            const modal = new ModalBuilder({
                components: [pointRow, reasonRow],
                custom_id: 'modal',
                title: `Puan ${collected.customId === 'add' ? 'Ekleme' : 'Çıkarma'}`,
            });

            await collected.showModal(modal);

            const modalCollector = await collected.awaitModalSubmit({
                filter: (i: ModalSubmitInteraction) => i.user.id === message.author.id,
                time: 1000 * 60 * 5,
            });
            if (modalCollector) {
                modalCollector.deferUpdate();
                const reason = modalCollector.fields.getTextInputValue('reason');
                const point = Number(modalCollector.fields.getTextInputValue('point'));
                if (!point) {
                    modalCollector.reply({
                        content: 'Puan sayı olmak zorundadır.',
                        ephemeral: true,
                    });
                    return;
                }

                document.bonusLogs.push({
                    point,
                    reason,
                    staff: message.author.id,
                    time: Date.now(),
                    type: collected.customId === 'add' ? BonusLogFlags.Add : BonusLogFlags.Remove,
                });
                document.save();

                question.edit({
                    embeds: [
                        embed.setDescription(
                            `${member} (${inlineCode(member.id)}) adlı kullanıcıya ${bold(reason)} sebebiyle ${bold(
                                point.toString(),
                            )} puan ${collected.customId === 'add' ? 'eklendi' : 'çıkarıldı'}.`,
                        ),
                    ],
                    components: [],
                });
            } else question.edit({ components: [timeFinished] });
        } else question.edit({ components: [timeFinished] });
    },
};

export default Command;
