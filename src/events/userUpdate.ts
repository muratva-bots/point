import { TaskFlags } from '@/enums';
import { StaffModel } from '@/models';
import { Events } from 'discord.js';

const UserUpdate: Point.IEvent<Events.UserUpdate> = {
    name: Events.UserUpdate,
    execute: async (client, oldUser, newUser) => {
        const guildData = client.servers.get(client.config.GUILD_ID);
        if (!guildData || !(guildData.tags || []).length) return;

        const oldHasTag = (guildData.tags || []).some((t) => oldUser.displayName.toLowerCase().includes(t.toLowerCase()));
        const newHasTag = (guildData.tags || []).some((t) => newUser.displayName.toLowerCase().includes(t.toLowerCase()));

        if (oldHasTag && !newHasTag) {
            const staffDocuments = await StaffModel.find(
                {
                    guild: client.config.GUILD_ID,
                    $or: [{ 'staffTakes.user': newUser.id }, { taggeds: { $in: [newUser.id] } }],
                },
                { $pull: { staffTakes: { user: newUser.id }, taggeds: newUser.id } },
                { upsert: true },
            );

            for (const staffDocument of staffDocuments) {
                if (staffDocument.staffTakes.some((t) => t.user === newUser.id)) {
                    const task = staffDocument.tasks.find((t) => t.type === TaskFlags.Staff);
                    if (task) {
                        if (task.currentCount > 0) task.currentCount = task.currentCount - 1;
                        task.completed = task.currentCount >= task.count;
                    }
                }

                if (staffDocument.taggeds.some((t) => t.user === newUser.id)) {
                    const task = staffDocument.tasks.find((t) => t.type === TaskFlags.Tagged);
                    if (task) {
                        if (task.currentCount > 0) task.currentCount = task.currentCount - 1;
                        task.completed = task.currentCount >= task.count;
                    }
                }

                staffDocument.save();
            }

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
