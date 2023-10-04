#!/bin/bash -x
# Rebuild native module, cleanup, and launch
#rm -rf node_modules/stt* && git checkout -- package-lock.json && npm install && node_modules/.bin/electron-rebuild && npm run dev
rm -rf node_modules/stt* && rm -f package-lock.json && npm install && node_modules/.bin/electron-rebuild && npm run dev
