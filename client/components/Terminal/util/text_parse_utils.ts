import React from "react";

/** utilities based on https://github.com/jstejada/react-typist */

function isValidReactElement(element: React.ReactNode): element is React.ReactElement {
  return React.isValidElement(element);
}

function exclude(obj: { [key: string]: any }, keys: string[]) {
  const res: { [key: string]: any } = {};
  for (const key in obj) {
    if (keys.indexOf(key) === -1) {
      res[key] = obj[key];
    }
  }
  return res;
}

const SYMBOL_CHAR = "ß";

const isSymbol = (element: JSX.Element) => {
  const count = React.Children.count(element.props.children);
  return !count;
};

function cloneElement(element: JSX.Element, children: React.ReactNode[]) {
  const tag = element.type;
  const props = exclude(element.props, ["children"]);
  const getMilliseconds = new Date().getUTCMilliseconds();
  const randomStamp = getMilliseconds + Math.random() + Math.random();

  props.key = `Typist-element-${typeof tag === "string" ? tag : "tag"}-${randomStamp}`;
  return React.createElement(tag, props, ...children);
}

export function extractText(element: React.ReactChild) {
  const stack = element ? [element] : [];
  const lines = [];

  while (stack.length > 0) {
    const current = stack.pop();
    if (React.isValidElement(current)) {
      if (isSymbol(current)) {
        lines.unshift(SYMBOL_CHAR);
      } else {
        React.Children.forEach(current.props.children, child => {
          stack.push(child);
        });
      }
    } else if (Array.isArray(current)) {
      for (const el of current) {
        stack.push(el);
      }
    } else if (typeof current === "string") {
      lines.unshift(current);
    }
  }

  return lines;
}

export function cloneElementWithSpecifiedTextAtIndex(
  element: React.ReactNode,
  parts: string[],
  textIdx: number,
): [React.ReactNode, number] {
  if (textIdx >= parts.length) {
    return [undefined, textIdx];
  }

  let idx = textIdx;
  const recurse = (el: React.ReactNode) => {
    const [child, advIdx] = cloneElementWithSpecifiedTextAtIndex(el, parts, idx);
    idx = advIdx;
    return child;
  };

  const isNonTypistElement = isValidReactElement(element);
  // && !(isBackspaceElement(element) || isDelayElement(element));

  if (isNonTypistElement) {
    if (isSymbol(element)) {
      const symbol = parts[idx] === SYMBOL_CHAR ? element : undefined;
      return [symbol, idx + 1];
    } else {
      const clonedChildren = React.Children.map(element.props.children, recurse) || [];
      return [cloneElement(element, clonedChildren), idx];
    }
  }

  if (Array.isArray(element)) {
    const children = element.map(recurse);
    return [children, idx];
  }

  // Anything that isn't a React element or an Array is interpreted as text
  return [parts[idx], idx + 1];
}

export function cloneElementWithSpecifiedText(element: React.ReactNode, parts: string[]) {
  if (!element) {
    return undefined;
  }

  return cloneElementWithSpecifiedTextAtIndex(element, parts, 0)[0];
}
