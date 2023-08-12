import { StaffTakeFlags } from '@/enums';
import { StaffModel } from '@/models';
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

        if (guildData.ranks.some((r) => !oldMember.roles.cache.has(r.role) && newMember.roles.cache.has(r.role))) {
            const entry = await newMember.guild
                .fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberRoleUpdate })
                .then((audit) => audit.entries.first());
            if (!entry || entry.executor.bot || entry.targetId !== newMember.id) return;

            const now = Date.now();
            const role = newMember.roles.cache.difference(oldMember.roles.cache).first();
            await StaffModel.updateOne(
                { id: entry.executorId, guild: newMember.guild.id },
                { $push: { staffTakes: { user: newMember.id, time: now, role: role.id } } },
                { upsert: true, setDefaultsOnInsert: true },
            );

            const rank = guildData.ranks.find(r => role.id === r.role);
            await StaffModel.updateOne(
                { id: newMember.id, guild: newMember.guild.id },
                {
                    $set: {
                        pointsRating: client.utils.pointsRating(newMember.guild, rank),
                        bonusPoints: 0,
                        inviteUsers: [],
                        messagePoints: 0,
                        publicPoints: 0,
                        registerPoints: 0,
                        responsibilityPoints: 0,
                        sleepPoints: 0,
                        totalPoints: 0,
                        inGeneralMeeting: false,
                        inPersonalMeeting: false,
                        roleStartTime: now,
                        staffTakes: [],
                        problemResolves: [],
                        tasks: [],
                        bonusLogs: [],
                    },
                    $push: {
                        oldRoles: {
                            startTimestamp: now,
                            admin: entry.executorId,
                            role: role.id,
                            type: StaffTakeFlags.Start,
                        },
                    },
                },
                { upsert: true, setDefaultsOnInsert: true },
            );
        }
    },
};

export default GuildMemberUpdate;
