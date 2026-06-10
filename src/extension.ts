import * as vscode from "vscode";

import { Register } from "./view/Command";
import { SetProxy } from "./request/Utility";
import { WebviewPanel } from "./view/WebView";
import { logger, initLogger } from "./request/Logger";
import { TreeViewProvider, TreeNode } from "./view/TreeView";

interface API {
    provider: TreeViewProvider;
    treeView: vscode.TreeView<TreeNode>;
    context: vscode.ExtensionContext;
    panels: vscode.WebviewPanel[];
}

export async function activate(context: vscode.ExtensionContext) {
    initLogger();
    SetProxy();

    // 同步注册，不等待
    const { provider, treeView } = await Register(context);

    // 数据异步后台加载，不阻塞视图
    (async () => {
        try {
            const url = provider.defaultURL();
            if (url !== "") {
                provider.instances = await provider.loadShortLink(url);
            } else {
                provider.instances.push(await provider.createSingleFileInstance());
            }
        } catch (err) {
            console.error("初始化实例失败", err);
        }

        provider.refresh();
    })();

    return { provider, treeView, context, panels: WebviewPanel.panels };
}

export function deactivate() {
    logger.dispose();
    WebviewPanel.clear();
}