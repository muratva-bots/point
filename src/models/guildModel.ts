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
    description: string;
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
    staffTakePoints: number;
    taggedPoints: number;
    registerPoints: number;
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
            staffTakePoints: 70,
            taggedPoints: 70,
            registerPoints: 70
        },
    })
    public point: PointClass;

    @prop({
        type: Object,
        default: {
            removeOldRank: false,
            dailyPublic: 0,
            lastPublic: 0,
            dailyStream: 0,
            lastStream: 0,
            dailyCam: 0,
            lastCam: 0,
            dailyStreamOpen: 0,
            lastStreamOpen: 0,
            dailyCamOpen: 0,
            lastCamOpen: 0,
            dailyGeneral: 0,
            lastGeneral: 0,
            dailyMessage: 0,
            lastMessage: 0,
            dailyAfk: 0,
            lastAfk: 0,
            dailyJoin: 0,
            lastJoin: 0,
            dailyLeave: 0,
            lastLeave: 0,
            camChannels: [],
            dailyVoice: 0,
            lastVoice: 0,
            lastDay: new Date().setHours(0, 0, 0, 0),
            days: 1,
            owneredStreams: []
        },
    })
    public stat: object;
}

export const GuildModel = getModelForClass(GuildClass);
