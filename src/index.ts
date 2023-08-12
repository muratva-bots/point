import { Client, addVoiceStat } from '@/structures';
import { VoiceChannel } from 'discord.js';
import mongoose from 'mongoose';

const client = new Client();
mongoose.set('strictQuery', false);

client.connect();

process.on('SIGQUIT', () => process.emit('SIGHUP'));
process.on('SIGINT', () => process.emit('SIGHUP'));

let saving = false;
process.on('SIGHUP', () => {
    if (saving) return;
    saving = true;

    const guild = client.guilds.cache.get(client.config.GUILD_ID);
    if (!guild) return;

    const guildData = client.servers.get(client.config.GUILD_ID);
    if (!guildData) return;

    const now = Date.now();
    client.voices.forEach(async (v, k) => {
        const diffValue = now - v.joinedTimestamp;
        if (!diffValue) return;

        const member = await client.utils.getMember(guild, k);
        if (!member || !client.utils.checkStaff(member, guildData)) {
            client.voices.delete(k);
            return;
        }

        const channel = client.channels.cache.get(v.channelId);
        if (!channel) {
            client.voices.delete(k);
            return;
        }

        client.voices.delete(k);
        addVoiceStat(client, member, channel as VoiceChannel, diffValue, guildData);
    });

    process.exit(1);
});

// process.on('unhandledRejection', (error: Error) => console.log(`${error.name}: ${error.message}`));
// process.on('uncaughtException', (error: Error) => console.log(`${error.name}: ${error.message}`));
