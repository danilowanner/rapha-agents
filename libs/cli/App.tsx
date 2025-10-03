import type { Key } from "ink";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { useAtomValue } from "jotai";
import React, { useCallback, useEffect, useState } from "react";

import { ScrollableLog } from "./components/ScrollableLog.tsx";
import { addLogEntry, logEntriesAtom } from "./store.ts";

type Props = {
  onCommand: (command: string) => void;
};

export const App: React.FC<Props> = ({ onCommand }) => {
  const entries = useAtomValue(logEntriesAtom);
  const [command, setCommand] = useState("");
  const [mode, setMode] = useState<"normal" | "debug">("normal");
  const [height, setHeight] = useState(process.stdout.rows - 4);

  useEffect(() => {
    const onResize = () => setHeight(process.stdout.rows - 4);
    process.stdout.on("resize", onResize);
    return () => {
      process.stdout.off("resize", onResize);
    };
  }, []);

  const submit = useCallback(() => {
    const value = command.trim();
    if (!value) return;
    switch (value) {
      case "debug":
        setMode("debug");
        break;
      case "normal":
        setMode("normal");
        break;
      default:
        addLogEntry({ component: "CLI", level: "notice", text: value });
        onCommand(value);
        break;
    }
    setCommand("");
  }, [command, onCommand]);

  useInput((_, key: Key) => {
    if (key.return) submit();
  });

  const filteredEntries = entries.filter((e) => (mode === "debug" ? true : e.level !== "debug"));

  return (
    <Box flexDirection="column">
      <Box flexGrow={1} borderStyle="round" borderColor="gray" paddingX={1} paddingY={0}>
        <ScrollableLog entries={filteredEntries} height={height} />
      </Box>
      <Box>
        <Text color="cyan">Command: </Text>
        <TextInput value={command} onChange={setCommand} />
        <Text color="gray"> (mode: {mode})</Text>
      </Box>
      <Box>
        <Text color="gray">Arrows/PageUp/PageDown scroll. Commands: </Text>
        <Text color="cyan">exit debug normal</Text>
        <Text color="gray"> Enter to submit.</Text>
      </Box>
    </Box>
  );
};
