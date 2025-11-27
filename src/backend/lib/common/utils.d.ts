import { CfnWebACL } from "aws-cdk-lib/aws-wafv2";
interface CommonManagedRuleProperty {
    name: string;
    overrideAction?: CfnWebACL.OverrideActionProperty;
    ruleActionOverrides?: CfnWebACL.RuleActionOverrideProperty[];
}
export declare const createManagedRules: (prefix: string, startingPriority: number, rules: CommonManagedRuleProperty[]) => CfnWebACL.RuleProperty[];
export {};
