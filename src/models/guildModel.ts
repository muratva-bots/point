import { TaskFlags } from '@/enums';
import { getModelForClass, modelOptions, prop } from '@typegoose/typegoose';

export interface IResponsibilityChannel {
    id: string;
    disabledChannels: string[];
    role: string;
    point: number;
}

export interface IGuildTask {
    channel: string;
    title: string;
    count: number;
    type: TaskFlags;
    isGeneral: boolean;
    role?: string;
}

export interface IRank {
    point: number;
    role: string;
    taskCount?: number;
    roleTime?: number;
    extraRole?: string;
    maxSleep: number;
}

export class PointClass {
    tags: string[];
    minStaffRole: string;
    ranks: IRank[];
    chatChannel: string;
    chatStaffs: string[];
    messagePoint: number;
    messageStaffPoint: number;
    tasks: IGuildTask[];
    invitePoint: number;
    sleepPoint: number;
    publicPoint: number;
    afkRoom: string;
    publicCategory: string;
    responsibilityChannels: IResponsibilityChannel[];
    meetingRole: string;
    meetingPoint: number;
    noMute: boolean;
    eventFinishTimestamp: number;
    responsibilityChannel: string;
}

@modelOptions({ options: { customName: 'Guilds', allowMixed: 0 } })
export class GuildClass {
    @prop({ type: () => String, required: true })
    public id!: string;

    @prop({
        type: Object,
        default: {
            needName: true,
            registerSystem: true,
            invasionProtection: true,
            needAge: true,
            removeWarnRole: true,
            compliment: true,
            changeName: true,
            minAgePunish: true,
            maxMuteSystem: true,
            extraMute: true,
        },
    })
    public moderation: object;

    @prop({ type: Object, default: {} })
    public guard: object;

    @prop({
        type: Object,
        default: {
            messagePoint: 1,
            messageStaffPoint: 2,
            invitePoint: 70,
            sleepPoint: 4,
            publicPoint: 8,
            meetingPoint: 500,
            noMute: true,
            eventFinishTimestamp: Date.now(),
        },
    })
    public point: PointClass;
}

export const GuildModel = getModelForClass(GuildClass);
