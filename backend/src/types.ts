/**
 * ----------------------------------------------------
 * ------------------ /company/facts ------------------
 * ----------------------------------------------------
 */
export interface CompanyFacts {
  ticker: string;
  name: string;
  cik: string;
  market_cap: number;
  number_of_employees: number;
  sic_code: string;
  sic_description: string;
  website_url: string;
  listing_date: string;
  is_active: boolean;
}

export interface CompanyFactsResponse {
  company_facts: CompanyFacts;
}

/**
 * ----------------------------------------------------
 * ---------- /financials/income-statements -----------
 * ----------------------------------------------------
 */
export interface IncomeStatement {
  ticker: string;
  calendar_date: string;
  report_period: string;
  period: "quarterly" | "ttm" | "annual";
  revenue: number;
  cost_of_revenue: number;
  gross_profit: number;
  operating_expense: number;
  selling_general_and_administrative_expenses: number;
  research_and_development: number;
  operating_income: number;
  interest_expense: number;
  ebit: number;
  income_tax_expense: number;
  net_income_discontinued_operations: number;
  net_income_non_controlling_interests: number;
  net_income: number;
  net_income_common_stock: number;
  preferred_dividends_impact: number;
  consolidated_income: number;
  earnings_per_share: number;
  earnings_per_share_diluted: number;
  dividends_per_common_share: number;
  weighted_average_shares: number;
  weighted_average_shares_diluted: number;
}

export interface IncomeStatementsResponse {
  income_statements: IncomeStatement[];
}

/**
 * ----------------------------------------------------
 * ------------ /financials/balance-sheets ------------
 * ----------------------------------------------------
 */
export interface BalanceSheet {
  ticker: string;
  calendar_date: string;
  report_period: string;
  period: "quarterly" | "ttm" | "annual";
  total_assets: number;
  current_assets: number;
  cash_and_equivalents: number;
  inventory: number;
  current_investments: number;
  trade_and_non_trade_receivables: number;
  non_current_assets: number;
  property_plant_and_equipment: number;
  goodwill_and_intangible_assets: number;
  investments: number;
  non_current_investments: number;
  outstanding_shares: number;
  tax_assets: number;
  total_liabilities: number;
  current_liabilities: number;
  current_debt: number;
  trade_and_non_trade_payables: number;
  deferred_revenue: number;
  deposit_liabilities: number;
  non_current_liabilities: number;
  non_current_debt: number;
  tax_liabilities: number;
  shareholders_equity: number;
  retained_earnings: number;
  accumulated_other_comprehensive_income: number;
  total_debt: number;
}

export interface BalanceSheetsResponse {
  balance_sheets: BalanceSheet[];
}

/**
 * ----------------------------------------------------
 * --------- /financials/cash-flow-statements ---------
 * ----------------------------------------------------
 */
export interface CashFlowStatement {
  ticker: string;
  calendar_date: string;
  report_period: string;
  period: "quarterly" | "ttm" | "annual";
  net_cash_flow_from_operations: number;
  depreciation_and_amortization: number;
  share_based_compensation: number;
  net_cash_flow_from_investing: number;
  capital_expenditure: number;
  business_acquisitions_and_disposals: number;
  investment_acquisitions_and_disposals: number;
  net_cash_flow_from_financing: number;
  issuance_or_repayment_of_debt_securities: number;
  issuance_or_purchase_of_equity_shares: number;
  dividends_and_other_cash_distributions: number;
  change_in_cash_and_equivalents: number;
  effect_of_exchange_rate_changes: number;
}

export interface CashFlowStatementsResponse {
  cash_flow_statements: CashFlowStatement[];
}

/**
 * ----------------------------------------------------
 * --------- /prices/snapshot ---------
 * ----------------------------------------------------
 */
export interface Snapshot {
  price: number;
  ticker: string;
  day_change: number;
  day_change_percent: number;
  time: string;
  time_nanoseconds: number;
}

export interface SnapshotResponse {
  snapshot: Snapshot;
}

/* ---------------------------------------------------- */
/**
 * ----------------------------------------------------
 * ------------- /financial-metrics/snapshot ------------
 * ----------------------------------------------------
 */
export interface FinancialMetricsSnapshot {
  ticker: string;
  market_cap: number;
  enterprise_value: number;
  price_to_earnings_ratio: number;
  price_to_book_ratio: number;
  price_to_sales_ratio: number;
  enterprise_value_to_ebitda_ratio: number;
  enterprise_value_to_revenue_ratio: number;
  free_cash_flow_yield: number;
  peg_ratio: number;
  gross_margin: number;
  operating_margin: number;
  net_margin: number;
  return_on_equity: number;
  return_on_assets: number;
  return_on_invested_capital: number;
  asset_turnover: number;
  inventory_turnover: number;
  receivables_turnover: number;
  days_sales_outstanding: number;
  operating_cycle: number;
  working_capital_turnover: number;
  current_ratio: number;
  quick_ratio: number;
  cash_ratio: number;
  operating_cash_flow_ratio: number;
  debt_to_equity: number;
  debt_to_assets: number;
  interest_coverage: number;
  revenue_growth: number;
  earnings_growth: number;
  book_value_growth: number;
  earnings_per_share_growth: number;
  free_cash_flow_growth: number;
  operating_income_growth: number;
  ebitda_growth: number;
  payout_ratio: number;
  earnings_per_share: number;
  book_value_per_share: number;
  free_cash_flow_per_share: number;
}

export interface FinancialMetricsSnapshotResponse {
  snapshot: FinancialMetricsSnapshot;
}

/* ---------------------------------------------------- */
/**
 * ----------------------------------------------------
 * --------------- /financials/search -----------------
 * ----------------------------------------------------
 */

export interface FinancialsSearchFilter {
  field: string; // e.g., "revenue", "total_debt", "capital_expenditure"
  operator: "eq" | "gt" | "gte" | "lt" | "lte";
  value: number;
}

export interface FinancialsSearchRequestBody {
  filters: FinancialsSearchFilter[];
  period?: "annual" | "quarterly" | "ttm";
  limit?: number;
  order_by?: string; // e.g., "ticker", "-ticker", "report_period", "-report_period"
  currency?: "USD" | "EUR" | "GBP" | "JPY" | "CHF" | "AUD" | "CAD" | "SEK";
  historical?: boolean;
}

// Using a flexible structure for search results as fields can vary
export interface FinancialsSearchResult extends Record<string, string | number | undefined> {
  ticker: string;
  report_period: string;
  period: "annual" | "quarterly" | "ttm";
  // Other fields like 'revenue', 'capital_expenditure' will be present based on query context
}

export interface FinancialsSearchResponse {
  search_results: FinancialsSearchResult[];
}

/* ---------------------------------------------------- */
