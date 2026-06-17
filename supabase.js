// ============================================
// SUPABASE LEADERBOARD MODULE
// Credentials are loaded from config.js (gitignored).
// Copy config.example.js → config.js and fill in your values.
// ============================================

import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

let supabase = null;

/**
 * Initialize the Supabase client.
 * Call once on page load.
 */
export function initSupabase() {
	if (supabase) return supabase;
	try {
		supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
	} catch (err) {
		console.warn("Supabase init failed — leaderboard will be offline.", err);
	}
	return supabase;
}

/**
 * Submit a score to the leaderboard table.
 * @param {string} username
 * @param {number} score
 * @returns {Promise<boolean>} true on success
 */
export async function submitScore(username, score) {
	if (!supabase) return false;
	try {
		const { error } = await supabase
			.from("leaderboard")
			.insert([{ username, score }]);
		if (error) {
			console.warn("Score submit error:", error.message);
			return false;
		}
		return true;
	} catch (err) {
		console.warn("Score submit failed:", err);
		return false;
	}
}

/**
 * Fetch the top N scores from the leaderboard.
 * @param {number} limit — default 10
 * @returns {Promise<Array>} sorted array of { username, score, created_at }
 */
export async function getTopScores(limit = 10) {
	if (!supabase) return [];
	try {
		const { data, error } = await supabase
			.from("leaderboard")
			.select("username, score, created_at")
			.order("score", { ascending: false })
			.limit(limit);
		if (error) {
			console.warn("Leaderboard fetch error:", error.message);
			return [];
		}
		return data || [];
	} catch (err) {
		console.warn("Leaderboard fetch failed:", err);
		return [];
	}
}

/**
 * Get a specific player's personal best score.
 * @param {string} username
 * @returns {Promise<number|null>}
 */
export async function getPlayerBest(username) {
	if (!supabase) return null;
	try {
		const { data, error } = await supabase
			.from("leaderboard")
			.select("score")
			.eq("username", username)
			.order("score", { ascending: false })
			.limit(1);
		if (error || !data || data.length === 0) return null;
		return data[0].score;
	} catch (err) {
		console.warn("Personal best fetch failed:", err);
		return null;
	}
}
