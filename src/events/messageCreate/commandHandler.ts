import { PointClass } from '@/models';
import { Client } from '@/structures';
import { Message } from 'discord.js';

function commandHandler(client: Client, message: Message, guildData: PointClass) {
    const minStaffRole = message.guild.roles.cache.get(guildData.minStaffRole);
    if (!minStaffRole || minStaffRole.position > message.member.roles.highest.position) return;

    const prefix = client.config.PREFIXES.find((p) => message.content.trim().toLowerCase().startsWith(p.toLowerCase()));
    if (!prefix || !message.content.startsWith(prefix)) return;

    const [commandName, ...args] = message.content.slice(prefix.length).trim().split(' ');
    const command = client.commands.find((command) => command.usages.includes(commandName.toLowerCase()));
    if (command) command.execute({ client, message, args, guildData });
}

export default commandHandler;
