import * as vscode from "vscode";

class Logger {
    readonly logger: vscode.OutputChannel;

    constructor() {
        this.logger = vscode.window.createOutputChannel("Wingsemi Assembler");
        this.logger.appendLine("Wingsemi Assembler is now active!");
    }

    info(message: string) {
        this.logger.appendLine(message);
    }

    error(message: string) {
        this.logger.appendLine(`Error: ${message}`);
        this.logger.show();
    }

    internal_error(message: string) {
        this.logger.appendLine(`Unexpected internal Error: ${message}, please report this issue.`);
        this.logger.show();
    }

    dispose() {
        this.logger.dispose();
    }
}

export function initLogger() {
    logger = new Logger();
}

export let logger: Logger;
