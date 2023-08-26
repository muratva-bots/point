import { StaffTakeFlags } from '@/enums';
import { StaffModel, UserStatModel } from '@/models';
import { AuditLogEvent, EmbedBuilder, Events, TextChannel, bold, inlineCode } from 'discord.js';

const GuildMemberUpdate: Point.IEvent<Events.GuildMemberUpdate> = {
    name: Events.GuildMemberUpdate,
    execute: async (client, oldMember, newMember) => {
        const guildData = client.servers.get(newMember.guild.id);
        if (!guildData) return;

        if (
            oldMember.user.bot ||
            oldMember.roles.cache.map((r) => r.id) === newMember.roles.cache.map((r) => r.id) ||
            !(guildData.ranks || []).length
        )
            return;

        if (guildData.ranks.some((r) => oldMember.roles.cache.has(r.role) && !newMember.roles.cache.has(r.role))) {
            const entry = await newMember.guild
                    .fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberRoleUpdate })
                    .then((audit) => audit.entries.first());
            if (!entry || entry.executor.bot) return;

            const document = await StaffModel.findOne({ id: newMember.id, guild: newMember.guild.id });
            if (document && document.oldRoles.length) {
                const currentRole = document.oldRoles[document.oldRoles.length - 1];
                currentRole.finishTimestamp = Date.now();
                document.save();
            }

            const channel = newMember.guild.channels.cache.find((c) => c.name === 'staff-logs') as TextChannel;
            if (channel) {
                channel.send({
                    embeds: [
                        new EmbedBuilder({
                            color: client.utils.getRandomColor(),
                            description: `${newMember} (${inlineCode(newMember.id)}) adlı kullanıcının yetkisi ${entry.executor} (${entry.executorId}) tarafından çekildi!`,
                        }),
                    ],
                });
            }
        }
    }
};

export default GuildMemberUpdate;
