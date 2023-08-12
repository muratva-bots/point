import { StaffModel } from '@/models';
import { Client } from '@/structures';
import { EmbedBuilder, Guild, TextChannel, inlineCode } from 'discord.js';
import { schedule } from 'node-cron';

const ONE_DAY = 1000 * 60 * 60 * 24;

export function staffControl(client: Client, guild: Guild) {
    schedule('0 0 0 * * 7', async () => {
        const guildData = client.servers.get(guild.id);
        if (!guildData || !(guildData.ranks || []).length) return;

        const minStaffRole = guild.roles.cache.find((r) => r.name === guildData.minStaffRole);
        if (!minStaffRole) return;

        const logChannel = guild.channels.cache.find((c) => c.name === 'staff-logs') as TextChannel;
        if (!logChannel) return;

        const now = Date.now();
        const embed = new EmbedBuilder({
            color: client.utils.getRandomColor(),
            timestamp: now,
        });
        const members = guild.members.cache
            .filter((m) => m.roles.highest.position >= minStaffRole.position)
            .map((m) => m.id);

        const documents = await StaffModel.find({
            id: { $in: members },
            guild: guild.id,
            $or: [{ roleTime: { $gte: now + ONE_DAY * 3 } }, { staffTime: { $gte: now + ONE_DAY * 7 } }],
        });
        if (!documents.length) return;

        const sortedRanks = guildData.ranks.slice().sort((a, b) => a.point - b.point);
        for (const document of documents) {
            if (document.lastWeekPoints !== 0 && 3000 > document.allPoints - document.lastWeekPoints) {
                const member = await client.utils.getMember(guild, document.id);
                if (!member) continue;

                const currentIndex = sortedRanks.findIndex((r) => member.roles.cache.has(r.role));
                if (!currentIndex) continue;

                const currentRole = guild.roles.cache.get(sortedRanks[currentIndex].role);
                if (!currentRole) return;

                if (currentIndex === 1) {
                    if (document.oldRoles.length) {
                        const sortedRoles = document.oldRoles.sort((a, b) => a.startTimestamp - b.startTimestamp);
                        const currentRole = sortedRoles.find((r) => member.roles.cache.has(r.role));
                        currentRole.finishTimestamp = Date.now();
                        document.save();
                    }

                    member.roles.remove(
                        member.roles.cache.filter((r) => r.position >= minStaffRole.position).map((r) => r.id),
                    );

                    logChannel.send({
                        embeds: [
                            embed.setDescription(
                                `${member} (${inlineCode(member.id)}) adlı kullanıcı ${currentRole} (${inlineCode(
                                    currentRole.id,
                                )}) rolündeydi daha düşürelecek yetkisi olmadığından yetkiden atıldı.`,
                            ),
                        ],
                    });
                    continue;
                }

                if (member.roles.cache.has(currentRole.id)) await member.roles.remove(currentRole);

                const newRole = guild.roles.cache.get(sortedRanks[currentIndex - 1].role);
                if (!member.roles.cache.has(newRole.id)) await member.roles.add(newRole);

                if (sortedRanks[currentIndex].extraRole !== sortedRanks[currentIndex - 1].extraRole) {
                    if (!member.roles.cache.has(sortedRanks[currentIndex].extraRole))
                        await member.roles.remove(sortedRanks[currentIndex].extraRole);
                    if (!member.roles.cache.has(sortedRanks[currentIndex - 1].extraRole))
                        await member.roles.add(sortedRanks[currentIndex - 1].extraRole);
                }

                logChannel.send({
                    embeds: [
                        embed.setDescription(
                            `${member} (${inlineCode(member.id)}) adlı kullanıcı ${currentRole} (${inlineCode(
                                currentRole.id,
                            )}) rolünden ${newRole} (${inlineCode(newRole.id)}) rolüne düşürüldü.`,
                        ),
                    ],
                });

                document.bonusPoints = 0;
                document.inviteUsers = [];
                document.messagePoints = 0;
                document.publicPoints = 0;
                document.registerPoints = 0;
                document.responsibilityPoints = 0;
                document.sleepPoints = 0;
                document.totalPoints = 0;
                document.inGeneralMeeting = false;
                document.inPersonalMeeting = false;
                document.roleStartTime = now;
                document.staffTakes = [];
                document.problemResolves = [];
                document.tasks = [];
                document.bonusLogs = [];
            }

            document.lastWeekPoints = document.allPoints;
            document.save();
        }
    });
}
