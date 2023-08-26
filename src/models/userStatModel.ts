import { getModelForClass, modelOptions, prop } from '@typegoose/typegoose';

interface ITagged {
    user: string;
    time: number;
}

export interface IRegister {
    type: number;
    user: string;
    time: number;
}

interface IProblemResolve {
    reason: string;
    channelId: string;
    createdTimestamp: number;
    endTimestamp: number;
    insideRoom: string[];
    isResuming: boolean;
}

interface IStaffTake {
    user: string;
    time: number;
    role: string;
}

export interface IStat {
    [key: string]: number;
}

export interface IDay {
    [key: string]: IStat & { total: number };
}

interface IMessages {
    total: number;
    lastMessage: {
        channelId: string;
        messageId: string;
        createdTimestamp: number;
    };
    channels: IStat;
    days: IDay;
}

interface IVoiceBased {
    total: number;
    lastChannel: string;
    lastTime: number;
    channels: IStat;
    days: IDay;
}

@modelOptions({ options: { customName: 'UserStats', allowMixed: 0 } })
export class UserStatClass {
    @prop({ type: String, required: true })
    public id!: string;

    @prop({ type: String, required: true })
    public guild!: string;

    @prop({ type: String, default: undefined })
    public inviter: string;

    @prop({ type: Number, default: 0 })
    public leaveInvites: number;

    @prop({ type: Number, default: 0 })
    public suspectInvites: number;

    @prop({ type: Number, default: 0 })
    public normalInvites: number;

    @prop({ type: Number, default: 1 })
    public days: number;

    @prop({ type: Object, default: () => new Date().setHours(0, 0, 0, 0) })
    public lastDayTime: number;

    @prop({
        type: Object,
        default: {
            total: 0,
            channels: {},
            days: {},
        },
    })
    public voices: IVoiceBased;

    @prop({
        type: Object,
        default: {
            total: 0,
            channels: {},
            days: {},
        },
    })
    public messages: IMessages;

    @prop({
        type: Object,
        default: {
            total: 0,
            channels: {},
            days: {},
        },
    })
    public streams: IVoiceBased;

    @prop({
        type: Object,
        default: {
            total: 0,
            channels: {},
            days: {},
        },
    })
    public cameras: IVoiceBased;

    @prop({ type: Object, default: {} })
    public voiceFriends: IStat;

    @prop({ type: Object, default: {} })
    public chatFriends: IStat;

    @prop({ type: () => [Object], default: [] })
    public problemResolves: IProblemResolve[];

    @prop({ type: () => [Object], default: [] })
    public staffTakes: IStaffTake[];

    @prop({ type: () => Array, default: [] })
    public registers!: IRegister[];

    @prop({ type: () => Object, default: [] })
    public taggeds!: ITagged[];
}

export const UserStatModel = getModelForClass(UserStatClass);
