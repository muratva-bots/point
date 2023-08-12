import { BonusLogFlags, StaffTakeFlags, TaskFlags } from '@/enums';
import { prop, getModelForClass, modelOptions } from '@typegoose/typegoose';

export interface IStaffTask {
    channel?: string;
    type: TaskFlags;
    count: number;
    currentCount: number;
    completed: boolean;
}

interface IProblemResolve {
    reason: string;
    channelId: string;
    createdTimestamp: number;
    endTimestamp: number;
    insideRoom: string[];
    isResuming: boolean;
}

interface IOldRole {
    startTimestamp: number;
    finishTimestamp: number;
    admin: string;
    role: string;
    type: StaffTakeFlags;
}

interface IStaffTake {
    user: string;
    time: number;
    role: string;
}

interface ITagged {
    user: string;
    time: number;
}

interface IBonusLog {
    staff: string;
    reason: string;
    type: BonusLogFlags;
    time: number;
    point: number;
}

@modelOptions({ options: { customName: 'Staffs', allowMixed: 0 } })
export class StaffClass {
    @prop({ type: () => String, required: true })
    public id: string;

    @prop({ type: () => String, required: true })
    public guild: string;

    @prop({ type: () => Number, default: 0 })
    public pointsRating: number;

    @prop({ type: () => Number, default: 0 })
    public totalPoints: number;

    @prop({ type: () => Number, default: 0 })
    public allPoints: number;

    @prop({ type: () => Number, default: () => Date.now() })
    public staffStartTime: number;

    @prop({ type: () => Number, default: () => Date.now() })
    public roleStartTime: number;

    @prop({ type: () => Number, default: 0 })
    public bonusPoints: number;

    @prop({ type: () => [Object], default: [] })
    public bonusLogs: IBonusLog[];

    @prop({ type: () => Number, default: 0 })
    public lastWeekPoints: number;

    @prop({ type: () => Number, default: 0 })
    public publicPoints: number;

    @prop({ type: () => Number, default: 0 })
    public registerPoints: number;

    @prop({ type: () => Number, default: 0 })
    public sleepPoints: number;

    @prop({ type: () => Number, default: 0 })
    public responsibilityPoints: number;

    @prop({ type: () => [String], default: [] })
    public inviteUsers: string[];

    @prop({ type: () => [String], default: [] })
    public taggeds: ITagged[];

    @prop({ type: () => Number, default: 0 })
    public messagePoints: number;

    @prop({ type: () => Boolean, default: false })
    public inGeneralMeeting: boolean;

    @prop({ type: () => Boolean, default: false })
    public inRoleMeeting: boolean;

    @prop({ type: () => Boolean, default: false })
    public inPersonalMeeting: boolean;

    @prop({ type: () => [Object], default: [] })
    public problemResolves: IProblemResolve[];

    @prop({ type: () => [Object], default: [] })
    public staffTakes: IStaffTake[];

    @prop({ type: () => [Object], default: [] })
    public oldRoles: IOldRole[];

    @prop({ type: () => [Object], default: [] })
    public tasks: IStaffTask[];
}

export const StaffModel = getModelForClass(StaffClass);
