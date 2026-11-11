/**
 * DB/LuaRecipes.js
 *
 * The Lua the client runs to read its Lua tables (a "recipe": the callbacks it calls and its driver code), shared by
 * the client (DB/LuaRecipeRunner.js) and TitanRO's client-sync builder (sysops grfhost/luatables-json.mjs, which
 * reads them from lua-recipes.json next to the client).
 *
 * The builder runs a recipe on the server, in the same Lua 5.1, with recorders in place of the callbacks, and writes
 * the calls it made (SystemEN/luatables/<recipe hash>/<files>.json). The client replays those calls into its own
 * callbacks, in short slices, instead of running the Lua on the page's main thread; a recording is used only for the
 * very bytes it was made from and the very recipe, else the client runs the Lua as before.
 *
 * Pure data and string functions: no imports, so the builder can load it as it is.
 */

/** The recording format the client reads. */
export const RECORDING_FORMAT = 1;

/**
 * loadLuaValue's driver: a Lua value as JSON, through extractValue(json).
 */
const TO_JSON = String.raw`
							local function escape_str(str)
								return str:gsub("\\", "\\\\"):gsub("\"", "\\\"")
							end

							local function to_json(value)
								if type(value) == "boolean" then
									return tostring(value)
								elseif type(value) == "number" then
									return value
								elseif type(value) == "string" then
									return "\"" .. escape_str(value) .. "\""
								elseif type(value) == "table" then
									-- pairs() visits keys in no set order, so count them rather than
									-- expect 1, 2, 3...: an array is keys 1..n with none missing
									local is_array = true
									local count, highest = 0, 0
									for k, _ in pairs(value) do
										if type(k) ~= "number" or k < 1 or k % 1 ~= 0 then
											is_array = false
											break
										end
										count = count + 1
										highest = math.max(highest, k)
									end
									is_array = is_array and count == highest

									local result = {}
									if is_array then
										for _, v in ipairs(value) do
											table.insert(result, to_json(v))
										end
										return "[" .. table.concat(result, ",") .. "]"
									else
										for k, v in pairs(value) do
											if type(k) == "string" then
												table.insert(result, "\"" .. escape_str(k) .. "\":" .. to_json(v))
											elseif type(k) == "number" then
												table.insert(result, "\"" .. tostring(k) .. "\":" .. to_json(v))
											end
										end
										return "{" .. table.concat(result, ",") .. "}"
									end
								else
									return "null"
								end
							end
						`;

/**
 * A recipe: the callbacks its driver calls (in this order: a recording names them by index), its driver, and the files
 * whose execution the client keeps even when it replays (keep: indices; files that define globals later Lua needs).
 *
 * @typedef {{callbacks: string[], driver: string, keep?: number[]}} LuaRecipe
 */

/**
 * loadLuaValue: the value of a Lua global, as JSON text.
 *
 * @param {string} variable
 * @returns {LuaRecipe}
 */
export function valueRecipe(variable) {
	return {
		callbacks: ['extractValue'],
		driver:
			TO_JSON +
			`
							extractValue(to_json(${variable}))
						`
	};
}

/**
 * loadLuaTable: an id file (enums the next files and loaders use: kept) and a value table read key by key.
 *
 * @param {string} tableName
 * @returns {LuaRecipe}
 */
export function tableRecipe(tableName) {
	return {
		callbacks: ['addKeyAndValueToTable', 'addKeyAndMoreValuesToTable'],
		keep: [0],
		driver: `
						function main_table()
							for key, value in pairs(${tableName}) do
								if type(value) == "table" then
									for k, v in pairs(value) do
										result, msg = addKeyAndMoreValuesToTable(key, v)
									end
								else
									result, msg = addKeyAndValueToTable(key, value)
								end
								if not result then
									return false, msg
								end
							end
							return true, "good"
						end
						main_table()
					`
	};
}

/** loadQuestInfo: System/OngoingQuestInfoList*.lub, SystemEN/OngoingQuests.lub. */
export const QUEST_RECIPE = {
	callbacks: ['AddQuestInfo', 'AddQuestDescription', 'AddQuestRewardItem'],
	driver: `
					function main_quest()
					-- Check if QuestInfoList is a table and not nil
					if type(QuestInfoList) ~= "table" or QuestInfoList == nil then
						return false, "Error: Quest table is nil or not a table"
					end

					for QuestID, DESC in pairs(QuestInfoList) do
						-- Ensure DESC is a table, use empty table if nil
						DESC = type(DESC) == "table" and DESC or {}

						-- Provide default values for DESC fields if they are nil
						local questData = {
							Title = DESC.Title or "Unknown Quest",
							Summary = DESC.Summary or "Unknown Quest",
							IconName = DESC.IconName or "",
							NpcSpr = DESC.NpcSpr or "",
							NpcNavi = DESC.NpcNavi or "",
							NpcPosX = DESC.NpcPosX or 0,
							NpcPosY = DESC.NpcPosY or 0,
							RewardItemList = DESC.RewardItemList or {},
							RewardEXP = tonumber(DESC.RewardEXP) or 0,
							RewardJEXP = tonumber(DESC.RewardJEXP) or 0,

							Description = type(DESC.Description) == "table" and DESC.Description or {}
						}

						result, msg = AddQuestInfo(QuestID, questData.Title, questData.Summary, questData.IconName, 
												questData.NpcSpr, questData.NpcNavi, questData.NpcPosX, 
												questData.NpcPosY, questData.RewardEXP, 
												questData.RewardJEXP)
						if not result then
							return false, msg
						end

						-- Iterate over RewardItemList table, use empty table if nil
						for k, v in pairs(questData.RewardItemList) do
							result, msg = AddQuestRewardItem(QuestID, v.ItemID, v.ItemNum)
							if not result then
								return false, msg
							end
						end

						-- Iterate over Description table, use empty table if nil
						for k, v in pairs(questData.Description) do
							result, msg = AddQuestDescription(QuestID, v or "No description available")
							if not result then
								return false, msg
							end
						end
					end
					return true, "good"
				end

				main_quest()
					`
};

/** loadLaphineSysFile: lapineddukddakbox.lub. */
export const LAPHINE_SYS_RECIPE = {
	callbacks: ['AddLaphineSysItem', 'AddLaphineSysSourceItem'],
	driver: `
						function main_laphynesys()
                            for key, value in pairs(tblLapineDdukddakBox.sources) do
                                result, msg = AddLaphineSysItem(key, value.ItemID, value.NeedCount, value.NeedRefineMin, value.NeedRefineMax, value.NeedSource_String)
                                if not result then
                                    return false, msg
                                end
                                for _, item in ipairs(value.SourceItems) do
                                    result, msg = AddLaphineSysSourceItem(key, item[1], item[2], item[3])
                                    if not result then
                                        return false, msg
                                    end

                                end
                            end
                        end
                        main_laphynesys()
					`
};

/** loadLaphineUpgFile: lapineupgradebox.lub. */
export const LAPHINE_UPG_RECIPE = {
	callbacks: ['AddLaphineUpgradeItem', 'AddLaphineUpgradeTargetItem'],
	driver: `
						function main_laphyneupg()
                            for key, value in pairs(tblLapineUpgradeBox.targets) do
                                result, msg = AddLaphineUpgradeItem(key, value.ItemID, value.NeedCount, value.NeedRefineMin, value.NeedRefineMax, value.NeedSource_String, value.NeedOptionNumMin, value.NotSocketEnchantItem)
                                if not result then
                                    return false, msg
                                end
                                for _, item in ipairs(value.TargetItems) do
                                    result, msg = AddLaphineUpgradeTargetItem(key, item[1], item[2])
                                    if not result then
                                        return false, msg
                                    end

                                end
                            end
                        end
                        main_laphyneupg()
					`
};

/** loadItemDBTable: ItemDBNameTbl.lub. */
export const ITEMDB_NAME_RECIPE = {
	callbacks: ['AddDBItemName'],
	driver: `
						function main_itemDBTable()
                            for key, value in pairs(ItemDBNameTbl) do
                                result, msg = AddDBItemName(key, value)
                                if not result then
                                    return false, msg
                                end
                        	end
						end
                        main_itemDBTable()
					`
};

/** loadItemReformFile: ItemReformSystem.lub. */
export const ITEM_REFORM_RECIPE = {
	callbacks: ['AddReformInfo', 'ReformInfoAddInformationString', 'ReformInfoAddMaterial', 'AddReformItem'],
	driver: `
						function main_itemReform()
							for key, value in pairs(ReformInfo) do
								result, msg = AddReformInfo(key, value.BaseItem, value.ResultItem, value.NeedRefineMin, value.NeedRefineMax, value.NeedOptionNumMin, value.IsEmptySocket, value.ChangeRefineValue, value.RandomOptionCode, value.PreserveSocketItem, value.PreserveGrade)
								if not result then
									return false, msg
								end
								if type(value.InformationString) == "table" then
									for _, info in pairs(value.InformationString) do
										result, msg = ReformInfoAddInformationString(key, info)
										if not result then
											return false, msg
										end
									end
								end
								if type(value.Material) == "table" then
									for material, quantity in pairs(value.Material) do
										result, msg = ReformInfoAddMaterial(key, material, quantity)
										if not result then
											return false, msg
										end
									end
								end
							end
							for key, itemList in pairs(ReformItemList) do
								for index, value in ipairs(itemList) do
									result, msg = AddReformItem(key, value)
									if not result then
										return false, msg
									end
								end
							end
						end
                        main_itemReform()
					`
};

/**
 * A short hash of a recipe (FNV-1a, 32 bits, hex): which driver a recording was made with.
 *
 * @param {LuaRecipe} recipe
 * @returns {string}
 */
export function recipeHash(recipe) {
	const text = recipe.callbacks.join(',') + '\0' + (recipe.keep || []).join(',') + '\0' + recipe.driver;
	let h = 0x811c9dc5;
	for (let i = 0; i < text.length; i++) {
		h ^= text.charCodeAt(i);
		h = Math.imul(h, 0x01000193) >>> 0;
	}
	return h.toString(16).padStart(8, '0');
}

/**
 * Where a recording of a recipe over these files is (relative to the remote client, so a language pack's own).
 *
 * @param {LuaRecipe} recipe
 * @param {string[]} files - The Lua files, in the order the recipe runs them.
 * @returns {string}
 */
export function recordingPath(recipe, files) {
	const name = files.map(f => f.replace(/[^A-Za-z0-9._-]+/g, '_')).join('+');
	return `SystemEN/luatables/${recipeHash(recipe)}/${name}.json`;
}

const LUA = 'data/luafiles514/lua files/';
const QUEST_FILES = ['', '_true', '_sak', '_Sakray'].flatMap(s => [
	`System/OngoingQuestInfoList${s}.lub`,
	`System/OngoingQuestInfoList${s}.lua`
]);

/**
 * What the builder records: the recipes and files of the tables that cost the most main-thread time to run. A file
 * that doesn't exist is skipped. files: the names the loader mounts them under (a recording's key); fetch: where they
 * are fetched from, when not there.
 *
 * @returns {Array<{recipe: LuaRecipe, files: string[], fetch?: string[]}>}
 */
export function prebuiltRecipes() {
	const navi = [
		['navi_map_krpri', 'Navi_Map'],
		['navi_mob_krpri', 'Navi_Mob'],
		['navi_npc_krpri', 'Navi_Npc'],
		['navi_link_krpri', 'Navi_Link'],
		['navi_linkdistance_krpri', 'Navi_Distance'],
		['navi_npcdistance_krpri', 'Navi_NpcDistance']
	].map(([file, variable]) => ({ recipe: valueRecipe(variable), files: [`${LUA}navigation/${file}.lub`] }));
	const tables = [
		[['datainfo/accessoryid.lub', 'datainfo/accname.lub'], 'AccNameTable'],
		[['datainfo/spriterobeid.lub', 'datainfo/spriterobename.lub'], 'RobeNameTable'],
		[['datainfo/npcidentity.lub', 'datainfo/jobname.lub'], 'JobNameTable'],
		[['datainfo/enumvar.lub', 'datainfo/addrandomoptionnametable.lub'], 'NameTable_VAR'],
		[['skillinfoz/skillid.lub', 'skillinfoz/skilldescript.lub'], 'SKILL_DESCRIPT']
	].map(([files, name]) => ({ recipe: tableRecipe(name), files: files.map(f => LUA + f) }));
	const quests = [...QUEST_FILES, 'SystemEN/OngoingQuests.lub'].map(f => ({ recipe: QUEST_RECIPE, files: [f] }));
	// loaders that mount their file under its bare name (files), fetched from its path (fetch)
	const named = [
		[LAPHINE_SYS_RECIPE, 'datainfo/lapineddukddakbox.lub'],
		[LAPHINE_UPG_RECIPE, 'datainfo/lapineupgradebox.lub'],
		[ITEMDB_NAME_RECIPE, 'ItemDBNameTbl.lub'],
		[ITEM_REFORM_RECIPE, 'ItemReform/ItemReformSystem.lub']
	].map(([recipe, file]) => ({ recipe, files: [file.split('/').pop()], fetch: [LUA + file] }));
	return [...navi, ...tables, ...quests, ...named];
}
