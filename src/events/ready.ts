import { staffControl } from '@/crons';
import { GuildModel, GuildClass } from '@/models';
import { addVoiceStat } from '@/structures';
import { Events, VoiceChannel } from 'discord.js';

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

        const now = Date.now();
        guild.members.cache
            .filter((m) => client.utils.checkStaff(m, document.point) && !m.voice.channelId)
            .forEach((m) =>
                client.voices.set(`${guild.id}-${m.id}`, { channelId: m.voice.channelId, joinedTimestamp: now }),
            );


        setInterval(() => {
            const guildData = client.servers.get(guild.id);
            if (!guildData) return;

            client.voices.forEach(async (v, k) => {
                const channel = guild.channels.cache.get(v.channelId);
                if (!channel) return;

                const diff = now - v.joinedTimestamp;
                if (!diff) return;

                const member = await client.utils.getMember(guild, k);
                if (!member) return;

                client.voices.set(k, {
                    channelId: v.channelId,
                    joinedTimestamp: now,
                });
                if (!member.voice.mute) addVoiceStat(client, member, channel as VoiceChannel, diff, guildData);
            });
        }, 1000 * 60);

        const guildEventEmitter = GuildModel.watch([{ $match: { 'fullDocument.id': guild.id } }], {
            fullDocument: 'updateLookup',
        });
        guildEventEmitter.on('change', ({ fullDocument }: { fullDocument: GuildClass }) =>
            client.servers.set(guild.id, { ...fullDocument.point }),
        );
    },
};

export default Ready;
