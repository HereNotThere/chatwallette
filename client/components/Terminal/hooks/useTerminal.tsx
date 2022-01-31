import React, { useEffect, useMemo, useRef, useState } from "react";
import { usePrevious } from "../../../hooks/use_previous";
import { cloneElementWithSpecifiedText, extractText } from "../util/text_parse_utils";

export type TerminalLog = (string | JSX.Element)[];

export const useTerminal = (terminalLog: TerminalLog, settings?: { cursor?: JSX.Element; maxLines?: number }) => {
  settings = useMemo(() => {
    return {
      cursor: undefined,
      maxLines: undefined,
      ...(settings ?? {}),
    };
  }, [settings]);

  const [lineNumber, setLineNumber] = useState(-1);

  const { cursor, maxLines } = settings;

  // update `currentLine` only when line number changes
  const linesRef = useRef(terminalLog);

  useEffect(() => {
    linesRef.current = terminalLog;
  }, [terminalLog]);

  const currentLine = useMemo(() => linesRef.current[lineNumber], [lineNumber]);

  const { typedNodes, isDone } = useTypeLine(currentLine);

  const prevDone = usePrevious(isDone);

  useEffect(() => {
    if (isDone && lineNumber + 1 < terminalLog.length) {
      const delay = lineNumber === -1 ? 2000 : 350;
      const timeout = setTimeout(() => {
        setLineNumber(l => l + 1);
      }, delay);
      return () => {
        clearTimeout(timeout);
      };
    }
  }, [isDone, lineNumber, terminalLog.length, prevDone]);

  // lines that have already been typed and rendered
  const completedLines = useMemo(
    () => (lineNumber >= 0 ? terminalLog.slice(0, lineNumber) : []),
    [terminalLog, lineNumber],
  );

  // transpose and clone DOM based on the text representation of the line being typed
  const renderTypingLine = useMemo(
    () => (typedNodes ? cloneElementWithSpecifiedText(terminalLog[lineNumber], typedNodes) : null),
    [terminalLog, typedNodes, lineNumber],
  );

  const renderCombined = useMemo(() => {
    return [...completedLines, renderTypingLine].slice(maxLines ? -maxLines : 0).map((line, index, arr) => (
      <div key={`line-${index}`}>
        {line}
        {index === arr.length - 1 && cursor}
      </div>
    ));
  }, [completedLines, cursor, maxLines, renderTypingLine]);

  return {
    terminalElement: <>{renderCombined}</>,
    typingDone: lineNumber + 1 === terminalLog.length && isDone,
  };
};

const useTypeLine = (sourceElement: string | JSX.Element) => {
  const [isDone, setDone] = useState(false);
  const [charPos, setCharPos] = useState(0);

  // complete line being typed, represented as a flat array of strings
  // e.g. ["...", "...", "...", ".........", "..."]
  const nodes = useMemo(() => {
    return extractText(sourceElement);
  }, [sourceElement]);

  // array mapping cursor position against node/character index
  const cursorMap = useMemo(
    () =>
      nodes.reduce((cursorMap: { nodeIndex: number; charIndex: number }[], node, nodeIndex) => {
        const a = Array(node.length)
          .fill(undefined)
          .map((_, charIndex) => ({ nodeIndex, charIndex }));
        return cursorMap.concat(a);
      }, []),
    [nodes],
  );

  useEffect(() => {
    if (nodes) {
      setDone(false);
      setCharPos(0);
    }
  }, [nodes]);

  // partial line being typed cut at cursor position
  // e.g.  ["...", "...", "...", "..." <- cursor position ]
  const typedNodes = useMemo(() => {
    if (!nodes || charPos >= cursorMap.length) {
      return;
    }
    const { nodeIndex, charIndex } = cursorMap[charPos];

    // retrieve parts until cursor position
    // cut text in last part to match cursor
    return (
      nodes
        .slice(0, nodeIndex)
        //
        .concat(nodes[nodeIndex].slice(0, charIndex + 1))
    );
  }, [nodes, cursorMap, charPos]);

  // increment cursor position
  useEffect(() => {
    if (!nodes || isDone) {
      return;
    }

    if (charPos + 1 >= cursorMap.length) {
      setDone(true);
    }

    const timeout = setTimeout(() => {
      setCharPos(c => c + 1);
    }, 25);

    return () => {
      clearTimeout(timeout);
    };
  }, [charPos, cursorMap.length, isDone, nodes]);

  return { typedNodes, isDone };
};
