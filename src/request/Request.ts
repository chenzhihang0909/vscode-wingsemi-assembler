import axios from "axios";

import { logger } from "./Logger";
import { retry } from "./Utility";
import { Response } from "./CompileResult";
import { ClientState } from "./ClientState";
import { CompileRequest } from "./CompileRequest";
import { CompilerInstance } from "../view/Instance";

export async function Compile(instance: any): Promise<Response> {
    logger.info(`Compile request: ${JSON.stringify(instance.compilerInfo)}`);
    const request = await CompileRequest.from(instance);
    logger.info(`Compile request: ${JSON.stringify(request.options)}`);
    const headers = { "Content-Type": "application/json; charset=utf-8" };
    const suffix =  "/cmake";
    const url = `http://127.0.0.1:10240/api/compiler/riscv-clang${suffix}`;

    return retry("Compiling", async () => {
        logger.info(`Request for Compile from "${url}"`);
        const compileResult = await axios.post(url, JSON.stringify(request), { headers: headers });

        if (instance.compilerInfo.supportsExecute && instance.filters.execute) {
            request.options.fitExecute();

            logger.info(`Request for Execute from "${url}"`);
            const executeResult = await axios.post(url, JSON.stringify(request), { headers: headers });
            return { compileResult: compileResult.data, executeResult: executeResult.data };
        }

        return { compileResult: compileResult.data.result };
    });
}

export async function GetShortLink(instances: CompilerInstance[]): Promise<string> {
    const request = await ClientState.from(instances);
    const headers = { "Content-Type": "application/json; charset=utf-8" };
    const url = "http://127.0.0.1:10240/api/shortener";

    return retry("Get Short Link", async () => {
        logger.info(`Request for short link from "${url}"`);
        const response = await axios.post(url, JSON.stringify(request), { headers: headers });
        return response.data.url;
    });
}

export async function LoadShortLink(link: string): Promise<CompilerInstance[]> {
    const url = "http://127.0.0.1:10240/api/shortlinkinfo/" + link.split("/").pop();

    return retry("Loading ShortLink", async () => {
        logger.info(`Request for short link info from "${url}"`);
        const response = await axios.get(url);
        const state = new ClientState();
        Object.assign(state, response.data);
        return state.toInstances();
    });
}
