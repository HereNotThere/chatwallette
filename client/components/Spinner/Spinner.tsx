import { useEffect, useState } from "react";

const animationSequences = {
  connecting: ["[=--]", "[-=-]", "[--=]", "[-=-]"],
  dots: ["", ".", "..", "...", "..."],
};

type SpinnerMode = keyof typeof animationSequences;

type Props = {
  mode: SpinnerMode;
};

export const Spinner = (props: Props) => {
  const sequence = animationSequences[props.mode] ?? animationSequences["dots"];

  const [sequenceIndex, setSequenceIndex] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setSequenceIndex(i => (i + 1) % sequence.length);
    }, 250);
    return () => {
      clearInterval(interval);
    };
  });
  return (
    <span style={{ display: "inline-block", color: "inherit", minWidth: "1.5em" }}>{sequence[sequenceIndex]}</span>
  );
};
