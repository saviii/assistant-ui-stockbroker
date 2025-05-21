import { ToolNode } from "@langchain/langgraph/prebuilt";
import {
  Annotation,
  END,
  START,
  StateGraph,
  NodeInterrupt,
  MessagesAnnotation,
} from "@langchain/langgraph";
import {
  BaseMessage,
  ToolMessage,
  type AIMessage,
} from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import {
  priceSnapshotTool,
  StockPurchase,
  ALL_TOOLS_LIST,
  webSearchTool,
} from "tools.js";
import { z } from "zod";

const GraphAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
  requestedStockPurchaseDetails: Annotation<StockPurchase>,
});

const llm = new ChatOpenAI({
  model: "gpt-4o",
  temperature: 0,
});

const toolNode = new ToolNode(ALL_TOOLS_LIST);

const callModel = async (state: typeof GraphAnnotation.State) => {
  const { messages } = state;

  const systemMessage = {
    role: "system",
    content:
      "You are an expert financial analyst. Your primary goal is to answer user questions about companies and financial markets. " +
      "You have several tools at your disposal. Prioritize using the most specific tool for the task. Break down complex queries into multiple steps if necessary." +

      "Tool Guide:\n" +
      "1. `financialsSearchTool`: Your **primary tool** for finding companies based on financial criteria (e.g., revenue > $1B, net_income > $100M). Use its `filters` for direct criteria. \n" +
      "   - For criteria not directly filterable by this tool (like specific growth rates or sorting by metrics from other tools like P/E ratio), you may need a multi-step process:\n" +
      "     a. Use `financialsSearchTool` for the initial screen with available filters (e.g., revenue).\n" +
      "     b. For each company found, you might then need to use `financialMetricsSnapshotTool` to get additional metrics (like P/E ratio for sorting) or data to calculate growth.\n" +
      "     c. To calculate growth rates (e.g., revenue growth), you might need to fetch financial data for the current and a previous period (e.g., using `financialsSearchTool` with different `period` settings or by fetching historical income statements using `incomeStatementsTool`), then perform the calculation.\n" +
      "   - Example: For 'companies with >$10B revenue, 10% revenue growth, sorted by P/E': \n" +
      "     Step 1: Use `financialsSearchTool` to find companies with revenue > $10B (TTM).\n" +
      "     Step 2: For each, get previous year\'s TTM revenue (e.g. another `financialsSearchTool` call or `incomeStatementsTool`). Calculate growth.\n" +
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
  return { messages: result };
};

const shouldContinue = (state: typeof GraphAnnotation.State) => {
  const { messages, requestedStockPurchaseDetails } = state;

  const lastMessage = messages[messages.length - 1];

  // Cast here since `tool_calls` does not exist on `BaseMessage`
  const messageCastAI = lastMessage as AIMessage;
  if (messageCastAI._getType() !== "ai" || !messageCastAI.tool_calls?.length) {
    // LLM did not call any tools, or it's not an AI message, so we should end.
    return END;
  }

  // If `requestedStockPurchaseDetails` is present, we want to execute the purchase
  if (requestedStockPurchaseDetails) {
    return "execute_purchase";
  }

  const { tool_calls } = messageCastAI;
  if (!tool_calls?.length) {
    throw new Error(
      "Expected tool_calls to be an array with at least one element"
    );
  }

  return tool_calls.map((tc) => {
    if (tc.name === "purchase_stock") {
      // The user is trying to purchase a stock, route to the verify purchase node.
      return "prepare_purchase_details";
    } else {
      return "tools";
    }
  });
};

const findCompanyName = async (companyName: string) => {
  // Use the web search tool to find the ticker symbol for the company.
  const searchResults: string = await webSearchTool.invoke(
    `What is the ticker symbol for ${companyName}?`
  );
  const llmWithTickerOutput = llm.withStructuredOutput(
    z
      .object({
        ticker: z.string().describe("The ticker symbol of the company"),
      })
      .describe(
        `Extract the ticker symbol of ${companyName} from the provided context.`
      ),
    { name: "extract_ticker" }
  );
  const extractedTicker = await llmWithTickerOutput.invoke([
    {
      role: "user",
      content: `Given the following search results, extract the ticker symbol for ${companyName}:\n${searchResults}`,
    },
  ]);

  return extractedTicker.ticker;
};

const preparePurchaseDetails = async (state: typeof GraphAnnotation.State) => {
  const { messages } = state;
  const lastMessage = messages[messages.length - 1];
  if (lastMessage._getType() !== "ai") {
    throw new Error("Expected the last message to be an AI message");
  }

  // Cast here since `tool_calls` does not exist on `BaseMessage`
  const messageCastAI = lastMessage as AIMessage;
  const purchaseStockTool = messageCastAI.tool_calls?.find(
    (tc) => tc.name === "purchase_stock"
  );
  if (!purchaseStockTool) {
    throw new Error(
      "Expected the last AI message to have a purchase_stock tool call"
    );
  }
  let { maxPurchasePrice, companyName, ticker } = purchaseStockTool.args;

  if (!ticker) {
    if (!companyName) {
      // The user did not provide the ticker or the company name.
      // Ask the user for the missing information. Also, if the
      // last message had a tool call we need to add a tool message
      // to the messages array.
      const toolMessages = messageCastAI.tool_calls?.map((tc) => {
        return {
          role: "tool",
          content: `Please provide the missing information for the ${tc.name} tool.`,
          id: tc.id,
        };
      });

      return {
        messages: [
          ...(toolMessages ?? []),
          {
            role: "assistant",
            content:
              "Please provide either the company ticker or the company name to purchase stock.",
          },
        ],
      };
    } else {
      // The user did not provide the ticker, but did provide the company name.
      // Call the `