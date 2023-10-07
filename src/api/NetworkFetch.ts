import CONFIG from "./CONFIG";

export class NetworkFetch {
	// A proxy is necessary for the browser-based app to avoid STT CORS/CORB issues
	private _urlProxy: string | undefined = undefined;

	setProxy(urlProxy: string): void {
		this._urlProxy = urlProxy;
	}

	_weirdUrlify(form: any): string {
		// Arrays on DB's severs don't work with the usual "ids=1,2", they need the special "ids[]=1&ids[]=2" form
		let searchParams: URLSearchParams = new URLSearchParams();
		for (const prop of Object.keys(form)) {
			if (Array.isArray(form[prop])) {
				form[prop].forEach((entry: any): void => {
					searchParams.append(prop + '[]', entry);
				});
			}
			else {
				searchParams.set(prop, form[prop]);
			}
		}

		return searchParams.toString();
	}

	async post(uri: string, form: any, bearerToken: string | undefined = undefined, getjson: boolean = true): Promise<any> {
		let headers: any = {
			"Content-type": "application/x-www-form-urlencoded; charset=UTF-8"
		};

		if (bearerToken !== undefined) {
			headers.Authorization = "Bearer " + btoa(bearerToken);
		}

		//const nodeFetch = require('electron').remote.require('node-fetch');

		let response = await window.fetch(uri, {
			method: "post",
			headers: headers,
			body: this._weirdUrlify(form)
		});

		if (response.ok) {
			if (getjson) {
				return response.json();
			} else {
				return response.text();
			}
		} else {
			let data = await response.text();
			throw new Error(`Network error; status ${response.status}; reply ${data}.`);
		}
	}

	async get(uri: string, qs: any, json: boolean = true): Promise<any> {
		let response;
		if (qs) {
			response = await window.fetch(uri + "?" + this._weirdUrlify(qs));
		} else {
			response = await window.fetch(uri);
		}

		if (response.ok) {
			if (json) {
				return response.json();
			} else {
				return response.text();
			}
		} else {
			let data = await response.text();
			throw new Error(`Network error; status ${response.status}; reply ${data}.`);
		}
	}

	async get_proxy(uri: string, qs: any, json: boolean = true) : Promise<any> {
		if (!this._urlProxy) {
			return this.get(uri, qs, json);
		} else {
			let response = await this.postjson(this._urlProxy + '/get', {origURI: uri, qs});

			if (response.ok) {
				if (json) {
					return response.json();
				}
				return response.text();
			} else {
				let data = await response.text();
				throw new Error(`Network error; status ${response.status}; reply ${data}.`);
			}
		}
	}

	async post_proxy(uri: string, form: any, bearerToken?: string): Promise<any> {
		if (!this._urlProxy) {
			return this.post(uri, form, bearerToken);
		} else {
			let response = await this.postjson(this._urlProxy + '/post', {origURI: uri, form, bearerToken});

			if (response.ok) {
				return response.json();
			} else {
				let data = await response.text();
				throw new Error(`Network error; status ${response.status}; reply ${data}.`);
			}
		}
	}

	async postjson(uri: string, form: any): Promise<any> {
		let headers: any = {
			"Content-type": "application/json"
		};

		let response = await window.fetch(uri, {
			method: "post",
			headers: headers,
			body: JSON.stringify(form)
		});

		return response;
	}

	async getRaw(uri: string, qs: any): Promise<ArrayBuffer> {
		// TODO: this should not be in here (networkfetch should be agnostic of its callers)
		let headers: any = {
			'Origin': CONFIG.URL_SERVER,
			'Referer': CONFIG.URL_SERVER,
			'Accept': '*/*',
			'Accept-Encoding': 'gzip, deflate, br'
		};

		let response = await window.fetch(uri, {
			method: "get",
			headers: headers
		});

		if (response.ok) {
			return response.arrayBuffer();
		} else {
			let data = await response.text();
			throw new Error(`Network error; status ${response.status}; reply ${data}.`);
		}
	}
}
