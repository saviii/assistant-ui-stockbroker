"use client";

import { SecFilingsInput, SecFilingsOutput } from "./sec-filings";
import { makeAssistantToolUI } from "@assistant-ui/react";
// Zod might not be strictly needed here if all schema validation happens before this component
// import { z } from 'zod'; 

export const SecFilingsTool = makeAssistantToolUI<SecFilingsInput, string>({
  toolName: "sec_filings",
  render: function SecFilingsUI({ args, result }) {
    let parsedResult: SecFilingsOutput | null = null;
    let displayError: { message: string; details?: string } | null = null;

    if (result) {
      try {
        const jsonResult = JSON.parse(result);
        // Our fetchSecFilings now returns SecFilingsOutput which includes an optional error field
        // and ensures filings is always an array.
        if (jsonResult && (Array.isArray(jsonResult.filings) || jsonResult.error)) {
          parsedResult = jsonResult as SecFilingsOutput;
          if (parsedResult.error) {
            displayError = { message: "API Error", details: parsedResult.error };
          }
        } else {
          displayError = { message: "Unexpected result format", details: result };
        }
      } catch (e) {
        displayError = { message: "Failed to parse tool result", details: result };
      }
    }

    const displayArgs = JSON.stringify(args);
    const hasActualFilings = parsedResult && parsedResult.filings && parsedResult.filings.length > 0 && parsedResult.filings[0].accessionNo !== "ERROR";

    return (
      <div className="mb-4 flex flex-col items-start gap-2 p-4 border rounded-md bg-gray-50">
        <p className="text-sm font-semibold text-gray-700">
          Attempted to call: <code className="bg-gray-200 px-1 rounded">sec_filings({displayArgs})</code>
        </p>

        {displayError && (
          <div className="w-full p-3 border border-red-300 bg-red-50 rounded-md">
            <p className="text-red-600 font-semibold">Error: {displayError.message}</p>
            {displayError.details && <p className="text-red-500 text-xs mt-1">Details: {displayError.details}</p>}
          </div>
        )}

        {!displayError && parsedResult && (
          <>
            {hasActualFilings ? (
              <div className="w-full">
                <h3 className="text-md font-semibold mb-2 text-gray-800">SEC Filings Results:</h3>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  {parsedResult.filings.map((filing, index) => (
                    <li key={index} className="text-gray-700">
                      <strong>{filing.formType}</strong> ({new Date(filing.filedAt).toLocaleDateString()})
                      <p className="text-xs text-gray-500">{filing.description || 'N/A'}</p>
                      <div className="mt-1">
                        <a href={filing.linkToFilingDetails} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline text-xs pr-2">
                          Details
                        </a>
                        <a href={filing.linkToHtm} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline text-xs pr-2">
                          HTML
                        </a>
                        <a href={filing.linkToTxt} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline text-xs">
                          TXT
                        </a>
                        {filing.linkToXbrl && (
                          <a href={filing.linkToXbrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline text-xs pl-2">
                            XBRL
                          </a>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-gray-600">No filings found for the given criteria, or an error occurred that was handled internally by the tool.</p>
            )}
          </>
        )}
      </div>
    );
  },
}); 