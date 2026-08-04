.PHONY: install page-loader test

install:
	npm ci

publish:
	npm publish --dry-run

make lint:
	npx eslint .

page-loader:
	node bin/pageLoaderComand.js

test:
	npm test