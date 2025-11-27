import { AppSyncResolverEvent } from "aws-lambda";
interface Arguments {
    sessionId: string;
    human: string;
    sessionAttributes?: Record<string, any>;
}
export declare const handler: (event: AppSyncResolverEvent<Arguments>) => Promise<string>;
export {};
