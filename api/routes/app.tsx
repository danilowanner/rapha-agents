import { Anchor, Button, Code, Container, Group, Stack, Table, Text, TextInput, Title } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import z from "zod";

import { authMiddleware } from "../authHeaderMiddleware.ts";
import type {
  AppDataFunctionInput,
  AppDataFunctionName,
  AppDataFunctionOutput,
  AppDataRequest,
} from "../features/appData/contract.ts";

const searchSchema = z.object({
  token: z.string().optional(),
  userId: z.string().optional(),
});

type DashboardProps = {
  userId?: string;
};

export const Route = createFileRoute("/app")({
  validateSearch: searchSchema,
  server: {
    middleware: [authMiddleware],
  },
  component: DashboardView,
});

function DashboardView() {
  const { userId } = Route.useSearch();
  return <Dashboard userId={userId} />;
}

function Dashboard({ userId }: DashboardProps) {
  const initialUserId = userId?.trim() ?? "";
  const [inputUserId, setInputUserId] = useState(initialUserId);
  const [selectedUserId, setSelectedUserId] = useState(initialUserId);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const conversationsQuery = useQuery({
    queryKey: ["conversations.recent", { limit: 10, userId: selectedUserId || undefined }],
    queryFn: () => appDataQuery("conversations.recent", { limit: 10, userId: selectedUserId || undefined }),
  });
  const memoryQuery = useQuery({
    queryKey: ["memory.get", { userId: selectedUserId }],
    queryFn: () => appDataQuery("memory.get", { userId: selectedUserId }),
    enabled: selectedUserId.length > 0,
  });

  const loadMemory = () => {
    const nextUserId = inputUserId.trim();
    if (nextUserId) setSelectedUserId(nextUserId);
  };

  const copyMemoryViewUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  };

  return (
    <Container size={900} p="md">
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <Title order={1}>Rapha AI Dashboard</Title>
          <Button variant="default" onClick={copyMemoryViewUrl}>
            Copy URL
          </Button>
        </Group>
        {copyStatus === "copied" && <MutedText>URL copied.</MutedText>}
        {copyStatus === "failed" && <Text c="red">Could not copy URL.</Text>}
        <Stack gap="sm">
          <Title order={2}>Recent conversations</Title>
          {conversationsQuery.isPending && <MutedText>Loading...</MutedText>}
          {conversationsQuery.isError && <Text c="red">{conversationsQuery.error.message}</Text>}
          {conversationsQuery.isSuccess && renderRecentConversations(conversationsQuery.data.conversations)}
        </Stack>
        <Stack gap="sm">
          <Group align="baseline" gap="sm">
            <Title order={2}>Memory</Title>
            {selectedUserId && (
              <Text c="dimmed" ff="monospace" fz="sm">
                {selectedUserId}
              </Text>
            )}
          </Group>
          <Group align="end" gap="sm">
            <TextInput
              flex={1}
              label="User ID"
              miw="16rem"
              value={inputUserId}
              onChange={(event) => setInputUserId(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") loadMemory();
              }}
            />
            <Button onClick={loadMemory} disabled={!inputUserId.trim()} loading={memoryQuery.isFetching}>
              Load
            </Button>
          </Group>
          {!selectedUserId && <MutedText>Enter a user ID to load memory.</MutedText>}
          {memoryQuery.isPending && selectedUserId && <MutedText>Loading...</MutedText>}
          {memoryQuery.isError && <Text c="red">{memoryQuery.error.message}</Text>}
          {memoryQuery.isSuccess && renderMemoryXml(memoryQuery.data.xml)}
        </Stack>
      </Stack>
    </Container>
  );
}

function renderRecentConversations(conversations: { id: string; createdAt: string; url: string; userId?: string }[]) {
  if (conversations.length === 0) return <MutedText>No recent conversations.</MutedText>;
  return (
    <Table>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Conversation</Table.Th>
          <Table.Th>User</Table.Th>
          <Table.Th>Created</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {conversations.map((conversation) => (
          <Table.Tr key={conversation.id}>
            <Table.Td>
              <Anchor href={conversation.url} target="_blank" rel="noreferrer">
                {conversation.id}
              </Anchor>
            </Table.Td>
            <Table.Td>{conversation.userId ?? ""}</Table.Td>
            <Table.Td>{new Date(conversation.createdAt).toLocaleString()}</Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}

function renderMemoryXml(xml: string) {
  if (!xml.trim()) return <MutedText>No memory entries.</MutedText>;
  return <Code block>{xml}</Code>;
}

function MutedText({ children }: { children: ReactNode }) {
  return (
    <Text c="dimmed" fs="italic">
      {children}
    </Text>
  );
}

async function appDataQuery<TName extends AppDataFunctionName>(
  functionName: TName,
  input: AppDataFunctionInput<TName>,
): Promise<AppDataFunctionOutput<TName>> {
  const response = await fetch(getAppDataUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ functionName, input } satisfies AppDataRequest<TName>),
  });

  if (!response.ok) throw new Error(await getAppDataError(response));
  return (await response.json()) as AppDataFunctionOutput<TName>;
}

function getAppDataUrl() {
  const url = new URL("/app-data", window.location.origin);
  const token = new URLSearchParams(window.location.search).get("token");
  if (token) url.searchParams.set("token", token);
  return url;
}

async function getAppDataError(response: Response) {
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body.error === "string") return body.error;
  } catch {
    return `App data request failed (${response.status})`;
  }
  return `App data request failed (${response.status})`;
}
