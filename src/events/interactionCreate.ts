import { Events, inlineCode, roleMention } from 'discord.js';

const InteractionCreate: Point.IEvent<Events.InteractionCreate> = {
    name: Events.InteractionCreate,
    execute: async (client, interaction) => {
        if (!interaction.isButton()) return;

        const guildData = client.servers.get(interaction.guildId);
        if (!guildData) return;

        const tasks = (guildData.tasks || []).filter((t) => interaction.guild.roles.cache.has(t.role));
        if (!tasks.length || tasks.some((t) => t.role !== interaction.customId)) return;

        const member = await client.utils.getMember(interaction.guild, interaction.user.id);
        if (!member || !client.utils.checkStaff(member, guildData)) return;

        if (member.roles.cache.has(interaction.customId)) {
            member.roles.remove(interaction.customId);
            interaction.reply({
                content: `${roleMention(interaction.customId)} (${inlineCode(
                    interaction.customId,
                )}) adlı sorumluluk rolü üzerinizden alındı.`,
                ephemeral: true,
            });
        } else {
            member.roles.add(interaction.customId);
            interaction.reply({
                content: `${roleMention(interaction.customId)} (${inlineCode(
                    interaction.customId,
                )}) adlı sorumluluk rolü üzerinize verildi.`,
                ephemeral: true,
            });
        }
    },
};

export default InteractionCreate;
