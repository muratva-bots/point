import { readdirSync } from 'fs';
import { resolve } from 'path';

import { Client } from '@/structures';
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    Collection,
    Guild,
    GuildChannel,
    GuildMember,
    Message,
    Snowflake,
    User,
    time,
} from 'discord.js';
import { EMOJIS } from '@/assets';
import { IRank, PointClass, StaffClass, StaffModel } from '@/models';
import { TaskFlags } from '@/enums';
import { Document } from 'mongoose';

const ONE_DAY = 1000 * 60 * 60 * 24;

export class Utils {
    private client: Client;
    public limits: Collection<string, Point.ILimit>;

    constructor(client: Client) {
        this.client = client;
        this.limits = new Collection<string, Point.ILimit>();
    }

    chunkArray(array: any[], chunkSize: number) {
        const chunkedArray = [];
        for (let i = 0; i < array.length; i += chunkSize) chunkedArray.push(array.slice(i, i + chunkSize));
        return chunkedArray;
    }

    paginationButtons(page: number, totalData: number) {
        return new ActionRowBuilder<ButtonBuilder>({
            components: [
                new ButtonBuilder({
                    custom_id: 'first',
                    emoji: {
                        id: '1070037431690211359',
                    },
                    style: ButtonStyle.Secondary,
                    disabled: page === 1,
                }),
                new ButtonBuilder({
                    custom_id: 'previous',
                    emoji: {
                        id: '1061272577332498442',
                    },
                    style: ButtonStyle.Secondary,
                    disabled: page === 1,
                }),
                new ButtonBuilder({
                    custom_id: 'count',
                    label: `${page}/${totalData}`,
                    style: ButtonStyle.Secondary,
                    disabled: true,
                }),
                new ButtonBuilder({
                    custom_id: 'next',
                    emoji: {
                        id: '1061272499670745229',
                    },
                    style: ButtonStyle.Secondary,
                    disabled: totalData === page,
                }),
                new ButtonBuilder({
                    custom_id: 'last',
                    emoji: {
                        id: '1070037622820458617',
                    },
                    style: ButtonStyle.Secondary,
                    disabled: page === totalData,
                }),
            ],
        });
    }

    getRank(roles: string[], ranks: IRank[]) {
        if (!(ranks || []).length) {
            return { newRank: undefined, currentRank: undefined };
        }

        const sortedRanks = ranks.slice().sort((a, b) => a.point - b.point);
        const currentIndex = sortedRanks.findIndex((rank) => roles.includes(rank.role));

        return {
            newRank: sortedRanks[currentIndex + 1] || undefined,
            currentRank: sortedRanks[currentIndex] || undefined,
        };
    }

      async checkRank(member: GuildMember, document: StaffClass, guildData: PointClass) {
        if (document.pointsRating > document.totalPoints) {
            document.bonusPoints = 0;
            document.messagePoints = 0;
            document.publicPoints = 0;
            document.registerPoints = 0;
            document.responsibilityPoints = 0;
            document.sleepPoints = 0;
            document.staffTakePoints = 0;
            document.problemResolvePoints = 0;
        }

        const { currentRank, newRank } = this.getRank(
            member.roles.cache.map((r) => r.id),
            guildData.ranks,
        );
        if (!currentRank) return;

        const now = Date.now();
        if (
            !newRank ||
            document.pointsRating > document.totalPoints ||
            currentRank.point > (document.totalPoints - document.pointsRating) ||
            (currentRank.roleTime && currentRank.roleTime * (ONE_DAY * 7) > now - document.roleStartTime) ||
            (currentRank.taskCount && currentRank.taskCount > document.tasks.filter((t) => t.completed).length)
        )
            return;

        if (newRank.extraRole !== currentRank.extraRole) {
            if (!member.roles.cache.has(currentRank.extraRole)) await member.roles.remove(currentRank.extraRole);
            if (!member.roles.cache.has(newRank.extraRole)) await member.roles.add(newRank.extraRole);
        }

        if (member.roles.cache.has(newRank.role)) await member.roles.add(newRank.role);
        if (member.roles.cache.has(currentRank.role)) await member.roles.remove(currentRank.role);

        await StaffModel.updateOne(
            { user: member.id, guild: member.guild.id },
            {
                $set: {
                    pointsRating: this.pointsRating(member.guild, newRank),
                    bonusPoints: 0,
                    invitePoints: 0,
                    messagePoints: 0,
                    publicPoints: 0,
                    registerPoints: 0,
                    responsibilityPoints: 0,
                    sleepPoints: 0,
                    totalPoints: 0,
                    inGeneralMeeting: false,
                    inPersonalMeeting: false,
                    roleStartTime: now,
                    staffTakePoints: 0,
                    problemResolvePoints: 0,
                    tasks: [],
                },
            },
            { upsert: true, setDefaultsOnInsert: true },
        );
    }

    pointsRating(guild: Guild, rank: IRank) {
        const rankHalfPoint = Math.floor(rank.point / 2);

        const role = guild.roles.cache.get(rank.role);
        if (!role) return rankHalfPoint;

        const roleMembersCount = role.members.size;
        if (!roleMembersCount || 3 > roleMembersCount) return rankHalfPoint;

        return Math.min(rankHalfPoint + Math.pow(roleMembersCount, 2) + 500 * roleMembersCount + 250, rank.point);
    }

       createBar(current: number, required: number): string {
        const percentage = Math.min((100 * current) / required, 100);
        const progress = Math.max(Math.round((percentage / 100) * 4), 0);
        let str = this.getEmoji(percentage > 0 ? 'ilkdolu' : 'ilkbos');
        str += this.getEmoji('ortadolu').repeat(progress);
        str += this.getEmoji('ortabos').repeat(4 - progress);
        str += this.getEmoji(percentage === 100 ? 'sondolu' : 'sonbos');

        return str;
    }

    async checkRegisterTask(document: Document<unknown, any, StaffClass> & StaffClass) {
        if (document.pointsRating > document.totalPoints) return;

        const task = document.tasks.find((t) => t.type === TaskFlags.Register);
        console.log(task)
        if (!task || task.completed) return;

        document.markModified('tasks');
        task.currentCount += 1;
        if (task.currentCount >= task.count) {
            task.currentCount = task.count;
            task.completed = true;
        }
    }

    checkStaff(member: GuildMember, guildData: PointClass) {
        return guildData.ranks && guildData.ranks.length && guildData.ranks.some((r) => member.roles.cache.has(r.role));
    }

    getEmoji(name: string) {
        const clientEmoji = this.client.emojis.cache.find((e) => e.name === name);
        return clientEmoji ? clientEmoji.toString() : EMOJIS.find((e) => e.name === name).default;
    }

    isSnowflake(id: string): id is Snowflake {
        return BigInt(id).toString() === id;
    }

    setRoles(member: GuildMember, params: string[] | string): Promise<GuildMember> {
        if (!member.manageable) return undefined;

        const roles = member.roles.cache
            .filter((role) => role.managed)
            .map((role) => role.id)
            .concat(params);
        return member.roles.set(roles);
    }

    splitMessage(text: string, { maxLength = 2000, char = '\n', prepend = '', append = '' } = {}) {
        if (text.length <= maxLength) return [append + text + prepend];
        const splitText = text.split(char);
        const messages = [];
        let msg = '';
        for (const chunk of splitText) {
            if (msg && (msg + char + chunk + append).length > maxLength) {
                messages.push(msg + append);
                msg = prepend;
            }
            msg += (msg && msg !== prepend ? char : '') + chunk;
        }
        return messages.concat(msg).filter((m) => m);
    }

    async getMember(guild: Guild, id: string): Promise<GuildMember> {
        if (!id || !this.isSnowflake(id.replace(/\D/g, ''))) return;

        const cache = guild.members.cache.get(id.replace(/\D/g, ''));
        if (cache) return cache;

        let result;
        try {
            result = await guild.members.fetch({ user: id.replace(/\D/g, ''), force: true, cache: true });
        } catch (e) {
            result = undefined;
        }
        return result;
    }

    async getUser(id: string): Promise<User> {
        if (!id || !this.isSnowflake(id.replace(/\D/g, ''))) return;

        const cache = this.client.users.cache.get(id.replace(/\D/g, ''));
        if (cache) return cache;

        let result;
        try {
            result = await this.client.users.fetch(id.replace(/\D/g, ''), { force: true, cache: true });
        } catch (e) {
            result = undefined;
        }
        return result;
    }

    checkLimit(id: string, type: number, count: number = 5, minutes: number = 1000 * 60 * 15) {
        const key = `${id}-${type}`;
        const now = Date.now();

        const userLimits = this.limits.get(`${id}-${type}`);
        if (!userLimits) {
            this.limits.set(key, { count: 1, lastUsage: now });
            return { hasLimit: false };
        }

        userLimits.count = userLimits.count + 1;

        const diff = now - userLimits.lastUsage;
        if (diff < minutes && userLimits.count >= count) {
            return {
                hasLimit: true,
                time: time(Math.floor((userLimits.lastUsage + minutes) / 1000), 'R'),
            };
        }

        if (diff > minutes) this.limits.delete(id);
        else this.limits.set(id, userLimits);
        return { hasLimit: false };
    }

    numberToString(seconds: number) {
        seconds = seconds / 1000;
        var d = Math.floor(seconds / (3600 * 24));
        var h = Math.floor((seconds % (3600 * 24)) / 3600);
        var m = Math.floor((seconds % 3600) / 60);
        var s = Math.floor(seconds % 60);

        var dDisplay = d > 0 ? d + ' gün ' : '';
        var hDisplay = h > 0 ? h + ' saat ' : '';
        var mDisplay = d === 0 && m > 0 ? m + ' dakika ' : '';
        var sDisplay = h === 0 && s > 0 ? s + ' saniye' : '';
        return dDisplay + hDisplay + mDisplay + sDisplay;
    }

    sendTimedMessage(message: Message, content: string, time = 1000 * 5) {
        message
            .reply({ content })
            .then((msg) => {
                setTimeout(() => msg.delete(), time);
            })
            .catch(() => undefined);
    }

    checkUser(message: Message, member: GuildMember) {
        let type;

        if (member.user.bot) type = 'Botlara işlem yapamazsın!';
        if (member.id === message.member.id) type = 'Kendinize işlem yapamazsın!';
        if (message.member.id === member.roles.highest.id)
            type = '{user} ile aynı yetkidesin! Kullanıcıya işlem yapamazsın.';
        if (member.id === this.client.user.id) type = 'Botlara işlem uygulayamazsın!';
        if (member.roles.highest.rawPosition >= message.member.roles.highest.rawPosition)
            type = '{user} senden daha üst bir yetkiye sahip.';
        if (message.guild.members.me.roles.highest.id === member.roles.highest.id)
            type = '{user} benimle aynı yetkiye sahip! Kullanıcıya işlem yapamam.';

        if (type) this.client.utils.sendTimedMessage(message, type.replace(/{user}/g, member.user.username));
        return type;
    }

    getRandomColor() {
        return Math.floor(Math.random() * (0xffffff + 1));
    }

    async loadCommands() {
        const files = readdirSync(resolve(__dirname, '..', 'commands'));
        files.forEach(async (fileName) => {
            const commandFile = await import(resolve(__dirname, '..', 'commands', fileName));
            delete require.cache[commandFile];

            const command = commandFile.default as Point.ICommand;
            this.client.commands.set(command.usages[0], { ...command });
        });
    }

    async loadEvents() {
        const files = readdirSync(resolve(__dirname, '..', 'events'));
        files.forEach(async (fileName) => {
            const eventFile = await import(resolve(__dirname, '..', 'events', fileName));
            delete require.cache[eventFile];

            const event = eventFile.default;
            this.client.on(event.name, (...args: unknown[]) => event.execute(this.client, ...args));
        });
    }
}
