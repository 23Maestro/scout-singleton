import { runSeleniumPlayerSearch, SeleniumSearchResult } from '../lib/selenium-runner';

export interface PlayerSearchResult {
  playerId?: string;
  profileUrl?: string;
  athleteName?: string;
  sport?: string;
  gradYear?: string;
  city?: string;
  state?: string;
  highSchool?: string;
  positions?: string;
}

export async function findPlayerIdsByName(athleteName: string): Promise<PlayerSearchResult[]> {
  try {
    const results = await runSeleniumPlayerSearch(athleteName);

    // Convert SeleniumSearchResult to PlayerSearchResult
    return results.map((result: SeleniumSearchResult) => ({
      playerId: result.playerId,
      profileUrl: result.profileUrl,
      athleteName: result.athleteName,
      sport: result.sport,
      gradYear: result.gradYear,
      city: result.city,
      state: result.state,
      highSchool: result.highSchool,
      positions: result.positions,
    }));
  } catch (error) {
    throw new Error(`Selenium player search failed: ${error}`);
  }
}

export async function resolvePlayerIdentity(
  athleteName: string,
): Promise<PlayerSearchResult | null> {
  try {
    const results = await findPlayerIdsByName(athleteName);

    // Return the first match, or null if no matches
    return results.length > 0 ? results[0] : null;
  } catch (error) {
    console.error(`Failed to resolve player identity for "${athleteName}":`, error);
    return null;
  }
}
