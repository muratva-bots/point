import { PointClass } from '@/models';
import { Client } from '@/structures';
import { Message, PermissionFlagsBits } from 'discord.js';

function commandHandler(client: Client, message: Message, guildData: PointClass) {
    if (
        !client.utils.checkStaff(message.member, guildData) &&
        !message.member.permissions.has(PermissionFlagsBits.Administrator)
    )
        return;

    const prefix = client.config.PREFIXES.find((p) => message.content.trim().toLowerCase().startsWith(p.toLowerCase()));
    if (!prefix) return;

    const [commandName, ...args] = message.content.slice(prefix.length).trim().split(' ');
    const command = client.commands.find((command) => command.usages.includes(commandName.toLowerCase()));
    if (command) {
        if (command.checkPermission && !command.checkPermission({ client, message, guildData })) return;
        command.execute({ client, message, args, guildData });
    }
}

export default commandHandler;
