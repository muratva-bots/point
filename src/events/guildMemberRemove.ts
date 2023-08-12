import { TaskFlags } from '@/enums';
import { StaffModel } from '@/models';
import { Events, GuildMember } from 'discord.js';

const GuildMemberRemove: Point.IEvent<Events.GuildMemberRemove> = {
    name: Events.GuildMemberRemove,
    execute: async (client, member) => {
        if (member.user.bot) return;

        const guildData = client.servers.get(member.guild.id);
        if (!guildData) return;

        if (client.utils.checkStaff(member as GuildMember, guildData)) {
            const document = await StaffModel.findOne({ id: member.id, guild: client.config.GUILD_ID });
            if (document && document.oldRoles.length) {
                const currentRole = document.oldRoles[document.oldRoles.length - 1];
                currentRole.finishTimestamp = Date.now();
                document.save();
            }
        }

        const staffDocument = await StaffModel.findOne({ inviteUsers: { $in: [member.id] }, guild: member.guild.id });
        if (!staffDocument) return;

        const inviteMember = await client.utils.getMember(member.guild, staffDocument.id);
        if (!inviteMember || !client.utils.checkStaff(inviteMember, guildData)) return;

        staffDocument.inviteUsers = staffDocument.inviteUsers.filter((i) => member.id !== i);

        if (staffDocument.allPoints > staffDocument.pointsRating) {
            const task = staffDocument.tasks.find((t) => t.type === TaskFlags.Invite);
            if (task) {
                if (task.currentCount > 0) task.currentCount -= 1;
                task.completed = task.currentCount >= task.count;
            }
        }

        staffDocument.save();
    },
};

export default GuildMemberRemove;
