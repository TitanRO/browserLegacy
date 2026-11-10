/**
 * The site pages' game data: TitanRO's game data API (titanro-api, GraphQL at api.titanro.net), for signed-in players. The pages load Clerk's
 * browser SDK from TitanRO's Clerk instance and send its session token (a short-lived JWT the API checks with Clerk's
 * public keys) with each query. A player signed in on the play page is signed in here too (the same Clerk session).
 *
 * window.TitanROData.query(gql, variables) resolves to the query's data, or rejects with an Error whose
 * `signIn` is true when the player has to sign in first. window.TitanROData.signIn() opens Clerk's sign-in.
 *
 * ?api= overrides the API (testing).
 */
(function () {
	'use strict';
	var API = new URLSearchParams(location.search).get('api') || 'https://api.titanro.net';
	var CLERK_FRONTEND = 'https://clerk.titanro.net';
	// The publishable key names the Frontend API (base64 of "clerk.titanro.net$"); it's public by design.
	var PUBLISHABLE_KEY = 'pk_live_' + btoa('clerk.titanro.net$');

	var clerkReady = null;
	function loadClerk() {
		if (clerkReady) return clerkReady;
		clerkReady = new Promise(function (resolve, reject) {
			var s = document.createElement('script');
			s.async = true;
			s.crossOrigin = 'anonymous';
			s.src = CLERK_FRONTEND + '/npm/@clerk/clerk-js@5/dist/clerk.browser.js';
			s.setAttribute('data-clerk-publishable-key', PUBLISHABLE_KEY);
			s.onload = function () {
				window.Clerk.load().then(function () { resolve(window.Clerk); }, reject);
			};
			s.onerror = function () { reject(new Error('Sign-in could not load; reload the page to try again.')); };
			document.head.appendChild(s);
		});
		return clerkReady;
	}

	function needSignIn() {
		var e = new Error('Sign in to search the game data.');
		e.signIn = true;
		return e;
	}

	function query(gql, variables) {
		return loadClerk().then(function (clerk) {
			if (!clerk.session) throw needSignIn();
			return clerk.session.getToken();
		}).then(function (token) {
			if (!token) throw needSignIn();
			return fetch(API + '/graphql', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
				body: JSON.stringify({ query: gql, variables: variables || {} })
			});
		}).then(function (r) {
			if (r.status === 401) throw needSignIn();
			return r.json();
		}).then(function (body) {
			if (body.errors && body.errors.length) {
				var first = body.errors[0];
				var e = new Error(first.message);
				if (first.extensions && first.extensions.code === 'UNAUTHENTICATED') e.signIn = true;
				throw e;
			}
			return body.data;
		});
	}

	function signIn() {
		return loadClerk().then(function (clerk) {
			clerk.redirectToSignIn({ redirectUrl: location.href });
		});
	}

	/** Shows an error in `note`; for a sign-in error, with a button that signs in. */
	function showError(note, e) {
		note.textContent = e.message + ' ';
		note.className = 'error';
		if (e.signIn) {
			var b = document.createElement('button');
			b.textContent = 'Sign in';
			b.addEventListener('click', signIn);
			note.appendChild(b);
		}
	}

	window.TitanROData = { query: query, signIn: signIn, showError: showError };
})();
