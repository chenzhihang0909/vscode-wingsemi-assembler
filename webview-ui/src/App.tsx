
import ResultViewer from './components/ResultViewer';
// import { AnsiUp } from 'ansi_up';
import { useEffect, useRef, useState } from 'react';

import { highlight } from '../../src/highlight/x86Intel';
import { MessageBase, useVsCode } from './utils/useVsCode';
import { Response } from '../../src/request/CompileResult'
import { VSCodePanels, VSCodePanelTab, VSCodePanelView, VSCodeProgressRing } from '@vscode/webview-ui-toolkit/react';

// const ansiUp = new AnsiUp();

const changeFontSize = (node: HTMLElement, newSize: number) => {
  if (node.style.fontSize !== `${newSize}px`) {
    node.style.fontSize = `${newSize}px`;
  }
  for (const child of Array.from(node.children) as HTMLElement[]) {
    changeFontSize(child, newSize);
  }
};

function App() {
  const [fontSize, setFontSize] = useState(14.0);  // Zoom in/out with Ctrl + Mouse Wheel
  const [isLoaded, setIsLoaded] = useState(true);
  const [response, setResponse] = useState<Response>();

  const activeId = useRef<string>('asm');
  const gotoLine = useRef<{ [tabId: string]: null | ((lineNo: number, file: string) => void) }>({});

  const [sendMessage] = useVsCode(message => {
    switch (message.command) {
      case 'setResults': {
        setIsLoaded(false);
        type SetResultsMsg = MessageBase & { results: Response };
        setResponse((message as SetResultsMsg).results);
      } break;
      case 'gotoLine': {
        // console.log('form---serve', message)
        // console.log('---r',response)
        type GotoLineMsg = MessageBase & { lineNo: number, file: string };
        const f = gotoLine.current[activeId.current];
        if (f) {
          f((message as GotoLineMsg).lineNo, (message as GotoLineMsg).file);
        }
      } break;
      case 'codetoLine': {
        
        type GotoLineMsg = MessageBase & { lineNo: number, file: string };
        let rlist:any = response?.compileResult.asm?.filter(item=>{
          return item.source != null
        })
        let keylist:any = {}
        rlist.forEach((item: any) => {
            const key = item.source.line - 1;
            if (!keylist[key]) {
                keylist[key] = [];
            }
            keylist[key].push(item);
        });
        let findindex = -1
        for(let i in keylist){
          let one = keylist[i].find((item:any)=>{
            return item.source.file === (message as GotoLineMsg).file && item.source.line === (message as GotoLineMsg).lineNo
          })
          if(one){
            findindex = Number(i)
          }
        }
        if(findindex != -1){
           const f = gotoLine.current[activeId.current];
            if (f) {
              f(findindex, (message as GotoLineMsg).file);
            }
        }
       
      } break;
    }
  });

  useEffect(() => sendMessage({ command: 'ready' }), [sendMessage]);

  useEffect(() => {
    const handleWheelEvent = (event: WheelEvent) => {
      if (event.ctrlKey) {
        event.preventDefault();
        const zoomDelta = event.deltaY > 0 ? -0.5 : 0.5;
        setFontSize((prevFontSize) => prevFontSize + zoomDelta);

        const element = document.getElementById('view')!;
        changeFontSize(element, fontSize + zoomDelta);
      }
    };

    document.addEventListener('wheel', handleWheelEvent);

    return () => {
      document.removeEventListener('wheel', handleWheelEvent);
    };
  }, [fontSize]);

  const asmText2html = (text: string) => highlight(text);
  // const consoleText2html = (text: string) => `<span class="wingsemi-assembler-output">${ansiUp.ansi_to_html(text)}</span>`;

  // const consoleOutput = (() => {
  //   const result: { html: string, lineNo: number | null }[] = [];
  //   for (const step of response?.compileResult?.buildsteps || []) {
  //     for (const line of step.stdout) {
  //       result.push({ html: consoleText2html(line.text), lineNo: null });
  //     }
  //   }
  //   for (const step of response?.compileResult?.buildsteps || []) {
  //     for (const line of step.stderr) {
  //       result.push({ html: consoleText2html(line.text), lineNo: null });
  //     }
  //   }

  //   // for cmake
  //   response?.compileResult?.result?.stderr?.forEach(x => result.push({ html: consoleText2html(x.text), lineNo: null }));
  //   response?.compileResult?.result?.stdout?.forEach(x => result.push({ html: consoleText2html(x.text), lineNo: null }));

  //   // for single file
  //   response?.compileResult?.stderr?.forEach(x => result.push({ html: consoleText2html(x.text), lineNo: null }));
  //   response?.compileResult?.stdout?.forEach(x => result.push({ html: consoleText2html(x.text), lineNo: null }));

  //   return result;
  // })();

  const asmRes = ((response?.compileResult.result?.asm || response?.compileResult.asm))?.map(x => ({ html: asmText2html(x.text), lineNo: x.source?.line, file: x.source?.file ?? "" }));
  // const execStdoutRes = (response?.executeResult?.execResult || response?.executeResult)?.stdout?.map(x => ({ html: consoleText2html(x.text) }));


  const onSelect = (line: number, file: string) => {
    // @ts-expect-error TODO: better type hint
    sendMessage({ command: 'gotoLine', lineNo: line, file });
  };

  if (isLoaded) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <VSCodeProgressRing />
      </div>
    );
  }

  return (<>
    <VSCodePanels id="view" aria-label='Wingsemi Assembler' activeidChanged={(_, newValue) => activeId.current = newValue} style={{ height: '100vh' }}>
      {/* <VSCodePanelTab id='stderr' className='wingsemi-assembler-output'>Console</VSCodePanelTab> */}
      <VSCodePanelTab id='asm' className='wingsemi-assembler-output'>ASM</VSCodePanelTab>
      {/* <VSCodePanelTab id='exeout' className='wingsemi-assembler-output'>Stdout</VSCodePanelTab> */}
      {/* <VSCodePanelView id='stderr'>
        <ResultViewer results={consoleOutput} onSelect={onSelect} text2html={consoleText2html} ref={f => gotoLine.current.stderr = f} />
      </VSCodePanelView> */}
      <VSCodePanelView id='asm'>
        <ResultViewer results={asmRes} onSelect={onSelect} text2html={asmText2html} ref={f => gotoLine.current.asm = f} />
      </VSCodePanelView>
      {/* <VSCodePanelView id='stdout'>
        <ResultViewer results={execStdoutRes} onSelect={onSelect} text2html={consoleText2html} ref={f => gotoLine.current.exeout = f} />
      </VSCodePanelView> */}
    </VSCodePanels>
  </>);
}

export default App
