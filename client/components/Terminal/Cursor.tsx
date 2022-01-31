import styled from "styled-components";

export const StyledCursor = styled.div`
  position: absolute;
  bottom: 0;
  width: 8px;
  height: calc(var(--bl1) * 2.5);
  background: var(--color-light-purple);
  transform: translateY(calc(var(--bl1) * 0.5));

  animation: 1s blink infinite;

  @keyframes blink {
    0% {
      opacity: 1;
    }

    40% {
      opacity: 1;
    }
    50% {
      opacity: 0;
    }
    90% {
      opacity: 0;
    }
    100% {
      opacity: 1;
    }
  }
`;

export const CursorContainer = styled.div`
  position: relative;
  display: inline-block;
`;

export const Cursor = () => (
  <CursorContainer>
    <StyledCursor />
  </CursorContainer>
);
