export type AppDataRegistry = {
  "memory.get": {
    input: {
      userId: string;
    };
    output: {
      xml: string;
    };
  };
  "conversations.recent": {
    input: {
      limit?: number;
      userId?: string;
    };
    output: {
      conversations: Array<{
        id: string;
        createdAt: string;
        url: string;
        userId: string;
      }>;
    };
  };
};

export type AppDataFunctionName = keyof AppDataRegistry;
export type AppDataFunctionInput<TName extends AppDataFunctionName> = AppDataRegistry[TName]["input"];
export type AppDataFunctionOutput<TName extends AppDataFunctionName> = AppDataRegistry[TName]["output"];
export type AppDataRequest<TName extends AppDataFunctionName = AppDataFunctionName> = {
  functionName: TName;
  input: AppDataFunctionInput<TName>;
};
export type AppDataFunctions = {
  [TName in AppDataFunctionName]: (
    input: AppDataFunctionInput<TName>,
  ) => Promise<AppDataFunctionOutput<TName>> | AppDataFunctionOutput<TName>;
};
