import { Box, Text, useInput, type Key } from "ink";
import { useState } from "react";
import type { LogEntry } from "../types/LogEntry.ts";
import { colorByComponent, colorByLevel } from "../utils/colors.ts";

type Props = {
  entries: LogEntry[];
  height: number;
};

export const ScrollableLog: React.FC<Props> = ({ entries, height }) => {
  const [offset, setOffset] = useState<number>(0); // 0 means bottom (latest)

  useInput((_, key: Key) => {
    if (key.pageDown) setOffset(0);
    if (key.pageUp) setOffset(entries.length);
    if (key.upArrow) setOffset((o: number) => Math.min(entries.length, o + 1));
    if (key.downArrow) setOffset((o: number) => Math.max(0, o - 1));
  });

  const visible = (() => {
    const startFromEnd = offset;
    const sliceEnd = entries.length - startFromEnd;
    const sliceStart = Math.max(0, sliceEnd - height);
    return entries.slice(sliceStart, sliceEnd);
  })();

  return (
    <Box flexDirection="column">
      {visible.map((e: LogEntry) => {
        const componentColor = e.component in colorByComponent ? colorByComponent[e.component] : "gray";
        const levelColor = e.level in colorByLevel ? colorByLevel[e.level] : "white";
        return (
          <Box key={e.id} flexDirection="row">
            <Box width={12}>
              <Text color={componentColor} wrap="truncate-end">
                {e.component}
              </Text>
            </Box>
            <Box flexDirection="column" marginLeft={1}>
              <Text color={levelColor}>{e.text}</Text>
              {e.details && <Text color={"gray"}>{e.details}</Text>}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
};
