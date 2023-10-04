const path = require('path');
const merge = require('webpack-merge');
const { spawn } = require('child_process');
const baseConfig = require('./webpack.base.config.js');

// Config directories
const OUTPUT_DIR = path.resolve(__dirname, '../dist');

module.exports = merge(baseConfig('electron', true), {
	devServer: {
		contentBase: OUTPUT_DIR,
		before() {
			spawn('electron', ['.', '--remote-debugging-port=9222'], { shell: true, env: process.env, stdio: 'inherit' })
				.on('close', code => process.exit(0))
				.on('error', spawnError => console.error(spawnError));
		}
	}
});
