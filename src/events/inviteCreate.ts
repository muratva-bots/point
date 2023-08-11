import { Events } from 'discord.js';

const InviteCreate: Point.IEvent<Events.InviteCreate> = {
    name: Events.InviteCreate,
    execute: (client, invite) => {
        client.invites.set(`${invite.guild.id}-${invite.code}`, {
            code: invite.code,
            inviter: invite.inviter,
            uses: invite.uses,
            maxUses: invite.maxUses,
        });
    },
};

export default InviteCreate;
