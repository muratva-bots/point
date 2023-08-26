import { StaffModel, UserStatModel } from '@/models';
import { Events } from 'discord.js';

const UserUpdate: Point.IEvent<Events.UserUpdate> = {
    name: Events.UserUpdate,
    execute: async (client, oldUser, newUser) => {
        const guildData = client.servers.get(client.config.GUILD_ID);
        if (!guildData || !(guildData.tags || []).length) return;

        const oldHasTag = (guildData.tags || []).some((t) =>
            oldUser.displayName.toLowerCase().includes(t.toLowerCase()),
        );
        const newHasTag = (guildData.tags || []).some((t) =>
            newUser.displayName.toLowerCase().includes(t.toLowerCase()),
        );

        if (oldHasTag && !newHasTag) {
            await UserStatModel.updateOne(
                { "staffTake.user": newUser.id, guild: client.config.GUILD_ID },
                { $pull: { "staffTakes.user": newUser.id } },
            )

            await UserStatModel.updateOne(
                { "taggeds.user": newUser.id, guild: client.config.GUILD_ID },
                { $pull: { "taggeds.user": newUser.id } },
            );
            
            const document = await StaffModel.findOne({ id: newUser.id, guild: client.config.GUILD_ID });
            if (document && document.oldRoles.length) {
                const currentRole = document.oldRoles[document.oldRoles.length - 1];
                currentRole.finishTimestamp = Date.now();
                document.save();
            }
        }
    },
};

export default UserUpdate;
