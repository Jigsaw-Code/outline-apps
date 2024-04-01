/// <reference types="node" />
import { HttpExecutor } from "builder-util-runtime";
import { ClientRequest } from "http";
export declare class NodeHttpExecutor extends HttpExecutor<ClientRequest> {
    createRequest(options: any, callback: (response: any) => void): ClientRequest;
}
export declare const httpExecutor: NodeHttpExecutor;
