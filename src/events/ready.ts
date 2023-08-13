import { staffControl } from '@/crons';
import { GuildModel, GuildClass, StaffModel } from '@/models';
import { Events } from 'discord.js';

const Ready: Point.IEvent<Events.ClientReady> = {
    name: Events.ClientReady,
    execute: async (client) => {
        const guild = client.guilds.cache.get(client.config.GUILD_ID);
        if (!guild) {
            console.log('Guild is undefined.');
            return;
        }

        await guild.members.fetch();
        await guild.fetchOwner();
        staffControl(client, guild);

        const invites = await guild.invites.fetch();
        invites.forEach((i) =>
            client.invites.set(`${i.guild.id}-${i.code}`, {
                code: i.code,
                inviter: i.inviter,
                uses: i.uses,
                maxUses: i.maxUses,
            }),
        );

        console.log(`${client.user.tag} is online!`);

        await client.application.fetch();
        const document = (await GuildModel.findOne({ id: guild.id })) || (await GuildModel.create({ id: guild.id }));
        client.servers.set(guild.id, { ...document.point });

        const unTaggedMembers = guild.members.cache
            .filter(
                (m) =>
                    !(document.point.tags || []).some((t) =>
                        m.user.displayName.toLowerCase().includes(t.toLowerCase()),
                    ),
            )
            .map((m) => m.id);
        await StaffModel.updateMany(
            {
                guild: guild.id,
                $or: [{ 'staffTakes.user': unTaggedMembers }, { 'taggeds.user': { $in: unTaggedMembers } }],
            },
            {
                $pull: { 'staffTakes.user': { $in: unTaggedMembers }, 'taggeds.user': { $in: unTaggedMembers } },
            },
        );

        const now = Date.now();
        guild.members.cache
            .filter((m) => client.utils.checkStaff(m, document.point) && !m.voice.channelId)
            .forEach((m) =>
                client.voices.set(`${guild.id}-${m.id}`, { channelId: m.voice.channelId, joinedTimestamp: now }),
            );

        const guildEventEmitter = GuildModel.watch([{ $match: { 'fullDocument.id': guild.id } }], {
            fullDocument: 'updateLookup',
        });
        guildEventEmitter.on('change', ({ fullDocument }: { fullDocument: GuildClass }) =>
            client.servers.set(guild.id, { ...fullDocument.point }),
        );
    },
};

export default Ready;
