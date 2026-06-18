import { forwardRef, useImperativeHandle, useRef, ReactElement, ForwardRefRenderFunction, useCallback } from "react";

import ResultBlock, { ResultBlockRef } from "./ResultBlock";


export interface ResultViewerLine {
  html: string,
  lineNo?: number | null | undefined,
  file?:string
}

export interface ResultViewerProps {
  results?: ResultViewerLine[];
  onSelect: (lineNo: number, file: string) => void;
  text2html?: (text: string) => string;
}

const ResultViewerImpl: ForwardRefRenderFunction<(line: number, file: string) => void, ResultViewerProps> = (props, ref) => {
  const currentLineNo = useRef<number>(-1);
  const lineNo2blocks = useRef<{ [lineNo: number]: ResultBlockRef }>({});

  const onSelect = useCallback((lineNo: number, file: string) => {
    console.log(`Select line ${lineNo} in file ${file}`);
    // console.log('results---',props.results)
    // console.log(lineNo2blocks)
    // Unselect the previous selected line
    lineNo2blocks.current[currentLineNo.current]?.setIsSelected(false);
    // Select the current line
    lineNo2blocks.current[lineNo]?.setIsSelected(true);
    // Update the current selected line
    currentLineNo.current = lineNo;
    // Callback
    props.onSelect(lineNo, file);
  }, [lineNo2blocks, props]);

  useImperativeHandle(ref, () => {
    return (line: number, file: string) => {
      onSelect(line, file);
      lineNo2blocks.current[line]?.scrollIntoView()
    };
  }, [lineNo2blocks, onSelect]);

  const renderResult = (props: ResultViewerProps) => {
    if (!props.results) {
      return;
    }

    // Preprocess the lineNo of results to 0-based, to be consistent with vscode editor
    const results = props.results.map(x => {
      if (x.lineNo) {
        x.lineNo--;
      }
      return x;
    });

    const resultsBlocks: ReactElement[] = [];
    let l = 0;
    let lastLineNo = -1;

    const addResultBlockWithLineNo = (key: number, lineNo: number,file:string, html: string[]) => {
      const updateLineNo2blocks = (el: ResultBlockRef) => {
        // Make sure add the first results block of target lineNo
        if (!lineNo2blocks.current[lineNo]) {
          lineNo2blocks.current[lineNo] = el;
        }
      };

      resultsBlocks.push(<ResultBlock 
                      key={key}
                      lineNo={lineNo}
                      file={file}
                      onSelect={onSelect}
                      html={html}
                      ref={updateLineNo2blocks}
                    />);
    };

    // 在group循环外部新增
    let currentGroupFile = "";

    // 循环内赋值
    for (const [i, line ] of results.entries()) {
      if (typeof line.lineNo !== 'number') {
        if (lastLineNo !== -1) {
          // 传缓存的文件
          addResultBlockWithLineNo(resultsBlocks.length, lastLineNo, currentGroupFile, results.slice(l, i).map(x => x.html));
        }
        resultsBlocks.push(<ResultBlock
                            key={resultsBlocks.length}
                            html={results.slice(i, i + 1).map(x => x.html)}
                            file={line.file}
                          />);
        lastLineNo = -1;
        l = i + 1;
      } else if (line.lineNo !== lastLineNo) {
        if (lastLineNo !== -1) {
          addResultBlockWithLineNo(resultsBlocks.length, lastLineNo, currentGroupFile, results.slice(l, i).map(x => x.html));
          l = i;
        }
        lastLineNo = line.lineNo;
        // 更新当前分组文件
        currentGroupFile = line.file ?? "";
      }
    }
    // 兜底时使用缓存的currentGroupFile，不再填空字符串
    if (lastLineNo !== -1) {
      addResultBlockWithLineNo(resultsBlocks.length, lastLineNo, currentGroupFile, results.slice(l).map(x => x.html));
    }

    return resultsBlocks;
  };

  return (<div style={{ width: '100%' }}>{renderResult(props)}</div>);
};

const ResultViewer = forwardRef(ResultViewerImpl);

export default ResultViewer;
