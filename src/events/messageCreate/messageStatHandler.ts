import { TaskFlags } from '@/enums';
import { PointClass, StaffModel } from '@/models';
import { Client } from '@/structures';
import { GuildChannel, Message } from 'discord.js';

async function messageStatHandler(client: Client, message: Message, guildData: PointClass) {
    if (!client.utils.checkStaff(message.member, guildData) || message.channelId !== guildData.chatChannel) return;

    let point = message.member.roles.cache.some((r) => (guildData.chatStaffs || []).includes(r.id))
        ? guildData.messageStaffPoint
        : guildData.messagePoint;;

    if (Date.now() - guildData.eventFinishTimestamp >= 0) point *= 2;

    const document = await StaffModel.findOneAndUpdate(
        { id: message.author.id, guild: message.guildId },
        { $inc: { messagePoints: point, totalPoints: point, allPoints: point } },
        { upsert: true, new: true },
    );

    await client.utils.checkTask(document, message.channel as GuildChannel, 1, TaskFlags.Message);
    await client.utils.checkRank(message.member, document, guildData);
    document.save();
}

export default messageStatHandler;
