import { addVoiceStat } from '@/structures';
import { Events, VoiceChannel } from 'discord.js';

const VoiceStateUpdate: Point.IEvent<Events.VoiceStateUpdate> = {
    name: Events.VoiceStateUpdate,
    execute: (client, oldState, newState) => {
        if (!oldState.member.guild || oldState.member.user.bot) return;

        const guildData = client.servers.get(oldState.guild.id);
        if (!guildData || !client.utils.checkStaff(oldState.member, guildData)) return;

        const now = Date.now();
        const isMuted = guildData.noMute && newState.selfMute && newState.selfDeaf;
        const spesificKey = `${oldState.member.guild.id}-${oldState.id}`;

        if (!oldState.channelId && newState.channelId && !isMuted) {
            client.voices.set(spesificKey, {
                channelId: newState.channelId,
                joinedTimestamp: now,
            });
            return;
        }

        if (!client.voices.has(spesificKey) && !isMuted) {
            client.voices.set(spesificKey, {
                channelId: newState.channelId,
                joinedTimestamp: now,
            });
            return;
        }

        if (isMuted) {
            const voiceCache = client.voices.get(spesificKey);
            if (!voiceCache) return;

            const diffValue = now - voiceCache.joinedTimestamp;
            if (!diffValue) {
                client.voices.delete(spesificKey);
                return;
            }

            addVoiceStat(client, oldState.member, newState.channel as VoiceChannel, diffValue, guildData);
            client.voices.delete(spesificKey);
            return;
        }

        if (oldState.channelId && !newState.channelId) {
            const voiceCache = client.voices.get(spesificKey);
            if (!voiceCache) return;

            const diffValue = now - voiceCache.joinedTimestamp;
            if (!diffValue) {
                client.voices.delete(spesificKey);
                return;
            }

            addVoiceStat(client, oldState.member, oldState.channel as VoiceChannel, diffValue, guildData);
            client.voices.delete(spesificKey);
            return;
        }

        if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
            const voiceCache = client.voices.get(spesificKey);
            if (!voiceCache) return;

            client.voices.set(`${oldState.member.guild.id}-${oldState.id}`, {
                channelId: newState.channelId,
                joinedTimestamp: now,
            });

            const diffValue = now - voiceCache.joinedTimestamp;
            if (!diffValue) return;

            addVoiceStat(client, oldState.member, oldState.channel as VoiceChannel, diffValue, guildData);
            return;
        }
    },
};

export default VoiceStateUpdate;
