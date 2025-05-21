import { z } from 'zod';

// Define the schema for the filings API response
const FilingSchema = z.object({
  accessionNo: z.string(),
  cik: z.string(),
  ticker: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
  companyNameLong: z.string().optional().nullable(),
  formType: z.string(),
  description: z.string().optional().nullable(),
  filedAt: z.string(),
  linkToTxt: z.string(),
  linkToHtm: z.string(),
  linkToXbrl: z.string().optional().nullable(),
  linkToFilingDetails: z.string(),
});

const FilingsResponseSchema = z.object({
  filings: z.array(FilingSchema),
  error: z.string().optional(), // Added to accommodate errors from our API route
});

// Define the schema for the tool's input parameters
export const SecFilingsInputSchema = z.object({
  ticker: z.string().optional().describe("The ticker symbol of the company (e.g., AAPL)."),
  cik: z.string().optional().describe("The Central Index Key (CIK) of the company."),
  filing_type: z.enum(["10-K", "10-Q", "8-K", "4", "144"]).optional().describe("The type of filing."),
}).refine(data => data.ticker || data.cik, {
  message: "Either 'ticker' or 'cik' must be provided.",
});

export type SecFilingsInput = z.infer<typeof SecFilingsInputSchema>;
export type SecFilingsOutput = z.infer<typeof FilingsResponseSchema>;

// API_KEY is no longer needed here as it's handled by the backend API route

interface FetchFilingsParams {
  ticker?: string;
  cik?: string;
  filing_type?: "10-K" | "10-Q" | "8-K" | "4" | "144";
}

export async function fetchSecFilings(params: FetchFilingsParams): Promise<SecFilingsOutput> {
  const queryParams = new URLSearchParams();
  if (params.ticker) {
    queryParams.append('ticker', params.ticker);
  }
  if (params.cik) {
    queryParams.append('cik', params.cik);
  }
  if (params.filing_type) {
    queryParams.append('filing_type', params.filing_type);
  }

  if (!params.ticker && !params.cik) {
    // This validation should ideally be caught by Zod schema, but good to have a safeguard
    return {
      filings: [],
      error: "Client Error: Either ticker or CIK must be provided."
    };
  }

  const url = `/api/get-filings?${queryParams.toString()}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await response.json(); // Our API route should always return JSON

    if (!response.ok) {
      console.error(`API Route Error (${response.status}):`, data.error || "Unknown error");
      return {
        filings: [],
        error: data.error || `API request failed with status ${response.status}`,
      };
    }
    
    // Ensure the data conforms to SecFilingsOutput, specifically the 'filings' array
    // Our API route now returns the full { filings: [...] } object or { error: ..., filings: [] }
    const parsedData = FilingsResponseSchema.safeParse(data);
    if (!parsedData.success) {
      console.error("Failed to parse response from /api/get-filings:", parsedData.error);
      return {
        filings: [],
        error: "Invalid data format received from server."
      };
    }
    return parsedData.data;

  } catch (error) {
    console.error("Error fetching SEC filings via API route:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
    return { 
      filings: [],
      error: `Client-Side Error: ${errorMessage}`,
    };
  }
}

// The fetchAvailableTickers function also needs to be proxied if it requires an API key.
// For now, assuming it might be a public endpoint or will be handled separately.
// If it needs the API key, create a similar API route for it.

/* 
  Leaving fetchAvailableTickers as is for now. 
  If it also requires the API key, it should be refactored similarly with its own API route.
*/
export async function fetchAvailableTickers(): Promise<string[]> {
  const url = '/api/get-available-tickers'; // Use the new internal API route

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Our API route will return JSON, either with { tickers: [...] } or { error: ..., tickers: [] }
    const data = await response.json(); 

    if (!response.ok || data.error) {
      const errorMessage = data.error || `API request failed with status ${response.status}`;
      console.error("Error fetching available tickers via API route:", errorMessage);
      return [`ERROR: ${errorMessage}`];
    }

    if (data && Array.isArray(data.tickers)) {
      return data.tickers;
    } else {
      console.error("Unexpected format for available tickers from API route:", data);
      return ["ERROR: Unexpected format for tickers from API route"];
    }

  } catch (error) {
    console.error("Client-side error fetching available tickers:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected client-side error occurred.";
    return [`ERROR: ${errorMessage}`];
  }
}

// The secFilingsTool definition for the backend would now use this refactored fetchSecFilings.
// The input and output schemas remain largely the same from the tool's perspective,
// though the SecFilingsOutput now includes an optional error field.
/*
export const secFilingsTool = {
  name: "sec_filings", // Ensure this matches toolName in SecFilingsTool.tsx
  description: "Fetches SEC filings for a given company ticker or CIK. Useful for finding 10-Ks, 10-Qs, 8-Ks, etc.",
  inputSchema: SecFilingsInputSchema,
  // The output schema for the tool itself might just be the array of filings,
  // or it could be the full SecFilingsOutput including potential errors.
  // This depends on how your AI backend handles tool errors vs. successful data.
  execute: async (input: SecFilingsInput): Promise<SecFilingsOutput> => {
    return fetchSecFilings(input);
  },
};
*/ 