import { PythonFunction, PythonFunctionProps, PythonLayerVersion, PythonLayerVersionProps } from "@aws-cdk/aws-lambda-python-alpha";
import { NodejsFunction, NodejsFunctionProps } from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";
export declare class CommonNodejsFunction extends NodejsFunction {
    constructor(scope: Construct, id: string, props: Omit<NodejsFunctionProps, "architecture" | "runtime" | "logRetention">);
}
export declare class CommonPythonLayerVersion extends PythonLayerVersion {
    constructor(scope: Construct, id: string, props: Omit<PythonLayerVersionProps, "compatibleArchitectures" | "compatibleRuntimes">);
}
type CommonPythonFunctionProps = Omit<PythonFunctionProps, "architecture" | "runtime" | "logRetention">;
export declare class CommonPythonFunction extends PythonFunction {
    constructor(scope: Construct, id: string, props: CommonPythonFunctionProps);
}
export declare class CommonPythonPowertoolsFunction extends CommonPythonFunction {
    constructor(scope: Construct, id: string, props: CommonPythonFunctionProps);
}
export {};
