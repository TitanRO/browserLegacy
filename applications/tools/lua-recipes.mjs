/* global process, console */
// Writes lua-recipes.json next to the built client (Dockerfile.titanro): the Lua tables TitanRO's client-sync builder
// records for this client (DB/LuaRecipes.js prebuiltRecipes), each with its recipe, recipe hash, files and the path
// of its recording, so the builder runs exactly this client's Lua.
//
// usage: node applications/tools/lua-recipes.mjs <out.json>
import fs from 'node:fs';
import { prebuiltRecipes, recipeHash, recordingPath, RECORDING_FORMAT } from '../../src/DB/LuaRecipes.js';

const out = process.argv[2];
if (!out) {
	console.error('usage: node applications/tools/lua-recipes.mjs <out.json>');
	process.exit(2);
}
const recipes = prebuiltRecipes().map(({ recipe, files, fetch }) => ({
	hash: recipeHash(recipe),
	callbacks: recipe.callbacks,
	keep: recipe.keep || [],
	driver: recipe.driver,
	files,
	fetch: fetch || files,
	path: recordingPath(recipe, files)
}));
fs.writeFileSync(out, JSON.stringify({ format: RECORDING_FORMAT, recipes }));
console.log(`${out}: ${recipes.length} recipes`);
