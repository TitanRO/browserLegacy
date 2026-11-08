/**
 * Emscripten's debug glue (the vendored wasmoon build of Lua) defines getters on globalThis that only report a
 * symbol the build left out. Their closures hold the module that defined them, so the first Lua state's wasm memory
 * (the databases' state, tens of MB) stayed alive after the state was closed. This runs a module's set-up and removes
 * the getters it added or replaced; nothing reads them.
 *
 * @param {() => Promise<T>} create
 * @returns {Promise<T>}
 * @template T
 */
export async function withoutAddedGlobalGetters(create) {
	const before = new Map(
		Object.getOwnPropertyNames(globalThis).map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)])
	);
	try {
		return await create();
	} finally {
		for (const name of Object.getOwnPropertyNames(globalThis)) {
			const now = Object.getOwnPropertyDescriptor(globalThis, name);
			const was = before.get(name);
			if (now && now.get && !now.set && now.configurable && (!was || was.get !== now.get)) {
				delete globalThis[name];
			}
		}
	}
}
