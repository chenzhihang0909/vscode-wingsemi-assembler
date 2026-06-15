import * as vscode from "vscode";
import * as fs from 'fs/promises';
import { logger } from "../request/Logger";
import { WebviewPanel } from "./WebView";
import { GetEditor, WriteFile } from "../request/Utility";
import { TreeViewProvider, TreeNode } from "./TreeView";
import { GetCompilerInfos, QueryCompilerInfo } from "../request/CompilerInfo";
import { Compile, GetShortLink, LoadShortLink } from "../request/Request";
import { CompilerInstance, SingleFileInstance, MultiFileInstance } from "./Instance";
import * as path from 'path';
import makeToCMake from "./convent";
let provider: TreeViewProvider;
let treeView: vscode.TreeView<TreeNode>;

export async function Register(context: vscode.ExtensionContext) {
    // 关键：去掉 await，同步创建
    provider = TreeViewProvider.create();

    treeView = vscode.window.createTreeView("wingsemi-assembler.view", { treeDataProvider: provider });

    // checkbox api is available since vscode 1.80.0
    // if the version is lower than 1.80.0, use command to toggle checkbox
    if (vscode.version >= "1.80.0") {
        treeView.onDidChangeCheckboxState(async (event) => {
            const [[node]] = event.items;
            const { attr, instance } = node;
            //@ts-ignore
            instance.filters[attr] = !instance.filters[attr];
            provider.refresh();
        });
    } else {
        vscode.commands.registerCommand("wingsemi-assembler.toggleCheckbox", async (node: TreeNode) => {
            const { attr, instance } = node;
            //@ts-ignore
            instance.filters[attr] = !instance.filters[attr];
            provider.refresh();
        });
    }

    RegisterView(context);
    RegisterInstance(context);
    RegisterSelect(context);
    RegisterText(context);
    RegisterItem(context);

    context.subscriptions.push(treeView);

    return { provider, treeView };
}

async function Resolve(context: vscode.ExtensionContext, fromStudio: any) {
    // if (instance.output === "webview") {
        const editor = GetEditor("active");
        const panel = new WebviewPanel({ context, editor });

        while (!panel.ready) {
            await new Promise((resolve) => setTimeout(resolve, 100));
        }

        const result = await Compile(fromStudio);
        panel.postMessage(result);
    // } else {
    //     const result = await Compile(instance);
    //     const asm = result?.compileResult?.asm?.map((asm) => asm.text).join("\n") || "";
    //     WriteFile(instance.output, asm);
    // }
}

/**
 * Register commands for the view
 * see that "menus": "view/title" in package.json
 */
function RegisterView(context: vscode.ExtensionContext) {
    const AddSingleInstance = vscode.commands.registerCommand("wingsemi-assembler.AddSingleInstance", async () => {
        provider.instances.push(await SingleFileInstance.create());
        provider.refresh();
    });

    const AddMultiInstance = vscode.commands.registerCommand("wingsemi-assembler.AddMultiInstance", async () => {
        provider.instances.push(await MultiFileInstance.create());
        provider.refresh();
    });

    const CompileAll = vscode.commands.registerCommand("wingsemi-assembler.CompileAll", async () => {
        const instances = provider.instances;
        try {
            const compilePromises = instances.map(async (instance) => {
                await Resolve(context, instance);
            });
            await Promise.all(compilePromises);
        } catch (error: unknown) {
            logger.error(`Compile failed while compile all, error: ${error}`);
        }
    });

    // const GetLink = vscode.commands.registerCommand("wingsemi-assembler.GetLink", async () => {
    //     const instances = provider.instances;
    //     const link = await GetShortLink(instances);
    //     vscode.env.clipboard.writeText(link);
    //     logger.info(`The link has been copied to the clipboard: "${link}"`);
    // });

    // const LoadLink = vscode.commands.registerCommand("wingsemi-assembler.LoadLink", async () => {
    //     const link = await vscode.window.showInputBox({ placeHolder: "Enter link" });
    //     if (link) {
    //         try {
    //             const instances = await LoadShortLink(link);
    //             provider.instances = instances;
    //             provider.refresh();
    //         } catch (error: unknown) {
    //             logger.error(`Load link failed while load link, error: ${error}`);
    //         }
    //     }
    // });

    const RemoveAll = vscode.commands.registerCommand("wingsemi-assembler.RemoveAll", async () => {
        provider.instances = [];
        provider.refresh();
    });

    // const Clear = vscode.commands.registerCommand("wingsemi-assembler.Clear", async () => {
    //     WebviewPanel.clear();
    // });

    context.subscriptions.push(AddSingleInstance);
    context.subscriptions.push(CompileAll);
    // context.subscriptions.push(GetLink);
    context.subscriptions.push(AddMultiInstance);
    // context.subscriptions.push(LoadLink);
    context.subscriptions.push(RemoveAll);
    // context.subscriptions.push(Clear);
}

/**
 * Register commands for the instance
 * see that "menus": "view/item/context", "when": viewItem == instance, in package.json
 */
function RegisterInstance(context: vscode.ExtensionContext) {
    const Compile_ = vscode.commands.registerCommand("wingsemi-assembler.Compile", async (fromStudio:any) => {
        try {
            logger.info(fromStudio)
            
            // 获取makefile信息
            const workspaceRoot = vscode.workspace.workspaceFolders![0].uri.fsPath;
            logger.info(workspaceRoot)
            const activeFile =vscode.Uri.parse(fromStudio).fsPath.replace(workspaceRoot, "")
            logger.info(activeFile)
            const folderName = activeFile.replace(/[\\/]/g, "/").replace(/^\/+/, "").split("/")[0] || "";
            const makefilePath = path.join(workspaceRoot,folderName, 'output', 'makefile');
            const projectSettingPath = path.join(workspaceRoot,folderName, 'config', 'setting.json');
            let makefileJsonContent = '';
            let projectSettingJsonContent:any = {};
            let CorePath = '';
            try {
                const makefileContent = await fs.readFile(makefilePath, 'utf8');
                makefileJsonContent =  makefileContent.toString()
                const projectSettingContent = await fs.readFile(projectSettingPath, 'utf8');
                projectSettingJsonContent = JSON.parse(projectSettingContent);
                if(projectSettingJsonContent['Core']){
                    CorePath = projectSettingJsonContent['Core'].path;
                }else{
                    throw new Error('Invalid project setting file: missing "Core" field');
                }
            }catch(err){
                logger.error(`Failed to read makefile, error: ${(err as Error).message}`);
                return
            }
            
            logger.info(activeFile)
            logger.info(workspaceRoot)
            logger.info(folderName)
            // logger.info(makefileJsonContent)
            // logger.info(makeToCMake(makefileJsonContent))
            // 获取clang信息
            await Resolve(context, {compilerInfo:{id:'riscv-clang',
                objdumper:path.join(CorePath,'llvm','bin','llvm-objdump'),
                exe:path.join(CorePath,'llvm','bin','clang')
            }, src: {src:path.join(workspaceRoot,folderName),cmakeSource: makeToCMake(makefileJsonContent)}});
        } catch (error: unknown) {
            logger.error(
                `error: ${(error as Error).message}`
            );
        }
    });

    const Clone = vscode.commands.registerCommand("wingsemi-assembler.Clone", async (node: TreeNode) => {
        const instance = node.instance as CompilerInstance;
        provider.instances.push(instance.copy());
        provider.refresh();
    });

    const Remove = vscode.commands.registerCommand("wingsemi-assembler.Remove", async (node: TreeNode) => {
        const index = provider.instances.indexOf(node.instance as CompilerInstance);
        provider.instances.splice(index, 1);
        provider.refresh();
    });

    context.subscriptions.push(Compile_);
    context.subscriptions.push(Clone);
    context.subscriptions.push(Remove);
}
/**
 * Register commands for the select
 * see that "menus": "view/item/context", "when": viewItem == select, in package.json
 */
function RegisterSelect(context: vscode.ExtensionContext) {
    const SelectCompiler = vscode.commands.registerCommand(
        "wingsemi-assembler.SelectCompiler",
        async (node: TreeNode) => {
            const infos = await GetCompilerInfos();
            const options = Array.from(infos.keys()).map((name) => ({ label: name }));

            const selectedOption = await vscode.window.showQuickPick(options, {
                placeHolder: "Select a compiler",
            });

            if (selectedOption) {
                const instance = node.instance as CompilerInstance;
                instance.compilerInfo = await QueryCompilerInfo(selectedOption.label);
                provider.refresh();
            }
        }
    );

    context.subscriptions.push(SelectCompiler);
}

/**
 * Register commands for the text,
 * see that "menus": "view/item/context", "when": viewItem == text, in package.json
 */
function RegisterText(context: vscode.ExtensionContext) {
    const GetInput = vscode.commands.registerCommand("wingsemi-assembler.GetInput", async (node: TreeNode) => {
        const { attr, instance } = node;
        //@ts-ignore
        const last = instance[attr].value as string;
        const userInput = await vscode.window.showInputBox({
            placeHolder: "Enter the text",
            value: last,
        });

        if (userInput) {
            //@ts-ignore
            instance[attr] = { value: userInput, isPath: false };
            provider.refresh();
        }
    });

    const ClearInput = vscode.commands.registerCommand("wingsemi-assembler.ClearInput", async (node: TreeNode) => {
        const { attr, instance } = node;
        //@ts-ignore
        instance[attr].value = "";
        provider.refresh();
    });

    const CopyText = vscode.commands.registerCommand("wingsemi-assembler.CopyText", async (node: TreeNode) => {
        vscode.env.clipboard.writeText(node.label as string);
    });

    const OpenTempFile = vscode.commands.registerCommand("wingsemi-assembler.OpenTempFile", async (node: TreeNode) => {
        const { attr, instance, context } = node;
        if (context === "text") {
            //@ts-ignore
            await vscode.commands.executeCommand("workbench.action.files.newUntitledFile");
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                const path = editor.document.uri.fsPath;
                //@ts-ignore
                instance[attr] = { value: path, isPath: true };
                provider.refresh();
            } else {
                logger.error("No active editor found");
            }
        }
    });

    context.subscriptions.push(GetInput);
    context.subscriptions.push(ClearInput);
    context.subscriptions.push(CopyText);
    context.subscriptions.push(OpenTempFile);
}

/**
 * Register commands for the item, see that "menus": "view/item/context" in package.json
 */
function RegisterItem(context: vscode.ExtensionContext) {
    const SelectFile = vscode.commands.registerCommand("wingsemi-assembler.SelectFile", async (node: TreeNode) => {
        const uri = await vscode.window.showOpenDialog({
            canSelectMany: false,
            canSelectFiles: true,
            canSelectFolders: false,
        });

        if (uri) {
            const { attr, instance, context } = node;
            if (context === "file") {
                //@ts-ignore
                instance[attr] = uri[0].fsPath;
            } else if (context === "text") {
                //@ts-ignore
                instance[attr] = { value: uri[0].fsPath, isPath: true };
            }
            provider.refresh();
        }
    });

    const SelectFolder = vscode.commands.registerCommand("wingsemi-assembler.SelectFolder", async (node: TreeNode) => {
        const uri = await vscode.window.showOpenDialog({
            canSelectFolders: true,
            canSelectFiles: false,
            canSelectMany: false,
        });
        if (uri) {
            const { attr, instance, context } = node;
            if (context === "folder") {
                //@ts-ignore
                instance[attr] = uri[0].fsPath;
            }
            provider.refresh();
        }
    });

    context.subscriptions.push(SelectFile);
    context.subscriptions.push(SelectFolder);
}