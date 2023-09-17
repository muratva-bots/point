import { TaskFlags } from '@/enums';
import { PointClass, StaffModel } from '@/models';
import { Client } from '@/structures';
import { GuildMember, VoiceChannel } from 'discord.js';

export async function addVoiceStat(
    client: Client,
    member: GuildMember,
    channel: VoiceChannel,
    value: number,
    guildData: PointClass,
) {
    const { currentRank } = client.utils.getRank(
        member.roles.cache.map((r) => r.id),
        guildData.ranks,
    );
    if (!currentRank) return;

    const minutes = Math.max(Math.floor(value / (1000 * 60)), 1);

    let point = minutes * guildData.sleepPoint;
    let key = 'sleepPoints';

    const pointChannel = (guildData.responsibilityChannels || []).find(
        (c) =>
            (channel.id === c.id || channel.parentId === c.id) &&
            member.roles.cache.has(c.role) &&
            !c.disabledChannels.includes(channel.id),
    );
    if (pointChannel) {
        key = 'responsibilityPoints';
        point = minutes * pointChannel.point;
    } else if (channel.parentId === guildData.publicCategory && channel.id === guildData.afkRoom) {
        point = minutes * guildData.publicPoint;
        key = 'publicPoints';
    }

    if (key !== 'sleepPoints' && Date.now() - guildData.eventFinishTimestamp >= 0) point *= 2;

    const document = await StaffModel.findOneAndUpdate(
        { id: member.id, guild: member.guild.id },
        { $inc: { [key]: point, total: point, allPoints: point } },
        { upsert: true, new: true },
    );
    if (document.sleepPoints >= currentRank.maxSleep) document.sleepPoints = currentRank.maxSleep;
    await client.utils.checkTask(document, channel, value, TaskFlags.Voice);
    await client.utils.checkRank(member, document, guildData);
    document.save();
}
