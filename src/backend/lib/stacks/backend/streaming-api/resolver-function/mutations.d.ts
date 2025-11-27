import * as APITypes from "./types";
type GeneratedMutation<InputType, OutputType> = string & {
    __generatedMutationInput: InputType;
    __generatedMutationOutput: OutputType;
};
export declare const sendChat: GeneratedMutation<APITypes.SendChatMutationVariables, APITypes.SendChatMutation>;
export declare const createChat: GeneratedMutation<APITypes.CreateChatMutationVariables, APITypes.CreateChatMutation>;
export declare const updateChat: GeneratedMutation<APITypes.UpdateChatMutationVariables, APITypes.UpdateChatMutation>;
export declare const deleteChat: GeneratedMutation<APITypes.DeleteChatMutationVariables, APITypes.DeleteChatMutation>;
export declare const createSession: GeneratedMutation<APITypes.CreateSessionMutationVariables, APITypes.CreateSessionMutation>;
export declare const updateSession: GeneratedMutation<APITypes.UpdateSessionMutationVariables, APITypes.UpdateSessionMutation>;
export declare const deleteSession: GeneratedMutation<APITypes.DeleteSessionMutationVariables, APITypes.DeleteSessionMutation>;
export {};
