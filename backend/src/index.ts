import { ToolNode } from "@langchain/langgraph/prebuilt";
import {
  Annotation,
  END,
  START,
  StateGraph,
  NodeInterrupt,
  MessagesAnnotation,
  type SingleReducer,
  type BinaryOperator, // For explicit typing of reducer functions
} from "@langchain/langgraph";
// Removed problematic import: import { LastValueReducer, MessagesReducer } from "@langchain/langgraph/channels"; 
import {
  BaseMessage,
  ToolMessage,
  AIMessage,
  type AIMessage as AIMessageType,
} from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import {
  priceSnapshotTool,
  StockPurchase,
  ALL_TOOLS_LIST,
  webSearchTool,
} from "./tools.js";
import { z } from "zod";

// Use Annotation.Root primarily for deriving the State type for type safety in nodes
const AppStateSchema = Annotation.Root({
  messages: MessagesAnnotation.spec.messages, // Essential for AppStateSchema.State.messages to be BaseMessage[]
  requestedStockPurchaseDetails: Annotation<StockPurchase | null>(), // Essential for AppStateSchema.State.requestedStockPurchaseDetails type
});

// Define constants for node names
const LLM_NODE = "llm";
const TOOLS_NODE = "tools";
const PREPARE_PURCHASE_NODE = "prepare_purchase_details";
const EXECUTE_PURCHASE_NODE = "execute_purchase";

const llm = new ChatOpenAI({
  model: "gpt-4o",
  temperature: 0,
});

const toolNode = new ToolNode(ALL_TOOLS_LIST);

const callModel = async (state: typeof AppStateSchema.State): Promise<Partial<typeof AppStateSchema.State>> => {
  const { messages } = state;
  const systemMessage = {
    role: "system",
    content:
      "You are an expert financial analyst. Your primary goal is to answer user questions about companies and financial markets. " +
      "First, attempt to answer questions using your internal knowledge base. " +
      "If the question requires real-time data (like current stock prices), specific financial figures not in your general knowledge, details about very recent events, or tasks like stock purchasing, then use the appropriate tool from your available tools. " +
      "When a company name is mentioned (e.g., 'Apple', 'McDonald\\'s'), if you recognize the company and confidently know its stock ticker, use that ticker directly when invoking financial tools that require it. Do NOT use the webSearchTool to find the ticker for commonly known companies unless you are unsure or the company is obscure. " +
      "When using tools, prioritize the most specific tool for the task. Break down complex queries into multiple steps if necessary. " +
      "If you are unsure whether to use a tool, briefly explain why you think a tool might be needed or why your internal knowledge might be insufficient.\n\n" +
      "Tool Guide:\n" +
      "1. `financialsSearchTool`: Your **primary tool** for finding companies based on financial criteria (e.g., revenue > $1B, net_income > $100M). Use its `filters` for direct criteria. \n" +
      "   - For criteria not directly filterable by this tool (like specific growth rates or sorting by metrics from other tools like P/E ratio), you may need a multi-step process:\n" +
      "     a. Use `financialsSearchTool` for the initial screen with available filters (e.g., revenue).\n" +
      "     b. For each company found, you might then need to use `financialMetricsSnapshotTool` to get additional metrics (like P/E ratio for sorting) or data to calculate growth.\n" +
      "     c. To calculate growth rates (e.g., revenue growth), you might need to fetch financial data for the current and a previous period (e.g., using `financialsSearchTool` with different `period` settings or by fetching historical income statements using `incomeStatementsTool`), then perform the calculation.\n" +
      "   - Example: For 'companies with >$10B revenue, 10% revenue growth, sorted by P/E': \n" +
      "     Step 1: Use `financialsSearchTool` to find companies with revenue > $10B (TTM).\n" +
      "     Step 2: For each, get previous year\\'s TTM revenue (e.g. another `financialsSearchTool` call or `incomeStatementsTool`). Calculate growth.\n" +
      "     Step 3: For those meeting growth criteria, use `financialMetricsSnapshotTool` to get their P/E ratios.\n" +
      "     Step 4: Present the list sorted by P/E ratio.\n" +
      "2. `financialMetricsSnapshotTool`: Use this to get a snapshot of many key financial metrics (including P/E ratio, margins, yields) for a *specific* company ticker. Essential for detailed current data on one company or for enriching results from `financialsSearchTool`.\n" +
      "3. `incomeStatementsTool`, `balanceSheetsTool`, `cashFlowStatementsTool`: Use these for detailed *historical* financial statement data for a *specific* company ticker (annual or quarterly).\n" +
      "4. `companyFactsTool`: For general, non-financial facts about a *specific* company (e.g., industry, CEO).\n" +
      "5. `priceSnapshotTool`: To get the *current stock price* for a *specific* company ticker.\n" +
      "6. `webSearchTool` (Tavily): Use this as a **last resort** if specialized financial tools cannot provide the answer. Useful for finding ticker symbols from company names, or for very general news/market queries not tied to specific company financials.\n" +
      "General Guidelines:\n" +
      "- Always state which tool(s) you are using and why, especially for multi-step queries.\n" +
      "- You do not have live, up-to-the-second data unless you call a tool.\n" +
      "- If a user query requires multiple criteria that span different tools or require calculations, explain your plan to retrieve and process the information step-by-step."
  };
  const llmWithTools = llm.bindTools(ALL_TOOLS_LIST);
  const result = await llmWithTools.invoke([systemMessage, ...messages]);
  return { messages: [result] }; 
};

const shouldContinue = (state: typeof AppStateSchema.State): string | string[] => { 
  const { messages, requestedStockPurchaseDetails } = state;
  const lastMessage = messages[messages.length - 1];
  const messageCastAI = lastMessage as AIMessageType;
  if (messageCastAI._getType() !== "ai" || !messageCastAI.tool_calls?.length) {
    return END;
  }
  if (requestedStockPurchaseDetails) {
    return EXECUTE_PURCHASE_NODE;
  }
  const { tool_calls } = messageCastAI;
  if (!tool_calls?.length) {
    throw new Error("Expected tool_calls to be an array with at least one element");
  }
  return tool_calls.map((tc) => tc.name === "purchase_stock" ? PREPARE_PURCHASE_NODE : TOOLS_NODE);
};

const findCompanyName = async (companyName: string): Promise<string> => {
  const searchResults: string = await webSearchTool.invoke(`What is the ticker symbol for ${companyName}?`);
  const llmWithTickerOutput = llm.withStructuredOutput(
    z.object({ ticker: z.string().describe("The ticker symbol of the company") })
      .describe(`Extract the ticker symbol of ${companyName} from the provided context.`),
    { name: "extract_ticker" }
  );
  const extractedTicker = await llmWithTickerOutput.invoke([
    new AIMessage({ content: `Given the following search results, extract the ticker symbol for ${companyName}:\n${searchResults}` }),
  ]);
  return extractedTicker.ticker;
};

const preparePurchaseDetails = async (state: typeof AppStateSchema.State): Promise<Partial<typeof AppStateSchema.State>> => {
  const { messages } = state;
  const lastMessage = messages[messages.length - 1];
  if (lastMessage._getType() !== "ai") throw new Error("Expected the last message to be an AI message");
  const messageCastAI = lastMessage as AIMessageType;
  const purchaseStockToolCall = messageCastAI.tool_calls?.find((tc) => tc.name === "purchase_stock"); 
  if (!purchaseStockToolCall) throw new Error("Expected purchase_stock tool call");
  if (!purchaseStockToolCall.id) throw new Error("Purchase stock tool call ID missing");

  const args = purchaseStockToolCall.args as Omit<StockPurchase, 'ticker'> & { ticker?: string; companyName?: string; quantity?: number, maxPurchasePrice?: number }; 
  let ticker = args.ticker;
  let quantity = args.quantity;
  const companyName = args.companyName;
  const maxPurchasePrice = args.maxPurchasePrice; 

  if (!ticker) {
    if (!companyName) {
      const toolMessages = (messageCastAI.tool_calls ?? []).map((tc) => {
        if (!tc.id) throw new Error("Tool call ID missing in mapping");
        return new ToolMessage({ tool_call_id: tc.id, content: `Missing info for ${tc.name}` });
      });
      return { messages: [...toolMessages, new AIMessage({ content: "Ticker or company name required." })] };
    } else {
      ticker = await findCompanyName(companyName as string);
    }
  }
  if (!ticker) { 
    return { messages: [new ToolMessage({ tool_call_id: purchaseStockToolCall.id, content: "Could not determine ticker." }), new AIMessage({ content: "Could not determine ticker." })] };
  }

  const priceSnapshotOutput = await priceSnapshotTool.invoke({ ticker });
  let currentPrice: number;
  try {
    const snapshotData = JSON.parse(priceSnapshotOutput as string);
    currentPrice = snapshotData.price;
    if (typeof currentPrice !== 'number') throw new Error("Price is not a number");
  } catch (e) {
    return { messages: [new ToolMessage({ tool_call_id: purchaseStockToolCall.id, content: `Price error: ${e instanceof Error ? e.message : String(e)}` })] };
  }
  if (quantity === undefined) quantity = 1;
  if (maxPurchasePrice === undefined) throw new Error("maxPurchasePrice is undefined in tool call args");

  if (currentPrice > maxPurchasePrice) {
    return { messages: [new ToolMessage({ tool_call_id: purchaseStockToolCall.id, content: `Price ${currentPrice} > max ${maxPurchasePrice}` })] };
  }
  const requestedStockPurchaseDetails: StockPurchase = { ticker, quantity, maxPurchasePrice };
  const toolMessage = new ToolMessage({ tool_call_id: purchaseStockToolCall.id, content: JSON.stringify(requestedStockPurchaseDetails) });
  return { messages: [toolMessage], requestedStockPurchaseDetails };
};

const executePurchase = async (state: typeof AppStateSchema.State): Promise<Partial<typeof AppStateSchema.State>> => {
  const { messages, requestedStockPurchaseDetails } = state;
  if (!requestedStockPurchaseDetails) throw new Error("Missing purchase details");
  console.log("Simulated purchase:", requestedStockPurchaseDetails);
  let originalToolCallId: string | undefined;
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i] as BaseMessage; 
    if (msg._getType() === 'ai') {
      const relevantToolCall = (msg as AIMessageType).tool_calls?.find(tc => tc.name === 'purchase_stock' || tc.args.ticker === requestedStockPurchaseDetails.ticker);
      if (relevantToolCall?.id) { originalToolCallId = relevantToolCall.id; break; }
    }
  }
  if (!originalToolCallId) {
    const lastAiMsg = messages.slice().reverse().find((m: BaseMessage) => m._getType() === 'ai' && (m as AIMessageType).tool_calls?.length) as AIMessageType | undefined;
    originalToolCallId = lastAiMsg?.tool_calls?.[0]?.id;
    if (!originalToolCallId) throw new Error("Cannot find tool_call_id for purchase response");
  }
  const toolMessageResponse = new ToolMessage({
    tool_call_id: originalToolCallId,
    content: `Simulated purchase of ${requestedStockPurchaseDetails.quantity} of ${requestedStockPurchaseDetails.ticker} at <= ${requestedStockPurchaseDetails.maxPurchasePrice}.`
  });
  return { messages: [toolMessageResponse], requestedStockPurchaseDetails: null };
};

const workflow = new StateGraph<typeof AppStateSchema.State>({
  channels: {
    messages: {
      value: (
        current?: BaseMessage[], 
        update?: BaseMessage | BaseMessage[]
      ): BaseMessage[] => {
        if (!current || current.length === 0) return Array.isArray(update) ? update : (update ? [update] : []);
        if (!update) return current;
        return current.concat(update);
      },
      default: (): BaseMessage[] => [],
    } as SingleReducer<BaseMessage[], BaseMessage | BaseMessage[]>, // Explicitly define as SingleReducer with a BinaryOperator
    requestedStockPurchaseDetails: {
      value: (
        _current?: StockPurchase | null, 
        update?: StockPurchase | null
      ): StockPurchase | null => update === undefined ? null : update,
      default: (): StockPurchase | null => null,
    } as SingleReducer<StockPurchase | null, StockPurchase | null>,
  },
});

// Re-apply 'as any' casts to graph methods
workflow.addNode(LLM_NODE as any, callModel); 
workflow.addNode(TOOLS_NODE as any, toolNode);
workflow.addNode(PREPARE_PURCHASE_NODE as any, preparePurchaseDetails);
workflow.addNode(EXECUTE_PURCHASE_NODE as any, executePurchase);

workflow.setEntryPoint(LLM_NODE as any);

const conditionalEdgeMapping: Record<string, string | typeof END> = {
  [TOOLS_NODE]: TOOLS_NODE,
  [PREPARE_PURCHASE_NODE]: PREPARE_PURCHASE_NODE,
  [EXECUTE_PURCHASE_NODE]: EXECUTE_PURCHASE_NODE,
  [END]: END,
};

workflow.addConditionalEdges(LLM_NODE as any, shouldContinue, conditionalEdgeMapping as any);

workflow.addEdge(TOOLS_NODE as any, LLM_NODE as any);
workflow.addEdge(PREPARE_PURCHASE_NODE as any, LLM_NODE as any);
workflow.addEdge(EXECUTE_PURCHASE_NODE as any, LLM_NODE as any);

const app = workflow.compile();

export { app };

// Example usage (optional, for testing)
// async function main() {
//   const inputs = {
//     messages: [new AIMessage({ content: "What is the price of AAPL?" })], 
//   };
//   // @ts-ignore
//   for await (const event of await app.stream(inputs)) {
//     console.log(JSON.stringify(event, null, 2));
//   }
// }
// main();