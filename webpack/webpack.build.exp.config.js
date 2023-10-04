const merge = require('webpack-merge');
const WebpackCdnPlugin = require('webpack-cdn-plugin');
const baseConfig = require('./webpack.base.config.js');

module.exports = merge(baseConfig('exp', false), {
	plugins: [
		new WebpackCdnPlugin({
			modules: [{ name: 'xlsx-populate', var: 'XlsxPopulate', path: 'browser/xlsx-populate.js' }],
			publicPath: '/node_modules'
		})
	]
});
