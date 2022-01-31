import { useCallback, useState } from "react";
import { SpanText } from "../Text/Text";

type Props = {
  onYesSelected?: () => void;
  onNoSelected?: () => void;
};

export const RandomPrompt = (props: Props) => {
  const { onYesSelected, onNoSelected } = props;
  const [preference, setPreference] = useState<boolean | null>(null);

  const preferenceChosen = preference !== null;

  const handleYesClicked = useCallback(() => {
    if (preferenceChosen) return;
    setPreference(true);
    onYesSelected && onYesSelected();
  }, [onYesSelected, preferenceChosen]);

  const handleNoClicked = useCallback(() => {
    if (preferenceChosen) return;
    setPreference(false);
    onNoSelected && onNoSelected();
  }, [onNoSelected, preferenceChosen]);

  return (
    <>
      {preference !== false && (
        <SpanText
          style={{ cursor: preferenceChosen ? "auto" : "pointer" }}
          textColor={preferenceChosen ? "LightPurple" : "Turqoise"}
          bold
          onClick={handleYesClicked}
        >
          YES
        </SpanText>
      )}
      {preference === null && (
        <SpanText textColor="Turqoise" bold>
          {" "}
          /{" "}
        </SpanText>
      )}
      {preference !== true && (
        <SpanText
          style={{ cursor: preferenceChosen ? "auto" : "pointer" }}
          textColor={preferenceChosen ? "LightPurple" : "Turqoise"}
          bold
          onClick={handleNoClicked}
        >
          NO
        </SpanText>
      )}
    </>
  );
};
