import { TaskFlags } from '@/enums';
import { StaffModel } from '@/models';
import { Events } from 'discord.js';

const GuildMemberAdd: Point.IEvent<Events.GuildMemberAdd> = {
    name: Events.GuildMemberAdd,
    execute: async (client, member) => {
        if (member.user.bot) return;

        const guildData = client.servers.get(member.guild.id);
        if (!guildData) return;

        const invites = await member.guild.invites.fetch();
        const notHasInvite = client.invites.find((i) => !invites.has(i.code));
        const invite =
            invites.find(
                (i) =>
                    client.invites.has(`${member.guild.id}-${i.code}`) &&
                    i.uses > client.invites.get(`${member.guild.id}-${i.code}`).uses,
            ) || notHasInvite;
        if (!invite || !invite.inviter) return;

        if (notHasInvite) client.invites.delete(`${member.guild.id}-${invite.code}`);
        else {
            client.invites.set(`${member.guild.id}-${invite.code}`, {
                code: invite.code,
                inviter: invite.inviter,
                maxUses: invite.maxUses,
                uses: invite.uses,
            });
        }

        if (1000 * 60 * 60 * 24 * 7 >= Date.now() - member.user.createdTimestamp) return;

        const inviteMember = await client.utils.getMember(member.guild, invite.inviter.id);
        if (!inviteMember || !client.utils.checkStaff(inviteMember, guildData)) return;

        const query = { id: inviteMember.id, guild: member.guild.id };
        const staffDocument = (await StaffModel.findOne(query)) || new StaffModel(query);

        staffDocument.inviteUsers.push(member.id);

        if (staffDocument.allPoints > staffDocument.pointsRating) {
            const task = staffDocument.tasks.find((t) => t.type === TaskFlags.Invite);
            if (task) {
                task.count += 1;
                if (task.currentCount >= task.count) task.currentCount = task.count;
                task.completed = task.currentCount >= task.count;
                staffDocument.markModified('tasks');
            }
        }

        staffDocument.markModified('inviteUsers');
        staffDocument.save();
    },
};

export default GuildMemberAdd;
