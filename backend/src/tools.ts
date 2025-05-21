import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { tool } from "@langchain/core/tools";
import {
  IncomeStatementsResponse,
  BalanceSheetsResponse,
  CashFlowStatementsResponse,
  CompanyFactsResponse,
  SnapshotResponse,
  FinancialMetricsSnapshotResponse,
  FinancialsSearchRequestBody,
  FinancialsSearchResponse,
} from "types.js";
import { z } from "zod";

export async function callFinancialDatasetAPI<
  Output extends Record<string, any> = Record<string, any>
>(fields: {
  endpoint: string;
  params?: Record<string, string>;
  method?: "GET" | "POST";
  body?: Record<string, any>;
}): Promise<Output> {
  if (!process.env.FINANCIAL_DATASETS_API_KEY) {
    throw new Error("FINANCIAL_DATASETS_API_KEY is not set");
  }

  const baseURL = "https://api.financialdatasets.ai";
  const queryParams = fields.params ? new URLSearchParams(fields.params).toString() : "";
  const url = `${baseURL}${fields.endpoint}${queryParams ? `?${queryParams}` : ""}`;
  
  const requestMethod = fields.method || "GET";
  const headers: Record<string, string> = {
    "X-API-KEY": process.env.FINANCIAL_DATASETS_API_KEY,
  };
  if (requestMethod === "POST") {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url, {
    method: requestMethod,
    headers,
    body: fields.body ? JSON.stringify(fields.body) : undefined,
  });

  if (!response.ok) {
    let res: string;
    try {
      res = JSON.stringify(await response.json(), null, 2);
    } catch (_) {
      try {
        res = await response.text();
      } catch (_) {
        res = response.statusText;
      }
    }
    throw new Error(
      `Failed to fetch data from ${fields.endpoint}.\nStatus: ${response.status}\nResponse: ${res}`
    );
  }
  const data = await response.json();
  return data;
}

const incomeStatementsTool = tool(
  async (input) => {
    try {
      const data = await callFinancialDatasetAPI<IncomeStatementsResponse>({
        endpoint: "/financials/income-statements",
        params: {
          ticker: input.ticker,
          period: input.period ?? "annual",
          limit: input.limit.toString() ?? "5",
        },
      });
      return JSON.stringify(data, null);
    } catch (e: any) {
      console.warn("Error fetching income statements", e.message);
      return `An error occurred while fetching income statements: ${e.message}`;
    }
  },
  {
    name: "income_statements",
    description:
      "Retrieves income statements for a specified company, showing detailed financial performance over a chosen time period. The output includes key metrics such as revenue, expenses, profits, and per-share data. Specifically, it provides: ticker, date, period type, revenue, cost of revenue, gross profit, operating expenses, income figures (operating, net, EBIT), tax expenses, earnings per share (basic and diluted), dividends per share, and share count information.",
    schema: z.object({
      ticker: z.string().describe("The ticker of the stock. Example: 'AAPL'"),
      period: z
        .enum(["annual", "quarterly", "ttm"])
        .describe("The time period of the income statement. Example: 'annual'")
        .optional()
        .default("annual"),
      limit: z
        .number()
        .int()
        .positive()
        .describe("The number of income statements to return. Example: 5")
        .optional()
        .default(5),
    }),
  }
);

const balanceSheetsTool = tool(
  async (input) => {
    try {
      const data = await callFinancialDatasetAPI<BalanceSheetsResponse>({
        endpoint: "/financials/balance-sheets",
        params: {
          ticker: input.ticker,
          period: input.period ?? "annual",
          limit: input.limit.toString() ?? "5",
        },
      });
      return JSON.stringify(data, null);
    } catch (e: any) {
      console.warn("Error fetching balance sheets", e.message);
      return `An error occurred while fetching balance sheets: ${e.message}`;
    }
  },
  {
    name: "balance_sheets",
    description:
      "Fetches balance sheets for a given company, providing a snapshot of its financial position at specific points in time. The output includes detailed information on assets (total, current, non-current), liabilities (total, current, non-current), and shareholders' equity. Specific data points include cash and equivalents, inventory, investments, property/plant/equipment, goodwill, debt, payables, retained earnings, and more. The result is a JSON stringified object containing an array of balance sheets.",
    schema: z.object({
      ticker: z.string().describe("The ticker of the stock. Example: 'AAPL'"),
      period: z
        .enum(["annual", "quarterly", "ttm"])
        .describe("The time period of the balance sheet. Example: 'annual'")
        .optional()
        .default("annual"),
      limit: z
        .number()
        .int()
        .positive()
        .describe("The number of balance sheets to return. Example: 5")
        .optional()
        .default(5),
    }),
  }
);

const cashFlowStatementsTool = tool(
  async (input) => {
    try {
      const data = await callFinancialDatasetAPI<CashFlowStatementsResponse>({
        endpoint: "/financials/cash-flow-statements",
        params: {
          ticker: input.ticker,
          period: input.period ?? "annual",
          limit: input.limit.toString() ?? "5",
        },
      });
      return JSON.stringify(data, null);
    } catch (e: any) {
      console.warn("Error fetching cash flow statements", e.message);
      return `An error occurred while fetching cash flow statements: ${e.message}`;
    }
  },
  {
    name: "cash_flow_statements",
    description:
      "Obtains cash flow statements for a company, detailing the inflows and outflows of cash from operating, investing, and financing activities. The result is a JSON stringified object containing an array of cash flow statements. Each statement includes: ticker, date, report period, net cash flows from operations/investing/financing, depreciation and amortization, share-based compensation, capital expenditure, business and investment acquisitions/disposals, debt and equity issuances/repayments, dividends, change in cash and equivalents, and effect of exchange rate changes.",
    schema: z.object({
      ticker: z.string().describe("The ticker of the stock. Example: 'AAPL'"),
      period: z
        .enum(["annual", "quarterly", "ttm"])
        .describe("The period of the cash flow statement. Example: 'annual'")
        .optional()
        .default("annual"),
      limit: z
        .number()
        .int()
        .positive()
        .describe("The number of cash flow statements to return. Example: 5")
        .optional()
        .default(5),
    }),
  }
);

const companyFactsTool = tool(
  async (input) => {
    try {
      const data = await callFinancialDatasetAPI<CompanyFactsResponse>({
        endpoint: "/company/facts",
        params: {
          ticker: input.ticker,
        },
      });
      return JSON.stringify(data, null);
    } catch (e: any) {
      console.warn("Error fetching company facts", e.message);
      return `An error occurred while fetching company facts: ${e.message}`;
    }
  },
  {
    name: "company_facts",
    description:
      "Provides key facts and information about a specified company. The result is a JSON stringified object containing details such as: ticker symbol, company name, CIK number, market capitalization, number of employees, SIC code and description, website URL, listing date, and whether the company is currently active.",
    schema: z.object({
      ticker: z.string().describe("The ticker of the company. Example: 'AAPL'"),
    }),
  }
);

export const priceSnapshotTool = tool(
  async (input) => {
    try {
      const data = await callFinancialDatasetAPI<SnapshotResponse>({
        endpoint: "/prices/snapshot",
        params: {
          ticker: input.ticker,
        },
      });
      return JSON.stringify(data, null);
    } catch (e: any) {
      console.warn("Error fetching price snapshots", e.message);
      return `An error occurred while fetching price snapshots: ${e.message}`;
    }
  },
  {
    name: "price_snapshot",
    description:
      "Retrieves the current stock price and related market data for a given company. The snapshot includes the current price, ticker symbol, day's change in price and percentage, timestamp of the data, and a nanosecond-precision timestamp. This tool should ALWAYS be called before purchasing a stock to ensure the most up-to-date price is used.",
    schema: z.object({
      ticker: z.string().describe("The ticker of the company. Example: 'AAPL'"),
    }),
  }
);

const stockPurchaseSchema = z.object({
  ticker: z.string().describe("The ticker of the stock. Example: 'AAPL'"),
  quantity: z
    .number()
    .int()
    .positive()
    .describe("The quantity of stock to purchase."),
  maxPurchasePrice: z
    .number()
    .positive()
    .describe(
      "The max price at which to purchase the stock. Defaults to the current price."
    ),
});

export type StockPurchase = z.infer<typeof stockPurchaseSchema>;

const purchaseStockTool = tool(
  (input) => {
    return (
      `Please confirm that you want to purchase ${input.quantity} shares of ${input.ticker} at ` +
      `${
        input.maxPurchasePrice
          ? `$${input.maxPurchasePrice} per share`
          : "the current price"
      }.`
    );
  },
  {
    name: "purchase_stock",
    description:
      "This tool should be called when a user wants to purchase a stock.",
    schema: z.object({
      ticker: z
        .string()
        .optional()
        .describe("The ticker of the stock. Example: 'AAPL'"),
      companyName: z
        .string()
        .optional()
        .describe(
          "The name of the company. This field should be populated if you do not know the ticker."
        ),
      quantity: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("The quantity of stock to purchase. Defaults to 1."),
      maxPurchasePrice: z
        .number()
        .positive()
        .optional()
        .describe(
          "The max price at which to purchase the stock. Defaults to the current price."
        ),
    }),
  }
);

export const webSearchTool = new TavilySearchResults({
  maxResults: 2,
});

const financialMetricsSnapshotTool = tool(
  async (input) => {
    try {
      const data = await callFinancialDatasetAPI<FinancialMetricsSnapshotResponse>({
        endpoint: "/financial-metrics/snapshot",
        params: {
          ticker: input.ticker,
        },
      });
      return JSON.stringify(data, null);
    } catch (e: any) {
      console.warn("Error fetching financial metrics snapshot", e.message);
      return `An error occurred while fetching financial metrics snapshot: ${e.message}`;
    }
  },
  {
    name: "financial_metrics_snapshot",
    description:
      "Retrieves a snapshot of current financial metrics for a given company. This includes ratios like P/E, P/B, P/S, various growth rates (revenue, earnings), margins, and other key financial indicators. Requires a company ticker.",
    schema: z.object({
      ticker: z.string().describe("The ticker of the company. Example: 'AAPL'"),
    }),
  }
);

const financialsSearchTool = tool(
  async (input: FinancialsSearchRequestBody) => {
    try {
      const data = await callFinancialDatasetAPI<FinancialsSearchResponse>({
        endpoint: "/financials/search",
        method: "POST",
        body: input,
      });
      return JSON.stringify(data, null);
    } catch (e: any) {
      console.warn("Error during financial search", e.message);
      return `An error occurred during financial search: ${e.message}`;
    }
  },
  {
    name: "financials_search",
    description:
      "Searches for companies based on a set of financial statement filters (e.g., revenue, total_debt, capital_expenditure). Allows filtering by metrics from income statements, balance sheets, and cash flow statements. For example, to find companies with revenue greater than $100 million and total debt less than $1, use appropriate filters. Refer to API documentation for available filter fields and operators.",
    schema: z.object({
      filters: z.array(z.object({
        field: z.string().describe("The financial metric field to filter on. E.g., 'revenue', 'net_income'."),
        operator: z.enum(["eq", "gt", "gte", "lt", "lte"]).describe("The comparison operator."),
        value: z.number().describe("The value to compare against."),
      })).describe("An array of filter objects."),
      period: z.enum(["annual", "quarterly", "ttm"]).optional().default("ttm").describe("Time period for financial data."),
      limit: z.number().int().min(1).max(100).optional().default(100).describe("Maximum number of results."),
      order_by: z.string().optional().describe("Field to order results by (e.g., 'ticker', '-revenue')."),
      currency: z.enum(["USD", "EUR", "GBP", "JPY", "CHF", "AUD", "CAD", "SEK"]).optional().describe("Currency for financial data."),
      historical: z.boolean().optional().default(false).describe("Whether to return historical data."),
    }),
  }
);

// Schema for SEC Filings tool input (mirrors frontend SecFilingsInputSchema)
const BaseSecFilingsInputSchema = z.object({
  ticker: z.string().optional().describe("The ticker symbol of the company (e.g., AAPL)."),
  cik: z.string().optional().describe("The Central Index Key (CIK) of the company."),
  filing_type: z.enum(["10-K", "10-Q", "8-K", "4", "144"]).optional().describe("The type of filing."),
});

const SecFilingsInputSchema = BaseSecFilingsInputSchema.refine(data => data.ticker || data.cik, {
  message: "Either 'ticker' or 'cik' must be provided.",
});

// Define interfaces for the expected response structure from callFinancialDatasetAPI for these new tools
// Based on your frontend sec-filings.tsx and the API docs
interface Filing {
  accessionNo: string;
  cik: string;
  ticker?: string | null;
  company?: string | null;
  companyNameLong?: string | null;
  formType: string;
  description?: string | null;
  filedAt: string;
  linkToTxt: string;
  linkToHtm: string;
  linkToXbrl?: string | null;
  linkToFilingDetails: string;
}

interface SecFilingsApiResponse {
  filings: Filing[];
  // The actual API might return other fields, but we primarily care about filings
}

interface AvailableTickersApiResponse {
  tickers: string[];
}

export const secFilingsTool = tool(
  async (input: z.infer<typeof SecFilingsInputSchema>) => {
    // Runtime check, Zod parsing with .refine() would ideally catch this before tool execution by Langchain/Langgraph
    if (!input.ticker && !input.cik) { 
      return "Error: Either ticker or CIK must be provided to sec_filings tool.";
    }
    try {
      const params: Record<string, string> = {};
      if (input.ticker) params.ticker = input.ticker;
      if (input.cik) params.cik = input.cik;
      if (input.filing_type) params.filing_type = input.filing_type;

      const data = await callFinancialDatasetAPI<SecFilingsApiResponse>({
        endpoint: "/filings",
        params: params,
      });
      return JSON.stringify(data.filings || [], null, 2);
    } catch (e: any) {
      console.warn("Error fetching SEC filings:", e.message);
      return `An error occurred while fetching SEC filings: ${e.message}`;
    }
  },
  {
    name: "sec_filings",
    description:
      "Fetches SEC (Securities and Exchange Commission) filings for a given company stock ticker or CIK. Use this to find documents like 10-K annual reports, 10-Q quarterly reports, 8-K current reports, etc. You must provide either a ticker or a CIK. Optionally, you can specify a filing_type (e.g., \"10-K\", \"10-Q\").",
    schema: BaseSecFilingsInputSchema, // Use the base schema here
  }
);

export const getAvailableTickersTool = tool(
  async () => {
    try {
      const data = await callFinancialDatasetAPI<AvailableTickersApiResponse>({
        endpoint: "/filings/tickers/", // Ensure trailing slash if API expects it
      });
      return JSON.stringify(data.tickers || [], null, 2); // Return tickers array
    } catch (e: any) {
      console.warn("Error fetching available tickers:", e.message);
      return `An error occurred while fetching available tickers: ${e.message}`;
    }
  },
  {
    name: "get_available_tickers",
    description:
      "Fetches a list of all available stock tickers for which SEC filings and other financial data can be retrieved.",
    // This tool takes no input arguments, so schema can be a Zod object with no fields, or omitted if framework allows
    schema: z.object({}), 
  }
);

export const ALL_TOOLS_LIST = [
  incomeStatementsTool,
  balanceSheetsTool,
  cashFlowStatementsTool,
  companyFactsTool,
  priceSnapshotTool,
  purchaseStockTool,
  financialMetricsSnapshotTool,
  financialsSearchTool,
  webSearchTool,
  secFilingsTool,
  getAvailableTickersTool,
];

export const SIMPLE_TOOLS_LIST = [
  incomeStatementsTool,
  balanceSheetsTool,
  cashFlowStatementsTool,
  companyFactsTool,
  priceSnapshotTool,
  financialMetricsSnapshotTool,
  financialsSearchTool,
  webSearchTool,
  secFilingsTool,
  getAvailableTickersTool,
];
