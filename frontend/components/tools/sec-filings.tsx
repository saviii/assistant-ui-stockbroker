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
  // Add any other relevant fields from the API response
});

const FilingsResponseSchema = z.object({
  filings: z.array(FilingSchema),
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

// Placeholder for the API key - replace with your actual key or a secure way to manage it
const API_KEY = "your_api_key_here"; 
// It's highly recommended to store API keys securely, e.g., in environment variables.
// For a frontend application, you might need a backend proxy to avoid exposing the key.

interface FetchFilingsParams {
  ticker?: string;
  cik?: string;
  filing_type?: "10-K" | "10-Q" | "8-K" | "4" | "144";
}

export async function fetchSecFilings(params: FetchFilingsParams): Promise<SecFilingsOutput> {
  if (!API_KEY || API_KEY === "your_api_key_here") {
    // In a real application, you might throw an error or return a specific error structure
    console.error("API Key not configured for SEC Filings tool.");
    // Returning a structure that indicates an error to the user
    return { filings: [{ 
        accessionNo: "ERROR", 
        cik: "ERROR", 
        formType: "API Key Not Configured", 
        filedAt: new Date().toISOString(), 
        linkToTxt: "#", 
        linkToHtm: "#", 
        linkToFilingDetails: "#",
        description: "Please configure the X-API-KEY for the SEC Filings tool."
      }]
    };
  }

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
    throw new Error("Either ticker or CIK must be provided to fetch SEC filings.");
  }

  const url = `https://api.financialdatasets.ai/filings?${queryParams.toString()}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        "X-API-KEY": API_KEY,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: "Unknown error" }));
      console.error(`API Error (${response.status}):`, errorData);
      // Create a user-friendly error message based on the response status or content
      let errorMessage = `Failed to fetch SEC filings. Status: ${response.status}`;
      if (errorData && errorData.message) {
        errorMessage += ` - ${errorData.message}`;
      } else if (typeof errorData === 'string') {
        errorMessage += ` - ${errorData}`;
      }
       return { filings: [{ 
        accessionNo: "ERROR", 
        cik: params.cik || params.ticker || "N/A", 
        formType: `API Error ${response.status}`,
        filedAt: new Date().toISOString(), 
        linkToTxt: "#", 
        linkToHtm: "#", 
        linkToFilingDetails: "#",
        description: errorMessage
      }]
    };
    }

    const data = await response.json();
    const parsedData = FilingsResponseSchema.safeParse(data);

    if (!parsedData.success) {
      console.error("Failed to parse SEC filings response:", parsedData.error);
      throw new Error("Invalid data format received from SEC filings API.");
    }
    
    return parsedData.data;

  } catch (error) {
    console.error("Error fetching SEC filings:", error);
    // In a real app, you might want to re-throw or handle this more gracefully
    // For the tool, we'll return an error in the expected output format
     return { filings: [{ 
        accessionNo: "ERROR", 
        cik: params.cik || params.ticker || "N/A", 
        formType: "Client-Side Error", 
        filedAt: new Date().toISOString(), 
        linkToTxt: "#", 
        linkToHtm: "#", 
        linkToFilingDetails: "#",
        description: error instanceof Error ? error.message : "An unexpected error occurred."
      }]
    };
  }
}

// Example of how the tool might be defined (actual integration will depend on your framework)
// This is a conceptual structure based on common patterns.
// You'll need to adapt this to your application's tool registration mechanism.

/*
export const secFilingsTool = {
  name: "secFilings",
  description: "Fetches SEC filings for a given company ticker or CIK. Useful for finding 10-Ks, 10-Qs, 8-Ks, etc.",
  inputSchema: SecFilingsInputSchema,
  outputSchema: FilingsResponseSchema, // Or a simplified version for display
  execute: async (input: SecFilingsInput) => {
    // Input validation is handled by Zod if you're using a framework that integrates it.
    // Otherwise, you might validate here or trust the caller.
    return fetchSecFilings(input);
  },
  // Optional: A React component to render the tool's output
  displayComponent: (data: SecFilingsOutput) => {
    // JSX to display filings - this is highly dependent on your UI components
    if (!data || !data.filings || data.filings.length === 0) {
      return <p>No filings found or an error occurred.</p>;
    }
     if (data.filings[0]?.accessionNo === "ERROR") {
      return (
        <div>
          <h3>{data.filings[0].formType} for {data.filings[0].cik}</h3>
          <p>{data.filings[0].description}</p>
        </div>
      );
    }
    return (
      <div>
        <h3>SEC Filings</h3>
        <ul>
          {data.filings.map((filing, index) => (
            <li key={index}>
              <strong>{filing.formType}</strong> ({filing.filedAt}) - {filing.description || 'N/A'}
              <br />
              <a href={filing.linkToFilingDetails} target="_blank" rel="noopener noreferrer">
                View Details
              </a>
              {' | '}
              <a href={filing.linkToHtm} target="_blank" rel="noopener noreferrer">
                HTML
              </a>
              {' | '}
              <a href={filing.linkToTxt} target="_blank" rel="noopener noreferrer">
                TXT
              </a>
              {filing.linkToXbrl && (
                <>
                  {' | '}
                  <a href={filing.linkToXbrl} target="_blank" rel="noopener noreferrer">
                    XBRL
                  </a>
                </>
              )}
            </li>
          ))}
        </ul>
      </div>
    );
  }
};
*/

// You will also need to add a way to get available tickers
// GET https://api.financialdatasets.ai/filings/tickers/

export async function fetchAvailableTickers(): Promise<string[]> {
  if (!API_KEY || API_KEY === "your_api_key_here") {
    console.error("API Key not configured for SEC Filings tool (fetchAvailableTickers).");
    return ["ERROR: API Key not configured"];
  }

  const url = 'https://api.financialdatasets.ai/filings/tickers/';

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        "X-API-KEY": API_KEY,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: "Unknown error" }));
      console.error(`API Error fetching tickers (${response.status}):`, errorData);
      let errorMessage = `Failed to fetch available tickers. Status: ${response.status}`;
       if (errorData && errorData.message) {
        errorMessage += ` - ${errorData.message}`;
      } else if (typeof errorData === 'string') {
        errorMessage += ` - ${errorData}`;
      }
      return [`ERROR: ${errorMessage}`];
    }

    // The API returns a list of strings directly: {"tickers": ["AAPL", "MSFT", ...]}
    const data = await response.json();
    if (data && Array.isArray(data.tickers)) {
      return data.tickers;
    } else {
      console.error("Unexpected format for available tickers:", data);
      return ["ERROR: Unexpected format for tickers"];
    }

  } catch (error) {
    console.error("Error fetching available tickers:", error);
    return [`ERROR: ${error instanceof Error ? error.message : "An unexpected error occurred."}`];
  }
} 