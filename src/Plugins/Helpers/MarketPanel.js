/**
 * Plugins/Helpers/MarketPanel.js
 *
 * The vending search panel (Build-in roadmap feature 8): every open player shop selling or buying an item, and its
 * median sale price over 7 and 30 days, from the account service's public market data (src/publicData.ts in
 * TitanRO/account-service; the same as play.titanro.net/market.html). The Windows client opens the game's own shop
 * search window instead (@market). On unless the player turns it off (helper setting vendingSearch.enabled).
 *
 * @author Trojal
 */

const MAX_ROWS = 12;

const zeny = n => (n == null ? '-' : Number(n).toLocaleString('en-US'));

/**
 * @param {object} options
 * @param {string} options.accountApi - e.g. https://account-api.titanro.net
 * @param {function} [options.fetch]
 */
export function marketPanel({ accountApi, fetch: fetchFn }) {
	const doFetch = fetchFn || ((...args) => globalThis.fetch(...args));
	const get = path =>
		doFetch(accountApi + path).then(r =>
			r.json().then(body => {
				if (!r.ok) throw new Error((body.error && body.error.message) || 'HTTP ' + r.status);
				return body;
			})
		);

	return {
		id: 'market',
		title: 'Vending search',
		width: 300,
		enabled: ['vendingSearch', 'enabled'],
		mount(body) {
			body.innerHTML =
				'<form class="market-search"><input class="q" placeholder="item name or id" style="width:200px"> ' +
				'<button>Search</button></form>' +
				'<div class="summary hint"></div>' +
				'<table class="offers"></table>';
			const form = body.querySelector('form');
			const input = body.querySelector('.q');
			const summary = body.querySelector('.summary');
			const table = body.querySelector('.offers');
			// Keys typed here are the search's, not the game's shortcuts
			input.addEventListener('keydown', event => event.stopPropagation());

			form.addEventListener('submit', event => {
				event.preventDefault();
				const q = input.value.trim();
				if (q.length < 2 && !/^\d+$/.test(q)) {
					summary.textContent = 'At least 2 letters or an item id.';
					return;
				}
				summary.textContent = 'Searching...';
				table.textContent = '';
				get('/v1/public/market?q=' + encodeURIComponent(q))
					.then(r => {
						const names = new Map(r.items.concat(r.cards).map(i => [i.id, i.name]));
						for (const o of r.offers.slice(0, MAX_ROWS)) {
							const tr = document.createElement('tr');
							const cards = o.cards.filter(c => c > 0).map(c => names.get(c) || '#' + c);
							const label =
								(o.refine ? '+' + o.refine + ' ' : '') +
								(names.get(o.itemId) || '#' + o.itemId) +
								(cards.length ? ' [' + cards.join(', ') + ']' : '');
							for (const [text, cls] of [
								[label, ''],
								[o.kind === 'sell' ? 'sells' : 'buys', ''],
								[zeny(o.price) + ' z', 'value'],
								[o.map + ' ' + o.x + ',' + o.y, '']
							]) {
								const td = document.createElement('td');
								td.textContent = text;
								if (cls) td.className = cls;
								tr.append(td);
							}
							tr.title = `${o.shop} (${o.owner}), ${o.amount} available`;
							table.append(tr);
						}
						let text = r.items.length
							? `${r.offers.length} offer${r.offers.length === 1 ? '' : 's'}`
							: 'No item matches.';
						if (r.offers.length > MAX_ROWS)
							text += ` (first ${MAX_ROWS}; all on play.titanro.net/market.html)`;
						summary.textContent = text;
						if (r.items.length === 1) {
							return get('/v1/public/market/history/' + r.items[0].id).then(h => {
								summary.textContent +=
									` | median ${zeny(h.median7)} z (7 days, ${h.sales7} sales),` +
									` ${zeny(h.median30)} z (30 days, ${h.sales30})`;
							});
						}
						return null;
					})
					.catch(err => {
						summary.textContent = err.message;
					});
			});
			return {};
		}
	};
}
