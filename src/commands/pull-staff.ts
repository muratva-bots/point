import { StaffModel } from '@/models';
import { EmbedBuilder, PermissionFlagsBits, TextChannel, inlineCode, bold } from 'discord.js';

const Command: Point.ICommand = {
    usages: ['yetkiçek', 'yetki-çek', 'yçek', 'y-çek'],
    checkPermission: ({ message }) => message.member.permissions.has(PermissionFlagsBits.Administrator),
    execute: async ({ client, message, args, guildData }) => {
        const minStaffRole = message.guild.roles.cache.get(guildData.minStaffRole);
        if (!minStaffRole) {
            message.channel.send('En alt yetkili rolü ayarlanmamış.');
            return;
        }

        const reference = message.reference ? (await message.fetchReference()).member : undefined;
        const member = (await client.utils.getMember(message.guild, args[0])) || reference;
        if (member) {
            client.utils.sendTimedMessage(message, 'Geçerli bir kullanıcı belirt!');
            return;
        }

        const reason = args.slice(reference ? 0 : 1).join(' ');
        if (!reason)
            return client.utils.sendTimedMessage(
                message,
                `Kullanıcının yetkisini çekmek için geçerli bir sebep belirtmelisin!`,
            );

        if (minStaffRole.position > member.roles.highest.position) {
            client.utils.sendTimedMessage(message, 'Kullanıcı yetkili değil.');
            return;
        }

        if (client.utils.checkUser(message, member)) return;

        const document = await StaffModel.findOne({ id: member.id, guild: message.guildId });
        if (document && document.oldRoles.length) {
            const currentRole = document.oldRoles[document.oldRoles.length - 1];
            currentRole.finishTimestamp = Date.now();
            document.save();
        }

        member.roles.set(member.roles.cache.filter((r) => !r.managed && minStaffRole.position > r.position));

        message.channel.send({
            content: `${member.id} (${inlineCode(member.id)}) adlı kullanıcının ${bold(
                reason,
            )} sebebiyle yetkisi çekildi.`,
        });

        const channel = message.guild.channels.cache.find((c) => c.name === 'staff-logs') as TextChannel;
        if (channel) {
            channel.send({
                embeds: [
                    new EmbedBuilder({
                        color: client.utils.getRandomColor(),
                        description: `${member} (${inlineCode(member.id)}) adlı kullanıcının yetkisi ${
                            message.author
                        } (${message.author.id}) tarafından çekildi!`,
                    }),
                ],
            });
        }
    },
};

export default Command;
