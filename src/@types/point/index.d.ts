import { PointClass } from '@/models';
import { Client } from '@/structures';
import { ClientEvents, Message, User } from 'discord.js';

export {};

declare global {
    namespace Point {
        export type EventKeys = keyof ClientEvents;

        export interface ILimit {
            count: number;
            lastUsage: number;
        }

        export interface IEvent<K extends EventKeys> {
            name: EventKeys;
            execute: (client: Client, ...args: ClientEvents[K]) => Promise<void> | void;
        }

        export interface ICheckPermission {
            client: Client;
            message: Message;
            guildData: PointClass;
        }

        export interface ICommand {
            usages: string[];
            checkPermission?: ({ client, message }: ICheckPermission) => boolean;
            execute: (commandArgs: CommandArgs) => Promise<unknown> | unknown;
        }

        export interface CommandArgs {
            client: Client;
            message: Message;
            args: string[];
            guildData: PointClass;
        }

        export interface IVoice {
            channelId: string;
            joinedTimestamp: number;
        }

        export interface IInvite {
            uses: number;
            inviter: User;
            code: string;
            maxUses: number;
        }
    }
}
